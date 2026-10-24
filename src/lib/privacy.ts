import "server-only";
import { db } from "@/lib/db";

/**
 * Everything stored about a user, as one JSON document (GDPR Art. 15
 * right of access, Art. 20 data portability). Generated file contents are
 * listed but not embedded; they can be downloaded individually.
 */
export async function exportUserData(userId: string) {
  const sql = db();
  const [profile] = await sql`
    SELECT id, email, name, role, memory_enabled, created_at, last_login_at FROM users WHERE id = ${userId}`;
  const chats = await sql`
    SELECT id, title, model_key, knowledge_scope, pinned, created_at, updated_at
      FROM chats WHERE user_id = ${userId} ORDER BY created_at`;
  const messages = await sql`
    SELECT m.chat_id, m.id, m.role, m.parts, m.metadata, m.created_at
      FROM chat_messages m JOIN chats c ON c.id = m.chat_id
     WHERE c.user_id = ${userId} ORDER BY m.chat_id, m.seq`;
  const memories = await sql`
    SELECT id, content, category, source, created_at, updated_at FROM memories WHERE user_id = ${userId}`;
  const files = await sql`
    SELECT id, title, format, filename, size_bytes, created_at FROM generated_files WHERE user_id = ${userId}`;
  const knowledge = await sql`
    SELECT id, name, description, created_at FROM knowledge_bases
     WHERE visibility = 'private' AND owner_id = ${userId}`;
  const activity = await sql`
    SELECT at, action, target, detail FROM audit_events WHERE user_id = ${userId}
     ORDER BY at DESC LIMIT 5000`;

  const byChat = new Map<string, unknown[]>();
  for (const m of messages) {
    const list = byChat.get(m.chat_id as string) ?? [];
    list.push({ id: m.id, role: m.role, parts: m.parts, metadata: m.metadata, created_at: m.created_at });
    byChat.set(m.chat_id as string, list);
  }

  return {
    exported_at: new Date().toISOString(),
    profile,
    chats: chats.map((c) => ({ ...c, messages: byChat.get(c.id as string) ?? [] })),
    memories,
    generated_files: files,
    private_knowledge_bases: knowledge,
    activity,
  };
}

export async function deleteAllChats(userId: string): Promise<number> {
  return (await db()`DELETE FROM chats WHERE user_id = ${userId}`).count;
}
