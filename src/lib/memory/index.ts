import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { getUser } from "@/lib/auth/users";
import { loadMessages } from "@/lib/chat/store";
import { messageText } from "@/lib/chat/types";
import { db } from "@/lib/db";
import { enqueue } from "@/lib/heartbeat/jobs";
import { resolveUtilityModel } from "@/lib/providers/registry";
import { getSetting } from "@/lib/settings";

export type MemoryCategory = "profile" | "preference" | "work" | "other";

export type Memory = {
  id: string;
  content: string;
  category: MemoryCategory;
  source: "auto" | "tool" | "manual";
  created_at: Date;
  updated_at: Date;
};

const MAX_PROMPT_MEMORIES = 40;
const CONSOLIDATE_ABOVE = 30;

export async function memoryActive(userId: string): Promise<boolean> {
  if (!(await getSetting("memory_enabled"))) return false;
  const user = await getUser(userId);
  return Boolean(user?.memory_enabled);
}

export async function listMemories(userId: string): Promise<Memory[]> {
  return db()<Memory[]>`
    SELECT id, content, category, source, created_at, updated_at
      FROM memories WHERE user_id = ${userId} ORDER BY updated_at DESC`;
}

export async function memoriesForPrompt(userId: string): Promise<string[]> {
  if (!(await memoryActive(userId))) return [];
  const rows = await db()<{ content: string }[]>`
    SELECT content FROM memories WHERE user_id = ${userId}
     ORDER BY updated_at DESC LIMIT ${MAX_PROMPT_MEMORIES}`;
  return rows.map((r) => r.content);
}

export async function addMemory(
  userId: string,
  content: string,
  opts: { category?: MemoryCategory; source?: Memory["source"]; chatId?: string | null } = {},
): Promise<string> {
  const [row] = await db()<{ id: string }[]>`
    INSERT INTO memories (user_id, content, category, source, chat_id)
    VALUES (${userId}, ${content.trim().slice(0, 300)}, ${opts.category ?? "other"},
            ${opts.source ?? "manual"}, ${opts.chatId ?? null})
    RETURNING id`;
  return row.id;
}

export async function updateMemory(userId: string, id: string, content: string): Promise<boolean> {
  const res = await db()`
    UPDATE memories SET content = ${content.trim().slice(0, 300)}, updated_at = now()
     WHERE id = ${id} AND user_id = ${userId}`;
  return res.count > 0;
}

export async function deleteMemory(userId: string, id: string): Promise<boolean> {
  const res = await db()`DELETE FROM memories WHERE id = ${id} AND user_id = ${userId}`;
  return res.count > 0;
}

export async function deleteAllMemories(userId: string): Promise<number> {
  return (await db()`DELETE FROM memories WHERE user_id = ${userId}`).count;
}

/**
 * Called after each answer. The job waits a bit so a burst of messages is
 * processed once (the dedupe key collapses repeated requests).
 */
export async function scheduleMemoryUpdate(userId: string, chatId: string): Promise<void> {
  if (!(await memoryActive(userId))) return;
  await enqueue(
    "update_memory",
    { userId, chatId },
    { dedupeKey: `memory:${chatId}`, runAt: new Date(Date.now() + 20_000), maxAttempts: 2 },
  );
}

const RULES = `You maintain a small long-term memory about ONE user of a company AI assistant, so future chats can be more helpful.

Store only durable facts about the user themself, e.g. role, team, office location, projects they work on repeatedly, tools they use, and preferences about language, tone or answer format.

Never store:
- passwords, keys, account numbers or other secrets
- health, religion, political opinions, union membership, sexual orientation, ethnic origin, biometric data or other special categories of personal data (GDPR Art. 9)
- information about other people
- one-off tasks, questions or the content of documents
- anything the user asked not to remember

Write each fact as one short sentence in the user's language, in third person ("Arbeitet im Controlling in Graz."), at most 120 characters. Prefer updating an existing fact over adding a near-duplicate. Delete facts the conversation clearly contradicts. If nothing durable was said, return no operations.`;

const opsSchema = z.object({
  operations: z
    .array(
      z.object({
        op: z.enum(["add", "update", "delete"]),
        id: z.string().optional().describe("Existing memory id, for update and delete"),
        content: z.string().max(200).optional(),
        category: z.enum(["profile", "preference", "work", "other"]).optional(),
      }),
    )
    .max(10),
});

/** The heartbeat job: distill the latest exchange into memory operations. */
export async function updateMemoryFromChat(userId: string, chatId: string): Promise<void> {
  if (!(await memoryActive(userId))) return;
  const utility = await resolveUtilityModel();
  if (!utility) return;

  const messages = (await loadMessages(chatId)).slice(-6);
  const transcript = messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${messageText(m).slice(0, 2000)}`)
    .join("\n\n");
  if (!transcript.trim()) return;

  const existing = await listMemories(userId);
  const known = existing.length
    ? existing.map((m) => `- [${m.id}] ${m.content}`).join("\n")
    : "(none yet)";

  const { output } = await generateText({
    model: utility.model,
    instructions: RULES,
    prompt: `Current memory:\n${known}\n\nLatest conversation:\n${transcript}`,
    output: Output.object({ schema: opsSchema }),
    maxOutputTokens: 800,
  });

  const ids = new Set(existing.map((m) => m.id));
  let changed = 0;
  for (const op of output.operations) {
    if (op.op === "add" && op.content) {
      await addMemory(userId, op.content, { category: op.category, source: "auto", chatId });
      changed++;
    } else if (op.op === "update" && op.id && ids.has(op.id) && op.content) {
      changed += Number(await updateMemory(userId, op.id, op.content));
    } else if (op.op === "delete" && op.id && ids.has(op.id)) {
      changed += Number(await deleteMemory(userId, op.id));
    }
  }
  if (changed) {
    await audit("memory.update", { userId, target: chatId, detail: { operations: changed, source: "auto" } });
  }
}

/**
 * Daily heartbeat task: when a memory grows long, merge duplicates and drop
 * stale entries so the prompt stays small.
 */
export async function consolidateMemories(): Promise<number> {
  const users = await db()<{ user_id: string }[]>`
    SELECT user_id FROM memories WHERE source = 'auto'
     GROUP BY user_id HAVING count(*) > ${CONSOLIDATE_ABOVE}`;
  const utility = users.length ? await resolveUtilityModel() : null;
  if (!utility) return 0;

  let done = 0;
  for (const { user_id } of users) {
    // Only learned facts are rewritten; what users typed themselves stays.
    const existing = (await listMemories(user_id)).filter((m) => m.source === "auto");
    try {
      const { output } = await generateText({
        model: utility.model,
        instructions: `${RULES}\n\nTask now: rewrite the memory list into at most 20 facts. Merge duplicates, keep the most recent version when facts conflict, drop trivia.`,
        prompt: existing.map((m) => `- ${m.content}`).join("\n"),
        output: Output.object({
          schema: z.object({
            facts: z
              .array(z.object({ content: z.string().max(200), category: z.enum(["profile", "preference", "work", "other"]) }))
              .max(20),
          }),
        }),
      });
      if (!output.facts.length) continue;
      await db().begin(async (tx) => {
        await tx`DELETE FROM memories WHERE user_id = ${user_id} AND source = 'auto'`;
        for (const f of output.facts) {
          await tx`
            INSERT INTO memories (user_id, content, category, source)
            VALUES (${user_id}, ${f.content.slice(0, 300)}, ${f.category}, 'auto')`;
        }
      });
      done++;
    } catch (err) {
      console.warn("[memory] consolidation failed:", (err as Error).message);
    }
  }
  return done;
}
