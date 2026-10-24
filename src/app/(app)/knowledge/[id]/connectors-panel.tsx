"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Cloud,
  FolderTree,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plug,
  RefreshCw,
  Server,
  Trash2,
  XCircle,
} from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/components/i18n-provider";
import { CONNECTORS, getConnectorDef, type ConnectorType } from "@/lib/connectors/catalog";
import type { PublicConnector, SyncStats } from "@/lib/connectors";
import { fmt } from "@/lib/i18n";

type Connector = Omit<PublicConnector, "next_sync_at" | "last_sync_at"> & {
  next_sync_at: string;
  last_sync_at: string | null;
};

const ICON: Record<ConnectorType, typeof Cloud> = {
  sharepoint: Cloud,
  folder: FolderTree,
  webdav: Server,
};

const TONE: Record<string, BadgeTone> = {
  ok: "success",
  partial: "warning",
  error: "danger",
  running: "warning",
  queued: "neutral",
};

export function ConnectorsPanel({
  kbId,
  initial,
  isAdmin,
}: {
  kbId: string;
  initial: Connector[];
  isAdmin: boolean;
}) {
  const { t, locale } = useI18n();
  const [connectors, setConnectors] = useState<Connector[]>(initial);
  const [editing, setEditing] = useState<Connector | "new" | null>(null);
  const [removing, setRemoving] = useState<Connector | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/knowledge/${kbId}/connectors`);
    if (res.ok) setConnectors(await res.json());
  }, [kbId]);

  const active = connectors.some((c) => c.last_status === "running" || c.last_status === "queued");
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => void refresh(), 3000);
    return () => clearInterval(timer);
  }, [active, refresh]);

  const dateFmt = new Intl.DateTimeFormat(locale === "de" ? "de-AT" : "en-GB", {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 className="eyebrow">{t.connectors.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.connectors.subtitle}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditing("new")}>
          <Plug />
          {t.connectors.add}
        </Button>
      </div>

      {connectors.length === 0 ? (
        <p className="rounded-xl border border-border px-4 py-6 text-center text-sm text-muted-foreground">
          {t.connectors.none}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {connectors.map((c) => {
            const Icon = ICON[c.type];
            const status = c.enabled ? (c.last_status ?? "queued") : "paused";
            const stats = c.last_stats as SyncStats | null;
            return (
              <li key={c.id} className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-muted">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <span className="truncate">{c.name}</span>
                    <Badge tone={TONE[status] ?? "neutral"}>
                      {status === "running" && <Loader2 className="size-3 animate-spin" />}
                      {status === "paused"
                        ? t.connectors.paused
                        : (t.connectors.status[status as keyof typeof t.connectors.status] ?? status)}
                    </Badge>
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {getConnectorDef(c.type)?.name} · {fmt(t.connectors.documents, { n: c.document_count })}
                    {c.last_sync_at && ` · ${t.connectors.lastSync}: ${dateFmt.format(new Date(c.last_sync_at))}`}
                    {stats && ` · ${fmt(t.connectors.stats, stats)}`}
                  </p>
                  {c.last_error && (
                    <p className="mt-1 line-clamp-2 text-xs whitespace-pre-line text-destructive">{c.last_error}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title={t.connectors.syncNow}
                  onClick={async () => {
                    await fetch(`/api/connectors/${c.id}`, { method: "POST" });
                    await refresh();
                  }}
                >
                  <RefreshCw />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger className="grid size-8 place-items-center rounded-md text-muted-foreground outline-none hover:bg-muted">
                    <MoreHorizontal className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditing(c)}>
                      <Pencil />
                      {t.connectors.edit}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem destructive onSelect={() => setRemoving(c)}>
                      <Trash2 />
                      {t.connectors.remove}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ul>
      )}

      <ConnectorDialog
        kbId={kbId}
        isAdmin={isAdmin}
        connector={editing === "new" ? null : editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await refresh();
        }}
      />

      <Dialog open={Boolean(removing)} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>{t.connectors.remove}?</DialogTitle>
          <DialogDescription>{t.connectors.removeBody}</DialogDescription>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (removing) await fetch(`/api/connectors/${removing.id}`, { method: "DELETE" });
                setRemoving(null);
                await refresh();
              }}
            >
              {t.common.remove}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ConnectorDialog({
  kbId,
  isAdmin,
  connector,
  open,
  onClose,
  onSaved,
}: {
  kbId: string;
  isAdmin: boolean;
  connector: Connector | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { t, locale } = useI18n();
  const [type, setType] = useState<ConnectorType>(connector?.type ?? "sharepoint");
  const [values, setValues] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [interval, setIntervalMinutes] = useState(60);
  const [enabled, setEnabled] = useState(true);
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<"test" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset the form whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    setType(connector?.type ?? "sharepoint");
    setName(connector?.name ?? "");
    setIntervalMinutes(connector?.sync_interval_minutes ?? 60);
    setEnabled(connector?.enabled ?? true);
    const def = connector ? getConnectorDef(connector.type) : null;
    // Secrets come back masked; the inputs start empty and keep the stored value.
    setValues(
      connector && def
        ? Object.fromEntries(def.fields.filter((f) => !f.secret).map((f) => [f.key, connector.config[f.key] ?? ""]))
        : {},
    );
    setTest(null);
    setError(null);
  }, [open, connector]);

  const def = getConnectorDef(type)!;

  async function runTest() {
    setBusy("test");
    setTest(null);
    const res = await fetch("/api/connectors/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type, config: values, id: connector?.id }),
    });
    const body = (await res.json()) as { ok: boolean; summary?: string; error?: string };
    setTest({ ok: body.ok, text: body.ok ? (body.summary ?? "") : (body.error ?? t.common.error) });
    setBusy(null);
  }

  async function save() {
    setBusy("save");
    setError(null);
    const res = connector
      ? await fetch(`/api/connectors/${connector.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, config: values, enabled, intervalMinutes: interval }),
        })
      : await fetch(`/api/knowledge/${kbId}/connectors`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type, name: name || def.name, config: values, intervalMinutes: interval }),
        });
    setBusy(null);
    if (!res.ok) {
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? t.common.error);
      return;
    }
    await onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogTitle>{connector ? t.connectors.edit : t.connectors.add}</DialogTitle>
        <DialogDescription>{def.description[locale]}</DialogDescription>
        <form
          className="mt-5 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          {!connector && (
            <Field label={t.connectors.type} htmlFor="c-type">
              <Select
                id="c-type"
                value={type}
                onChange={(e) => {
                  setType(e.target.value as ConnectorType);
                  setValues({});
                  setTest(null);
                }}
              >
                {CONNECTORS.map((c) => (
                  <option key={c.type} value={c.type} disabled={c.adminOnly && !isAdmin}>
                    {c.name}
                    {c.adminOnly && !isAdmin ? ` (${t.connectors.adminOnly})` : ""}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label={t.common.name} htmlFor="c-name">
            <Input id="c-name" value={name} placeholder={def.name} onChange={(e) => setName(e.target.value)} />
          </Field>
          {def.fields.map((f) => {
            const props = {
              id: `c-${f.key}`,
              value: values[f.key] ?? "",
              required: f.required && !(f.secret && connector),
              placeholder: f.secret && connector ? t.connectors.secretKeep : f.placeholder,
              onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                setValues((v) => ({ ...v, [f.key]: e.target.value })),
            };
            return (
              <Field
                key={f.key}
                label={f.required ? f.label[locale] : `${f.label[locale]} (${t.common.optional})`}
                htmlFor={props.id}
                hint={f.hint?.[locale]}
              >
                {f.key === "credentials" ? (
                  <Textarea {...props} className="font-mono text-xs" />
                ) : (
                  <Input {...props} type={f.secret ? "password" : "text"} autoComplete="off" />
                )}
              </Field>
            );
          })}
          <div className="flex items-end gap-4">
            <Field label={t.connectors.interval} htmlFor="c-interval" className="w-40">
              <div className="flex items-center gap-2">
                <Input
                  id="c-interval"
                  type="number"
                  min={5}
                  max={10080}
                  value={interval}
                  onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                />
                <span className="text-sm text-muted-foreground">{t.connectors.minutes}</span>
              </div>
            </Field>
            {connector && (
              <label className="mb-2 flex items-center gap-2 text-sm">
                <Switch checked={enabled} onCheckedChange={setEnabled} />
                {enabled ? t.common.enabled : t.connectors.paused}
              </label>
            )}
          </div>

          {test && (
            <p
              className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                test.ok ? "border-success/30 text-success" : "border-destructive/30 text-destructive"
              }`}
            >
              {test.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <XCircle className="mt-0.5 size-4 shrink-0" />}
              <span>
                {test.ok && <strong className="mr-1">{t.connectors.testOk}:</strong>}
                {test.text}
              </span>
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <a
              href={`https://github.com/fuchs-harry/Self-hosted-Chat-Engine/blob/main/${def.docs}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {t.connectors.docsLink} ↗
            </a>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void runTest()} disabled={busy !== null}>
                {busy === "test" && <Loader2 className="animate-spin" />}
                {busy === "test" ? t.connectors.testing : t.connectors.test}
              </Button>
              <Button type="submit" disabled={busy !== null}>
                {busy === "save" && <Loader2 className="animate-spin" />}
                {t.common.save}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
