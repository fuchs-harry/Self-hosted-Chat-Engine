<div align="center">

<img src="public/mark.svg" width="56" alt="" />

# Self-hosted Chat Engine

**A GDPR-first AI assistant for your company.**<br/>
Chat with your own documents, on your own server, with a model you choose: on-prem or EU-hosted.

[![CI](https://github.com/fuchs-harry/Self-hosted-Chat-Engine/actions/workflows/ci.yml/badge.svg)](https://github.com/fuchs-harry/Self-hosted-Chat-Engine/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-white?style=flat-square)](LICENSE)
![Version](https://img.shields.io/badge/version-0.1.0-white?style=flat-square)
![Stack](https://img.shields.io/badge/Next.js%2016%20·%20Postgres%20·%20pgvector-white?style=flat-square)
![UI](https://img.shields.io/badge/UI-Deutsch%20·%20English-white?style=flat-square)

[Quickstart](#quickstart) · [Features](#features) · [Models](docs/models.md) · [Connectors](docs/connectors.md) · [Compliance](docs/compliance.md) · [Admin guide](docs/setup.md) · [Architecture](docs/architecture.md)

<img src="docs/screenshots/chat-sources.jpg" alt="The assistant answering from company documents, with cited sources and an on-prem badge" width="900" />

</div>

## Why

Employees already use AI, often through private chatbot accounts IT never approved. Every pasted contract, customer e-mail or salary table is then a data transfer nobody can audit, usually to a provider outside the EU. Banning AI rarely works; offering a **better, sanctioned tool** does.

Self-hosted Chat Engine is that tool for small and mid-sized companies in Austria and the EU. It runs as **two containers** (the app and Postgres) on a server you control. It answers from your SharePoint, file shares and Nextcloud with sources, and it sends prompts only to the model you approved, pseudonymized if that model runs in the cloud.

| | Public chatbot | Self-hosted Chat Engine |
|---|---|---|
| Conversations stored | in the provider's cloud | in **your** Postgres |
| Knows company documents | no, or you upload them to the vendor | **SharePoint, file shares, Nextcloud, uploads** |
| Model | whatever the vendor picks | **your choice**: on-prem, EU-hosted or opt-in cloud |
| Personal data in prompts | sent as is | **pseudonymized** before leaving the server |
| Audit log, retention, data export | no | **built in** |
| Cost | per seat, per month | open source; you pay only for the model (or nothing, with Ollama) |

## Features

**Answers from company knowledge**
- Hybrid retrieval (pgvector embeddings + Postgres full-text, fused with Reciprocal Rank Fusion) finds paraphrases *and* exact terms like order numbers.
- Inline citations `[1]` link to the source file or SharePoint page, with page numbers for PDFs.
- Company-wide knowledge bases (managed by admins) and private ones per user.

**Connectors that keep data in sync**
- **Microsoft SharePoint / OneDrive** via Microsoft Graph delta queries.
- **Windows file shares** (SMB/NFS mounts) and **Nextcloud / WebDAV**.
- New, changed and deleted files are picked up automatically; originals stay at the source.

**Any model, connected by key**
- 11 providers, each with a residency label: Ollama and any OpenAI-compatible server (on-prem); Mistral, STACKIT, IONOS, Scaleway, Azure OpenAI EU Data Zone, Amazon Bedrock EU, Google Vertex EU (EU); OpenAI and Anthropic (opt-in).
- Paste a key in the admin UI, press *Test*, save. Keys are stored encrypted (AES-256-GCM) or come from environment variables.
- An *EU only* switch hides every non-EU option from users.

**Context, memory and a heartbeat**
- **Context**: admins describe the company and set house rules once; every chat starts from there.
- **Memory**: the assistant learns lasting facts about each user (role, location, preferred format). Users see, edit and delete every entry, and the assistant is instructed never to store sensitive categories (GDPR Art. 9).
- **Heartbeat**: a background loop on a Postgres job queue. It indexes uploads, syncs connectors, updates memories, enforces retention, and re-embeds the index after a model change. No Redis, no separate worker.

**Privacy and compliance building blocks**
- Reversible pseudonymization of e-mail addresses, IBANs, card numbers, phone numbers and Austrian social security numbers, with checksum validation where the format has one.
- Chat retention policy, audit log without content, per-user data export and deletion (GDPR Art. 15, 17, 20).
- AI disclosure in the UI (AI Act Art. 50), self-hosted fonts, no telemetry.

**Practical extras**
- "Write that as a PDF": the assistant creates PDF, Word and Markdown files, and every answer can be exported.
- Admin area with setup checklist, heartbeat status, users, privacy settings and audit log.
- German and English UI, health endpoint, migrations on start, one-click demo data.

<table>
<tr>
<td><img src="docs/screenshots/knowledge.jpg" alt="Knowledge base with connected sources and indexed documents" /></td>
<td><img src="docs/screenshots/admin-models.jpg" alt="Connecting Mistral AI by API key, labelled EU" /></td>
</tr>
<tr>
<td align="center"><sub>Knowledge bases with connectors and live indexing status</sub></td>
<td align="center"><sub>Connecting a provider by key; the label shows where data is processed</sub></td>
</tr>
</table>

## Quickstart

**Requirements:** a machine with Docker and Docker Compose. 2 CPU cores and 4 GB RAM are enough with a hosted EU model; for local models see [hardware sizing](docs/setup.md#hardware).

```bash
git clone https://github.com/fuchs-harry/Self-hosted-Chat-Engine.git
cd Self-hosted-Chat-Engine
cp .env.example .env
```

Open `.env` and set the two required values, for example with `openssl rand -hex 32`:

```ini
APP_SECRET=<long random string>
POSTGRES_PASSWORD=<another random string>
```

Then start the stack. The first start builds the image, which takes a few minutes:

```bash
docker compose up -d
```

Open `http://<server>:3000` and:

1. **Create the admin account.** The first visit shows the setup page.
2. **Connect a model** under *Administration → Models*: paste e.g. a [Mistral](https://console.mistral.ai/api-keys) or [STACKIT](https://portal.stackit.cloud) key, press *Test*, then *Save*.
3. **Load the demo** under *Administration → Overview → Load demo knowledge* (fictional Austrian company policies) and ask *"Wie viel Kilometergeld bekomme ich?"*
4. **Add your own knowledge** under *Knowledge*: upload files or connect SharePoint, a file share or Nextcloud.

### Fully on-prem

No data leaves the building. A GPU is strongly recommended.

```bash
docker compose --profile ollama up -d
docker compose exec ollama ollama pull qwen3:30b-a3b   # chat model
docker compose exec ollama ollama pull bge-m3          # embedding model
```

Add `OLLAMA_BASE_URL=http://ollama:11434/v1` and `OLLAMA_MODELS=qwen3:30b-a3b` to `.env`, then run `docker compose up -d` again.

For HTTPS, backups, file-share mounts and updates, see the [admin guide](docs/setup.md).

## Choosing a model

Summary as of October 2026; setup steps and caveats are in [docs/models.md](docs/models.md).

| Need | Recommendation | Residency |
|---|---|---|
| Nothing may leave the network | **Ollama** or **vLLM** with Qwen3, gpt-oss or Mistral Small | On-prem |
| European provider without a US parent | **Mistral AI** (Paris) | EU |
| Data centers in Germany or Austria | **STACKIT**, **IONOS** | EU |
| GPT models in a Microsoft environment | **Azure OpenAI**, *Data Zone Standard (EU)* deployments | EU (US company) |
| Claude models | **Amazon Bedrock**, `eu.anthropic.*` inference profiles | EU (US company) |
| Gemini models | **Google Vertex AI**, regional endpoint such as `europe-west3` | EU (US company) |

The direct OpenAI and Anthropic APIs are supported and labelled accordingly: OpenAI's EU residency requires an eligible project, and Anthropic's API has no EU processing option.

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
  llm -- "answer, values restored" --> app
```

For each message, the app:

1. Loads the company context and the user's memory.
2. Runs a hybrid search over the selected knowledge.
3. Pseudonymizes personal data if the model is not on-prem.
4. Streams the answer and restores the real values on the way back.
5. Stores the conversation and queues a memory update for the heartbeat.

Details: [docs/architecture.md](docs/architecture.md).

## Compliance

The engine provides technical measures: data residency, pseudonymization, retention, access control, audit logging and transparency. Compliance also needs organizational steps. These include a data processing agreement with your model provider and an entry in your record of processing activities. In Austria, introducing such a system usually also requires a **works agreement under § 96a ArbVG**. The [compliance checklist](docs/compliance.md) covers the GDPR, the AI Act timeline after the 2026 Digital Omnibus, and Austrian contacts.

> This is not legal advice. Involve your data protection officer and works council.

## Configuration

All options are documented in [`.env.example`](.env.example). The most important:

| Variable | Purpose |
|---|---|
| `APP_SECRET` | **Required.** Encrypts API keys and connector passwords stored in the database. |
| `POSTGRES_PASSWORD` | **Required.** Database password. |
| `APP_NAME`, `APP_LOCALE` | Name shown in the UI; default language `de` or `en`. |
| `APP_URL` | Public URL; with `https://` login cookies are marked secure. |
| `<PROVIDER>_API_KEY` | Optional; providers can also be connected in the admin UI. |
| `EMBEDDING_MODEL` | e.g. `ollama:bge-m3` or `mistral:mistral-embed`; picked automatically if unset. |
| `CONNECTOR_FOLDER_ROOTS` | Where mounted file shares live (default `/data/shares`). |

## Status and limitations

This is the **first public release (0.1.0)**. It is complete enough to run in a team, but a few things are deliberately simple for now:

- **Accounts are local** (e-mail and password, managed by admins). Single sign-on with Entra ID/OIDC is the next big item.
- **Source permissions are not mirrored.** Everything in a company knowledge base is searchable by all users, so connect only folders everyone may read.
- **Scanned PDFs need OCR** before upload; there is no built-in OCR yet.
- **Tool use needs a capable model.** Creating documents works best with hosted models and larger local models (about 20B parameters and up); very small models often call tools incorrectly.
- Model catalogs change monthly. Defaults reflect October 2026 and can be overridden without code changes.

## FAQ

**Does it send anything home?** No. There is no telemetry, and fonts are bundled at build time. The only outbound connections go to the model provider and the connectors you configure.

**Can it run without internet?** Yes, at runtime, with Ollama or another local model server. Building the image needs internet once (npm packages and fonts); you can also build elsewhere and copy the image.

**Which file types are supported?** PDF, DOCX, TXT, Markdown, CSV, JSON and HTML, up to 25 MB per file by default.

**How do I update?** `git pull && docker compose up -d --build`. Database migrations run automatically on start.

**Can I rebrand it?** Yes: set `APP_NAME` and replace `public/mark.svg`. The license allows commercial use.

## Development

```bash
docker run -d --name chat-pg -e POSTGRES_PASSWORD=dev -p 5432:5432 pgvector/pgvector:pg17
cp .env.example .env.local
# in .env.local: DATABASE_URL=postgres://postgres:dev@localhost:5432/postgres and an APP_SECRET
npm install
npm run dev                     # http://localhost:3000

npm run typecheck && npm run lint && npm test
TEST_DATABASE_URL=postgres://postgres:dev@localhost:5432/postgres npm test   # includes integration tests
```

Built with Next.js 16, React 19, AI SDK 7, Tailwind CSS 4, Radix UI, postgres.js and pgvector. Conventions and invariants are in [AGENTS.md](AGENTS.md).

## Roadmap

- [ ] Single sign-on with Microsoft Entra ID / OIDC
- [ ] Mirror SharePoint permissions per document
- [ ] OCR for scanned PDFs
- [ ] More connectors: Confluence, Google Drive, IMAP mailboxes
- [ ] Scheduled assistant tasks ("every Monday, summarize what changed in the handbook")
- [ ] Usage and cost overview per provider

## Contributing and security

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). Report security issues privately as described in [SECURITY.md](SECURITY.md). Changes are listed in the [changelog](CHANGELOG.md).

## License

[Apache License 2.0](LICENSE) © 2026 Harald Fuchs. You may use, modify and redistribute it, including commercially.
