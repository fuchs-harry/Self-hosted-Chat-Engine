import { z } from "zod";
import { HttpError, apiUser, parseBody, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { createConnector, listConnectors } from "@/lib/connectors";
import { assertTypeAllowed, configError, connectorType } from "@/lib/connectors/http";
import { getKnowledgeBase, requireManageable } from "@/lib/knowledge";
import { asHttp, kbIdFrom } from "@/lib/knowledge/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, ctx: Ctx) => {
  const user = await apiUser();
  const kb = await getKnowledgeBase(await kbIdFrom(ctx), user);
  if (!kb) throw new HttpError(404, "Knowledge base not found");
  return Response.json(await listConnectors(kb.id));
});

const createSchema = z.object({
  type: connectorType,
  name: z.string().trim().min(1).max(120),
  config: z.record(z.string(), z.string().max(20_000)),
  intervalMinutes: z.number().int().min(5).max(10_080).default(60),
});

export const POST = route(async (req: Request, ctx: Ctx) => {
  const user = await apiUser();
  const kbId = await kbIdFrom(ctx);
  await requireManageable(kbId, user).catch(asHttp);
  const input = await parseBody(req, createSchema);
  assertTypeAllowed(input.type, user);

  const id = await createConnector({ kbId, ...input }, user.id).catch(configError);
  await audit("connector.create", { userId: user.id, target: id, detail: { type: input.type, kbId } });
  return Response.json({ id }, { status: 201 });
});
