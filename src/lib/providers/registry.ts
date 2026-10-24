import "server-only";
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createAzure } from "@ai-sdk/azure";
import { createVertex } from "@ai-sdk/google-vertex";
import { createMistral } from "@ai-sdk/mistral";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { EmbeddingModel, LanguageModel } from "ai";
import { db } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { getSettings } from "@/lib/settings";
import {
  PROVIDERS,
  RESIDENCY_ORDER,
  getProviderDef,
  isEuSafe,
  splitModelKey,
  type ChatModelDef,
  type ProviderDef,
  type ProviderId,
  type Residency,
} from "./catalog";

export type ResolvedProvider = {
  def: ProviderDef;
  configured: boolean;
  enabled: boolean;
  /** Merged field values (env wins over the admin UI), decrypted. */
  values: Record<string, string>;
  /** Field keys whose value comes from an environment variable. */
  envFields: string[];
  models: ChatModelDef[];
};

export type ModelOption = {
  key: string; // "provider:model"
  provider: ProviderId;
  providerName: string;
  model: string;
  label: string;
  residency: Residency;
  recommended: boolean;
};

type DbRow = {
  provider_id: string;
  enabled: boolean;
  config: Record<string, string>;
  models: string[] | null;
};

const CACHE_MS = 5_000;
let cache: { at: number; providers: ResolvedProvider[] } | null = null;

export function invalidateProviderCache(): void {
  cache = null;
  instances.clear();
}

function modelsEnvName(id: ProviderId): string {
  return id === "custom" ? "CUSTOM_LLM_MODELS" : `${id.toUpperCase()}_MODELS`;
}

function parseModelList(raw: string | undefined | null): ChatModelDef[] | null {
  if (!raw) return null;
  const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return ids.length ? ids.map((id, i) => ({ id, recommended: i === 0 })) : null;
}

function resolveOne(def: ProviderDef, row: DbRow | undefined): ResolvedProvider {
  const values: Record<string, string> = {};
  const envFields: string[] = [];
  let explicit = 0;

  for (const field of def.fields) {
    const fromEnv = process.env[field.env];
    const fromDb = row?.config?.[field.key];
    if (fromEnv) {
      values[field.key] = fromEnv;
      envFields.push(field.key);
      explicit++;
    } else if (fromDb) {
      values[field.key] = field.secret ? safeDecrypt(fromDb) : fromDb;
      explicit++;
    } else if (field.default) {
      values[field.key] = field.default;
    }
  }

  const configured =
    explicit > 0 && def.fields.every((f) => !f.required || Boolean(values[f.key]));

  const models =
    parseModelList(process.env[modelsEnvName(def.id)]) ??
    (row?.models?.length ? row.models.map((id, i) => ({ id, recommended: i === 0 })) : null) ??
    def.chatModels;

  return {
    def,
    configured,
    enabled: row ? row.enabled : true,
    values,
    envFields,
    models,
  };
}

function safeDecrypt(value: string): string {
  try {
    return decryptSecret(value);
  } catch {
    // APP_SECRET changed since the value was stored: treat as missing.
    return "";
  }
}

export async function resolveProviders(): Promise<ResolvedProvider[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.providers;
  const rows = await db()<DbRow[]>`SELECT provider_id, enabled, config, models FROM provider_configs`;
  const byId = new Map(rows.map((r) => [r.provider_id, r]));
  const providers = PROVIDERS.map((def) => resolveOne(def, byId.get(def.id)));
  cache = { at: Date.now(), providers };
  return providers;
}

export async function activeProviders(): Promise<ResolvedProvider[]> {
  return (await resolveProviders()).filter((p) => p.configured && p.enabled);
}

/** Saves admin-entered values. Empty strings clear a field; undefined keeps it. */
export async function saveProviderConfig(
  id: ProviderId,
  input: { enabled?: boolean; values?: Record<string, string | undefined>; models?: string[] | null },
  userId: string,
): Promise<void> {
  const def = getProviderDef(id);
  if (!def) throw new Error(`Unknown provider ${id}`);
  const [existing] = await db()<DbRow[]>`
    SELECT provider_id, enabled, config, models FROM provider_configs WHERE provider_id = ${id}`;
  const config: Record<string, string> = { ...(existing?.config ?? {}) };

  for (const field of def.fields) {
    const value = input.values?.[field.key];
    if (value === undefined) continue;
    if (value === "") delete config[field.key];
    else config[field.key] = field.secret ? encryptSecret(value) : value.trim();
  }

  const enabled = input.enabled ?? existing?.enabled ?? true;
  const models = input.models === undefined ? (existing?.models ?? null) : input.models;
  await db()`
    INSERT INTO provider_configs (provider_id, enabled, config, models, updated_by)
    VALUES (${id}, ${enabled}, ${db().json(config)}, ${models}, ${userId})
    ON CONFLICT (provider_id) DO UPDATE SET
      enabled = EXCLUDED.enabled, config = EXCLUDED.config, models = EXCLUDED.models,
      updated_at = now(), updated_by = EXCLUDED.updated_by`;
  invalidateProviderCache();
}

// ---------------------------------------------------------------------------
// Model instances
// ---------------------------------------------------------------------------

type Factory = {
  chat: (model: string) => LanguageModel;
  embedding?: (model: string) => EmbeddingModel;
};

const instances = new Map<string, Factory>();

