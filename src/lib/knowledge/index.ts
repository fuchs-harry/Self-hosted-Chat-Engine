import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { enqueue } from "@/lib/heartbeat/jobs";
import type { User } from "@/lib/auth/users";
import { detectMimeType, isSupported } from "@/lib/rag/extract";

export type KnowledgeBase = {
  id: string;
  name: string;
  description: string;
  visibility: "org" | "private";
  owner_id: string | null;
  created_at: Date;
  document_count: number;
  ready_count: number;
  connector_count: number;
};

export type DocumentRow = {
  id: string;
  kb_id: string;
  connector_id: string | null;
  title: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  status: "pending" | "processing" | "ready" | "failed";
  error: string | null;
  chunk_count: number;
  source_url: string | null;
  has_file: boolean;
  created_at: Date;
  updated_at: Date;
};

export class KnowledgeError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const visibleTo = (user: User) =>
  db()`(k.visibility = 'org' OR k.owner_id = ${user.id})`;

export async function listKnowledgeBases(user: User): Promise<KnowledgeBase[]> {
  return db()<KnowledgeBase[]>`
    SELECT k.id, k.name, k.description, k.visibility, k.owner_id, k.created_at,
           (SELECT count(*)::int FROM documents d WHERE d.kb_id = k.id) AS document_count,
           (SELECT count(*)::int FROM documents d WHERE d.kb_id = k.id AND d.status = 'ready') AS ready_count,
           (SELECT count(*)::int FROM connectors c WHERE c.kb_id = k.id) AS connector_count
      FROM knowledge_bases k
     WHERE ${visibleTo(user)}
     ORDER BY k.visibility, k.name`;
}

export async function getKnowledgeBase(id: string, user: User): Promise<KnowledgeBase | null> {
  const [row] = await db()<KnowledgeBase[]>`
    SELECT k.id, k.name, k.description, k.visibility, k.owner_id, k.created_at,
           (SELECT count(*)::int FROM documents d WHERE d.kb_id = k.id) AS document_count,
           (SELECT count(*)::int FROM documents d WHERE d.kb_id = k.id AND d.status = 'ready') AS ready_count,
           (SELECT count(*)::int FROM connectors c WHERE c.kb_id = k.id) AS connector_count
      FROM knowledge_bases k
     WHERE k.id = ${id} AND ${visibleTo(user)}`;
  return row ?? null;
}

/** Org knowledge is managed by admins; private knowledge by its owner. */
export function canManage(kb: Pick<KnowledgeBase, "visibility" | "owner_id">, user: User): boolean {
  return kb.visibility === "org" ? user.role === "admin" : kb.owner_id === user.id;
}

export async function requireManageable(id: string, user: User): Promise<KnowledgeBase> {
  const kb = await getKnowledgeBase(id, user);
  if (!kb) throw new KnowledgeError(404, "Knowledge base not found");
  if (!canManage(kb, user)) throw new KnowledgeError(403, "You can't manage this knowledge base");
  return kb;
}

export async function createKnowledgeBase(
  input: { name: string; description?: string; visibility: "org" | "private" },
  user: User,
): Promise<string> {
  if (input.visibility === "org" && user.role !== "admin") {
    throw new KnowledgeError(403, "Only administrators can create company-wide knowledge");
  }
  const [row] = await db()<{ id: string }[]>`
    INSERT INTO knowledge_bases (name, description, visibility, owner_id)
    VALUES (${input.name.trim()}, ${input.description?.trim() ?? ""}, ${input.visibility}, ${user.id})
    RETURNING id`;
  return row.id;
}

export async function updateKnowledgeBase(
  id: string,
  patch: { name?: string; description?: string },
): Promise<void> {
  const sql = db();
  const fields = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  if (!Object.keys(fields).length) return;
  await sql`UPDATE knowledge_bases SET ${sql(fields as Record<string, string>)}, updated_at = now() WHERE id = ${id}`;
}

export async function deleteKnowledgeBase(id: string): Promise<void> {
  await db()`DELETE FROM knowledge_bases WHERE id = ${id}`;
}

export async function listDocuments(kbId: string): Promise<DocumentRow[]> {
  return db()<DocumentRow[]>`
    SELECT id, kb_id, connector_id, title, filename, mime_type, size_bytes, status, error,
           chunk_count, source_url, content IS NOT NULL AS has_file, created_at, updated_at
      FROM documents WHERE kb_id = ${kbId}
     ORDER BY created_at DESC LIMIT 1000`;
}

export async function addUpload(
  kbId: string,
  file: { name: string; type: string; bytes: Uint8Array },
  user: User,
): Promise<string> {
  const maxBytes = env().MAX_UPLOAD_MB * 1024 * 1024;
  if (file.bytes.byteLength === 0) throw new KnowledgeError(400, `${file.name} is empty`);
  if (file.bytes.byteLength > maxBytes) {
    throw new KnowledgeError(413, `${file.name} is larger than ${env().MAX_UPLOAD_MB} MB`);
  }
  if (!isSupported(file.name, file.type)) {
    throw new KnowledgeError(415, `${file.name}: this file type is not supported`);
  }
  const hash = createHash("sha256").update(file.bytes).digest("hex");
  const title = file.name.replace(/\.[^.]+$/, "");
  const [row] = await db()<{ id: string }[]>`
    INSERT INTO documents (kb_id, title, filename, mime_type, size_bytes, content_hash, content, created_by)
    VALUES (${kbId}, ${title}, ${file.name}, ${detectMimeType(file.name, file.type)},
            ${file.bytes.byteLength}, ${hash}, ${Buffer.from(file.bytes)}, ${user.id})
    RETURNING id`;
  await enqueue("ingest_document", { documentId: row.id }, { dedupeKey: `ingest:${row.id}` });
  return row.id;
}

export async function getDocument(id: string, user: User) {
  const [row] = await db()<(DocumentRow & { visibility: string; owner_id: string | null })[]>`
    SELECT d.id, d.kb_id, d.connector_id, d.title, d.filename, d.mime_type, d.size_bytes, d.status,
           d.error, d.chunk_count, d.source_url, d.content IS NOT NULL AS has_file,
           d.created_at, d.updated_at, k.visibility, k.owner_id
      FROM documents d JOIN knowledge_bases k ON k.id = d.kb_id
     WHERE d.id = ${id} AND ${visibleTo(user)}`;
  return row ?? null;
}

export async function getDocumentFile(id: string): Promise<Buffer | null> {
  const [row] = await db()<{ content: Buffer | null }[]>`SELECT content FROM documents WHERE id = ${id}`;
  return row?.content ?? null;
}

export async function deleteDocument(id: string): Promise<void> {
  await db()`DELETE FROM documents WHERE id = ${id}`;
}

export async function reindexDocument(id: string): Promise<void> {
  await db()`UPDATE documents SET status = 'pending', error = NULL WHERE id = ${id}`;
  await enqueue("ingest_document", { documentId: id }, { dedupeKey: `ingest:${id}` });
}

/** Knowledge bases the user may search, optionally narrowed to `requested`. */
export async function searchableKbIds(user: User, requested?: string[] | null): Promise<string[]> {
  const rows = await db()<{ id: string }[]>`
    SELECT k.id FROM knowledge_bases k WHERE ${visibleTo(user)}`;
  const all = rows.map((r) => r.id);
  if (!requested?.length) return all;
  const set = new Set(requested);
  return all.filter((id) => set.has(id));
}
