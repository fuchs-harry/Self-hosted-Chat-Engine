"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, FileText, Loader2, MoreHorizontal, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import type { DocumentRow } from "@/lib/knowledge";
import { cn, formatBytes } from "@/lib/utils";

const STATUS_TONE: Record<DocumentRow["status"], BadgeTone> = {
  pending: "neutral",
  processing: "warning",
  ready: "success",
  failed: "danger",
};

type Doc = Omit<DocumentRow, "created_at" | "updated_at"> & { created_at: string; updated_at: string };

export function DocumentsPanel({
  kbId,
  initial,
  manageable,
  maxMb,
}: {
  kbId: string;
  initial: Doc[];
  manageable: boolean;
  maxMb: number;
}) {
  const { t, locale } = useI18n();
  const [docs, setDocs] = useState<Doc[]>(initial);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/knowledge/${kbId}/documents`);
    if (res.ok) setDocs(await res.json());
  }, [kbId]);

  // Poll while something is still being indexed.
  const busy = docs.some((d) => d.status === "pending" || d.status === "processing");
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => void refresh(), 2500);
    return () => clearInterval(timer);
  }, [busy, refresh]);

  async function upload(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    setUploading(true);
    setErrors([]);
    const form = new FormData();
    for (const f of list) form.append("files", f);
    const res = await fetch(`/api/knowledge/${kbId}/documents`, { method: "POST", body: form });
    const body = (await res.json().catch(() => ({}))) as { errors?: string[]; error?: string };
    setErrors(body.errors?.length ? body.errors : body.error ? [body.error] : []);
    setUploading(false);
    await refresh();
  }

  async function act(id: string, method: "POST" | "DELETE") {
    await fetch(`/api/documents/${id}`, { method });
    await refresh();
  }

  const dateFmt = new Intl.DateTimeFormat(locale === "de" ? "de-AT" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="flex flex-col gap-6">
      {manageable && (
        <div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void upload(e.dataTransfer.files);
            }}
            className={cn(
              "flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-white/20 bg-card px-6 py-10 text-center transition-colors hover:border-white/40",
              dragging && "border-white/60 bg-muted",
            )}
          >
            {uploading ? (
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            ) : (
              <UploadCloud className="size-6 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">{uploading ? t.knowledge.uploading : t.knowledge.dropHere}</span>
            <span className="text-xs text-muted-foreground">{fmt(t.knowledge.supported, { mb: maxMb })}</span>
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            accept=".pdf,.docx,.txt,.md,.markdown,.csv,.json,.html,.htm"
            onChange={(e) => {
              if (e.target.files) void upload(e.target.files);
              e.target.value = "";
            }}
          />
          {errors.map((err) => (
            <p key={err} className="mt-2 text-sm text-destructive">
              {err}
            </p>
          ))}
        </div>
      )}

      <section>
        <h2 className="eyebrow mb-3">{t.knowledge.documents}</h2>
        {docs.length === 0 ? (
          <p className="rounded-xl border border-border px-4 py-8 text-center text-sm text-muted-foreground">
            {t.knowledge.noDocuments}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50 text-left">
                <tr className="[&>th]:px-4 [&>th]:py-2.5 [&>th]:font-mono [&>th]:text-[10.5px] [&>th]:font-normal [&>th]:tracking-[0.14em] [&>th]:text-muted-foreground [&>th]:uppercase">
                  <th>{t.knowledge.file}</th>
                  <th>{t.common.status}</th>
                  <th className="hidden sm:table-cell">{t.knowledge.size}</th>
                  <th className="hidden md:table-cell">{t.knowledge.chunks}</th>
                  <th className="hidden md:table-cell">{t.knowledge.updated}</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {docs.map((d) => (
                  <tr key={d.id} className="[&>td]:px-4 [&>td]:py-2.5">
                    <td className="max-w-[320px]">
                      <span className="flex items-center gap-2">
                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate" title={d.filename}>
                          {d.title}
                        </span>
                      </span>
                      {d.status === "failed" && d.error && (
                        <span className="mt-0.5 block truncate pl-6 text-xs text-destructive" title={d.error}>
                          {d.error}
                        </span>
                      )}
                    </td>
                    <td>
                      <Badge tone={STATUS_TONE[d.status]}>
                        {(d.status === "processing" || d.status === "pending") && (
                          <Loader2 className="size-3 animate-spin" />
                        )}
                        {t.knowledge.status[d.status]}
                      </Badge>
                    </td>
                    <td className="hidden text-muted-foreground sm:table-cell">{formatBytes(d.size_bytes)}</td>
                    <td className="hidden text-muted-foreground md:table-cell">{d.chunk_count}</td>
                    <td className="hidden whitespace-nowrap text-muted-foreground md:table-cell">
                      {dateFmt.format(new Date(d.updated_at))}
                    </td>
                    <td>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="grid size-7 place-items-center rounded-md text-muted-foreground outline-none hover:bg-muted">
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {(d.has_file || d.source_url) && (
                            <DropdownMenuItem onSelect={() => window.open(`/api/documents/${d.id}`, "_blank")}>
                              <ExternalLink />
                              {t.knowledge.download}
                            </DropdownMenuItem>
                          )}
                          {manageable && (
                            <>
                              <DropdownMenuItem onSelect={() => void act(d.id, "POST")}>
                                <RefreshCw />
                                {t.knowledge.reindex}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem destructive onSelect={() => void act(d.id, "DELETE")}>
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
        )}
      </section>
    </div>
  );
}
