"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Brain, Check, Download, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/components/i18n-provider";

async function patchMe(body: Record<string, unknown>) {
  const res = await fetch("/api/me", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string; signedOut?: boolean };
  return { ok: res.ok, ...json };
}

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.settings.profile}</CardTitle>
        <CardDescription>{email}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex items-end gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setState("saving");
            await patchMe({ name: value });
            setState("saved");
            router.refresh();
          }}
        >
          <Field label={t.common.name} htmlFor="p-name" className="flex-1">
            <Input id="p-name" value={value} onChange={(e) => setValue(e.target.value)} maxLength={120} required />
          </Field>
          <Button type="submit" variant="outline" disabled={state === "saving" || value.trim() === name}>
            {state === "saved" && value.trim() === name ? <Check /> : null}
            {state === "saved" && value.trim() === name ? t.common.saved : t.common.save}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

type Mem = {
  id: string;
  content: string;
  category: string;
  source: "auto" | "tool" | "manual";
  updated_at: string;
};

export function MemoryPanel({
  initial,
  enabled,
  orgEnabled,
}: {
  initial: Mem[];
  enabled: boolean;
  orgEnabled: boolean;
}) {
  const { t } = useI18n();
  const [memories, setMemories] = useState(initial);
  const [on, setOn] = useState(enabled);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  async function reload() {
    const res = await fetch("/api/me/memories");
    if (res.ok) setMemories(await res.json());
  }

  const sourceLabel = { auto: t.settings.sourceAuto, tool: t.settings.sourceTool, manual: t.settings.sourceManual };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="size-4" />
          {t.settings.memory}
        </CardTitle>
        <CardDescription>{t.settings.memoryHint}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!orgEnabled ? (
          <p className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-sm">{t.settings.memoryOrgOff}</p>
        ) : (
          <label className="flex items-center gap-3 text-sm">
            <Switch
              checked={on}
              onCheckedChange={async (v) => {
                setOn(v);
                await patchMe({ memory_enabled: v });
              }}
            />
            {t.settings.memoryToggle}
          </label>
        )}

        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {memories.length === 0 && (
            <li className="px-3 py-4 text-center text-sm text-muted-foreground">{t.settings.memoryEmpty}</li>
          )}
          {memories.map((m) => (
            <li key={m.id} className="group flex items-center gap-3 px-3 py-2">
              {editing?.id === m.id ? (
                <form
                  className="flex flex-1 items-center gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await fetch(`/api/me/memories/${m.id}`, {
                      method: "PATCH",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ content: editing.text }),
                    });
                    setEditing(null);
                    await reload();
                  }}
                >
                  <Input
                    autoFocus
                    value={editing.text}
                    maxLength={300}
                    onChange={(e) => setEditing({ id: m.id, text: e.target.value })}
                    className="h-8"
                  />
                  <Button type="submit" size="icon-sm" variant="ghost">
                    <Check />
                  </Button>
                  <Button size="icon-sm" variant="ghost" onClick={() => setEditing(null)}>
                    <X />
                  </Button>
                </form>
              ) : (
                <>
                  <span className="flex-1 text-sm">{m.content}</span>
                  <Badge>{sourceLabel[m.source]}</Badge>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={() => setEditing({ id: m.id, text: m.content })}
                    title={t.common.edit}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100"
                    title={t.common.delete}
                    onClick={async () => {
                      await fetch(`/api/me/memories/${m.id}`, { method: "DELETE" });
                      await reload();
                    }}
                  >
                    <Trash2 />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>

        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (draft.trim().length < 3) return;
            await fetch("/api/me/memories", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ content: draft }),
            });
            setDraft("");
            await reload();
          }}
        >
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t.settings.addMemoryPlaceholder}
            maxLength={300}
          />
          <Button type="submit" variant="outline" disabled={draft.trim().length < 3}>
            <Plus />
            {t.settings.addMemory}
          </Button>
        </form>

        {memories.length > 0 && (
          <div>
            <Button variant="ghost" size="sm" onClick={() => setConfirmAll(true)}>
              <Trash2 />
              {t.settings.forgetAll}
            </Button>
          </div>
        )}

        <Confirm
          open={confirmAll}
          title={`${t.settings.forgetAll}?`}
          body={t.settings.forgetAllBody}
          onCancel={() => setConfirmAll(false)}
          onConfirm={async () => {
            await fetch("/api/me/memories", { method: "DELETE" });
            setConfirmAll(false);
            await reload();
          }}
        />
      </CardContent>
    </Card>
  );
}

export function PasswordForm() {
  const { t } = useI18n();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.settings.password}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            setBusy(true);
            setError(null);
            const res = await patchMe({
              currentPassword: form.get("current"),
              newPassword: form.get("next"),
            });
            setBusy(false);
            if (!res.ok) return setError(res.error ?? t.common.error);
            // All sessions end with a password change.
            router.push("/login?changed=1");
          }}
        >
          <Field label={t.settings.currentPassword} htmlFor="pw-current">
            <Input id="pw-current" name="current" type="password" autoComplete="current-password" required />
          </Field>
          <Field label={t.settings.newPassword} htmlFor="pw-next">
            <Input id="pw-next" name="next" type="password" autoComplete="new-password" minLength={10} required />
          </Field>
          <Button type="submit" variant="outline" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {t.settings.changePassword}
          </Button>
        </form>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        <p className="mt-2 text-xs text-muted-foreground">{t.auth.passwordHint}</p>
      </CardContent>
    </Card>
  );
}

export function PrivacyPanel() {
  const { t } = useI18n();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.settings.privacy}</CardTitle>
        <CardDescription>{t.settings.privacyHint}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <a href="/api/me/export" download className={buttonVariants({ variant: "outline" })}>
          <Download />
          {t.settings.export}
        </a>
        <Button variant="destructive" onClick={() => setConfirm(true)}>
          <Trash2 />
          {t.settings.deleteChats}
        </Button>
        <Confirm
          open={confirm}
          title={`${t.settings.deleteChats}?`}
          body={t.settings.deleteChatsBody}
          onCancel={() => setConfirm(false)}
          onConfirm={async () => {
            await fetch("/api/me/chats", { method: "DELETE" });
            setConfirm(false);
            router.push("/");
            router.refresh();
          }}
        />
      </CardContent>
    </Card>
  );
}

function Confirm({
  open,
  title,
  body,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{body}</DialogDescription>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            {t.common.cancel}
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onConfirm();
              setBusy(false);
            }}
          >
            {busy && <Loader2 className="animate-spin" />}
            {t.common.delete}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
