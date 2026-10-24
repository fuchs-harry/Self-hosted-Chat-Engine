"use client";

import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Inline citations like [1] become small chips that point at the source list.
const CITATION = /\[(\d{1,2})\](?!\(|:)/g;

function linkCitations(text: string): string {
  // Leave fenced code untouched.
  return text
    .split(/(```[\s\S]*?```)/g)
    .map((chunk) => (chunk.startsWith("```") ? chunk : chunk.replace(CITATION, "[$1](#cite-$1)")))
    .join("");
}

const components: Components = {
  a({ href, children, ...props }) {
    if (href?.startsWith("#cite-")) {
      const n = href.slice(6);
      return (
        <a
          href={href}
          onClick={(e) => {
            e.preventDefault();
            document
              .getElementById(`${(e.currentTarget.closest("[data-message-id]") as HTMLElement | null)?.dataset.messageId}-source-${n}`)
              ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }}
          className="mx-0.5 inline-grid h-[18px] min-w-[18px] -translate-y-px place-items-center rounded-[5px] border border-white/20 bg-white/8 px-1 font-mono text-[10.5px] !no-underline align-middle hover:bg-white/15"
        >
          {n}
        </a>
      );
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    );
  },
  table({ children }) {
    return (
      <div className="overflow-x-auto">
        <table>{children}</table>
      </div>
    );
  },
};

export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {linkCitations(text)}
    </ReactMarkdown>
  );
});
