import { z } from "zod";
import { HttpError, apiAdmin, parseBody, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { getProviderDef, type ProviderId } from "@/lib/providers/catalog";
import { testProvider } from "@/lib/providers/admin";
import { saveProviderConfig } from "@/lib/providers/registry";

type Ctx = { params: Promise<{ id: string }> };

async function providerId(ctx: Ctx): Promise<ProviderId> {
  const { id } = await ctx.params;
  if (!getProviderDef(id)) throw new HttpError(404, "Unknown provider");
  return id as ProviderId;
}

const saveSchema = z.object({
  enabled: z.boolean().optional(),
  // Empty string clears a field; omitted keeps it (masked secrets stay).
  values: z.record(z.string(), z.string().max(20_000)).optional(),
  models: z.array(z.string().trim().min(1).max(200)).max(50).nullable().optional(),
});

export const PUT = route(async (req: Request, ctx: Ctx) => {
  const user = await apiAdmin();
  const id = await providerId(ctx);
  const input = await parseBody(req, saveSchema);
  await saveProviderConfig(id, input, user.id);
  // Never log values, only which fields changed.
  await audit("provider.update", {
    userId: user.id,
    target: id,
    detail: { fields: Object.keys(input.values ?? {}), enabled: input.enabled, models: input.models?.length },
  });
  return Response.json({ ok: true });
});

const testSchema = z.object({
  values: z.record(z.string(), z.string().max(20_000)).default({}),
  model: z.string().max(200).optional(),
});

/** POST = test the connection with the given (unsaved) values. */
export const POST = route(async (req: Request, ctx: Ctx) => {
  await apiAdmin();
  const id = await providerId(ctx);
  const input = await parseBody(req, testSchema);
  return Response.json(await testProvider(id, input.values, input.model));
});
