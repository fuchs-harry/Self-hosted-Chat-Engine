# Architecture

One Next.js process and one Postgres database. Everything else (queue, scheduler, vector store, file storage) is built on those two, which keeps operations boring.

```
Browser ──HTTPS──► Next.js app ───────────────► LLM provider (on-prem / EU)
                   ├─ UI (React Server + Client Components)
                   ├─ API routes (/api/*)
                   └─ Heartbeat (in-process, every 30 s)
                          │
                          ▼
                   Postgres 17 + pgvector
                   users · chats · messages · knowledge · chunks (vector + tsvector)
                   jobs · heartbeats · memories · audit_events · settings
```

## Request flow: a chat message

[`src/app/api/chat/route.ts`](../src/app/api/chat/route.ts)

1. **Auth**: the session cookie is looked up by its SHA-256 hash in `auth_sessions`.
2. **Conversation**: the client sends only the newest message; history comes from `chat_messages` (stored as AI SDK `UIMessage` parts, so tool calls and documents survive reloads). Regenerate/edit truncate the history server-side.
3. **Model**: `provider:model` is resolved through the [registry](../src/lib/providers/registry.ts), which honors the admin's allow-list and *EU only* switch.
4. **Retrieval** ([`lib/chat/retrieval.ts`](../src/lib/chat/retrieval.ts)): short follow-ups are expanded with the previous question; [hybrid search](../src/lib/rag/search.ts) runs a pgvector cosine query and a Postgres full-text query and fuses both with Reciprocal Rank Fusion (k = 60). Keyword search catches exact terms (order numbers, names, paragraph numbers); vectors catch paraphrases.
5. **Context**: [`buildInstructions`](../src/lib/chat/prompt.ts) layers product rules → company profile → admin instructions → user memory → retrieved excerpts (numbered for citations).
6. **Pseudonymization** (cloud models only): [`lib/pii.ts`](../src/lib/pii.ts) replaces personal data with placeholders in history, excerpts and memories. A stream transform restores them in text, reasoning and tool parts, holding back partial placeholders split across chunks. Tools receive restored inputs and return masked outputs.
7. **Streaming**: `streamText` with tools (`create_document`, `search_knowledge`, `remember`) and up to 5 steps; `toUIMessageStream` adds metadata (model, residency, sources, masked count).
8. **After the answer**: messages are saved, a title is generated for new chats, and a memory update is queued for the heartbeat.

## The heartbeat

[`src/lib/heartbeat`](../src/lib/heartbeat) is started from [`instrumentation.ts`](../src/instrumentation.ts) after migrations. Each beat:

1. Requeues jobs whose worker died (`running` for more than 15 min).
2. Runs **periodic tasks** that are due, under a Postgres advisory lock so only one replica runs each:

   | Task | Interval | Does |
   |---|---|---|
   | `connectors.schedule` | 60 s | queues syncs for connectors whose `next_sync_at` passed |
   | `embeddings.reconcile` | 10 min | re-embeds documents indexed with a different embedding model |
   | `retention.purge` | 1 h | deletes chats past the retention period |
   | `memory.consolidate` | 24 h | merges long memory lists into ≤ 20 facts |
   | `sessions.purge`, `housekeeping` | 1 h | expired sessions, old jobs and heartbeat rows |

3. **Drains the job queue** for up to 25 s, 2 jobs in parallel. Jobs are claimed with `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)`, so any number of replicas can work the same queue. Failures retry with exponential backoff (30 s, 2 min, 8 min); `dedupe_key` prevents duplicate work.

   | Job | Queued by |
   |---|---|
   | `ingest_document` | upload, connector sync, re-index, reconcile |
   | `sync_connector` | schedule, *Sync now*, connector create/edit |
   | `update_memory` | every answer (20 s debounce per chat) |

Enqueuing a job also "kicks" the heartbeat, so uploads are indexed within seconds rather than waiting for the next beat.

## Knowledge pipeline

```
upload / connector ──► documents (bytes for uploads, text_content always)
                           │  ingest_document
                           ▼
            extract (unpdf per page, mammoth, HTML→text)
                           ▼
            chunk (≈1000 chars, 150 overlap, never across pages)
                           ▼
            embed ("<title>\n\n<chunk>", batches of 64)
                           ▼
            chunks: content · page · embedding (vector) · tsv (generated)
```

- `embedding` is an untyped `vector` column, so the model and dimension can be chosen at deploy time. An HNSW index per dimension is created on first use: `((embedding::vector(1024)) vector_cosine_ops) WHERE vector_dims(embedding) = 1024`.
- The extracted text is stored, so switching embedding models re-indexes without touching SharePoint or the file server again.
- PDF page boundaries are kept as form feeds in `text_content`, so citations show page numbers after re-indexing too.

## Memory pipeline

[`src/lib/memory`](../src/lib/memory/index.ts)

- `update_memory` loads the last six messages and the current memory list, then asks the utility model for **operations** (`add`, `update` by id, `delete` by id) via structured output. Rules forbid secrets, GDPR Art. 9 data, facts about other people, and one-off tasks.
- Users can also say "remember that…" (the `remember` tool) or add facts in *Settings*.
- The prompt includes the 40 most recent facts. A daily consolidation rewrites learned facts once there are more than 30.

## Providers

[`src/lib/providers/catalog.ts`](../src/lib/providers/catalog.ts) is data: provider id, operator, HQ country, residency class, field definitions (with env var names), default models and embedding models. The admin UI and `.env.example` follow it. [`registry.ts`](../src/lib/providers/registry.ts) merges env values (which win) with encrypted DB values and builds AI SDK provider instances. Adding a provider means adding a catalog entry and a `case` in `buildFactory`.

## Security model

| Concern | Measure |
|---|---|
| Passwords | scrypt (N = 2^15), constant-time compare, login throttling |
| Sessions | 32-byte random token in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` on HTTPS); only its SHA-256 stored; disabled users and password changes revoke sessions |
| Secrets at rest | AES-256-GCM, key derived from `APP_SECRET` via HKDF; masked in all API responses |
| Authorization | Every route resolves the user server-side; chats are filtered by owner; company knowledge is managed by admins, private knowledge by its owner; generated files by owner |
| File system | Folder connector restricted to `CONNECTOR_FOLDER_ROOTS`, resolved with `realpath` against symlink escapes; admin-only |
| Logging | Audit events carry ids, model names and counts, never prompts or document text |
| Supply chain | Fonts self-hosted at build time; no telemetry; non-root container |

## Directory layout

```
db/migrations/        numbered SQL migrations, applied on boot
src/app/(auth)/       login, first-run setup
src/app/(app)/        chat, knowledge, settings, admin pages
src/app/api/          REST + streaming endpoints
src/components/       UI (chat/, layout/, ui/ primitives)
src/lib/              domain logic: auth, chat, rag, connectors, providers,
                      heartbeat, memory, documents, pii, settings, audit
tests/                vitest unit tests; tests/integration needs TEST_DATABASE_URL
examples/             demo knowledge and a sample file share
```
