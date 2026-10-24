"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/components/i18n-provider";

export type SettingField =
  | { key: string; kind: "text"; label: string; hint?: string; placeholder?: string; rows?: number }
  | { key: string; kind: "bool"; label: string; hint?: string }
  | { key: string; kind: "number"; label: string; hint?: string; suffix?: string; min?: number; max?: number };

/** Edits a group of org settings and saves them together. */
export function SettingsForm({
  fields,
  initial,
}: {
  fields: SettingField[];
  initial: Record<string, string | number | boolean>;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const dirty = fields.some((f) => values[f.key] !== initial[f.key]);

  return (
    <Card>
      <CardContent>
        <form
          className="flex flex-col gap-6"
          onSubmit={async (e) => {
            e.preventDefault();
            setState("saving");
            await fetch("/api/admin/settings", {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(values),
            });
            setState("saved");
            router.refresh();
          }}
        >
          {fields.map((f) => {
            const id = `s-${f.key}`;
            if (f.kind === "bool") {
              return (
                <div key={f.key} className="flex flex-col gap-1.5">
                  <label className="flex items-center gap-3 text-sm font-medium">
                    <Switch
                      checked={Boolean(values[f.key])}
                      onCheckedChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
                    />
                    {f.label}
                  </label>
                  {f.hint && <p className="pl-12 text-xs text-muted-foreground">{f.hint}</p>}
                </div>
              );
            }
            if (f.kind === "number") {
              return (
                <Field key={f.key} label={f.label} htmlFor={id} hint={f.hint}>
                  <div className="flex items-center gap-2">
                    <Input
                      id={id}
                      type="number"
                      min={f.min}
                      max={f.max}
                      className="w-28"
                      value={Number(values[f.key])}
                      onChange={(e) => setValues((s) => ({ ...s, [f.key]: Number(e.target.value) }))}
                    />
                    {f.suffix && <span className="text-sm text-muted-foreground">{f.suffix}</span>}
                  </div>
                </Field>
              );
            }
            return (
              <Field key={f.key} label={f.label} htmlFor={id} hint={f.hint}>
                <Textarea
                  id={id}
                  rows={f.rows ?? 6}
                  placeholder={f.placeholder}
                  value={String(values[f.key] ?? "")}
                  onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))}
                />
              </Field>
            );
          })}
          <div className="flex justify-end">
            <Button type="submit" disabled={!dirty || state === "saving"}>
              {state === "saving" && <Loader2 className="animate-spin" />}
              {state === "saved" && !dirty && <Check />}
              {state === "saved" && !dirty ? t.common.saved : t.common.save}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
