import type { Metadata } from "next";
import Link from "next/link";
import { Building2, FolderLock, Library } from "lucide-react";
import { Page } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth/session";
import { fmt } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";
import { listKnowledgeBases } from "@/lib/knowledge";
import { NewKnowledgeBase } from "./new-knowledge-base";

export const metadata: Metadata = { title: "Knowledge" };

export default async function KnowledgePage() {
  const user = await requireUser();
  const [t, kbs] = await Promise.all([getT(), listKnowledgeBases(user)]);

  return (
    <Page
      title={t.knowledge.title}
      subtitle={t.knowledge.subtitle}
      actions={<NewKnowledgeBase isAdmin={user.role === "admin"} />}
    >
      {kbs.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-6 py-16 text-center">
          <Library className="size-8 text-muted-foreground" />
          <p className="mt-4 font-medium">{t.knowledge.empty}</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">{t.knowledge.emptyHint}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {kbs.map((kb) => (
            <Link
              key={kb.id}
              href={`/knowledge/${kb.id}`}
              className="group flex flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-white/25"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="grid size-9 place-items-center rounded-lg border border-border bg-muted">
                  {kb.visibility === "org" ? (
                    <Building2 className="size-4" />
                  ) : (
                    <FolderLock className="size-4" />
                  )}
                </span>
                <Badge tone={kb.visibility === "org" ? "strong" : "neutral"}>
                  {kb.visibility === "org" ? t.knowledge.org : t.knowledge.private}
                </Badge>
              </div>
              <h2 className="mt-4 font-semibold">{kb.name}</h2>
              {kb.description && (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{kb.description}</p>
              )}
              <p className="mt-auto pt-4 text-xs text-muted-foreground">
                {fmt(t.knowledge.documentsCount, { n: kb.document_count })} ·{" "}
                {fmt(t.knowledge.readyCount, { n: kb.ready_count })}
              </p>
            </Link>
          ))}
        </div>
      )}
    </Page>
  );
}
