/**
 * Every LLM provider the engine can talk to, with what an IT admin needs to
 * judge it: where inference runs, who operates it, and how to connect.
 *
 * Residency classes:
 *  - on-prem      inference runs on hardware you control; nothing leaves the network
 *  - eu           provider processes in EU regions (with the configuration noted)
 *  - eu-optional  EU processing exists but must be explicitly enabled/approved
 *  - non-eu       no EU processing option; data is processed outside the EU
 *
 * Model lists are defaults as of October 2026. Admins can override them per
 * provider (env `<PROVIDER>_MODELS` or the admin UI) without code changes.
 */

export type Residency = "on-prem" | "eu" | "eu-optional" | "non-eu";

export type ProviderId =
  | "ollama"
  | "custom"
  | "mistral"
  | "stackit"
  | "ionos"
  | "scaleway"
  | "azure"
  | "bedrock"
  | "vertex"
  | "openai"
  | "anthropic";

export type Localized = { de: string; en: string };

export type ProviderField = {
  key: string;
  env: string;
  label: Localized;
  secret?: boolean;
  required?: boolean;
  placeholder?: string;
  default?: string;
  multiline?: boolean;
  hint?: Localized;
};

export type ChatModelDef = { id: string; label?: string; recommended?: boolean };
export type EmbeddingModelDef = { id: string; dimensions: number; supportsDimensions?: boolean };

export type ProviderDef = {
  id: ProviderId;
  name: string;
  operator: string;
  /** Country of the company operating the service (ISO 3166). */
  hq: string;
  residency: Residency;
  note: Localized;
  keyUrl?: string;
  docsUrl?: string;
  fields: ProviderField[];
  chatModels: ChatModelDef[];
  embeddingModels: EmbeddingModelDef[];
};

const apiKey = (env: string, required = true): ProviderField => ({
  key: "apiKey",
  env,
  label: { de: "API-Schlüssel", en: "API key" },
  secret: true,
  required,
});

const baseURL = (env: string, def: string, required = false): ProviderField => ({
  key: "baseURL",
  env,
  label: { de: "Basis-URL", en: "Base URL" },
  default: def,
  placeholder: def,
  required,
});

