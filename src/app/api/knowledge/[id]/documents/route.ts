import { HttpError, apiUser, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { addUpload, getKnowledgeBase, listDocuments, requireManageable } from "@/lib/knowledge";
import { asHttp, kbIdFrom } from "@/lib/knowledge/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, ctx: Ctx) => {
  const user = await apiUser();
  const kb = await getKnowledgeBase(await kbIdFrom(ctx), user);
  if (!kb) throw new HttpError(404, "Knowledge base not found");
  return Response.json(await listDocuments(kb.id));
});

/** Multipart upload; field name "files", one or many. */
export const POST = route(async (req: Request, ctx: Ctx) => {
  const user = await apiUser();
  const kbId = await kbIdFrom(ctx);
  await requireManageable(kbId, user).catch(asHttp);

  const form = await req.formData().catch(() => {
    throw new HttpError(400, "Expected multipart/form-data");
  });
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length) throw new HttpError(400, "No files uploaded");

  const created: string[] = [];
  const errors: string[] = [];
  for (const file of files) {
    try {
      const id = await addUpload(
        kbId,
        { name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) },
        user,
      );
      created.push(id);
    } catch (err) {
      errors.push((err as Error).message);
    }
  }
  if (created.length) {
    await audit("document.upload", { userId: user.id, target: kbId, detail: { count: created.length } });
  }
  return Response.json({ created, errors }, { status: created.length ? 201 : 400 });
});
