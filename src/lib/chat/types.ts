import type { UIMessage } from "ai";
import type { Residency } from "@/lib/providers/catalog";

export type Source = {
  n: number;
  documentId: string;
  title: string;
  knowledgeBase?: string;
  score: number;
  snippet: string;
  page?: number | null;
  url?: string | null;
};

export type KnowledgeScope =
  | { scope: "none" }
  | { scope: "all" }
  | { scope: "kb"; kbId: string };

export type KnowledgeOption = { id: string; name: string; visibility: "org" | "private" };

export type ChatMetadata = {
  createdAt?: number;
  modelKey?: string;
  modelLabel?: string;
  residency?: Residency;
  sources?: Source[];
  /** Number of personal-data items pseudonymized before the model call. */
  masked?: number;
  totalTokens?: number;
};

export type ChatMessage = UIMessage<ChatMetadata>;

export type ChatSummary = {
  id: string;
  title: string;
  pinned: boolean;
  updated_at: string;
};

/** Plain text of a message, ignoring tool and file parts. */
export function messageText(message: Pick<UIMessage, "parts">): string {
  return message.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("")
    .trim();
}