export const PROVIDERS: ProviderDef[] = [
  {
    id: "ollama",
    name: "Ollama",
    operator: "Self-hosted",
    hq: "—",
    residency: "on-prem",
    note: {
      de: "Läuft auf Ihrem eigenen Server (GPU empfohlen). Keine Daten verlassen das Firmennetz. Ideal für sensible Daten.",
      en: "Runs on your own server (GPU recommended). No data leaves the company network. Best for sensitive data.",
    },
    docsUrl: "https://ollama.com/library",
    fields: [
      baseURL("OLLAMA_BASE_URL", "http://ollama:11434/v1", true),
    ],
    chatModels: [
      { id: "qwen3:30b-a3b", label: "Qwen3 30B A3B", recommended: true },
      { id: "gpt-oss:20b", label: "gpt-oss 20B" },
      { id: "mistral-small3.2", label: "Mistral Small 3.2" },
    ],
    embeddingModels: [{ id: "bge-m3", dimensions: 1024 }],
  },
  {
    id: "custom",
    name: "OpenAI-compatible server",
    operator: "Self-hosted",
    hq: "—",
    residency: "on-prem",
    note: {
      de: "Jeder Server mit OpenAI-kompatibler API: vLLM, LM Studio, LiteLLM, TGI. Wird als on-prem eingestuft – prüfen Sie, wo er tatsächlich läuft.",
      en: "Any server with an OpenAI-compatible API: vLLM, LM Studio, LiteLLM, TGI. Classified as on-prem; check where it actually runs.",
    },
    fields: [
      baseURL("CUSTOM_LLM_BASE_URL", "http://vllm:8000/v1", true),
      apiKey("CUSTOM_LLM_API_KEY", false),
    ],
    chatModels: [],
    embeddingModels: [],
  },
  {
    id: "mistral",
    name: "Mistral AI",
    operator: "Mistral AI SAS",
    hq: "FR",
    residency: "eu",
    note: {
      de: "Europäischer Anbieter (Paris), Verarbeitung standardmäßig in der EU. Kein US-Mutterkonzern, daher kein CLOUD-Act-Zugriff.",
      en: "European provider (Paris), processing in the EU by default. No US parent company, so no CLOUD Act exposure.",
    },
    keyUrl: "https://console.mistral.ai/api-keys",
    docsUrl: "https://docs.mistral.ai/getting-started/models",
    fields: [apiKey("MISTRAL_API_KEY")],
    chatModels: [
      { id: "mistral-medium-latest", label: "Mistral Medium", recommended: true },
      { id: "mistral-large-latest", label: "Mistral Large" },
      { id: "mistral-small-latest", label: "Mistral Small" },
    ],
    embeddingModels: [{ id: "mistral-embed", dimensions: 1024 }],
  },
  {
    id: "stackit",
    name: "STACKIT AI Model Serving",
    operator: "STACKIT (Schwarz Gruppe)",
    hq: "DE",
    residency: "eu",
    note: {
      de: "Souveräne deutsche Cloud, Rechenzentren in Deutschland und Österreich. Open-Weight-Modelle über OpenAI-kompatible API.",
      en: "Sovereign German cloud with data centers in Germany and Austria. Open-weight models via an OpenAI-compatible API.",
    },
    keyUrl: "https://portal.stackit.cloud",
    docsUrl:
      "https://docs.stackit.cloud/products/data-and-ai/ai-model-serving/basics/available-shared-models/",
    fields: [
      apiKey("STACKIT_API_KEY"),
      baseURL(
        "STACKIT_BASE_URL",
        "https://api.openai-compat.model-serving.eu01.onstackit.cloud/v1",
      ),
    ],
    chatModels: [
      { id: "openai/gpt-oss-120b", label: "gpt-oss 120B", recommended: true },
      { id: "Qwen/Qwen3.8-27B", label: "Qwen3.8 27B" },
      { id: "google/gemma-4-31B-it", label: "Gemma 4 31B" },
      { id: "cortecs/Llama-3.3-70B-Instruct-FP8-Dynamic", label: "Llama 3.3 70B" },
    ],
    embeddingModels: [
      { id: "Qwen/Qwen3-VL-Embedding-8B", dimensions: 1024, supportsDimensions: true },
    ],
  },
  {
    id: "ionos",
    name: "IONOS AI Model Hub",
    operator: "IONOS SE",
    hq: "DE",
    residency: "eu",
    note: {
      de: "Deutscher Anbieter, Verarbeitung in deutschen Rechenzentren. Modellkatalog ändert sich regelmäßig – aktuelle Liste prüfen.",
      en: "German provider, processing in German data centers. The catalog changes regularly; check the current list.",
    },
    keyUrl: "https://dcd.ionos.com",
    docsUrl: "https://docs.ionos.com/cloud/ai/ai-model-hub",
    fields: [
      apiKey("IONOS_API_KEY"),
      baseURL("IONOS_BASE_URL", "https://openai.inference.de-txl.ionos.com/v1"),
    ],
    chatModels: [
      { id: "openai/gpt-oss-120b", label: "gpt-oss 120B", recommended: true },
      { id: "meta-llama/Llama-3.3-70B-Instruct", label: "Llama 3.3 70B" },
    ],
    embeddingModels: [{ id: "BAAI/bge-m3", dimensions: 1024 }],
  },
  {
    id: "scaleway",
    name: "Scaleway Generative APIs",
    operator: "Scaleway SAS",
    hq: "FR",
    residency: "eu",
    note: {
      de: "Französischer Cloud-Anbieter, Verarbeitung in Paris. Open-Weight-Modelle über OpenAI-kompatible API.",
      en: "French cloud provider, processing in Paris. Open-weight models via an OpenAI-compatible API.",
    },
    keyUrl: "https://console.scaleway.com/iam/api-keys",
    docsUrl: "https://www.scaleway.com/en/docs/generative-apis/reference-content/supported-models/",
    fields: [apiKey("SCALEWAY_API_KEY"), baseURL("SCALEWAY_BASE_URL", "https://api.scaleway.ai/v1")],
    chatModels: [
      { id: "gpt-oss-120b", label: "gpt-oss 120B", recommended: true },
      { id: "mistral-small-3.2-24b-instruct-2506", label: "Mistral Small 3.2" },
      { id: "llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
    ],
    embeddingModels: [{ id: "bge-multilingual-gemma2", dimensions: 3584 }],
  },
  {
    id: "azure",
    name: "Azure OpenAI (Microsoft Foundry)",
    operator: "Microsoft",
    hq: "US",
    residency: "eu",
    note: {
      de: "GPT-Modelle in EU-Regionen. Deployment als „Data Zone Standard (EU)“ z. B. in Sweden Central oder Germany West Central anlegen – nicht „Global“. US-Konzern: EU Data Boundary, aber CLOUD Act beachten.",
      en: "GPT models in EU regions. Create deployments as “Data Zone Standard (EU)”, e.g. in Sweden Central or Germany West Central, not “Global”. US company: EU Data Boundary applies, but consider the CLOUD Act.",
    },
    keyUrl: "https://ai.azure.com",
    docsUrl:
      "https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability",
    fields: [
      {
        key: "resourceName",
        env: "AZURE_OPENAI_RESOURCE_NAME",
        label: { de: "Ressourcenname", en: "Resource name" },
        placeholder: "my-company-openai",
        required: true,
        hint: {
          de: "Der Teil vor .openai.azure.com",
          en: "The part before .openai.azure.com",
        },
      },
      apiKey("AZURE_OPENAI_API_KEY"),
    ],
    chatModels: [
      { id: "gpt-5.5", label: "GPT-5.5 (deployment name)", recommended: true },
      { id: "gpt-5.4-mini", label: "GPT-5.4 mini (deployment name)" },
    ],
    embeddingModels: [
      { id: "text-embedding-3-small", dimensions: 1024, supportsDimensions: true },
    ],
  },
  {
    id: "bedrock",
    name: "Amazon Bedrock",
    operator: "Amazon Web Services",
    hq: "US",
    residency: "eu",
    note: {
      de: "Claude & Co. über EU-Inferenzprofile (Präfix „eu.“): Verarbeitung bleibt in EU-Regionen (Frankfurt, Stockholm, Paris, Mailand, Irland, Spanien). Region eu-central-1 empfohlen. US-Konzern: CLOUD Act beachten.",
      en: "Claude and others via EU inference profiles (prefix “eu.”): processing stays in EU regions (Frankfurt, Stockholm, Paris, Milan, Ireland, Spain). Region eu-central-1 recommended. US company: consider the CLOUD Act.",
    },
    keyUrl: "https://console.aws.amazon.com/bedrock/home#/api-keys",
    docsUrl: "https://docs.aws.amazon.com/bedrock/latest/userguide/models-region-compatibility.html",
    fields: [
      {
        key: "region",
        env: "AWS_REGION",
        label: { de: "Region", en: "Region" },
        default: "eu-central-1",
        placeholder: "eu-central-1",
        required: true,
      },
      {
        ...apiKey("AWS_BEARER_TOKEN_BEDROCK"),
        label: { de: "Bedrock API-Schlüssel", en: "Bedrock API key" },
      },
    ],
    chatModels: [
      { id: "eu.anthropic.claude-sonnet-5-5", label: "Claude Sonnet 5.5 (EU)", recommended: true },
      { id: "eu.anthropic.claude-haiku-5-5", label: "Claude Haiku 5.5 (EU)" },
      { id: "eu.anthropic.claude-opus-5-5", label: "Claude Opus 5.5 (EU)" },
    ],
    embeddingModels: [{ id: "cohere.embed-multilingual-v3", dimensions: 1024 }],
  },
  {
    id: "vertex",
    name: "Google Vertex AI",
    operator: "Google Cloud",
    hq: "US",
    residency: "eu",
    note: {
      de: "Gemini mit regionalem Endpoint (z. B. europe-west3 Frankfurt). Der globale Endpoint bietet keine Datenresidenz. Nicht jedes Modell ist in jeder EU-Region verfügbar. US-Konzern: CLOUD Act beachten.",
      en: "Gemini with a regional endpoint (e.g. europe-west3 Frankfurt). The global endpoint has no residency guarantee. Not every model is in every EU region. US company: consider the CLOUD Act.",
    },
    keyUrl: "https://console.cloud.google.com/iam-admin/serviceaccounts",
    docsUrl: "https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/data-residency",
    fields: [
      {
        key: "project",
        env: "GOOGLE_VERTEX_PROJECT",
        label: { de: "Projekt-ID", en: "Project ID" },
        required: true,
      },
      {
        key: "location",
        env: "GOOGLE_VERTEX_LOCATION",
        label: { de: "Region", en: "Location" },
        default: "europe-west3",
        placeholder: "europe-west3",
        required: true,
      },
      {
        key: "credentials",
        env: "GOOGLE_VERTEX_CREDENTIALS_JSON",
        label: { de: "Service-Account-JSON", en: "Service account JSON" },
        secret: true,
        required: true,
        multiline: true,
      },
    ],
    chatModels: [
      { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash", recommended: true },
      { id: "gemini-4-argon", label: "Gemini 4 Argon" },
    ],
    embeddingModels: [{ id: "gemini-embedding-001", dimensions: 1024, supportsDimensions: true }],
  },
  {
    id: "openai",
    name: "OpenAI",
    operator: "OpenAI",
    hq: "US",
    residency: "eu-optional",
    note: {
      de: "Standardmäßig Verarbeitung in den USA. EU-Datenresidenz nur für freigegebene Projekte (Region „Europe“ im Projekt, Basis-URL https://eu.api.openai.com/v1). Für EU-Verarbeitung ist Azure meist einfacher.",
      en: "Processed in the US by default. EU data residency only for approved projects (region “Europe” on the project, base URL https://eu.api.openai.com/v1). For EU processing, Azure is usually simpler.",
    },
    keyUrl: "https://platform.openai.com/api-keys",
    docsUrl: "https://openai.com/index/introducing-data-residency-in-europe/",
    fields: [
      apiKey("OPENAI_API_KEY"),
      {
        ...baseURL("OPENAI_BASE_URL", "https://api.openai.com/v1"),
        hint: {
          de: "Für EU-Residenz-Projekte: https://eu.api.openai.com/v1",
          en: "For EU-residency projects: https://eu.api.openai.com/v1",
        },
      },
    ],
    chatModels: [
      { id: "gpt-6-sol", label: "GPT-6 Sol", recommended: true },
      { id: "gpt-6-luna", label: "GPT-6 Luna" },
      { id: "gpt-5.5", label: "GPT-5.5" },
    ],
    embeddingModels: [
      { id: "text-embedding-3-small", dimensions: 1024, supportsDimensions: true },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic (direct API)",
    operator: "Anthropic",
    hq: "US",
    residency: "non-eu",
    note: {
      de: "Die direkte API bietet keine EU-Verarbeitung (nur „global“ oder „us“). Für Claude mit EU-Datenresidenz Amazon Bedrock oder Google Vertex verwenden.",
      en: "The direct API has no EU processing option (only “global” or “us”). For Claude with EU data residency, use Amazon Bedrock or Google Vertex.",
    },
    keyUrl: "https://platform.claude.com/settings/keys",
    docsUrl: "https://platform.claude.com/docs/en/build-with-claude/data-residency",
    fields: [apiKey("ANTHROPIC_API_KEY")],
    chatModels: [
      { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", recommended: true },
      { id: "claude-haiku-5-5", label: "Claude Haiku 5.5" },
      { id: "claude-opus-5-5", label: "Claude Opus 5.5" },
    ],
    embeddingModels: [],
  },
];

export function getProviderDef(id: string): ProviderDef | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

export const RESIDENCY_ORDER: Record<Residency, number> = {
  "on-prem": 0,
  eu: 1,
  "eu-optional": 2,
  "non-eu": 3,
};

/** True when data stays in the EU or on-prem under the documented setup. */
export function isEuSafe(residency: Residency): boolean {
  return residency === "on-prem" || residency === "eu";
}

/** "provider:model" keys. Model ids may contain ":" (Ollama tags). */
export function splitModelKey(key: string): { provider: string; model: string } | null {
  const i = key.indexOf(":");
  if (i <= 0 || i === key.length - 1) return null;
  return { provider: key.slice(0, i), model: key.slice(i + 1) };
}
