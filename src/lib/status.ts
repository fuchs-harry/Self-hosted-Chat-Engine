import "server-only";
import { db } from "@/lib/db";
import { heartbeatNode } from "@/lib/heartbeat";
import { jobCounts } from "@/lib/heartbeat/jobs";
import { activeProviders, resolveEmbeddingModel } from "@/lib/providers/registry";

export type SystemStatus = Awaited<ReturnType<typeof systemStatus>>;

/** Everything the admin overview and /api/health need. */
export async function systemStatus() {
  const sql = db();
  const [[lastBeat], tasks, jobs, counts, providers, embedding, recentFailures] = await Promise.all([
    sql<{ started_at: Date; duration_ms: number; node: string }[]>`
      SELECT started_at, duration_ms, node FROM heartbeats ORDER BY started_at DESC LIMIT 1`,
    sql<{ name: string; last_run_at: Date | null; last_status: string | null; last_error: string | null }[]>`
      SELECT name, last_run_at, last_status, last_error FROM heartbeat_tasks ORDER BY name`,
    jobCounts(),
    sql<{ users: number; chats: number; documents: number; chunks: number; kbs: number }[]>`
      SELECT (SELECT count(*)::int FROM users) AS users,
             (SELECT count(*)::int FROM chats) AS chats,
             (SELECT count(*)::int FROM documents) AS documents,
             (SELECT count(*)::int FROM chunks) AS chunks,
             (SELECT count(*)::int FROM knowledge_bases) AS kbs`,
    activeProviders(),
    resolveEmbeddingModel(),
    sql<{ type: string; last_error: string | null; finished_at: Date }[]>`
      SELECT type, last_error, finished_at FROM jobs
       WHERE status = 'failed' ORDER BY finished_at DESC LIMIT 5`,
  ]);

  const beatAgeSeconds = lastBeat ? Math.round((Date.now() - lastBeat.started_at.getTime()) / 1000) : null;
  return {
    heartbeat: {
      ...heartbeatNode(),
      lastBeatAt: lastBeat?.started_at ?? null,
      lastDurationMs: lastBeat?.duration_ms ?? null,
      ageSeconds: beatAgeSeconds,
      // Healthy if a beat happened within three intervals.
      healthy:
        beatAgeSeconds !== null &&
        beatAgeSeconds < 3 * Number(process.env.HEARTBEAT_INTERVAL_SECONDS || 30) + 30,
    },
    tasks,
    jobs,
    recentFailures,
    counts: counts[0],
    providers: providers.map((p) => ({ id: p.def.id, name: p.def.name, residency: p.def.residency })),
    embedding: embedding ? { key: embedding.key, dimensions: embedding.dimensions } : null,
  };
}
