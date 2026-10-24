import "server-only";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { User } from "@/lib/auth/users";
import { createFile } from "@/lib/documents";
import { addMemory } from "@/lib/memory";
import { searchableKbIds } from "@/lib/knowledge";
import { hybridSearch } from "@/lib/rag/search";
import type { KnowledgeScope } from "./types";

export type ToolContext = {
  user: User;
  chatId: string;
  knowledge: KnowledgeScope;
  /** Offer the remember tool (memory enabled for org and user). */
  memory: boolean;
};

/**
 * Tools the model may call. Built per request so each tool only ever acts
 * as the signed-in user, inside their chat and their knowledge scope.
 */
export function buildTools(ctx: ToolContext) {
  const tools = {
    create_document: tool({
      description:
        "Create a downloadable document (PDF, Word/DOCX or Markdown) from Markdown content. Use only when the user asks for a file, document, report, letter or download. Write the complete content; the user sees a download card, so don't repeat the full text in your reply.",
      inputSchema: z.object({
        format: z
          .enum(["pdf", "docx", "md"])
          .default("pdf")
          .describe("pdf for reading/printing, docx for further editing in Word"),
        title: z.string().min(1).max(200),
        markdown: z.string().max(200_000).optional().describe("Body in GitHub-flavored Markdown, without the title"),
        // Small local models often say "content"; accept it instead of failing.
        content: z.string().max(200_000).optional().describe("Alias for markdown"),
      }),
      execute: async ({ format, title, markdown: md, content }) => {
        const markdown = md ?? content;
        if (!markdown?.trim()) throw new Error("markdown is required: pass the document body as Markdown");
        const file = await createFile({
          userId: ctx.user.id,
          chatId: ctx.chatId,
          format,
          title,
          markdown,
          author: ctx.user.name || undefined,
        });
        return file;
      },
    }),

    search_knowledge: tool({
      description:
        "Search the company's internal documents. Use when the provided excerpts don't answer the question or the user asks about something new. Returns numbered excerpts with document titles.",
      inputSchema: z.object({
        query: z.string().min(2).max(500).describe("What to look for, in the language of the documents"),
      }),
      execute: async ({ query }) => {
        const kbIds = await searchableKbIds(
          ctx.user,
          ctx.knowledge.scope === "kb" ? [ctx.knowledge.kbId] : null,
        );
        const hits = await hybridSearch(kbIds, query, 5);
        return hits.map((h, i) => ({
          n: i + 1,
          title: h.title,
          page: h.page,
          excerpt: h.content,
        }));
      },
    }),
  } satisfies ToolSet;

  if (!ctx.memory) return tools;
  return {
    ...tools,
    remember: tool({
      description:
        "Save a durable fact about the user to long-term memory. Use ONLY when the user explicitly asks you to remember or note something about themselves or their preferences. Never store secrets or sensitive personal data.",
      inputSchema: z.object({
        fact: z.string().min(3).max(200).describe("One short sentence in third person"),
      }),
      execute: async ({ fact }) => {
        await addMemory(ctx.user.id, fact, { source: "tool", chatId: ctx.chatId });
        return { saved: true };
      },
    }),
  };
}

export type ChatTools = ReturnType<typeof buildTools>;
