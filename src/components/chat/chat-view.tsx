"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import type { ChatMessage } from "@/lib/chat/types";
import type { ModelOption } from "@/lib/providers/registry";
import { Composer } from "./composer";
import { Message } from "./message";
import { ModelPicker } from "./model-picker";

export type ChatViewProps = {
  id: string;
  isNew: boolean;
  initialMessages: ChatMessage[];
  models: ModelOption[];
  initialModel: string | null;
  user: { name: string; role: "admin" | "member" };
};

export function ChatView({ id, isNew, initialMessages, models, initialModel, user }: ChatViewProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [model, setModel] = useState<string | null>(initialModel);
  const modelRef = useRef(model);
  modelRef.current = model;
  const createdRef = useRef(!isNew);

  const { messages, sendMessage, regenerate, stop, status, error, clearError } = useChat<ChatMessage>({
    id,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ id, messages, trigger }) => ({
        body: {
          id,
          message: messages.findLast((m) => m.role === "user"),
          trigger,
          model: modelRef.current ?? undefined,
        },
      }),
    }),
    onFinish: () => {
      router.refresh();
      // The title is written in the background; pick it up a bit later.
      setTimeout(() => router.refresh(), 2500);
    },
  });

  const busy = status === "submitted" || status === "streaming";

  // Keep the newest message in view while streaming, unless the user
  // scrolled up to read.
  const scrollRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function send(text: string) {
    clearError();
    if (!createdRef.current) {
      createdRef.current = true;
      window.history.replaceState(null, "", `/chat/${id}`);
    }
    stick.current = true;
    void sendMessage({ text });
  }

  const noModels = models.length === 0;

  return (
    <div className="flex h-full flex-col">
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {messages.length === 0 ? (
          <EmptyState name={user.name} onPick={send} disabled={noModels} />
        ) : (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-4 pt-8 pb-6">
            {messages.map((m, i) => (
              <Message
                key={m.id}
                message={m}
                isLast={i === messages.length - 1}
                streaming={busy && i === messages.length - 1 && m.role === "assistant"}
                onRegenerate={() => {
                  clearError();
                  void regenerate();
                }}
              />
            ))}
            {status === "submitted" && messages.at(-1)?.role === "user" && (
              <p className="animate-pulse text-sm text-muted-foreground">{t.chat.thinking}</p>
            )}
            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div className="flex-1">
                  <p className="font-medium">{t.chat.error}</p>
                  <p className="mt-0.5 text-muted-foreground">{readableError(error)}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => void regenerate()}>
                  {t.common.retry}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-3xl px-4 pb-4">
        {noModels ? (
          <div className="mb-3 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm">
            <p className="font-medium">{t.chat.noModels}</p>
            <p className="text-muted-foreground">
              {user.role === "admin" ? t.chat.noModelsAdmin : t.chat.noModelsMember}
            </p>
          </div>
        ) : null}
        <Composer
          busy={busy}
          disabled={noModels}
          onSend={send}
          onStop={() => void stop()}
          toolbar={<ModelPicker options={models} value={model} onChange={setModel} />}
        />
      </div>
    </div>
  );
}

function readableError(error: Error): string {
  try {
    const parsed = JSON.parse(error.message) as { error?: string };
    if (parsed.error) return parsed.error;
  } catch {
    // not JSON
  }
  return error.message;
}

function EmptyState({
  name,
  onPick,
  disabled,
}: {
  name: string;
  onPick: (text: string) => void;
  disabled: boolean;
}) {
  const { t } = useI18n();
  const first = name.split(" ")[0] || "";
  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col items-center justify-center px-4 py-12 text-center">
      <h1 className="fade-up title-sweep text-3xl font-semibold tracking-tight sm:text-4xl">
        {fmt(t.chat.greeting, { name: first })}
      </h1>
      <p className="fade-up mt-3 max-w-md text-[15px] text-muted-foreground [animation-delay:80ms]">
        {t.chat.greetingSub}
      </p>
      <div className="fade-up mt-8 grid w-full max-w-xl gap-2 sm:grid-cols-2 [animation-delay:160ms]">
        {t.chat.suggestions.map((s) => (
          <button
            key={s}
            disabled={disabled}
            onClick={() => onPick(s)}
            className="rounded-xl border border-border bg-card px-4 py-3 text-left text-[13.5px] text-foreground/85 transition-colors hover:border-white/25 hover:bg-muted disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
