"use client";

import { AlertCircle, Brain, Download, FileText, FileType2, Loader2, Search } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import type { GeneratedFile } from "@/lib/documents";
import { formatBytes } from "@/lib/utils";

/** Shape shared by all tool UI parts (`tool-<name>`). */
type ToolPartLike = {
  type: string;
  state: "input-streaming" | "input-available" | "output-available" | "output-error" | string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

const FORMAT_LABEL: Record<string, string> = { pdf: "PDF", docx: "Word", md: "Markdown" };

export function ToolPart({ part }: { part: ToolPartLike }) {
  const name = part.type.replace(/^tool-/, "");
  if (name === "create_document") return <DocumentCard part={part} />;
  if (name === "search_knowledge") return <SearchChip part={part} />;
  if (name === "remember") return <MemoryChip part={part} />;
  return null;
}

function DocumentCard({ part }: { part: ToolPartLike }) {
  const { t } = useI18n();
  const input = (part.input ?? {}) as { title?: string; format?: string };

  if (part.state === "output-error") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
        <AlertCircle className="size-4 text-destructive" />
        <span>{t.tools.documentFailed}</span>
        {part.errorText && <span className="truncate text-muted-foreground">{part.errorText}</span>}
      </div>
    );
  }

  if (part.state !== "output-available") {
    return (
      <div className="flex w-full max-w-md items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-muted">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{input.title || t.tools.creatingDocument}</span>
          <span className="mt-1 block h-1.5 w-32 animate-pulse rounded bg-muted" />
        </span>
      </div>
    );
  }

  const file = part.output as GeneratedFile;
  const Icon = file.format === "docx" ? FileType2 : FileText;
  return (
    <a
      href={file.url}
      download={file.filename}
      className="group/doc flex w-full max-w-md items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-white/30"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-white/15 bg-gradient-to-b from-white/10 to-transparent">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{file.title}</span>
        <span className="block text-xs text-muted-foreground">
          {FORMAT_LABEL[file.format] ?? file.format} · {formatBytes(file.size)}
        </span>
      </span>
      <span className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors group-hover/doc:text-foreground">
        <Download className="size-3.5" />
        {t.tools.download}
      </span>
    </a>
  );
}

function SearchChip({ part }: { part: ToolPartLike }) {
  const { t } = useI18n();
  const q = ((part.input ?? {}) as { query?: string }).query ?? "";
  const n = Array.isArray(part.output) ? part.output.length : null;
  const busy = part.state === "input-streaming" || part.state === "input-available";
  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-lg border border-border bg-card/60 px-2.5 py-1 text-[12.5px] text-muted-foreground">
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
      <span className="truncate">{busy && !q ? t.tools.searching : fmt(t.tools.searched, { q })}</span>
      {n !== null && <span className="shrink-0">· {fmt(t.tools.results, { n })}</span>}
    </span>
  );
}

function MemoryChip({ part }: { part: ToolPartLike }) {
  const { t } = useI18n();
  const busy = part.state !== "output-available";
  const fact = ((part.input ?? {}) as { fact?: string }).fact;
  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-lg border border-border bg-card/60 px-2.5 py-1 text-[12.5px] text-muted-foreground">
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Brain className="size-3.5" />}
      <span className="truncate">
        {busy ? t.tools.remembering : t.tools.remembered}
        {fact ? `: ${fact}` : ""}
      </span>
    </span>
  );
}
