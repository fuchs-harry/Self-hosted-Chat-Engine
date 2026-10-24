import "server-only";
import { generateText } from "ai";
import { maskSecret } from "@/lib/crypto";
import { getProviderDef, type ProviderId } from "./catalog";
import { buildFactory, resolveProviders, type ResolvedProvider } from "./registry";

/** Provider config as the admin UI sees it: secrets masked, env fields locked. */
export type ProviderView = {
  id: ProviderId;
  configured: boolean;
  enabled: boolean;
  values: Record<string, string>;
  envFields: string[];
  models: string[];
  modelsFromEnv: boolean;
};

export async function providerViews(): Promise<ProviderView[]> {
  const providers = await resolveProviders();
  return providers.map((p) => toView(p));
}

function toView(p: ResolvedProvider): ProviderView {
  const values: Record<string, string> = {};
  for (const f of p.def.fields) {
    const v = p.values[f.key] ?? "";
    values[f.key] = f.secret ? maskSecret(v) : v;
  }
  const envName = p.def.id === "custom" ? "CUSTOM_LLM_MODELS" : `${p.def.id.toUpperCase()}_MODELS`;
  return {
    id: p.def.id,
    configured: p.configured,
    enabled: p.enabled,
    values,
    envFields: p.envFields,
    models: p.models.map((m) => m.id),
    modelsFromEnv: Boolean(process.env[envName]),
  };
}

/**
 * Sends a tiny request to check the credentials before anyone chats. The
 * candidate values (not yet saved) are merged over the stored ones.
 */
export async function testProvider(
  id: ProviderId,
  candidate: Record<string, string | undefined>,
  model?: string,
): Promise<{ ok: boolean; message: string; latencyMs?: number }> {
  const def = getProviderDef(id);
  const current = (await resolveProviders()).find((p) => p.def.id === id);
  if (!def || !current) return { ok: false, message: "Unknown provider" };

  const v: Record<string, string> = { ...current.values };
  for (const [k, val] of Object.entries(candidate)) if (val) v[k] = val;
  const missing = def.fields.filter((f) => f.required && !v[f.key]).map((f) => f.label.en);
  if (missing.length) return { ok: false, message: `Missing: ${missing.join(", ")}` };

  const chatModel = model || current.models[0]?.id;
  const started = Date.now();
  try {
    if (!chatModel) {
      // e.g. custom server without a model list: just check embeddings exist
      return { ok: false, message: "Add at least one model id to test this provider" };
    }
    const lm = buildFactory(id, v).chat(chatModel);
    const { text } = await generateText({
      model: lm,
      prompt: "Reply with the single word OK.",
      maxOutputTokens: 16,
      maxRetries: 0,
    });
    return { ok: true, message: `${chatModel}: "${text.trim().slice(0, 40)}"`, latencyMs: Date.now() - started };
  } catch (err) {
    return { ok: false, message: (err as Error).message.slice(0, 400) };
  }
}
