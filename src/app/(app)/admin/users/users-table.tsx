"use client";

import { useState } from "react";
import { KeyRound, Loader2, MoreHorizontal, ShieldCheck, ShieldOff, Trash2, UserPlus, Ban, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, Input, Select } from "@/components/ui/input";
import { useI18n } from "@/components/i18n-provider";

type Row = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member";
  disabled: boolean;
  created_at: string;
  last_login_at: string | null;
};

/** Readable random password for first sign-in. */
function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length])
    .join("")
    .replace(/(.{4})(?!$)/g, "$1-");
}

export function UsersTable({ initial, meId }: { initial: Row[]; meId: string }) {
  const { t, locale } = useI18n();
  const u = t.admin.users;
  const [users, setUsers] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [resetFor, setResetFor] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const res = await fetch("/api/admin/users");
    if (res.ok) setUsers(await res.json());
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) setError(((await res.json()) as { error?: string }).error ?? t.common.error);
    await reload();
  }

  const dateFmt = new Intl.DateTimeFormat(locale === "de" ? "de-AT" : "en-GB", { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="chrome" onClick={() => setAdding(true)}>
          <UserPlus />
          {u.add}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-left">
            <tr className="[&>th]:px-4 [&>th]:py-2.5 [&>th]:font-mono [&>th]:text-[10.5px] [&>th]:font-normal [&>th]:tracking-[0.14em] [&>th]:text-muted-foreground [&>th]:uppercase">
              <th>{t.common.name}</th>
              <th>{u.role}</th>
              <th className="hidden md:table-cell">{u.lastLogin}</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((row) => (
              <tr key={row.id} className={`[&>td]:px-4 [&>td]:py-2.5 ${row.disabled ? "opacity-50" : ""}`}>
                <td>
                  <span className="block font-medium">{row.name || "—"}</span>
                  <span className="block text-xs text-muted-foreground">{row.email}</span>
                </td>
                <td>
                  <span className="flex flex-wrap gap-1.5">
                    <Badge tone={row.role === "admin" ? "strong" : "neutral"}>
                      {row.role === "admin" ? u.admin : u.member}
                    </Badge>
                    {row.disabled && <Badge tone="danger">{u.disabled}</Badge>}
                  </span>
                </td>
                <td className="hidden text-muted-foreground md:table-cell">
                  {row.last_login_at ? dateFmt.format(new Date(row.last_login_at)) : t.common.never}
                </td>
                <td>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="grid size-7 place-items-center rounded-md text-muted-foreground outline-none hover:bg-muted">
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setResetFor(row)}>
                        <KeyRound />
                        {u.resetPassword}
                      </DropdownMenuItem>
                      {row.id !== meId && (
                        <>
                          <DropdownMenuItem
                            onSelect={() => void patch(row.id, { role: row.role === "admin" ? "member" : "admin" })}
                          >
                            {row.role === "admin" ? <ShieldOff /> : <ShieldCheck />}
                            {row.role === "admin" ? u.makeMember : u.makeAdmin}
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => void patch(row.id, { disabled: !row.disabled })}>
                            {row.disabled ? <Undo2 /> : <Ban />}
                            {row.disabled ? u.enable : u.disable}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem destructive onSelect={() => setDeleting(row)}>
                            <Trash2 />
                            {t.common.delete}
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AddUserDialog open={adding} onClose={() => setAdding(false)} onCreated={reload} />
      <PasswordDialog user={resetFor} onClose={() => setResetFor(null)} onSave={(pw) => patch(resetFor!.id, { password: pw })} />

      <Dialog open={Boolean(deleting)} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>
            {t.common.delete}: {deleting?.email}?
          </DialogTitle>
          <DialogDescription>{u.deleteBody}</DialogDescription>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                const res = await fetch(`/api/admin/users/${deleting!.id}`, { method: "DELETE" });
                if (!res.ok) setError(((await res.json()) as { error?: string }).error ?? t.common.error);
                setDeleting(null);
                await reload();
              }}
            >
              {t.common.delete}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddUserDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => Promise<void> }) {
  const { t } = useI18n();
  const u = t.admin.users;
  const [password, setPassword] = useState(generatePassword);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>{u.add}</DialogTitle>
        <form
          className="mt-5 flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            setBusy(true);
            setError(null);
            const res = await fetch("/api/admin/users", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                name: form.get("name"),
                email: form.get("email"),
                role: form.get("role"),
                password,
              }),
            });
            setBusy(false);
            if (!res.ok) return setError(((await res.json()) as { error?: string }).error ?? t.common.error);
            await onCreated();
            setPassword(generatePassword());
            onClose();
          }}
        >
          <Field label={t.common.name} htmlFor="nu-name">
            <Input id="nu-name" name="name" required maxLength={120} />
          </Field>
          <Field label={t.auth.email} htmlFor="nu-email">
            <Input id="nu-email" name="email" type="email" required />
          </Field>
          <Field label={u.role} htmlFor="nu-role">
            <Select id="nu-role" name="role" defaultValue="member">
              <option value="member">{u.member}</option>
              <option value="admin">{u.admin}</option>
            </Select>
          </Field>
          <Field label={u.initialPassword} htmlFor="nu-pw" hint={u.initialPasswordHint}>
            <Input id="nu-pw" value={password} onChange={(e) => setPassword(e.target.value)} minLength={10} className="font-mono" />
          </Field>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
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

function PasswordDialog({ user, onClose, onSave }: { user: Row | null; onClose: () => void; onSave: (pw: string) => Promise<void> }) {
  const { t } = useI18n();
  const [password, setPassword] = useState(generatePassword);
  return (
    <Dialog open={Boolean(user)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogTitle>{t.admin.users.resetPassword}</DialogTitle>
        <DialogDescription>{user?.email}</DialogDescription>
        <form
          className="mt-4 flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            await onSave(password);
            setPassword(generatePassword());
            onClose();
          }}
        >
          <Input value={password} onChange={(e) => setPassword(e.target.value)} minLength={10} className="font-mono" />
          <p className="text-xs text-muted-foreground">{t.admin.users.initialPasswordHint}</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <Button type="submit">{t.common.save}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