/** Creates the AI SDK provider for a provider id and its field values. */
export function buildFactory(id: ProviderId, v: Record<string, string>): Factory {
  switch (id) {
    case "mistral": {
      const m = createMistral({ apiKey: v.apiKey });
      return { chat: (id) => m(id), embedding: (id) => m.embedding(id) };
    }
    case "openai": {
      const o = createOpenAI({ apiKey: v.apiKey, baseURL: v.baseURL || undefined });
      return { chat: (id) => o(id), embedding: (id) => o.embedding(id) };
    }
    case "azure": {
      const a = createAzure({ resourceName: v.resourceName, apiKey: v.apiKey });
      return { chat: (id) => a(id), embedding: (id) => a.embedding(id) };
    }
    case "bedrock": {
      const b = createAmazonBedrock({ region: v.region, apiKey: v.apiKey });
      return { chat: (id) => b(id), embedding: (id) => b.embedding(id) };
    }
    case "vertex": {
      const g = createVertex({
        project: v.project,
        location: v.location,
        googleAuthOptions: v.credentials ? { credentials: JSON.parse(v.credentials) } : undefined,
      });
      return { chat: (id) => g(id), embedding: (id) => g.textEmbeddingModel(id) };
    }
    case "anthropic": {
      const a = createAnthropic({ apiKey: v.apiKey });
      return { chat: (id) => a(id) };
    }
    case "ollama":
    case "custom":
    case "stackit":
    case "ionos":
    case "scaleway": {
      const c = createOpenAICompatible({
        name: id,
        baseURL: v.baseURL,
        apiKey: v.apiKey || undefined,
        includeUsage: true,
      });
      return { chat: (id) => c.chatModel(id), embedding: (id) => c.embeddingModel(id) };
    }
  }
}

function factoryFor(p: ResolvedProvider): Factory {
  const cacheKey = `${p.def.id}:${JSON.stringify(p.values)}`;
  let f = instances.get(cacheKey);
  if (!f) {
    f = buildFactory(p.def.id, p.values);
    instances.set(cacheKey, f);
  }
  return f;
}

// ---------------------------------------------------------------------------
// Model selection
// ---------------------------------------------------------------------------

function sortByResidency(a: ResolvedProvider, b: ResolvedProvider): number {
  return RESIDENCY_ORDER[a.def.residency] - RESIDENCY_ORDER[b.def.residency];
}

/** Models users may pick, honoring the admin's allow-list and EU-only switch. */
export async function listModelOptions(): Promise<ModelOption[]> {
  const [providers, settings] = await Promise.all([activeProviders(), getSettings()]);
  const allowed = new Set(settings.allowed_models);
  const out: ModelOption[] = [];
  for (const p of [...providers].sort(sortByResidency)) {
    if (settings.eu_only && !isEuSafe(p.def.residency)) continue;
    for (const m of p.models) {
      const key = `${p.def.id}:${m.id}`;
      if (allowed.size && !allowed.has(key)) continue;
      out.push({
        key,
        provider: p.def.id,
        providerName: p.def.name,
        model: m.id,
        label: m.label ?? m.id,
        residency: p.def.residency,
        recommended: Boolean(m.recommended),
      });
    }
  }
  return out;
}

export async function defaultModelKey(): Promise<string | null> {
  const options = await listModelOptions();
  if (!options.length) return null;
  const preferred = (await getSettings()).default_model || process.env.DEFAULT_MODEL;
  if (preferred && options.some((o) => o.key === preferred)) return preferred;
  return (options.find((o) => o.recommended) ?? options[0]).key;
}

export class ModelUnavailableError extends Error {}

/** Resolves a "provider:model" key the current user is allowed to use. */
export async function resolveChatModel(
  key: string | null | undefined,
): Promise<{ model: LanguageModel; option: ModelOption }> {
  const options = await listModelOptions();
  const wanted = key && options.find((o) => o.key === key);
  const fallbackKey = await defaultModelKey();
  const option = wanted || options.find((o) => o.key === fallbackKey);
  if (!option) {
    throw new ModelUnavailableError(
      "No language model is configured. An administrator can add one under Administration → Models.",
    );
  }
  const provider = (await activeProviders()).find((p) => p.def.id === option.provider)!;
  return { model: factoryFor(provider).chat(option.model), option };
}

/** Any configured model, for background jobs (memory extraction etc.). */
export async function resolveUtilityModel(): Promise<{ model: LanguageModel; option: ModelOption } | null> {
  const key = process.env.UTILITY_MODEL || (await defaultModelKey());
  if (!key) return null;
  try {
    return await resolveChatModel(key);
  } catch {
    return null;
  }
}

export type EmbeddingChoice = {
  key: string;
  model: EmbeddingModel;
  dimensions: number;
  supportsDimensions: boolean;
  residency: Residency;
};

/**
 * The single embedding model used for the whole index. EMBEDDING_MODEL
 * ("provider:model") picks it explicitly; otherwise the first configured
 * provider with an embedding model wins, on-prem before EU before others.
 */
export async function resolveEmbeddingModel(): Promise<EmbeddingChoice | null> {
  const providers = (await activeProviders()).sort(sortByResidency);
  const explicit = process.env.EMBEDDING_MODEL ? splitModelKey(process.env.EMBEDDING_MODEL) : null;
  const dimsEnv = Number(process.env.EMBEDDING_DIMENSIONS) || undefined;

  for (const p of providers) {
    if (explicit && p.def.id !== explicit.provider) continue;
    const factory = factoryFor(p);
    if (!factory.embedding) continue;
    const def = explicit
      ? (p.def.embeddingModels.find((m) => m.id === explicit.model) ?? {
          id: explicit.model,
          dimensions: dimsEnv ?? 1024,
          supportsDimensions: false,
        })
      : p.def.embeddingModels[0];
    if (!def) continue;
    return {
      key: `${p.def.id}:${def.id}`,
      model: factory.embedding(def.id),
      dimensions: dimsEnv ?? def.dimensions,
      supportsDimensions: Boolean(def.supportsDimensions),
      residency: p.def.residency,
    };
  }
  return null;
}
