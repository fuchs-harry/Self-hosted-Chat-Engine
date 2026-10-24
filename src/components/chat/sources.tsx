"use client";

import { useState } from "react";
import { ChevronDown, FileText } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import type { Source } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

export function Sources({ messageId, sources }: { messageId: string; sources: Source[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  // De-duplicate by document for the collapsed summary.
  const docs = [...new Map(sources.map((s) => [s.documentId, s])).values()];

  return (
    <div className="rounded-xl border border-border bg-card/60">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] text-muted-foreground hover:text-foreground"
      >
        <span className="eyebrow">{t.chat.sources}</span>
        <span className="min-w-0 flex-1 truncate">{docs.map((d) => d.title).join(" · ")}</span>
        <ChevronDown className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      <ol className={cn("flex-col gap-1 border-t border-border p-2", open ? "flex" : "hidden")}>
        {sources.map((s) => (
          <li key={s.n} id={`${messageId}-source-${s.n}`} className="scroll-mt-24">
            <a
              href={s.url ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="flex gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted"
            >
              <span className="mt-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-[5px] border border-white/20 font-mono text-[10.5px]">
                {s.n}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-[13px] font-medium">
                  <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{s.title}</span>
                  {s.page ? (
                    <span className="shrink-0 text-muted-foreground">
                      · {t.chat.page} {s.page}
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 line-clamp-2 block text-[12px] text-muted-foreground">{s.snippet}</span>
              </span>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
