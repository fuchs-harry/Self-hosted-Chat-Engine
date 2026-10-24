import "server-only";

export type Page = { page: number | null; text: string };

export class UnsupportedFileError extends Error {}

const TEXT_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/x-markdown",
  "application/json",
]);

const EXT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  html: "text/html",
  htm: "text/html",
};

export const SUPPORTED_EXTENSIONS = Object.keys(EXT_TYPES);

export function detectMimeType(filename: string, given?: string | null): string {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (EXT_TYPES[ext]) return EXT_TYPES[ext];
  return given || "application/octet-stream";
}

export function isSupported(filename: string, mime?: string | null): boolean {
  const type = detectMimeType(filename, mime);
  return Object.values(EXT_TYPES).includes(type);
}

function decodeText(bytes: Uint8Array): string {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  // Many Windows exports are Latin-1/CP1252; U+FFFD signals a wrong guess.
  if (!utf8.includes("�")) return utf8.replace(/^﻿/, "");
  return new TextDecoder("windows-1252").decode(bytes);
}

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article)>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Extracts text per page (PDF) or as a single page (everything else). */
export async function extractText(bytes: Uint8Array, filename: string, mime?: string | null): Promise<Page[]> {
  const type = detectMimeType(filename, mime);

  if (type === "application/pdf") {
    const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await pdfText(pdf, { mergePages: false });
    return text.map((t, i) => ({ page: i + 1, text: t }));
  }

  if (type.includes("wordprocessingml")) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return [{ page: null, text: value }];
  }

  if (type === "text/html") return [{ page: null, text: htmlToText(decodeText(bytes)) }];
  if (TEXT_TYPES.has(type)) return [{ page: null, text: decodeText(bytes) }];

  throw new UnsupportedFileError(`Unsupported file type: ${filename}`);
}
