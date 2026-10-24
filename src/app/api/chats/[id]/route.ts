import { z } from "zod";
import { HttpError, apiUser, parseBody, route, uuid } from "@/lib/api";
import { audit } from "@/lib/audit";
import { deleteChat, getChat, loadMessages, updateChat } from "@/lib/chat/store";

type Ctx = { params: Promise<{ id: string }> };

async function chatId(ctx: Ctx): Promise<string> {
  const { id } = await ctx.params;
  if (!uuid.safeParse(id).success) throw new HttpError(404, "Chat not found");
  return id;
}

export const GET = route(async (_req: Request, ctx: Ctx) => {
  const user = await apiUser();
  const chat = await getChat(await chatId(ctx), user.id);
  if (!chat) throw new HttpError(404, "Chat not found");
  return Response.json({ chat, messages: await loadMessages(chat.id) });
});

const patchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  pinned: z.boolean().optional(),
  model_key: z.string().max(200).nullable().optional(),
  knowledge_base_id: z.string().uuid().nullable().optional(),
});

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const user = await apiUser();
  const patch = await parseBody(req, patchSchema);
  const ok = await updateChat(await chatId(ctx), user.id, patch);
  if (!ok) throw new HttpError(404, "Chat not found");
  return Response.json({ ok: true });
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const user = await apiUser();
  const id = await chatId(ctx);
  if (!(await deleteChat(id, user.id))) throw new HttpError(404, "Chat not found");
  await audit("chat.delete", { userId: user.id, target: id });
  return Response.json({ ok: true });
});
