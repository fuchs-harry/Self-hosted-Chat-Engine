import { HttpError, apiUser, route, uuid } from "@/lib/api";
import { audit } from "@/lib/audit";
import {
  canManage,
  deleteDocument,
  getDocument,
  getDocumentFile,
  reindexDocument,
} from "@/lib/knowledge";

type Ctx = { params: Promise<{ id: string }> };

async function load(ctx: Ctx) {
  const user = await apiUser();
  const { id } = await ctx.params;
  if (!uuid.safeParse(id).success) throw new HttpError(404, "Document not found");
  const doc = await getDocument(id, user);
  if (!doc) throw new HttpError(404, "Document not found");
  return { user, doc };
}

/** Downloads the original file (uploads) or redirects to the source (connectors). */
export const GET = route(async (_req: Request, ctx: Ctx) => {
  const { doc } = await load(ctx);
  if (!doc.has_file) {
    if (doc.source_url) return Response.redirect(doc.source_url, 302);
    throw new HttpError(404, "The original file is not stored on this server");
  }
  const file = await getDocumentFile(doc.id);
  if (!file) throw new HttpError(404, "File not found");
  return new Response(new Uint8Array(file), {
    headers: {
      "content-type": doc.mime_type,
      "content-length": String(file.byteLength),
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,
      "x-content-type-options": "nosniff",
    },
  });
});

/** POST = re-index this document. */
export const POST = route(async (_req: Request, ctx: Ctx) => {
  const { user, doc } = await load(ctx);
  if (!canManage(doc as never, user)) throw new HttpError(403, "Not allowed");
  await reindexDocument(doc.id);
  return Response.json({ ok: true });
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const { user, doc } = await load(ctx);
  if (!canManage(doc as never, user)) throw new HttpError(403, "Not allowed");
  await deleteDocument(doc.id);
  await audit("document.delete", { userId: user.id, target: doc.id });
  return Response.json({ ok: true });
});
