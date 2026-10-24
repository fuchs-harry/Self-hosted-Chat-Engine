import "server-only";
import { db } from "@/lib/db";
import type { ChatMessage, ChatMetadata, ChatSummary } from "./types";

export type ChatRow = {
  id: string;
  user_id: string;
  title: string;
  model_key: string | null;
  knowledge_base_id: string | null;
  knowledge_scope: "none" | "all" | "kb";
  pinned: boolean;
  created_at: Date;
  updated_at: Date;
};

export async function createChat(userId: string): Promise<string> {
  const [row] = await db()<{ id: string }[]>`
    INSERT INTO chats (user_id) VALUES (${userId}) RETURNING id`;
  return row.id;
}

/**
 * New chats get their id in the browser so the URL can update without a
 * round-trip. The row is created on the first message; an id that already
 * belongs to someone else simply yields null.
 */
export async function ensureChat(id: string, userId: string): Promise<ChatRow | null> {
  await db()`INSERT INTO chats (id, user_id) VALUES (${id}, ${userId}) ON CONFLICT (id) DO NOTHING`;
  return getChat(id, userId);
}

/** Returns the chat only if it belongs to the user. */
export async function getChat(id: string, userId: string): Promise<ChatRow | null> {
  const [row] = await db()<ChatRow[]>`
    SELECT * FROM chats WHERE id = ${id} AND user_id = ${userId}`;
  return row ?? null;
}

export async function listChats(userId: string, query?: string): Promise<ChatSummary[]> {
  const rows = query
    ? await db()<ChatSummary[]>`
        SELECT c.id, c.title, c.pinned, c.updated_at FROM chats c
        WHERE c.user_id = ${userId} AND (
          c.title ILIKE ${"%" + query + "%"} OR EXISTS (
            SELECT 1 FROM chat_messages m
            WHERE m.chat_id = c.id AND m.parts::text ILIKE ${"%" + query + "%"}))
        ORDER BY c.updated_at DESC LIMIT 50`
    : await db()<ChatSummary[]>`
        SELECT id, title, pinned, updated_at FROM chats
        WHERE user_id = ${userId} AND title <> ''
        ORDER BY pinned DESC, updated_at DESC LIMIT 200`;
  return rows.map((r) => ({ ...r, updated_at: new Date(r.updated_at).toISOString() }));
}

export async function loadMessages(chatId: string): Promise<ChatMessage[]> {
  const rows = await db()<{ id: string; role: ChatMessage["role"]; parts: ChatMessage["parts"]; metadata: ChatMetadata | null }[]>`
    SELECT id, role, parts, metadata FROM chat_messages WHERE chat_id = ${chatId} ORDER BY seq`;
  return rows.map((r) => ({
    id: r.id,
    role: r.role,
    parts: r.parts,
    ...(r.metadata ? { metadata: r.metadata } : {}),
  }));
}

/**
 * Makes the stored conversation equal to `messages`: upserts every message
 * and drops ones that are no longer part of it (e.g. after "regenerate").
 */
export async function saveMessages(chatId: string, messages: ChatMessage[]): Promise<void> {
  const sql = db();
  await sql.begin(async (tx) => {
    const ids = messages.map((m) => m.id);
    await tx`DELETE FROM chat_messages WHERE chat_id = ${chatId} AND NOT (id = ANY(${ids}))`;
    for (const m of messages) {
      await tx`
        INSERT INTO chat_messages (id, chat_id, role, parts, metadata)
        VALUES (${m.id}, ${chatId}, ${m.role}, ${tx.json(m.parts as never)},
                ${m.metadata ? tx.json(m.metadata as never) : null})
        ON CONFLICT (id) DO UPDATE SET parts = EXCLUDED.parts, metadata = EXCLUDED.metadata`;
    }
    await tx`UPDATE chats SET updated_at = now() WHERE id = ${chatId}`;
  });
}

export async function updateChat(
  id: string,
  userId: string,
  patch: Partial<
    Pick<ChatRow, "title" | "pinned" | "model_key" | "knowledge_base_id" | "knowledge_scope">
  >,
): Promise<boolean> {
  const sql = db();
  const keys = Object.keys(patch) as (keyof typeof patch)[];
  if (!keys.length) return true;
  const res = await sql`
    UPDATE chats SET ${sql(patch as Record<string, string>, keys)}
    WHERE id = ${id} AND user_id = ${userId}`;
  return res.count > 0;
}

export async function deleteChat(id: string, userId: string): Promise<boolean> {
  const res = await db()`DELETE FROM chats WHERE id = ${id} AND user_id = ${userId}`;
  return res.count > 0;
}
