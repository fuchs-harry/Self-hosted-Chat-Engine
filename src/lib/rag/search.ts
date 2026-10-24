import "server-only";
import { db } from "@/lib/db";
import { resolveEmbeddingModel } from "@/lib/providers/registry";
import { embedTexts, toVector } from "./embed";

export type Hit = {
  chunkId: number;
  documentId: string;
  title: string;
  kbName: string;
  content: string;
  page: number | null;
  sourceUrl: string | null;
  score: number;
};

// Common words that would otherwise match nearly every chunk in the
// language-neutral ('simple') full-text index.
const STOPWORDS = new Set(
  (
    "der die das und oder ein eine einer eines einem einen ist sind war wie was wer wo wann warum " +
    "ich du er sie es wir ihr mein dein sein unser euer mir mich dir dich uns habe hat haben " +
    "für mit von bei aus nach auf über unter vor zu zum zur im in an am als auch nicht noch nur " +
    "kann können soll sollen muss müssen wird werden bitte gibt es dem den des " +
    "the and or a an is are was were what who where when why how i you he she it we they my your " +
    "our their me us have has had for with from at by on in to of as also not can could should " +
    "would will please there this that these those do does did"
  ).split(" "),
);

/** OR-query over the meaningful words, so partial matches still rank. */
export function toTsQuery(text: string): string | null {
  const words = [
    ...new Set(
      text
        .toLowerCase()
        .normalize("NFC")
        .match(/[\p{L}\p{N}]{3,}/gu)
        ?.filter((w) => !STOPWORDS.has(w)) ?? [],
    ),
  ].slice(0, 16);
  return words.length ? words.map((w) => `${w}:*`).join(" | ") : null;
}

const RRF_K = 60;
const CANDIDATES = 30;
const MIN_VECTOR_ONLY_SIM = 0.2;

/**
 * Hybrid retrieval: pgvector cosine search + Postgres full-text search,
 * fused with Reciprocal Rank Fusion. Keyword search catches exact terms
 * (product codes, names, paragraph numbers) that embeddings tend to miss;
 * embeddings catch paraphrases. Works keyword-only when no embedding
 * model is configured.
 */
export async function hybridSearch(kbIds: string[], query: string, limit = 6): Promise<Hit[]> {
  if (!kbIds.length || !query.trim()) return [];
  const sql = db();

  const fused = new Map<number, { score: number; sim: number | null; fts: boolean }>();
  const add = (id: number, rank: number, sim: number | null, fts: boolean) => {
    const prev = fused.get(id) ?? { score: 0, sim: null, fts: false };
    fused.set(id, {
      score: prev.score + 1 / (RRF_K + rank),
      sim: sim ?? prev.sim,
      fts: prev.fts || fts,
    });
  };

  const embedding = await resolveEmbeddingModel();
  if (embedding) {
    const embedded = await embedTexts([query], embedding);
    if (embedded) {
      const d = embedded.dimensions;
      const q = toVector(embedded.vectors[0]);
      const rows = await sql.unsafe<{ id: number; sim: number }[]>(
        `SELECT id, 1 - (embedding::vector(${d}) <=> $1::vector(${d})) AS sim
           FROM chunks
          WHERE kb_id = ANY($2::uuid[]) AND embedding_model = $3 AND vector_dims(embedding) = ${d}
          ORDER BY embedding::vector(${d}) <=> $1::vector(${d})
          LIMIT ${CANDIDATES}`,
        [q, kbIds, embedded.modelKey],
      );
      rows.forEach((r, i) => add(Number(r.id), i + 1, Number(r.sim), false));
    }
  }

  const tsq = toTsQuery(query);
  if (tsq) {
    const rows = await sql<{ id: number }[]>`
      SELECT id FROM chunks, to_tsquery('simple', ${tsq}) q
       WHERE kb_id = ANY(${kbIds}::uuid[]) AND tsv @@ q
       ORDER BY ts_rank_cd(tsv, q) DESC
       LIMIT ${CANDIDATES}`;
    rows.forEach((r, i) => add(Number(r.id), i + 1, null, true));
  }

  const ranked = [...fused.entries()]
    .filter(([, v]) => v.fts || (v.sim ?? 0) >= MIN_VECTOR_ONLY_SIM)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, limit);
  if (!ranked.length) return [];

  const ids = ranked.map(([id]) => id);
  const rows = await sql<Omit<Hit, "score">[]>`
    SELECT c.id AS "chunkId", c.document_id AS "documentId", d.title, k.name AS "kbName",
           c.content, c.page, d.source_url AS "sourceUrl"
      FROM chunks c
      JOIN documents d ON d.id = c.document_id
      JOIN knowledge_bases k ON k.id = c.kb_id
     WHERE c.id = ANY(${ids}::bigint[])`;
  const byId = new Map(rows.map((r) => [Number(r.chunkId), r]));
  const max = ranked[0][1].score;
  return ranked
    .map(([id, v]) => {
      const row = byId.get(id);
      return row ? { ...row, chunkId: id, score: v.score / max } : null;
    })
    .filter((h): h is Hit => h !== null);
}

/** Formats hits as numbered excerpts for the system prompt. */
export function formatHits(hits: Hit[]): string {
  return hits
    .map((h, i) => {
      const where = h.page ? `${h.title}, p. ${h.page}` : h.title;
      return `[${i + 1}] ${where}\n${h.content}`;
    })
    .join("\n\n");
}
