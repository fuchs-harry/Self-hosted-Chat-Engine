import { z } from "zod";
import { HttpError, apiUser, parseBody, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { asHttp, kbIdFrom } from "@/lib/knowledge/http";
import {
  deleteKnowledgeBase,
  getKnowledgeBase,
  listDocuments,
  requireManageable,
  updateKnowledgeBase,
} from "@/lib/knowledge";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, ctx: Ctx) => {
  const user = await apiUser();
  const kb = await getKnowledgeBase(await kbIdFrom(ctx), user);
  if (!kb) throw new HttpError(404, "Knowledge base not found");
  return Response.json({ ...kb, documents: await listDocuments(kb.id) });
});

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
});

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const user = await apiUser();
  const id = await kbIdFrom(ctx);
  await requireManageable(id, user).catch(asHttp);
  await updateKnowledgeBase(id, await parseBody(req, patchSchema));
  return Response.json({ ok: true });
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const user = await apiUser();
  const id = await kbIdFrom(ctx);
  await requireManageable(id, user).catch(asHttp);
  await deleteKnowledgeBase(id);
  await audit("knowledge.delete", { userId: user.id, target: id });
  return Response.json({ ok: true });
});
