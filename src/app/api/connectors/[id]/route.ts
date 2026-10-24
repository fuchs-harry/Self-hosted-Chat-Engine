import { z } from "zod";
import { apiUser, parseBody, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { deleteConnector, requestSync, updateConnector } from "@/lib/connectors";
import { configError, loadManageableConnector } from "@/lib/connectors/http";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  config: z.record(z.string(), z.string().max(20_000)).optional(),
  enabled: z.boolean().optional(),
  intervalMinutes: z.number().int().min(5).max(10_080).optional(),
});

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const user = await apiUser();
  const connector = await loadManageableConnector(ctx, user);
  const patch = await parseBody(req, patchSchema);
  await updateConnector(connector.id, patch).catch(configError);
  await audit("connector.update", { userId: user.id, target: connector.id });
  return Response.json({ ok: true });
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const user = await apiUser();
  const connector = await loadManageableConnector(ctx, user);
  await deleteConnector(connector.id);
  await audit("connector.delete", { userId: user.id, target: connector.id });
  return Response.json({ ok: true });
});

/** POST = sync now. */
export const POST = route(async (_req: Request, ctx: Ctx) => {
  const user = await apiUser();
  const connector = await loadManageableConnector(ctx, user);
  await requestSync(connector.id);
  await audit("connector.sync", { userId: user.id, target: connector.id, detail: { manual: true } });
  return Response.json({ ok: true });
});
