import "server-only";
import { db } from "@/lib/db";
import { resolveEmbeddingModel } from "@/lib/providers/registry";
import { chunkPages } from "./chunk";
import { ensureVectorIndex, embedTexts, toVector } from "./embed";
import { extractText, UnsupportedFileError, type Page } from "./extract";

// Pages are stored joined by form feeds so page numbers survive re-indexing.
const PAGE_BREAK = "\f";

export function pagesToText(pages: Page[]): string {
  return pages.map((p) => p.text).join(PAGE_BREAK);
}

export function textToPages(text: string, paged: boolean): Page[] {
  if (!paged) return [{ page: null, text }];
  return text.split(PAGE_BREAK).map((t, i) => ({ page: i + 1, text: t }));
}

/** Errors that retrying won't fix: mark the document failed and stop. */
class PermanentError extends Error {}

/**
 * extract → chunk → embed → store. Re-running replaces the document's
 * chunks, which is how re-indexing and connector updates work.
 */
export async function ingestDocument(documentId: string): Promise<void> {
  const sql = db();
  const [doc] = await sql<{
    id: string;
    kb_id: string;
    title: string;
    filename: string;
    mime_type: string;
    content: Buffer | null;
    text_content: string | null;
  }[]>`
    UPDATE documents SET status = 'processing', updated_at = now() WHERE id = ${documentId}
    RETURNING id, kb_id, title, filename, mime_type, content, text_content`;
  if (!doc) return; // deleted meanwhile

  try {
    const paged = doc.mime_type === "application/pdf";
    let pages: Page[];
    if (doc.text_content !== null) {
      pages = textToPages(doc.text_content, paged);
    } else if (doc.content) {
      try {
        pages = await extractText(new Uint8Array(doc.content), doc.filename, doc.mime_type);
      } catch (err) {
        if (err instanceof UnsupportedFileError) throw new PermanentError(err.message);
        throw new PermanentError(`Could not read file: ${(err as Error).message}`);
      }
      await sql`UPDATE documents SET text_content = ${pagesToText(pages)} WHERE id = ${doc.id}`;
    } else {
      throw new PermanentError("Document has no content");
    }

    const chunks = chunkPages(pages);
    if (!chunks.length) {
      throw new PermanentError("No text found. Scanned PDFs need OCR before upload.");
    }

    // The title travels with each chunk into the embedding, which helps
    // retrieval for questions that name the document.
    const embedding = await resolveEmbeddingModel();
    const embedded = embedding
      ? await embedTexts(
          chunks.map((c) => `${doc.title}\n\n${c.content}`),
          embedding,
        )
      : null;
    if (embedded) await ensureVectorIndex(embedded.dimensions);

    await sql.begin(async (tx) => {
      await tx`DELETE FROM chunks WHERE document_id = ${doc.id}`;
      const rows = chunks.map((c, i) => ({
        document_id: doc.id,
        kb_id: doc.kb_id,
        chunk_index: i,
        content: c.content,
        page: c.page,
        embedding: embedded ? toVector(embedded.vectors[i]) : null,
        embedding_model: embedded?.modelKey ?? null,
      }));
      for (let i = 0; i < rows.length; i += 200) {
        await tx`INSERT INTO chunks ${tx(rows.slice(i, i + 200))}`;
      }
      await tx`
        UPDATE documents SET status = 'ready', error = NULL, chunk_count = ${chunks.length}, updated_at = now()
         WHERE id = ${doc.id}`;
    });
  } catch (err) {
    const message = (err as Error).message.slice(0, 1000);
    const permanent = err instanceof PermanentError;
    await sql`
      UPDATE documents SET status = ${permanent ? "failed" : "pending"}, error = ${message}, updated_at = now()
       WHERE id = ${doc.id}`;
    if (!permanent) throw err; // let the job queue retry (e.g. embedding API down)
  }
}

/**
 * Documents whose chunks were embedded with a different model than the
 * current one (or not at all) get re-embedded. Runs from the heartbeat, so
 * switching the embedding model heals the index on its own.
 */
export async function staleDocumentIds(limit = 50): Promise<string[]> {
  const embedding = await resolveEmbeddingModel();
  if (!embedding) return [];
  const rows = await db()<{ id: string }[]>`
    SELECT d.id FROM documents d
     WHERE d.status = 'ready' AND EXISTS (
       SELECT 1 FROM chunks c
        WHERE c.document_id = d.id AND c.embedding_model IS DISTINCT FROM ${embedding.key})
     LIMIT ${limit}`;
  return rows.map((r) => r.id);
}
