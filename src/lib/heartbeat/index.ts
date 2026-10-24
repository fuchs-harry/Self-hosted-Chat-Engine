import "server-only";
import { hostname } from "node:os";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { JOB_HANDLERS } from "./handlers";
import { claimJobs, completeJob, failJob, requeueStale, type Job } from "./jobs";
import { TASKS } from "./tasks";

const NODE = `${hostname()}:${process.pid}`;
const TASK_LOCK = 727_002;
const TICK_BUDGET_MS = 25_000;
const CONCURRENCY = 2;

type State = {
  timer?: NodeJS.Timeout;
  running: boolean;
  again: boolean;
  lastBeat?: Date;
};

const g = globalThis as unknown as { __heartbeat?: State };
const state: State = (g.__heartbeat ??= { running: false, again: false });

async function runJob(job: Job): Promise<boolean> {
  const handler = JOB_HANDLERS[job.type];
  try {
    if (!handler) throw new Error(`No handler for job type "${job.type}"`);
    await handler(job.payload);
    await completeJob(job.id);
    return true;
  } catch (err) {
    console.error(`[heartbeat] job ${job.id} (${job.type}) failed:`, (err as Error).message);
    await failJob(job, err);
    return false;
  }
}

async function runDueTasks(): Promise<string[]> {
  const sql = db();
  const ran: string[] = [];
  const reserved = await sql.reserve();
  try {
    const [{ locked }] = await reserved<{ locked: boolean }[]>`SELECT pg_try_advisory_lock(${TASK_LOCK}) AS locked`;
    if (!locked) return ran;
    try {
      const rows = await reserved<{ name: string; last_run_at: Date | null }[]>`
        SELECT name, last_run_at FROM heartbeat_tasks`;
      const last = new Map(rows.map((r) => [r.name, r.last_run_at]));
      for (const task of TASKS) {
        const prev = last.get(task.name);
        if (prev && Date.now() - prev.getTime() < task.everySeconds * 1000) continue;
        const started = Date.now();
        let status = "ok";
        let error: string | null = null;
        try {
          const note = await task.run();
          if (note) status = `ok: ${note}`.slice(0, 500);
        } catch (err) {
          status = "error";
          error = (err as Error).message.slice(0, 2000);
          console.error(`[heartbeat] task ${task.name} failed:`, error);
        }
        await reserved`
          INSERT INTO heartbeat_tasks (name, last_run_at, last_status, last_error, last_duration_ms)
          VALUES (${task.name}, now(), ${status}, ${error}, ${Date.now() - started})
          ON CONFLICT (name) DO UPDATE SET last_run_at = now(), last_status = EXCLUDED.last_status,
            last_error = EXCLUDED.last_error, last_duration_ms = EXCLUDED.last_duration_ms`;
        ran.push(task.name);
      }
    } finally {
      await reserved`SELECT pg_advisory_unlock(${TASK_LOCK})`;
    }
  } finally {
    reserved.release();
  }
  return ran;
}

/** One beat: recover stale jobs, run due periodic tasks, drain the queue. */
export async function tick(): Promise<void> {
  if (state.running) {
    state.again = true;
    return;
  }
  state.running = true;
  const started = Date.now();
  let done = 0;
  let failed = 0;
  let tasks: string[] = [];
  try {
    await requeueStale();
    tasks = await runDueTasks();
    while (Date.now() - started < TICK_BUDGET_MS) {
      const jobs = await claimJobs(CONCURRENCY);
      if (!jobs.length) break;
      const results = await Promise.all(jobs.map(runJob));
      done += results.filter(Boolean).length;
      failed += results.filter((r) => !r).length;
    }
    await db()`
      INSERT INTO heartbeats (duration_ms, node, jobs_done, jobs_failed, tasks)
      VALUES (${Date.now() - started}, ${NODE}, ${done}, ${failed}, ${tasks})`;
    state.lastBeat = new Date();
  } catch (err) {
    console.error("[heartbeat] tick failed:", (err as Error).message);
  } finally {
    state.running = false;
    if (state.again) {
      state.again = false;
      setImmediate(() => void tick());
    }
  }
}

/** Run a beat soon instead of waiting for the interval (e.g. after an upload). */
export function kickHeartbeat(): void {
  if (!state.timer) return; // heartbeat disabled (tests, build)
  setImmediate(() => void tick());
}

export function startHeartbeat(): void {
  const { HEARTBEAT_ENABLED, HEARTBEAT_INTERVAL_SECONDS } = env();
  if (!HEARTBEAT_ENABLED || state.timer) return;
  state.timer = setInterval(() => void tick(), HEARTBEAT_INTERVAL_SECONDS * 1000);
  state.timer.unref();
  setTimeout(() => void tick(), 2_000).unref();
  console.log(`[heartbeat] started on ${NODE}, every ${HEARTBEAT_INTERVAL_SECONDS}s`);
}

export function heartbeatNode(): { node: string; lastBeat: Date | null; running: boolean } {
  return { node: NODE, lastBeat: state.lastBeat ?? null, running: Boolean(state.timer) };
}
