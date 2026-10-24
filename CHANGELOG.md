# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-10-24

The first public release.

### Added

- **Chat** with streaming answers, Markdown rendering, a model picker with residency labels, regenerate, copy and export (PDF, DOCX, Markdown), and an AI disclosure under the input.
- **Knowledge bases** (company-wide or private) with drag-and-drop upload of PDF, DOCX, TXT, Markdown, CSV, JSON and HTML.
- **Hybrid retrieval**: pgvector embeddings and Postgres full-text search fused with Reciprocal Rank Fusion, inline citations with page numbers, and follow-up-aware search queries.
- **Connectors**: Microsoft SharePoint / OneDrive (Graph delta sync), network shares / local folders, and Nextcloud / WebDAV, with connection tests and scheduled syncs.
- **Model providers**: Ollama, any OpenAI-compatible server, Mistral AI, STACKIT, IONOS, Scaleway, Azure OpenAI, Amazon Bedrock, Google Vertex AI, OpenAI and Anthropic. Each is labelled by data residency, and keys can be added in the admin UI (encrypted) or via environment variables.
- **Heartbeat**: an in-process scheduler on a Postgres job queue for indexing, connector syncs, memory updates, retention, re-embedding and housekeeping.
- **Memory**: per-user long-term facts, learned automatically or on request, viewable and editable by the user.
- **Tools**: `create_document`, `search_knowledge` and `remember`.
- **Privacy**: reversible pseudonymization of personal data for cloud models, chat retention, audit log with CSV export, personal data export and deletion, and AES-256-GCM encryption of stored secrets.
- **Administration**: setup checklist, heartbeat status, model policy (default model, EU-only), company context and instructions, privacy settings, user management.
- **Operations**: Docker image (non-root, health check), Docker Compose stack with optional Ollama profile, migrations on start, `/api/health`, and a one-click demo knowledge base.
- German and English user interface.
- Documentation: admin guide, model guide, connector guide, architecture overview and a GDPR / AI Act checklist for Austrian companies.

[Unreleased]: https://github.com/fuchs-harry/Self-hosted-Chat-Engine/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/fuchs-harry/Self-hosted-Chat-Engine/releases/tag/v0.1.0
