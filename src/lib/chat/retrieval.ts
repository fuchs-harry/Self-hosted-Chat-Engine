import "server-only";
import type { User } from "@/lib/auth/users";
import { searchableKbIds } from "@/lib/knowledge";
import { formatHits, hybridSearch, type Hit } from "@/lib/rag/search";
import { messageText, type ChatMessage, type KnowledgeScope, type Source } from "./types";

export type Retrieval = { hits: Hit[]; context: string; sources: Source[] };

/**
 * Short follow-ups ("and for Vienna?") carry little meaning alone, so the
 * previous user question is added to the search query.
 */
export function searchQuery(messages: ChatMessage[]): string {
  const users = messages.filter((m) => m.role === "user").map(messageText);
  const last = users.at(-1) ?? "";
  const words = last.split(/\s+/).filter(Boolean).length;
  return words < 7 && users.length > 1 ? `${users.at(-2)}\n${last}` : last;
}

export async function retrieve(
  user: User,
  scope: KnowledgeScope,
  messages: ChatMessage[],
): Promise<Retrieval | null> {
  if (scope.scope === "none") return null;
  const kbIds = await searchableKbIds(user, scope.scope === "kb" ? [scope.kbId] : null);
  if (!kbIds.length) return null;

  const hits = await hybridSearch(kbIds, searchQuery(messages));
  return {
    hits,
    context: formatHits(hits),
    sources: hits.map((h, i) => ({
      n: i + 1,
      documentId: h.documentId,
      title: h.title,
      knowledgeBase: h.kbName,
      score: Math.round(h.score * 100) / 100,
      snippet: h.content.slice(0, 280),
      page: h.page,
      url: `/api/documents/${h.documentId}`,
    })),
  };
}
