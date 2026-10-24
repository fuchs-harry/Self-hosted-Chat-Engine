import type { Page } from "./extract";

export type Chunk = { content: string; page: number | null };

export type ChunkOptions = {
  /** Target size in characters (~250 tokens at 1000). */
  size?: number;
  overlap?: number;
};

const SEPARATORS = ["\n\n", "\n", ". ", "? ", "! ", "; ", ", ", " "];

function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Splits text into pieces no longer than `size`, preferring natural breaks. */
function split(text: string, size: number, seps = SEPARATORS): string[] {
  if (text.length <= size) return [text];
  const [sep, ...rest] = seps;
  if (sep === undefined) {
    const out: string[] = [];
    for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
    return out;
  }
  const parts = text.split(sep);
  if (parts.length === 1) return split(text, size, rest);

  const out: string[] = [];
  let current = "";
  for (let i = 0; i < parts.length; i++) {
    const piece = parts[i] + (i < parts.length - 1 ? sep : "");
    if ((current + piece).length <= size) {
      current += piece;
      continue;
    }
    if (current) out.push(current);
    current = piece.length > size ? "" : piece;
    if (piece.length > size) out.push(...split(piece, size, rest));
  }
  if (current) out.push(current);
  return out;
}

/**
 * Recursive character chunking with overlap. Chunks never span pages, so
 * every chunk can cite its page number.
 */
export function chunkPages(pages: Page[], opts: ChunkOptions = {}): Chunk[] {
  const size = opts.size ?? 1000;
  const overlap = Math.min(opts.overlap ?? 150, Math.floor(size / 3));
  const chunks: Chunk[] = [];

  for (const { page, text } of pages) {
    const clean = normalize(text);
    if (!clean) continue;
    const pieces = split(clean, size - overlap);
    let previous = "";
    for (const piece of pieces) {
      const tail = previous ? previous.slice(-overlap) : "";
      // Start the overlap at a word boundary.
      const lead = tail.includes(" ") ? tail.slice(tail.indexOf(" ") + 1) : tail;
      const content = (lead ? `${lead}${piece}` : piece).trim();
      // Drop slivers (page numbers, stray headers) unless they're all there is.
      if (content.length >= 20 || pieces.length === 1) chunks.push({ content, page });
      previous = piece;
    }
  }
  return chunks;
}
