import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Page } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { getT } from "@/lib/i18n/server";
import { canManage, getKnowledgeBase, listDocuments } from "@/lib/knowledge";
import { KnowledgeBaseActions } from "./kb-actions";
import { DocumentsPanel } from "./documents-panel";

type Props = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f-]{36}$/i;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const user = await requireUser();
  const kb = UUID.test(id) ? await getKnowledgeBase(id, user) : null;
  return { title: kb?.name ?? "Knowledge" };
}

export default async function KnowledgeBasePage({ params }: Props) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await requireUser();
  const kb = await getKnowledgeBase(id, user);
  if (!kb) notFound();
  const [t, documents] = await Promise.all([getT(), listDocuments(kb.id)]);
  const manageable = canManage(kb, user);

  return (
    <Page
      eyebrow={t.knowledge.title}
      title={kb.name}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <Badge tone={kb.visibility === "org" ? "strong" : "neutral"}>
            {kb.visibility === "org" ? t.knowledge.org : t.knowledge.private}
          </Badge>
          {kb.description}
        </span>
      }
      actions={manageable ? <KnowledgeBaseActions id={kb.id} /> : null}
    >
      {!manageable && <p className="mb-6 text-sm text-muted-foreground">{t.knowledge.readOnly}</p>}
      <DocumentsPanel
        kbId={kb.id}
        initial={JSON.parse(JSON.stringify(documents))}
        manageable={manageable}
        maxMb={env().MAX_UPLOAD_MB}
      />
    </Page>
  );
}
