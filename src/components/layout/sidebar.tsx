"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  Brain,
  Check,
  Languages,
  LogOut,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import { setLocale } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/components/i18n-provider";
import type { ChatSummary } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

export type SidebarProps = {
  appName: string;
  chats: ChatSummary[];
  user: { name: string; email: string; role: "admin" | "member" };
};

export function Sidebar({ appName, chats, user }: SidebarProps) {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ChatSummary[] | null>(null);
  const [renaming, setRenaming] = useState<ChatSummary | null>(null);
  const [deleting, setDeleting] = useState<ChatSummary | null>(null);
  const [, startTransition] = useTransition();

  const list = results ?? chats;
  const pinned = useMemo(() => list.filter((c) => c.pinned), [list]);
  const recent = useMemo(() => list.filter((c) => !c.pinned), [list]);

  async function search(q: string) {
    setQuery(q);
    if (!q.trim()) return setResults(null);
    const res = await fetch(`/api/chats?q=${encodeURIComponent(q)}`);
    if (res.ok) setResults(await res.json());
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/chats/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    router.refresh();
  }

  async function remove(id: string) {
    await fetch(`/api/chats/${id}`, { method: "DELETE" });
    setDeleting(null);
    if (pathname === `/chat/${id}`) router.push("/");
    router.refresh();
  }

  const nav = [
    { href: "/knowledge", label: t.nav.knowledge, icon: BookOpen },
    { href: "/settings", label: t.nav.settings, icon: Brain },
    ...(user.role === "admin" ? [{ href: "/admin", label: t.nav.admin, icon: ShieldCheck }] : []),
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mark.svg" alt="" className="size-7" />
        <span className="truncate text-[15px] font-semibold tracking-tight">{appName}</span>
      </div>

      <div className="px-3">
        <Button
          variant="chrome-outline"
          className="w-full justify-start"
          onClick={() => {
            router.push(`/?new=${Date.now()}`);
          }}
        >
          <Plus />
          {t.nav.newChat}
        </Button>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => void search(e.target.value)}
            placeholder={t.nav.searchChats}
            className="h-8 pl-8 text-[13px]"
          />
        </div>
      </div>

      <nav className="mt-3 flex-1 overflow-y-auto px-2 pb-3">
        {pinned.length > 0 && (
          <Section label={t.nav.pinned}>
            {pinned.map((c) => (
              <ChatItem
                key={c.id}
                chat={c}
                active={pathname === `/chat/${c.id}`}
                onRename={() => setRenaming(c)}
                onTogglePin={() => patch(c.id, { pinned: false })}
                onDelete={() => setDeleting(c)}
              />
            ))}
          </Section>
        )}
        <Section label={t.nav.chats}>
          {recent.length === 0 && pinned.length === 0 ? (
            <p className="px-2 py-1.5 text-[13px] text-muted-foreground">{t.nav.noChats}</p>
          ) : (
            recent.map((c) => (
              <ChatItem
                key={c.id}
                chat={c}
                active={pathname === `/chat/${c.id}`}
                onRename={() => setRenaming(c)}
                onTogglePin={() => patch(c.id, { pinned: true })}
                onDelete={() => setDeleting(c)}
              />
            ))
          )}
        </Section>
      </nav>

      <div className="border-t border-border p-2">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13.5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              pathname.startsWith(item.href) && "bg-muted text-foreground",
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        ))}

        <DropdownMenu>
          <DropdownMenuTrigger className="mt-1 flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left outline-none hover:bg-muted">
            <span className="grid size-7 shrink-0 place-items-center rounded-full border border-border bg-muted text-xs font-semibold uppercase">
              {(user.name || user.email).slice(0, 1)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">{user.name || user.email}</span>
              <span className="block truncate text-[11.5px] text-muted-foreground">{user.email}</span>
            </span>
            <Settings2 className="size-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-60">
            <DropdownMenuLabel>
              <Languages className="mr-1 inline size-3" />
              {t.nav.language}
            </DropdownMenuLabel>
            {(["de", "en"] as const).map((l) => (
              <DropdownMenuItem
                key={l}
                onSelect={() =>
                  startTransition(async () => {
                    await setLocale(l);
                    router.refresh();
                  })
                }
              >
                <Check className={cn(locale !== l && "invisible")} />
                {l === "de" ? "Deutsch" : "English"}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => startTransition(() => logout())}>
              <LogOut />
              {t.auth.signOut}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <RenameDialog
        chat={renaming}
        onClose={() => setRenaming(null)}
        onSave={async (title) => {
          if (renaming) await patch(renaming.id, { title });
          setRenaming(null);
        }}
      />
      <Dialog open={Boolean(deleting)} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle>{t.chat.deleteTitle}</DialogTitle>
          <DialogDescription>{t.chat.deleteBody}</DialogDescription>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              {t.common.cancel}
            </Button>
            <Button variant="destructive" onClick={() => deleting && remove(deleting.id)}>
              {t.common.delete}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="eyebrow px-2 pt-2 pb-1">{label}</p>
      <ul className="flex flex-col">{children}</ul>
    </div>
  );
}

function ChatItem({
  chat,
  active,
  onRename,
  onTogglePin,
  onDelete,
}: {
  chat: ChatSummary;
  active: boolean;
  onRename: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  return (
    <li className="group relative">
      <Link
        href={`/chat/${chat.id}`}
        className={cn(
          "block truncate rounded-md py-1.5 pr-8 pl-2 text-[13.5px] text-foreground/80 transition-colors hover:bg-muted hover:text-foreground",
          active && "bg-muted text-foreground",
        )}
      >
        {chat.title || "…"}
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="absolute top-1/2 right-1 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground opacity-0 outline-none group-hover:opacity-100 hover:bg-white/10 data-[state=open]:opacity-100"
          aria-label={t.common.actions}
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={onRename}>
            <Pencil />
            {t.nav.rename}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onTogglePin}>
            {chat.pinned ? <PinOff /> : <Pin />}
            {chat.pinned ? t.nav.unpin : t.nav.pin}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={onDelete}>
            <Trash2 />
            {t.common.delete}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function RenameDialog({
  chat,
  onClose,
  onSave,
}: {
  chat: ChatSummary | null;
  onClose: () => void;
  onSave: (title: string) => Promise<void>;
}) {
  const { t } = useI18n();
  return (
    <Dialog open={Boolean(chat)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogTitle>{t.chat.renameTitle}</DialogTitle>
        <form
          className="mt-4 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const title = String(new FormData(e.currentTarget).get("title") ?? "").trim();
            if (title) void onSave(title);
          }}
        >
          <Input name="title" defaultValue={chat?.title} maxLength={120} autoFocus />
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
