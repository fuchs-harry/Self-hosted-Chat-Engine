import "server-only";
import { db } from "@/lib/db";

export type Job = {
  id: number;
  type: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
};

export async function enqueue(
  type: string,
  payload: Record<string, unknown> = {},
  opts: { runAt?: Date; dedupeKey?: string; maxAttempts?: number } = {},
): Promise<number | null> {
  const [row] = await db()<{ id: number }[]>`
    INSERT INTO jobs (type, payload, run_at, dedupe_key, max_attempts)
    VALUES (${type}, ${db().json(payload as never)}, ${opts.runAt ?? new Date()},
            ${opts.dedupeKey ?? null}, ${opts.maxAttempts ?? 3})
    ON CONFLICT (dedupe_key) WHERE status IN ('queued', 'running') DO NOTHING
    RETURNING id`;
  // Lazy import: the heartbeat module imports the handlers, which import us.
  const { kickHeartbeat } = await import("./index");
  kickHeartbeat();
  return row ? Number(row.id) : null;
}

/** Atomically takes up to `n` due jobs. Other replicas skip locked rows. */
export async function claimJobs(n: number): Promise<Job[]> {
  const rows = await db()<Job[]>`
    UPDATE jobs SET status = 'running', locked_at = now(), attempts = attempts + 1
     WHERE id IN (
       SELECT id FROM jobs
        WHERE status = 'queued' AND run_at <= now()
        ORDER BY run_at
        LIMIT ${n}
        FOR UPDATE SKIP LOCKED)
    RETURNING id, type, payload, attempts, max_attempts`;
  return rows.map((r) => ({ ...r, id: Number(r.id) }));
}

export async function completeJob(id: number): Promise<void> {
  await db()`UPDATE jobs SET status = 'done', finished_at = now(), last_error = NULL WHERE id = ${id}`;
}

/** Retries with exponential backoff (30 s, 2 min, 8 min, ...) until max_attempts. */
export async function failJob(job: Job, error: unknown): Promise<void> {
  const message = (error instanceof Error ? error.message : String(error)).slice(0, 2000);
  const retry = job.attempts < job.max_attempts;
  const delaySeconds = 30 * 4 ** (job.attempts - 1);
  await db()`
    UPDATE jobs SET
      status = ${retry ? "queued" : "failed"},
      last_error = ${message},
      locked_at = NULL,
      run_at = CASE WHEN ${retry} THEN now() + make_interval(secs => ${delaySeconds}) ELSE run_at END,
      finished_at = CASE WHEN ${retry} THEN NULL ELSE now() END
    WHERE id = ${job.id}`;
}

/** Jobs whose worker died mid-run (crash, redeploy) go back to the queue. */
export async function requeueStale(minutes = 15): Promise<number> {
  const res = await db()`
    UPDATE jobs SET status = 'queued', locked_at = NULL
     WHERE status = 'running' AND locked_at < now() - make_interval(mins => ${minutes})`;
  return res.count;
}

export async function jobCounts(): Promise<Record<string, number>> {
  const rows = await db()<{ status: string; n: number }[]>`
    SELECT status, count(*)::int AS n FROM jobs
     WHERE status <> 'done' OR finished_at > now() - interval '24 hours'
     GROUP BY status`;
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}
