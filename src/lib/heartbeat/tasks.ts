import "server-only";
import { db } from "@/lib/db";
import { purgeExpiredSessions } from "@/lib/auth/session";
import { scheduleDueConnectors } from "@/lib/connectors";
import { consolidateMemories } from "@/lib/memory";
import { staleDocumentIds } from "@/lib/rag/ingest";
import { enqueue } from "./jobs";

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
    name: "connectors.schedule",
    everySeconds: 60,
    run: async () => {
      const n = await scheduleDueConnectors();
      return n ? `${n} connector syncs queued` : undefined;
    },
  },
  {
    name: "embeddings.reconcile",
    everySeconds: 600,
    run: async () => {
      const ids = await staleDocumentIds();
      for (const id of ids) {
        await enqueue("ingest_document", { documentId: id }, { dedupeKey: `ingest:${id}` });
      }
      return ids.length ? `${ids.length} documents queued for re-embedding` : undefined;
    },
  },
  {
    name: "memory.consolidate",
    everySeconds: 86_400,
    run: async () => {
      const n = await consolidateMemories();
      return n ? `${n} memories consolidated` : undefined;
    },
  },
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
