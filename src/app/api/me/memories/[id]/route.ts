import { z } from "zod";
import { HttpError, apiUser, parseBody, route, uuid } from "@/lib/api";
import { audit } from "@/lib/audit";
import { deleteMemory, updateMemory } from "@/lib/memory";

type Ctx = { params: Promise<{ id: string }> };

async function memoryId(ctx: Ctx): Promise<string> {
  const { id } = await ctx.params;
  if (!uuid.safeParse(id).success) throw new HttpError(404, "Memory not found");
  return id;
}

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const user = await apiUser();
  const { content } = await parseBody(req, z.object({ content: z.string().trim().min(3).max(300) }));
  if (!(await updateMemory(user.id, await memoryId(ctx), content))) throw new HttpError(404, "Memory not found");
  return Response.json({ ok: true });
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const user = await apiUser();
  const id = await memoryId(ctx);
  if (!(await deleteMemory(user.id, id))) throw new HttpError(404, "Memory not found");
  await audit("memory.delete", { userId: user.id, target: id });
  return Response.json({ ok: true });
});
