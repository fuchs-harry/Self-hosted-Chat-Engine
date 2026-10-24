"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { useI18n } from "@/components/i18n-provider";

type Row = {
  id: number;
  at: string;
  action: string;
  target: string | null;
  detail: Record<string, unknown>;
  user_email: string | null;
};

const PREFIXES = ["", "auth", "chat", "knowledge", "document", "connector", "provider", "settings", "user", "memory", "data", "retention"];

export function AuditTable({ initial }: { initial: Row[] }) {
  const { t, locale } = useI18n();
  const a = t.admin.audit;
  const [rows, setRows] = useState(initial);
  const [action, setAction] = useState("");
  const [done, setDone] = useState(initial.length < 100);

  async function load(opts: { before?: number; action: string; append: boolean }) {
    const params = new URLSearchParams();
    if (opts.before) params.set("before", String(opts.before));
    if (opts.action) params.set("action", opts.action);
    const res = await fetch(`/api/admin/audit?${params}`);
    const page = (await res.json()) as Row[];
    setRows((r) => (opts.append ? [...r, ...page] : page));
    setDone(page.length < 100);
  }

  const dateFmt = new Intl.DateTimeFormat(locale === "de" ? "de-AT" : "en-GB", { dateStyle: "short", timeStyle: "medium" });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select
          value={action}
          className="w-48"
          onChange={(e) => {
            setAction(e.target.value);
            void load({ action: e.target.value, append: false });
          }}
        >
          {PREFIXES.map((p) => (
            <option key={p} value={p}>
              {p || `${a.action}: *`}
            </option>
          ))}
        </Select>
        <Button variant="outline" size="sm" onClick={() => (window.location.href = `/api/admin/audit?format=csv${action ? `&action=${action}` : ""}`)}>
          <Download />
          {a.csv}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-left">
            <tr className="[&>th]:px-4 [&>th]:py-2.5 [&>th]:font-mono [&>th]:text-[10.5px] [&>th]:font-normal [&>th]:tracking-[0.14em] [&>th]:text-muted-foreground [&>th]:uppercase">
              <th>{a.when}</th>
              <th>{a.who}</th>
              <th>{a.action}</th>
              <th className="hidden lg:table-cell">{a.details}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id} className="align-top [&>td]:px-4 [&>td]:py-2">
                <td className="whitespace-nowrap text-muted-foreground tabular-nums">{dateFmt.format(new Date(r.at))}</td>
                <td className="max-w-[200px] truncate">{r.user_email ?? <span className="text-muted-foreground">{a.system}</span>}</td>
                <td className="font-mono text-xs">{r.action}</td>
                <td className="hidden max-w-[360px] truncate font-mono text-[11px] text-muted-foreground lg:table-cell" title={JSON.stringify(r.detail)}>
                  {Object.keys(r.detail).length ? JSON.stringify(r.detail) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!done && (
        <div className="flex justify-center">
          <Button variant="ghost" onClick={() => void load({ before: rows.at(-1)?.id, action, append: true })}>
            {a.more}
          </Button>
        </div>
      )}
    </div>
  );
}
