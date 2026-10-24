import { z } from "zod";
import { HttpError, apiUser, parseBody, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { createKnowledgeBase, KnowledgeError, listKnowledgeBases } from "@/lib/knowledge";

export const GET = route(async () => {
  const user = await apiUser();
  return Response.json(await listKnowledgeBases(user));
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2000).optional(),
  visibility: z.enum(["org", "private"]).default("private"),
});

export const POST = route(async (req: Request) => {
  const user = await apiUser();
  const input = await parseBody(req, createSchema);
  try {
    const id = await createKnowledgeBase(input, user);
    await audit("knowledge.create", { userId: user.id, target: id, detail: { visibility: input.visibility } });
    return Response.json({ id }, { status: 201 });
  } catch (err) {
    if (err instanceof KnowledgeError) throw new HttpError(err.status, err.message);
    throw err;
  }
});
