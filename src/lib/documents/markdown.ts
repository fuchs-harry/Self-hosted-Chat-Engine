import { marked, type Token, type Tokens } from "marked";

/** A styled piece of inline text, shared by the PDF and DOCX renderers. */
export type Run = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  strike?: boolean;
  link?: string;
};

export type Block =
  | { kind: "heading"; level: number; runs: Run[] }
  | { kind: "paragraph"; runs: Run[] }
  | { kind: "list"; ordered: boolean; start: number; items: { runs: Run[]; depth: number }[] }
  | { kind: "table"; header: Run[][]; rows: Run[][][] }
  | { kind: "code"; text: string }
  | { kind: "quote"; runs: Run[] }
  | { kind: "rule" };

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
const decode = (s: string) => s.replace(/&(amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m] ?? m);

function inline(tokens: Token[] | undefined, style: Omit<Run, "text"> = {}): Run[] {
  const out: Run[] = [];
  for (const t of tokens ?? []) {
    switch (t.type) {
      case "strong":
        out.push(...inline((t as Tokens.Strong).tokens, { ...style, bold: true }));
        break;
      case "em":
        out.push(...inline((t as Tokens.Em).tokens, { ...style, italic: true }));
        break;
      case "del":
        out.push(...inline((t as Tokens.Del).tokens, { ...style, strike: true }));
        break;
      case "codespan":
        out.push({ ...style, code: true, text: decode((t as Tokens.Codespan).text) });
        break;
      case "link":
        out.push(...inline((t as Tokens.Link).tokens, { ...style, link: (t as Tokens.Link).href }));
        break;
      case "br":
        out.push({ ...style, text: "\n" });
        break;
      case "text": {
        const tt = t as Tokens.Text;
        if (tt.tokens?.length) out.push(...inline(tt.tokens, style));
        else out.push({ ...style, text: decode(tt.text) });
        break;
      }
      case "escape":
        out.push({ ...style, text: (t as Tokens.Escape).text });
        break;
      default:
        if ("text" in t && typeof t.text === "string") out.push({ ...style, text: decode(t.text) });
    }
  }
  return out;
}

function listItems(list: Tokens.List, depth: number): { runs: Run[]; depth: number }[] {
  const items: { runs: Run[]; depth: number }[] = [];
  for (const item of list.items) {
    const runs: Run[] = [];
    const nested: Tokens.List[] = [];
    for (const child of item.tokens) {
      if (child.type === "list") nested.push(child as Tokens.List);
      else if ("tokens" in child && child.tokens) runs.push(...inline(child.tokens as Token[]));
      else if ("text" in child) runs.push({ text: decode(String(child.text)) });
    }
    if (item.task) runs.unshift({ text: item.checked ? "☑ " : "☐ " });
    items.push({ runs, depth });
    for (const n of nested) items.push(...listItems(n, depth + 1));
  }
  return items;
}

/** Parses Markdown (GFM) into a flat list of renderable blocks. */
export function toBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  const walk = (tokens: Token[]) => {
    for (const t of tokens) {
      switch (t.type) {
        case "heading":
          blocks.push({ kind: "heading", level: (t as Tokens.Heading).depth, runs: inline((t as Tokens.Heading).tokens) });
          break;
        case "paragraph":
          blocks.push({ kind: "paragraph", runs: inline((t as Tokens.Paragraph).tokens) });
          break;
        case "list": {
          const l = t as Tokens.List;
          blocks.push({ kind: "list", ordered: l.ordered, start: Number(l.start) || 1, items: listItems(l, 0) });
          break;
        }
        case "table": {
          const tb = t as Tokens.Table;
          blocks.push({
            kind: "table",
            header: tb.header.map((c) => inline(c.tokens)),
            rows: tb.rows.map((r) => r.map((c) => inline(c.tokens))),
          });
          break;
        }
        case "code":
          blocks.push({ kind: "code", text: (t as Tokens.Code).text });
          break;
        case "blockquote":
          blocks.push({
            kind: "quote",
            runs: (t as Tokens.Blockquote).tokens.flatMap((c) =>
              "tokens" in c && c.tokens ? inline(c.tokens as Token[], { italic: true }) : [],
            ),
          });
          break;
        case "hr":
          blocks.push({ kind: "rule" });
          break;
        case "text":
          blocks.push({ kind: "paragraph", runs: inline((t as Tokens.Text).tokens ?? [t]) });
          break;
        default:
          break; // html, space, def: ignored
      }
    }
  };
  walk(marked.lexer(markdown, { gfm: true }));
  return blocks;
}

export function safeFilename(title: string, ext: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s.-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
  return `${base || "document"}.${ext}`;
}
