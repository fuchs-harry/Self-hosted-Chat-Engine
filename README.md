<div align="center">

<img src="public/mark.svg" width="56" alt="" />

# Self-hosted Chat Engine

**A GDPR-first AI assistant for your company: your documents, your server, your choice of EU-compliant model.**

Built for Austrian and European SMBs that want what ChatGPT offers without sending company data to wherever a free chatbot sends it.

[Quickstart](#quickstart-10-minutes) · [Why this matters](#why-this-matters) · [Models](docs/models.md) · [Connectors](docs/connectors.md) · [Compliance](docs/compliance.md) · [Admin guide](docs/setup.md)

![License](https://img.shields.io/badge/license-Apache--2.0-white?style=flat-square)
![Stack](https://img.shields.io/badge/stack-Next.js%2016%20·%20Postgres%20·%20pgvector-white?style=flat-square)
![Containers](https://img.shields.io/badge/containers-2-white?style=flat-square)
![Languages](https://img.shields.io/badge/UI-Deutsch%20·%20English-white?style=flat-square)

<img src="docs/screenshots/chat-sources.jpg" alt="Chat answering from company documents with cited sources and an on-prem badge" width="900" />

</div>

---

## Why this matters

Your employees already use AI, often through private chatbot accounts that IT never approved ("shadow AI"). Every pasted contract, customer e-mail or salary table is a data transfer you can't audit, usually to a provider outside the EU. That is a GDPR problem today. Since 2 August 2026, the EU AI Act's transparency rules (Art. 50) apply too.

Banning AI doesn't work. Giving people a **better, sanctioned tool** does:

| | Public chatbot | **Self-hosted Chat Engine** |
|---|---|---|
| Where conversations are stored | Provider's cloud | **Your Postgres, on your server** |
| Knows your company documents | No (or you upload them to the vendor) | **Yes: SharePoint, file shares, Nextcloud, uploads** |
| Which model processes data | Whatever the vendor picks | **You choose: on-prem, EU-hosted or opt-in cloud** |
| Personal data in prompts | Sent as is | **Pseudonymized before leaving the server, restored in the answer** |
| Audit trail, retention, user data export | No | **Built in** |
| Cost | Per seat, per month | **Open source; pay only for the model you use (or nothing, with Ollama)** |

It's an open-source demo you can actually run: two containers, one `.env` file, a setup wizard in the browser.

## What's inside

- **Chat that cites its sources.** Answers come from your documents with inline `[1]` citations that link to the original file or SharePoint page. Hybrid search (pgvector + Postgres full-text, fused with RRF) finds exact terms like order numbers *and* paraphrases.
- **Bring any model, by key.** 11 providers with a compliance label on each: Ollama/vLLM (on-prem), Mistral, STACKIT, IONOS, Scaleway, Azure OpenAI EU Data Zone, Amazon Bedrock EU, Google Vertex EU, plus OpenAI and Anthropic for those who opt in. Paste a key in the admin UI, press *Test* and you're done. An "EU only" switch hides everything else.
- **Company data stays manageable.** Connect a **SharePoint/OneDrive** library (Microsoft Graph delta sync), a **Windows file share** (SMB/NFS mount) or **Nextcloud/WebDAV**. The heartbeat keeps them in sync: new, changed and deleted files are picked up on their own.
- **Context, memory, heartbeat.** Three ideas borrowed from agent frameworks, made safe for companies:
  - **Context**: the admin describes the company and sets house rules once; every chat starts with it.
  - **Memory**: the assistant learns durable facts about each user ("works in controlling in Graz", "prefers bullet points"). Users see, edit and delete everything; GDPR Art. 9 data is excluded by design.
  - **Heartbeat**: an in-process scheduler on a Postgres job queue (`SKIP LOCKED`). It indexes uploads, syncs connectors, updates memories, enforces retention, and re-embeds the index when you switch embedding models. No Redis, no Celery.
- **Privacy built in.** Reversible PII pseudonymization (e-mail, IBAN with checksum, cards with Luhn, phone numbers, Austrian SV numbers with check digit), retention policies, an audit log without content, per-user data export (Art. 15/20), AES-256-GCM-encrypted secrets, self-hosted fonts (no Google requests), and an AI disclosure in the UI (AI Act Art. 50).
- **Documents out, too.** "Write that as a PDF" creates real PDF/DOCX/Markdown files (rendered in pure Node, no headless browser), and any answer can be exported.
- **Made for the IT person who has to run it.** Two containers, migrations on boot, `/api/health`, a status page showing the heartbeat, a one-click demo knowledge base, German and English UI.

<table>
<tr>
<td><img src="docs/screenshots/knowledge.jpg" alt="Knowledge base with connected sources and indexed documents" /></td>
<td><img src="docs/screenshots/admin-models.jpg" alt="Connecting Mistral AI by API key, labeled EU" /></td>
</tr>
<tr>
<td align="center"><sub>Knowledge bases with connectors and live indexing status</sub></td>
<td align="center"><sub>Connect a provider by key, with its residency on the label</sub></td>
</tr>
</table>

## Quickstart (10 minutes)

You need a Linux server (or any machine) with Docker. 2 CPU cores and 4 GB RAM are enough when you use a hosted EU model. For local models see [hardware sizing](docs/setup.md#hardware).

```bash
git clone https://github.com/fuchs-harry/Self-hosted-Chat-Engine.git
cd Self-hosted-Chat-Engine
cp .env.example .env

# Set the two required values:
sed -i "s/^APP_SECRET=.*/APP_SECRET=$(openssl rand -hex 32)/" .env
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 16)/" .env

docker compose up -d
```

Open `http://<server>:3000`:

1. **Create the admin account.** The first visit opens the setup page.
2. **Connect a model.** Go to *Administration → Models*, paste e.g. a [Mistral](https://console.mistral.ai/api-keys) or [STACKIT](https://portal.stackit.cloud) key, then press *Test* and *Save*.
3. **Try it.** Under *Administration → Overview → Load demo knowledge* you get fictional Austrian company policies. Then ask: *"Wie viel Kilometergeld bekomme ich?"*
4. **Add your own knowledge.** Upload files or connect SharePoint or a file share under *Knowledge*.

### Fully on-prem (no data leaves the building)

```bash
docker compose --profile ollama up -d
docker compose exec ollama ollama pull qwen3:30b-a3b   # chat
docker compose exec ollama ollama pull bge-m3          # embeddings
```

Add to `.env` and restart: `OLLAMA_BASE_URL=http://ollama:11434/v1` and `OLLAMA_MODELS=qwen3:30b-a3b`.

## Choosing a model

The short version, as of October 2026. Details, setup steps and caveats are in [docs/models.md](docs/models.md).

| Need | Recommendation | Residency |
|---|---|---|
| Nothing may leave the network | **Ollama / vLLM** with Qwen3, gpt-oss or Mistral Small | On-prem |
| European provider, no US parent | **Mistral AI** (Paris) | EU |
| German/Austrian data centers | **STACKIT** (Schwarz Gruppe), **IONOS** | EU |
| GPT models, Microsoft shop | **Azure OpenAI**, *Data Zone Standard (EU)* deployments | EU (US company) |
| Claude models | **Amazon Bedrock** `eu.anthropic.*` profiles from `eu-central-1` | EU (US company) |
| Gemini | **Vertex AI**, regional endpoint such as `europe-west3` | EU (US company) |

The direct OpenAI and Anthropic APIs are supported but labeled honestly. OpenAI's EU residency must be approved per project, and Anthropic's API has no EU processing option.

## How it works

```mermaid
flowchart LR
  subgraph server["Your server (docker compose)"]
    direction TB
    app["App (Next.js)<br/>UI · API · Heartbeat"]
    pg[("Postgres + pgvector<br/>chats · knowledge · jobs · memory")]
    app <--> pg
  end
  user(["Employees<br/>(browser)"]) -- HTTPS --> app
  sp["SharePoint · File share · Nextcloud"] -- "sync (heartbeat)" --> app
  app -- "pseudonymized prompt" --> llm["LLM: on-prem or EU provider"]
  llm -- "answer (restored)" --> app
```

Each chat request goes through these steps:

1. Load the user's memory and the company context.
2. Search the selected knowledge with a hybrid query.
3. Pseudonymize personal data if the model isn't on-prem.
4. Stream the answer and restore placeholders on the fly.
5. Store the conversation, then enqueue a memory update for the heartbeat.

More in [docs/architecture.md](docs/architecture.md).

## Compliance, briefly

This project gives you technical building blocks such as data residency, pseudonymization, retention, audit logging, access rights and transparency. Compliance itself is organizational: a data processing agreement (DPA) with your model provider, your record of processing activities, and, in Austria, usually a **works agreement under § 96a ArbVG** before you introduce such a system. [docs/compliance.md](docs/compliance.md) has a checklist for Austrian companies covering the GDPR, the AI Act timeline after the 2026 Digital Omnibus, the DSB and the works council.

> Not legal advice. Talk to your data protection officer.

## Configuration

Everything is in [`.env.example`](.env.example), with comments. The important parts:

| Variable | Purpose |
|---|---|
| `APP_SECRET` | Encrypts stored API keys. Required. |
| `POSTGRES_PASSWORD` | Database password. Required. |
| `APP_NAME`, `APP_LOCALE` | Your brand name in the UI; `de` or `en` |
| `<PROVIDER>_API_KEY` | Optional: providers can also be connected in the UI |
| `EMBEDDING_MODEL` | e.g. `ollama:bge-m3`, `mistral:mistral-embed`; auto-picked otherwise |
| `CONNECTOR_FOLDER_ROOTS` | Where mounted file shares live (default `/data/shares`) |

## Development

```bash
docker run -d --name chat-pg -e POSTGRES_PASSWORD=dev -p 5432:5432 pgvector/pgvector:pg17
cp .env.example .env.local   # set DATABASE_URL=postgres://postgres:dev@localhost:5432/postgres and APP_SECRET
npm install
npm run dev                  # http://localhost:3000

npm run typecheck && npm run lint && npm test
TEST_DATABASE_URL=postgres://postgres:dev@localhost:5432/postgres npm test   # + integration tests
```

Stack: Next.js 16 (App Router), React 19, AI SDK 7, Tailwind CSS 4, Radix UI, postgres.js, pgvector. See [AGENTS.md](AGENTS.md) for conventions, which is also useful if you work on it with an AI coding agent.

## Roadmap

- [ ] Single sign-on with Microsoft Entra ID / OIDC (login and SharePoint use the same app registration)
- [ ] Mirror SharePoint permissions per document
- [ ] OCR for scanned PDFs (Tesseract in the heartbeat)
- [ ] More connectors: Confluence, Google Drive, IMAP mailboxes
- [ ] Scheduled assistant tasks ("every Monday: summarize what changed in the handbook")
- [ ] Usage dashboard per department and cost tracking per provider

Contributions are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[Apache License 2.0](LICENSE). Use it, fork it, rebrand it for your company (`APP_NAME`, `public/mark.svg`), and sell services around it.
