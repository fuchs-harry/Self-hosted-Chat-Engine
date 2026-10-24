import type { Metadata } from "next";
import { Page } from "@/components/page";
import { listAudit } from "@/lib/audit-log";
import { getT } from "@/lib/i18n/server";
import { AuditTable } from "./audit-table";

export const metadata: Metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const [t, rows] = await Promise.all([getT(), listAudit({ limit: 100 })]);
  return (
    <Page title={t.admin.tabs.audit} subtitle={t.admin.audit.subtitle}>
      <AuditTable initial={JSON.parse(JSON.stringify(rows))} />
    </Page>
  );
}
