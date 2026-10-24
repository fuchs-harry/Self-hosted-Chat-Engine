"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useI18n } from "@/components/i18n-provider";

export function NewKnowledgeBase({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(form: FormData) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/knowledge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        description: form.get("description") || undefined,
        visibility: form.get("visibility") ?? "private",
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? t.common.error);
      return;
    }
    const { id } = (await res.json()) as { id: string };
    setOpen(false);
    router.push(`/knowledge/${id}`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="chrome">
          <Plus />
          {t.knowledge.new}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>{t.knowledge.new}</DialogTitle>
        <form action={submit} className="mt-5 flex flex-col gap-4">
          <Field label={t.common.name} htmlFor="kb-name">
            <Input id="kb-name" name="name" required maxLength={120} autoFocus />
          </Field>
          <Field label={`${t.common.description} (${t.common.optional})`} htmlFor="kb-desc">
            <Textarea id="kb-desc" name="description" maxLength={2000} className="min-h-20" />
          </Field>
          <Field label={t.knowledge.visibility} htmlFor="kb-vis">
            <Select id="kb-vis" name="visibility" defaultValue={isAdmin ? "org" : "private"}>
              {isAdmin && <option value="org">{t.knowledge.visibilityOrg}</option>}
              <option value="private">{t.knowledge.visibilityPrivate}</option>
            </Select>
          </Field>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {t.common.create}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
