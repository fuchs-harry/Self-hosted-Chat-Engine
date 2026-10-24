import { z } from "zod";
import { apiAdmin, parseBody, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { invalidateProviderCache } from "@/lib/providers/registry";
import { getSettings, updateSettings } from "@/lib/settings";

export const GET = route(async () => {
  await apiAdmin();
  return Response.json(await getSettings());
});

const schema = z
  .object({
    company_profile: z.string().max(8000),
    assistant_instructions: z.string().max(8000),
    pii_masking: z.boolean(),
    chat_retention_days: z.number().int().min(0).max(3650),
    memory_enabled: z.boolean(),
    default_model: z.string().max(200),
    allowed_models: z.array(z.string().max(200)).max(200),
    eu_only: z.boolean(),
  })
  .partial();

export const PATCH = route(async (req: Request) => {
  const user = await apiAdmin();
  const patch = await parseBody(req, schema);
  await updateSettings(patch, user.id);
  invalidateProviderCache();
  await audit("settings.update", { userId: user.id, detail: { keys: Object.keys(patch) } });
  return Response.json({ ok: true });
});
