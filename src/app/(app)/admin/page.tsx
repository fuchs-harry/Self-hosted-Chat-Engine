import type { Metadata } from "next";
import Link from "next/link";
import { Activity, CheckCircle2, Circle, XCircle } from "lucide-react";
import { Page } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmt } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";
import { systemStatus } from "@/lib/status";
import { DemoButton } from "./demo-button";

export const metadata: Metadata = { title: "Administration" };
export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const [t, status, settings] = await Promise.all([getT(), systemStatus(), getSettings()]);
  const o = t.admin.overview;

  const steps = [
    { done: status.providers.length > 0, label: o.stepModel, href: "/admin/models" },
    { done: status.counts.documents > 0, label: o.stepKnowledge, href: "/knowledge" },
    {
      done: Boolean(settings.company_profile || settings.assistant_instructions),
      label: o.stepAssistant,
      href: "/admin/assistant",
    },
    { done: status.counts.users > 1, label: o.stepUsers, href: "/admin/users" },
  ];

  const stats = [
    { label: o.users, value: status.counts.users },
    { label: o.chats, value: status.counts.chats },
    { label: o.documents, value: status.counts.documents },
    { label: o.chunks, value: status.counts.chunks },
  ];

  return (
    <Page title={t.admin.title} subtitle={o.subtitle}>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{o.setup}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {steps.map((s) => (
              <Link
                key={s.label}
                href={s.href}
                className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted"
              >
                {s.done ? (
                  <CheckCircle2 className="size-4 text-success" />
                ) : (
                  <Circle className="size-4 text-muted-foreground" />
                )}
                <span className={s.done ? "text-muted-foreground line-through" : ""}>{s.label}</span>
              </Link>
            ))}
            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-4">
              <DemoButton label={o.demo} done={o.demoDone} />
              <p className="text-xs text-muted-foreground">{o.demoHint}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-4" />
              {o.heartbeat}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="relative flex size-2.5">
                {status.heartbeat.healthy && (
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
                )}
                <span
                  className={`relative inline-flex size-2.5 rounded-full ${status.heartbeat.healthy ? "bg-success" : "bg-destructive"}`}
                />
              </span>
              <span className="text-sm font-medium">
                {status.heartbeat.healthy ? o.heartbeatHealthy : o.heartbeatStale}
              </span>
            </div>
            {status.heartbeat.ageSeconds !== null && (
              <p className="text-xs text-muted-foreground">{fmt(o.lastBeat, { s: status.heartbeat.ageSeconds })}</p>
            )}
            <p className="font-mono text-[11px] text-muted-foreground">{status.heartbeat.node}</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(status.jobs).map(([k, v]) => (
                <Badge key={k} tone={k === "failed" ? "danger" : k === "running" ? "warning" : "neutral"}>
                  {k} {v}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent>
              <p className="eyebrow">{s.label}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{s.value.toLocaleString("de-AT")}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{o.models}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex flex-wrap gap-1.5">
              {status.providers.length ? (
                status.providers.map((p) => (
                  <Badge key={p.id} tone="strong">
                    {p.name}
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
            <div>
              <p className="eyebrow">{o.embedding}</p>
              <p className="mt-1 font-mono text-xs">
                {status.embedding ? `${status.embedding.key} · ${status.embedding.dimensions}d` : o.noEmbedding}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{o.tasks}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              {status.tasks.map((task) => (
                <li key={task.name} className="flex items-start gap-2">
                  {task.last_status === "error" ? (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="font-mono text-xs">{task.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {task.last_error ?? task.last_status}
                      {task.last_run_at &&
                        ` · ${o.ranAt} ${task.last_run_at.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" })}`}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="eyebrow mt-5 mb-2">{o.failures}</p>
            {status.recentFailures.length ? (
              <ul className="flex flex-col gap-1.5 text-xs">
                {status.recentFailures.map((f, i) => (
                  <li key={i} className="truncate text-destructive" title={f.last_error ?? ""}>
                    <span className="font-mono">{f.type}</span> · {f.last_error}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">{o.noFailures}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
