"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, ExternalLink, KeyRound, Loader2, Lock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ResidencyBadge } from "@/components/residency-badge";
import { useI18n } from "@/components/i18n-provider";
import type { ProviderView } from "@/lib/providers/admin";
import type { ProviderDef, Residency } from "@/lib/providers/catalog";
import type { ModelOption } from "@/lib/providers/registry";
import { cn } from "@/lib/utils";

async function saveSettings(patch: Record<string, unknown>) {
  await fetch("/api/admin/settings", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export function ModelPolicy({
  options,
  defaultModel,
  euOnly,
}: {
  options: ModelOption[];
  defaultModel: string;
  euOnly: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [eu, setEu] = useState(euOnly);
  const m = t.admin.models;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.general}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-2">
        <Field label={m.defaultModel} htmlFor="default-model">
          <Select
            id="default-model"
            defaultValue={defaultModel}
            onChange={async (e) => {
              await saveSettings({ default_model: e.target.value });
              router.refresh();
            }}
          >
            <option value="">{m.automatic}</option>
            {options.map((o) => (
              <option key={o.key} value={o.key}>
                {o.providerName} · {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-3 pt-6 text-sm font-medium">
            <Switch
              checked={eu}
              onCheckedChange={async (v) => {
                setEu(v);
                await saveSettings({ eu_only: v });
                router.refresh();
              }}
            />
            {m.euOnly}
          </label>
          <p className="pl-12 text-xs text-muted-foreground">{m.euOnlyHint}</p>
        </div>
      </CardContent>
    </Card>
  );
}

const GROUPS: { key: "onprem" | "eu" | "other"; match: (r: Residency) => boolean }[] = [
  { key: "onprem", match: (r) => r === "on-prem" },
  { key: "eu", match: (r) => r === "eu" },
  { key: "other", match: (r) => r === "eu-optional" || r === "non-eu" },
];

export function ProviderList({ defs, views }: { defs: ProviderDef[]; views: ProviderView[] }) {
  const { t } = useI18n();
  return (
    <>
      {GROUPS.map((g) => (
        <section key={g.key}>
          <h2 className="eyebrow mb-3">{t.admin.models[g.key]}</h2>
          <div className="flex flex-col gap-2">
            {defs
              .filter((d) => g.match(d.residency))
              .map((def) => (
                <ProviderCard key={def.id} def={def} view={views.find((v) => v.id === def.id)!} />
              ))}
          </div>
        </section>
      ))}
    </>
  );
}

function ProviderCard({ def, view }: { def: ProviderDef; view: ProviderView }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const m = t.admin.models;
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [models, setModels] = useState(view.models.join(", "));
  const [enabled, setEnabled] = useState(view.enabled);
  const [busy, setBusy] = useState<"test" | "save" | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const modelList = models
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  async function test() {
    setBusy("test");
    setResult(null);
    const res = await fetch(`/api/admin/providers/${def.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ values, model: modelList[0] }),
    });
    const body = (await res.json()) as { ok: boolean; message: string; latencyMs?: number };
    setResult({ ok: body.ok, text: body.latencyMs ? `${body.message} · ${body.latencyMs} ms` : body.message });
    setBusy(null);
  }

  async function save() {
    setBusy("save");
    await fetch(`/api/admin/providers/${def.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        enabled,
        values,
        models: view.modelsFromEnv ? undefined : modelList.length ? modelList : null,
      }),
    });
    setBusy(null);
    setValues({});
    setResult({ ok: true, text: m.saved });
    router.refresh();
  }

  return (
    <div className={cn("rounded-xl border bg-card", view.configured && view.enabled ? "border-white/25" : "border-border")}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-muted font-mono text-[11px]">
          {def.hq}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{def.name}</span>
            <ResidencyBadge residency={def.residency} />
            {view.configured ? (
              <Badge tone={view.enabled ? "success" : "neutral"}>
                {view.enabled ? m.connected : t.common.disabled}
              </Badge>
            ) : null}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {m.operator}: {def.operator}
            {view.configured ? ` · ${view.models.slice(0, 3).join(", ")}` : ""}
          </span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="flex flex-col gap-4 border-t border-border px-4 py-4">
          <p className="text-sm text-muted-foreground">{def.note[locale]}</p>
          <div className="flex flex-wrap gap-3 text-xs">
            {def.keyUrl && (
              <a href={def.keyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
                <KeyRound className="size-3.5" />
                {m.getKey}
              </a>
            )}
            {def.docsUrl && (
              <a href={def.docsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
                <ExternalLink className="size-3.5" />
                {m.docs}
              </a>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {def.fields.map((f) => {
              const locked = view.envFields.includes(f.key);
              const id = `${def.id}-${f.key}`;
              const current = view.values[f.key];
              return (
                <Field
                  key={f.key}
                  label={f.label[locale]}
                  htmlFor={id}
                  className={f.multiline ? "md:col-span-2" : ""}
                  hint={
                    locked ? (
                      <span className="inline-flex items-center gap-1">
                        <Lock className="size-3" />
                        {m.fromEnv} ({f.env})
                      </span>
                    ) : (
                      (f.hint?.[locale] ?? <span className="font-mono">{f.env}</span>)
                    )
                  }
                >
                  {f.multiline ? (
                    <Textarea
                      id={id}
                      disabled={locked}
                      className="font-mono text-xs"
                      placeholder={current || f.placeholder}
                      value={values[f.key] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    />
                  ) : (
                    <Input
                      id={id}
                      type={f.secret ? "password" : "text"}
                      autoComplete="off"
                      disabled={locked}
                      placeholder={current || f.placeholder}
                      value={values[f.key] ?? (f.secret ? "" : current && current !== f.default ? current : "")}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    />
                  )}
                </Field>
              );
            })}
            <Field
              label={m.modelsField}
              htmlFor={`${def.id}-models`}
              className="md:col-span-2"
              hint={view.modelsFromEnv ? `${m.fromEnv}` : m.modelsHint}
            >
              <Input
                id={`${def.id}-models`}
                value={models}
                disabled={view.modelsFromEnv}
                onChange={(e) => setModels(e.target.value)}
                className="font-mono text-xs"
              />
            </Field>
          </div>

          {result && (
            <p
              className={cn(
                "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm break-all",
                result.ok ? "border-success/30 text-success" : "border-destructive/30 text-destructive",
              )}
            >
              {result.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <XCircle className="mt-0.5 size-4 shrink-0" />}
              {result.text}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={enabled} onCheckedChange={setEnabled} />
              {enabled ? t.common.enabled : t.common.disabled}
            </label>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void test()} disabled={busy !== null}>
                {busy === "test" && <Loader2 className="animate-spin" />}
                {busy === "test" ? m.testing : m.test}
              </Button>
              <Button onClick={() => void save()} disabled={busy !== null}>
                {busy === "save" && <Loader2 className="animate-spin" />}
                {t.common.save}
              </Button>
            </div>
          </div>
          <CardDescription className="text-[11.5px]">{def.id}</CardDescription>
        </div>
      )}
    </div>
  );
}
