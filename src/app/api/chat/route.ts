import {
  convertToModelMessages,
  createIdGenerator,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
} from "ai";
import { z } from "zod";
import { HttpError, apiUser, parseBody, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { buildInstructions } from "@/lib/chat/prompt";
import { ensureChat, loadMessages, saveMessages, updateChat } from "@/lib/chat/store";
import { titleChat } from "@/lib/chat/title";
import { buildTools } from "@/lib/chat/tools";
import { retrieve, type Retrieval } from "@/lib/chat/retrieval";
import {
  messageText,
  type ChatMessage,
  type ChatMetadata,
  type KnowledgeScope,
} from "@/lib/chat/types";
import { env } from "@/lib/env";
import { getLocale } from "@/lib/i18n/server";
import { ModelUnavailableError, resolveChatModel } from "@/lib/providers/registry";
import { getSettings } from "@/lib/settings";

export const maxDuration = 300;

const bodySchema = z.object({
  id: z.string().uuid(),
  message: z.object({
    id: z.string().min(1).max(100),
    role: z.literal("user"),
    parts: z.array(z.any()).min(1),
  }),
  trigger: z.enum(["submit-message", "regenerate-message"]).default("submit-message"),
  model: z.string().max(200).optional(),
  knowledge: z
    .discriminatedUnion("scope", [
      z.object({ scope: z.literal("none") }),
      z.object({ scope: z.literal("all") }),
      z.object({ scope: z.literal("kb"), kbId: z.string().uuid() }),
    ])
    .optional(),
});

/** Conversation the model should see for this request. */
function nextConversation(
  previous: ChatMessage[],
  message: ChatMessage,
  trigger: "submit-message" | "regenerate-message",
): ChatMessage[] {
  const idx = previous.findIndex((m) => m.id === message.id);
  if (idx >= 0) {
    // Edited or regenerated message: everything after it is replaced.
    return [...previous.slice(0, idx), message];
  }
  if (trigger === "regenerate-message") {
    const lastUser = previous.findLastIndex((m) => m.role === "user");
    return previous.slice(0, lastUser + 1);
  }
  return [...previous, message];
}

function friendlyError(error: unknown): string {
  if (error instanceof ModelUnavailableError) return error.message;
  const msg = error instanceof Error ? error.message : String(error);
  console.error("[chat] stream error:", msg);
  if (/401|unauthori[sz]ed|invalid.*key|api key/i.test(msg)) {
    return "The model provider rejected the credentials. Please ask an administrator to check the API key.";
  }
  if (/ECONNREFUSED|fetch failed|ENOTFOUND/i.test(msg)) {
    return "The model server is not reachable. Please ask an administrator to check the provider connection.";
  }
  if (/429|rate limit|quota/i.test(msg)) {
    return "The model provider is rate limiting requests. Please try again in a moment.";
  }
  return "The model could not answer this request. Please try again.";
}

export const POST = route(async (req: Request) => {
  const user = await apiUser();
  const body = await parseBody(req, bodySchema);

  const chat = await ensureChat(body.id, user.id);
  if (!chat) throw new HttpError(404, "Chat not found");

  const previous = await loadMessages(chat.id);
  const messages = nextConversation(previous, body.message as ChatMessage, body.trigger);
  const lastUser = messages.findLast((m) => m.role === "user");
  if (!lastUser) throw new HttpError(400, "No user message");

  const modelKey = body.model ?? chat.model_key ?? undefined;
  let resolved;
  try {
    resolved = await resolveChatModel(modelKey);
  } catch (err) {
    if (err instanceof ModelUnavailableError) throw new HttpError(503, err.message);
    throw err;
  }
  const { model, option } = resolved;

  const [settings, locale] = await Promise.all([getSettings(), getLocale()]);

  const knowledge: KnowledgeScope =
    body.knowledge ??
    (chat.knowledge_scope === "kb" && chat.knowledge_base_id
      ? { scope: "kb", kbId: chat.knowledge_base_id }
      : { scope: chat.knowledge_scope === "all" ? "all" : "none" });

  // Persist the user's turn before streaming so it survives provider errors.
  await saveMessages(chat.id, messages);
  await updateChat(chat.id, user.id, {
    model_key: option.key,
    knowledge_scope: knowledge.scope,
    knowledge_base_id: knowledge.scope === "kb" ? knowledge.kbId : null,
  });

  let retrieval: Retrieval | null = null;
  try {
    retrieval = await retrieve(user, knowledge, messages);
  } catch (err) {
    // Retrieval problems (embedding API down) degrade to a plain answer.
    console.error("[chat] retrieval failed:", (err as Error).message);
  }

  const tools = buildTools({ user, chatId: chat.id, knowledge });

  const instructions = buildInstructions({
    appName: env().APP_NAME,
    settings,
    user,
    locale,
    knowledge: retrieval ? retrieval.context : undefined,
    tools: Object.keys(tools),
  });

  const result = streamText({
    model,
    instructions,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: isStepCount(5),
    maxRetries: 1,
  });

  const metadata: ChatMetadata = {
    createdAt: Date.now(),
    modelKey: option.key,
    modelLabel: option.label,
    residency: option.residency,
    sources: retrieval?.sources.length ? retrieval.sources : undefined,
  };

  await audit("chat.request", {
    userId: user.id,
    target: chat.id,
    detail: {
      model: option.key,
      residency: option.residency,
      knowledge: knowledge.scope,
      sources: retrieval?.sources.length ?? 0,
    },
  });

  const isFirstExchange = !previous.some((m) => m.role === "assistant");

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      tools,
      originalMessages: messages,
      generateMessageId: createIdGenerator({ prefix: "msg", size: 16 }),
      onError: friendlyError,
      messageMetadata: ({ part }) => {
        if (part.type === "start") return metadata;
        if (part.type === "finish") return { totalTokens: part.totalUsage?.totalTokens };
      },
      onEnd: async ({ messages: finalMessages }) => {
        await saveMessages(chat.id, finalMessages as ChatMessage[]);
        const answer = finalMessages.at(-1);
        if (isFirstExchange && answer?.role === "assistant") {
          void titleChat(chat.id, messageText(lastUser), messageText(answer));
        }
      },
    }),
  });
});
