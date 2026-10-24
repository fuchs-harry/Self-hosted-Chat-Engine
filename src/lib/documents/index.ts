import "server-only";
import { db } from "@/lib/db";
import { renderDocx, type RenderMeta } from "./docx";
import { safeFilename } from "./markdown";
import { renderPdf } from "./pdf";

export type DocFormat = "pdf" | "docx" | "md";

export const MIME: Record<DocFormat, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  md: "text/markdown; charset=utf-8",
};

export type GeneratedFile = {
  id: string;
  title: string;
  format: DocFormat;
  filename: string;
  size: number;
  url: string;
};

export async function render(format: DocFormat, markdown: string, meta: RenderMeta): Promise<Uint8Array> {
  if (format === "pdf") return renderPdf(markdown, meta);
  if (format === "docx") return renderDocx(markdown, meta);
  return new TextEncoder().encode(`# ${meta.title}\n\n${markdown.trim()}\n`);
}

export async function createFile(input: {
  userId: string;
  chatId?: string | null;
  format: DocFormat;
  title: string;
  markdown: string;
  author?: string;
}): Promise<GeneratedFile> {
  const date = new Date().toLocaleDateString("de-AT", { day: "2-digit", month: "long", year: "numeric" });
  const bytes = await render(input.format, input.markdown, { title: input.title, author: input.author, date });
  const filename = safeFilename(input.title, input.format);
  const [row] = await db()<{ id: string }[]>`
    INSERT INTO generated_files (user_id, chat_id, title, format, filename, markdown, content, size_bytes)
    VALUES (${input.userId}, ${input.chatId ?? null}, ${input.title}, ${input.format}, ${filename},
            ${input.markdown}, ${Buffer.from(bytes)}, ${bytes.byteLength})
    RETURNING id`;
  return {
    id: row.id,
    title: input.title,
    format: input.format,
    filename,
    size: bytes.byteLength,
    url: `/api/files/${row.id}`,
  };
}

export async function getFile(id: string, userId: string) {
  const [row] = await db()<{ filename: string; format: DocFormat; content: Buffer }[]>`
    SELECT filename, format, content FROM generated_files WHERE id = ${id} AND user_id = ${userId}`;
  return row ?? null;
}
