import "server-only";
import { db } from "@/lib/db";

export type AuditRow = {
  id: number;
  at: Date;
  action: string;
  target: string | null;
  detail: Record<string, unknown>;
  user_email: string | null;
};

export async function listAudit(opts: { before?: number; action?: string; limit?: number } = {}): Promise<AuditRow[]> {
  const limit = Math.min(opts.limit ?? 100, 500);
  const sql = db();
  const rows = await sql<AuditRow[]>`
    SELECT a.id, a.at, a.action, a.target, a.detail, u.email AS user_email
      FROM audit_events a LEFT JOIN users u ON u.id = a.user_id
     WHERE (${opts.before ?? null}::bigint IS NULL OR a.id < ${opts.before ?? null})
       AND (${opts.action ?? null}::text IS NULL OR a.action LIKE ${(opts.action ?? "") + "%"})
     ORDER BY a.id DESC
     LIMIT ${limit}`;
  return rows.map((r) => ({ ...r, id: Number(r.id) }));
}
