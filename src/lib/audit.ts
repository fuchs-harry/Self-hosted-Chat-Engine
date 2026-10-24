import "server-only";
import { db } from "@/lib/db";

/**
 * Audit actions. Details carry metadata only (model, counts, ids), never
 * prompt text or document content.
 */
export type AuditAction =
  | "auth.login"
  | "auth.login_failed"
  | "auth.logout"
  | "auth.setup"
  | "user.create"
  | "user.update"
  | "user.delete"
  | "chat.request"
  | "chat.delete"
  | "knowledge.create"
  | "knowledge.delete"
  | "document.upload"
  | "document.delete"
  | "connector.create"
  | "connector.update"
  | "connector.delete"
  | "connector.sync"
  | "provider.update"
  | "settings.update"
  | "memory.update"
  | "memory.delete"
  | "data.export"
  | "retention.purge";

export async function audit(
  action: AuditAction,
  opts: { userId?: string | null; target?: string | null; detail?: Record<string, unknown> } = {},
): Promise<void> {
  try {
    await db()`
      INSERT INTO audit_events (user_id, action, target, detail)
      VALUES (${opts.userId ?? null}, ${action}, ${opts.target ?? null},
              ${db().json((opts.detail ?? {}) as never)})`;
  } catch (err) {
    // Auditing must never break the request that triggered it.
    console.error("[audit] failed to record", action, (err as Error).message);
  }
}
