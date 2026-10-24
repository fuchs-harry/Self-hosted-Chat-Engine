import "server-only";
import { embedMany } from "ai";
import { db } from "@/lib/db";
import { resolveEmbeddingModel, type EmbeddingChoice } from "@/lib/providers/registry";

const BATCH = 64;
// HNSW in pgvector indexes `vector` columns up to 2000 dimensions.
const MAX_INDEXED_DIMS = 2000;

export type Embedded = { vectors: number[][]; modelKey: string; dimensions: number };

export async function embedTexts(values: string[], choice?: EmbeddingChoice | null): Promise<Embedded | null> {
  const emb = choice ?? (await resolveEmbeddingModel());
  if (!emb || values.length === 0) return null;

  const vectors: number[][] = [];
  for (let i = 0; i < values.length; i += BATCH) {
    const { embeddings } = await embedMany({
      model: emb.model,
      values: values.slice(i, i + BATCH),
      maxParallelCalls: 2,
      maxRetries: 2,
      ...(emb.supportsDimensions ? { dimensions: emb.dimensions } : {}),
    });
    vectors.push(...embeddings);
  }
  const dimensions = vectors[0]?.length ?? emb.dimensions;
  return { vectors, modelKey: emb.key, dimensions };
}

/** pgvector literal: '[0.1,0.2,...]'. */
export function toVector(v: number[]): string {
  return `[${v.join(",")}]`;
}

const ensured = new Set<number>();

/** Creates the ANN index for this dimension once. Safe to call repeatedly. */
export async function ensureVectorIndex(dimensions: number): Promise<void> {
  if (ensured.has(dimensions)) return;
  if (!Number.isInteger(dimensions) || dimensions <= 0) throw new Error("bad dimension");
  if (dimensions <= MAX_INDEXED_DIMS) {
    await db().unsafe(
      `CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw_${dimensions}
         ON chunks USING hnsw ((embedding::vector(${dimensions})) vector_cosine_ops)
         WHERE vector_dims(embedding) = ${dimensions}`,
    );
  }
  ensured.add(dimensions);
}
