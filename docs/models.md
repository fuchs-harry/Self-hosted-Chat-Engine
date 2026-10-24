# Models and providers

The engine talks to 11 providers through the [AI SDK](https://ai-sdk.dev). Connect any of them by API key, either in *Administration → Models* (stored encrypted) or via environment variables (see [`.env.example`](../.env.example)). Each provider carries a **residency label** that users see next to the model name:

| Label | Meaning |
|---|---|
| **On-prem** | Inference runs on hardware you control. Nothing leaves your network. |
| **EU** | Processed in EU regions *if configured as described below*. |
| **EU optional** | EU processing exists but needs explicit approval or setup with the provider. |
| **Non-EU** | No EU processing option. Data goes to a third country. |

Turn on *Administration → Models → Only offer EU or on-prem models* to hide the last two groups entirely.

*State of October 2026. Model catalogs change monthly; each provider's docs link is in the admin UI. Override any default list with `<PROVIDER>_MODELS=a,b,c` or in the UI.*

---

## On-prem

### Ollama
The simplest way to run open-weight models on your own GPU. Start it with `docker compose --profile ollama up -d`.

| | |
|---|---|
| Env | `OLLAMA_BASE_URL=http://ollama:11434/v1`, `OLLAMA_MODELS=…` |
| Chat models | `qwen3:30b-a3b` (MoE, about 3B active, fast and good in German), `gpt-oss:20b`, `mistral-small3.2` |
| Embeddings | `bge-m3` (1024 dims, multilingual, MIT licensed) |

```bash
docker compose exec ollama ollama pull qwen3:30b-a3b
docker compose exec ollama ollama pull bge-m3
```

### Any OpenAI-compatible server (vLLM, LM Studio, LiteLLM, TGI)
For larger deployments or a GPU server that already exists. Set `CUSTOM_LLM_BASE_URL`, optionally `CUSTOM_LLM_API_KEY`, and `CUSTOM_LLM_MODELS`. Labeled on-prem, so make sure it really runs inside your network.

---

## EU data residency

### Mistral AI (France)
A European company with no US parent, so it isn't subject to the US CLOUD Act. Processing happens in the EU by default.
- Key: <https://console.mistral.ai/api-keys>, env `MISTRAL_API_KEY`
- Chat: `mistral-medium-latest` (good default), `mistral-large-latest`, `mistral-small-latest`
- Embeddings: `mistral-embed` (1024 dims)

### STACKIT AI Model Serving (Germany/Austria)
The sovereign cloud of the Schwarz Gruppe (Lidl, Kaufland), with data centers in Germany and Austria. Open-weight models behind an OpenAI-compatible API.
- Env `STACKIT_API_KEY` (base URL preset to `api.openai-compat.model-serving.eu01.onstackit.cloud`)
- Chat: `openai/gpt-oss-120b`, `Qwen/Qwen3.8-27B`, `google/gemma-4-31B-it`, `cortecs/Llama-3.3-70B-Instruct-FP8-Dynamic`
- Embeddings: `Qwen/Qwen3-VL-Embedding-8B` (used at 1024 dims via Matryoshka)

### IONOS AI Model Hub (Germany)
- Env `IONOS_API_KEY`
- Chat: `openai/gpt-oss-120b`, `meta-llama/Llama-3.3-70B-Instruct`. IONOS retires models regularly, so check the current catalog.
- Embeddings: `BAAI/bge-m3`

### Scaleway Generative APIs (France)
- Env `SCALEWAY_API_KEY`
- Chat: `gpt-oss-120b`, `mistral-small-3.2-24b-instruct-2506`, `llama-3.3-70b-instruct`

### Azure OpenAI / Microsoft Foundry
GPT models inside the EU, a good fit if you already have a Microsoft 365 contract and DPA.
1. Create an Azure OpenAI resource in **Sweden Central** or **Germany West Central**.
2. Deploy models with the deployment type **Data Zone Standard (EU)**, not *Global Standard*.
3. Enter the resource name (the part before `.openai.azure.com`) and key. Model IDs are your **deployment names**, e.g. `gpt-5.5`.

Microsoft is a US company: the EU Data Boundary applies, but include the CLOUD Act in your transfer impact assessment.

### Amazon Bedrock
Claude (and others) with EU processing through **EU inference profiles**. Requests from `eu-central-1` (Frankfurt) are routed only within EU regions (Frankfurt, Stockholm, Milan, Spain, Ireland, Paris).
- Create a long-term API key in the Bedrock console, then set `AWS_REGION=eu-central-1` and `AWS_BEARER_TOKEN_BEDROCK=…`.
- Models: `eu.anthropic.claude-sonnet-5-5`, `eu.anthropic.claude-haiku-5-5`, `eu.anthropic.claude-opus-5-5`. **Use the `eu.` prefix**: `global.` profiles may route worldwide.
- Embeddings: `cohere.embed-multilingual-v3`

### Google Vertex AI
- Use a **regional endpoint** such as `europe-west3` (Frankfurt). The global endpoint has no residency guarantee.
- Project ID + service-account JSON (role *Vertex AI User*).
- Chat: `gemini-3.5-flash`, `gemini-4-argon`. Not every model exists in every EU region.

---

## Opt-in and non-EU

### OpenAI (direct)
Processed in the US by default. **EU data residency** is available for eligible API customers: you create a project with region *Europe* and use the base URL `https://eu.api.openai.com/v1`. Eligibility and retention terms are set by OpenAI's sales team, so check them before relying on it. For most companies, Azure is the simpler path to GPT in the EU.

### Anthropic (direct)
The first-party API currently offers `inference_geo` = `global` or `us` only, with no EU option. For Claude with EU residency, use **Bedrock** or **Vertex**. The direct API is included for teams that have assessed the third-country transfer and want the newest features first.

---

## Embeddings

The whole index uses **one** embedding model. If `EMBEDDING_MODEL` isn't set, the first connected provider with an embedding model is chosen, on-prem before EU before others. If you change it later, the heartbeat re-embeds all documents in the background (`embeddings.reconcile` task) and search keeps working via keyword matching in the meantime.

| Provider | Model | Dims |
|---|---|---|
| Ollama | `bge-m3` | 1024 |
| Mistral | `mistral-embed` | 1024 |
| STACKIT | `Qwen/Qwen3-VL-Embedding-8B` | 1024 (MRL) |
| Bedrock | `cohere.embed-multilingual-v3` | 1024 |
| Azure / OpenAI | `text-embedding-3-small` | 1024 (shortened) |

Without any embedding model, retrieval falls back to Postgres full-text search only. That works, but it doesn't find paraphrases.

## Tools and small models

The assistant uses tool calls to create documents, search again and remember facts. Large hosted models handle this well. Small local models (< 7B) sometimes produce malformed tool calls; the engine tolerates common mistakes, but for production use a model of the 20–30B class or larger.

## Sources

- Mistral release notes, Oct 2026: <https://docs.mistral.ai/getting-started/models>
- Azure Foundry region availability: <https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability>
- Bedrock regional availability: <https://docs.aws.amazon.com/bedrock/latest/userguide/models-region-compatibility.html>
- Vertex AI data residency: <https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/data-residency>
- OpenAI EU data residency: <https://openai.com/index/introducing-data-residency-in-europe/>
- STACKIT shared models: <https://docs.stackit.cloud/products/data-and-ai/ai-model-serving/basics/available-shared-models/>
