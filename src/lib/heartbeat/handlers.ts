import "server-only";
import { syncConnector } from "@/lib/connectors";
import { updateMemoryFromChat } from "@/lib/memory";
import { ingestDocument } from "@/lib/rag/ingest";

/**
 * Job type → implementation. Handlers receive the job payload and throw to
 * signal failure (the job is then retried with backoff).
 */
export type JobHandler = (payload: Record<string, unknown>) => Promise<void>;

export const JOB_HANDLERS: Record<string, JobHandler> = {
  ingest_document: async (p) => ingestDocument(String(p.documentId)),
  sync_connector: async (p) => {
    await syncConnector(String(p.connectorId));
  },
  update_memory: async (p) => updateMemoryFromChat(String(p.userId), String(p.chatId)),
};
