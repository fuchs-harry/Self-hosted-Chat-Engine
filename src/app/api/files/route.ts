import { z } from "zod";
import { apiUser, parseBody, route } from "@/lib/api";
import { createFile } from "@/lib/documents";

const schema = z.object({
  format: z.enum(["pdf", "docx", "md"]),
  title: z.string().trim().min(1).max(200),
  markdown: z.string().min(1).max(200_000),
});

/** Exports a message (or any Markdown) as a file, without a model call. */
export const POST = route(async (req: Request) => {
  const user = await apiUser();
  const input = await parseBody(req, schema);
  const file = await createFile({ ...input, userId: user.id, author: user.name || undefined });
  return Response.json(file, { status: 201 });
});
