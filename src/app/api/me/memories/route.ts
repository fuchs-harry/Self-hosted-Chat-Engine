import { z } from "zod";
import { apiUser, parseBody, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { addMemory, deleteAllMemories, listMemories } from "@/lib/memory";

export const GET = route(async () => {
  const user = await apiUser();
  return Response.json(await listMemories(user.id));
});

const createSchema = z.object({
  content: z.string().trim().min(3).max(300),
  category: z.enum(["profile", "preference", "work", "other"]).default("other"),
});

export const POST = route(async (req: Request) => {
  const user = await apiUser();
  const input = await parseBody(req, createSchema);
  const id = await addMemory(user.id, input.content, { category: input.category, source: "manual" });
  await audit("memory.update", { userId: user.id, target: id, detail: { source: "manual" } });
  return Response.json({ id }, { status: 201 });
});

/** Forget everything. */
export const DELETE = route(async () => {
  const user = await apiUser();
  const n = await deleteAllMemories(user.id);
  await audit("memory.delete", { userId: user.id, detail: { count: n, all: true } });
  return Response.json({ deleted: n });
});
