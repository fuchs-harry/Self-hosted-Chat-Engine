import "server-only";
import { db } from "@/lib/db";
import { purgeExpiredSessions } from "@/lib/auth/session";

/**
 * Periodic tasks run by the heartbeat. Each runs at most once per interval
 * across all replicas (guarded by a Postgres advisory lock).
 */
export type PeriodicTask = {
  name: string;
  everySeconds: number;
  run: () => Promise<string | void>;
};

export const TASKS: PeriodicTask[] = [
  {
    name: "sessions.purge",
    everySeconds: 3600,
    run: async () => `${await purgeExpiredSessions()} expired sessions removed`,
  },
  {
    name: "housekeeping",
    everySeconds: 3600,
    run: async () => {
      const jobs = await db()`
        DELETE FROM jobs WHERE status IN ('done', 'failed') AND finished_at < now() - interval '7 days'`;
      const beats = await db()`DELETE FROM heartbeats WHERE started_at < now() - interval '7 days'`;
      return `${jobs.count} old jobs, ${beats.count} old heartbeats removed`;
    },
  },
];
