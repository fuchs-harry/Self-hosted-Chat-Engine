"use client";

import { useState } from "react";
import { Check, Copy, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResidencyBadge } from "@/components/residency-badge";
import { useI18n } from "@/components/i18n-provider";
import { messageText, type ChatMessage } from "@/lib/chat/types";
import { cn } from "@/lib/utils";
import { Markdown } from "./markdown";
import { Sources } from "./sources";

export function Message({
  message,
  streaming,
  isLast,
  onRegenerate,
  renderPart,
}: {
  message: ChatMessage;
  streaming: boolean;
  isLast: boolean;
  onRegenerate?: () => void;
  /** Renders non-text parts (tools, documents). */
  renderPart?: (part: ChatMessage["parts"][number], index: number) => React.ReactNode;
}) {
  const { t } = useI18n();

  if (message.role === "user") {
    return (
      <div className="flex justify-end" data-message-id={message.id}>
        <div className="max-w-[85%] rounded-2xl rounded-br-md border border-white/10 bg-white/[0.06] px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap">
          {messageText(message)}
        </div>
      </div>
    );
  }

  const text = messageText(message);
  const meta = message.metadata;
  const hasContent = message.parts.some(
    (p) => (p.type === "text" && p.text.trim()) || p.type.startsWith("tool-"),
  );

  return (
    <div className="group flex flex-col gap-2" data-message-id={message.id}>
      {!hasContent && streaming ? (
        <p className="animate-pulse text-sm text-muted-foreground">{t.chat.thinking}</p>
      ) : (
        message.parts.map((part, i) => {
          if (part.type === "reasoning") {
            if (!part.text.trim()) return null;
            return (
              <details key={i} className="group/r rounded-lg border border-border bg-card/50 text-sm">
                <summary className="cursor-pointer list-none px-3 py-1.5 text-[12.5px] text-muted-foreground select-none hover:text-foreground">
                  <span className="eyebrow">{t.chat.reasoning}</span>
                  {streaming && i === message.parts.length - 1 && (
                    <span className="ml-2 animate-pulse">…</span>
                  )}
                </summary>
                <div className="border-t border-border px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
                  {part.text.trim()}
                </div>
              </details>
            );
          }
          if (part.type === "text") {
            const last = i === message.parts.length - 1;
            return (
              <div key={i} className={cn("prose-chat", streaming && last && "stream-caret")}>
                <Markdown text={part.text} />
              </div>
            );
          }
          return renderPart ? <div key={i}>{renderPart(part, i)}</div> : null;
        })
      )}

      {meta?.sources?.length ? <Sources messageId={message.id} sources={meta.sources} /> : null}

      {!streaming && (
        <div className="flex flex-wrap items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
          {text && <CopyButton text={text} />}
          {isLast && onRegenerate && (
            <Button variant="ghost" size="icon-xs" onClick={onRegenerate} title={t.chat.regenerate}>
              <RotateCcw />
            </Button>
          )}
          {meta?.modelLabel && (
            <span className="ml-1 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
              {meta.modelLabel}
              {meta.residency && <ResidencyBadge residency={meta.residency} />}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      title={done ? t.common.copied : t.common.copy}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? <Check /> : <Copy />}
    </Button>
  );
}
