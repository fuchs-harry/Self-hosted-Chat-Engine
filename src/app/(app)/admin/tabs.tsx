"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin", key: "overview" },
  { href: "/admin/models", key: "models" },
  { href: "/admin/assistant", key: "assistant" },
  { href: "/admin/privacy", key: "privacy" },
  { href: "/admin/users", key: "users" },
  { href: "/admin/audit", key: "audit" },
] as const;

export function AdminTabs({ labels }: { labels: Record<(typeof TABS)[number]["key"], string> }) {
  const pathname = usePathname();
  return (
    <nav className="border-b border-border">
      <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 sm:px-8">
        {TABS.map((tab) => {
          const active = tab.href === "/admin" ? pathname === "/admin" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "-mb-px border-b-2 px-3 py-3 text-[13.5px] whitespace-nowrap transition-colors",
                active
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {labels[tab.key]}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
