"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";

export function Composer({
  busy,
  disabled,
  onSend,
  onStop,
  toolbar,
}: {
  busy: boolean;
  disabled?: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  toolbar?: React.ReactNode;
}) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  // Grow with the content up to ~10 lines.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 260)}px`;
  }, [text]);

  function submit() {
    const value = text.trim();
    if (!value || busy || disabled) return;
    onSend(value);
    setText("");
  }

  return (
    <div className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="rounded-2xl border border-white/14 bg-[#0b0b0b] shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)] transition-colors focus-within:border-white/30"
      >
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder={t.chat.placeholder}
          disabled={disabled}
          className="block max-h-[260px] w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground/60"
          aria-label={t.chat.placeholder}
        />
        <div className="flex items-center gap-1 px-2 pb-2">
          <div className="flex min-w-0 flex-1 items-center gap-1">{toolbar}</div>
          {busy ? (
            <Button size="icon-sm" variant="secondary" onClick={onStop} aria-label={t.chat.stop}>
              <Square className="size-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon-sm"
              variant="default"
              disabled={!text.trim() || disabled}
              aria-label={t.chat.send}
              className="rounded-full"
            >
              <ArrowUp />
            </Button>
          )}
        </div>
      </form>
      <p className="mt-2 text-center text-[11.5px] text-muted-foreground/80">{t.chat.disclaimer}</p>
    </div>
  );
}
