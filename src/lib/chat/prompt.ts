import "server-only";
import type { Settings } from "@/lib/settings";

export type PromptContext = {
  appName: string;
  settings: Settings;
  user: { name: string };
  locale: "de" | "en";
  /** Durable facts the assistant has learned about this user. */
  memories?: string[];
  /** Retrieved knowledge, already formatted with [n] markers. */
  knowledge?: string;
  knowledgeBaseName?: string;
  /** True when personal data in the conversation was pseudonymized. */
  pseudonymized?: boolean;
  tools?: string[];
};

/**
 * Builds the system instructions. Layers, from general to specific:
 * product rules → company context → admin instructions → user memory →
 * retrieved knowledge. Later layers are more specific, so they come last.
 */
export function buildInstructions(ctx: PromptContext): string {
  const today = new Date().toLocaleDateString(ctx.locale === "de" ? "de-AT" : "en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const parts: string[] = [
    `You are ${ctx.appName}, the internal AI assistant of this company. You run on the company's own infrastructure.`,
    `Today is ${today}. The user's name is ${ctx.user.name || "unknown"}.`,
    `Reply in the language the user writes in (default: ${ctx.locale === "de" ? "German, Austrian conventions" : "English"}).`,
    "Be accurate and concise. Use Markdown for structure when it helps (lists, tables, headings). Say clearly when you don't know something; never invent facts, figures, names or sources.",
  ];

  if (ctx.settings.company_profile.trim()) {
    parts.push(`## About the company\n${ctx.settings.company_profile.trim()}`);
  }
  if (ctx.settings.assistant_instructions.trim()) {
    parts.push(`## Instructions from the administrator\n${ctx.settings.assistant_instructions.trim()}`);
  }

  if (ctx.memories?.length) {
    parts.push(
      [
        "## What you remember about this user",
        "Use these facts when relevant; don't recite them unprompted.",
        ...ctx.memories.map((m) => `- ${m}`),
      ].join("\n"),
    );
  }

  if (ctx.pseudonymized) {
    parts.push(
      "## Pseudonymized data\nSome personal data was replaced by placeholders like [EMAIL_1] or [IBAN_2] before reaching you. Treat them as the real values and reuse the exact placeholder in your answer when you refer to them. Never ask for the real value.",
    );
  }

  if (ctx.knowledge !== undefined) {
    if (ctx.knowledge) {
      parts.push(
        [
          `## Company knowledge${ctx.knowledgeBaseName ? ` (${ctx.knowledgeBaseName})` : ""}`,
          "The excerpts below were retrieved from internal documents for this question. Base your answer on them and cite them inline as [1], [2] etc. matching the excerpt numbers. If they don't answer the question, say so and answer only from general knowledge if that is clearly appropriate.",
          "<excerpts>",
          ctx.knowledge,
          "</excerpts>",
        ].join("\n"),
      );
    } else {
      parts.push(
        "## Company knowledge\nA knowledge base is selected but no relevant excerpts were found for this question. Tell the user that the documents don't seem to cover it before answering from general knowledge.",
      );
    }
  }

  if (ctx.tools?.length) {
    parts.push(`## Tools\nYou can use: ${ctx.tools.join(", ")}. Use a tool only when it clearly helps the user's request.`);
  }

  return parts.join("\n\n");
}

/** Fallback title from the first user message. */
export function heuristicTitle(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 60 ? `${clean.slice(0, 57).trimEnd()}…` : clean || "…";
}
