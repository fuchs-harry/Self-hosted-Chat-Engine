# Agent and contributor guide

How to work in this repository, for humans and AI coding agents alike.

## What this is

A self-hosted, GDPR-first company AI assistant: chat with retrieval over company documents, connectors (SharePoint, file shares, WebDAV), per-user memory, and a background heartbeat. One Next.js app plus Postgres/pgvector. Read [`docs/architecture.md`](docs/architecture.md) before larger changes.

## Commands

```bash
npm run dev          # needs DATABASE_URL + APP_SECRET (see .env.example)
npm run typecheck
npm run lint
npm test             # unit tests; add TEST_DATABASE_URL for the Postgres integration suite
npm run build
```

Run typecheck, lint and tests before committing.

## Invariants (don't break these)

1. **Two runtime dependencies only: the app and Postgres.** No Redis, queue broker or separate vector DB. Background work goes through the job queue in `src/lib/heartbeat` (`enqueue(type, payload, { dedupeKey })` + a handler in `handlers.ts`). Periodic work goes in `tasks.ts`.
2. **Nothing personal leaves the server unprotected.** Any new path that sends user or document text to a model must go through the chat route's `protect`/`restore` (see `src/lib/chat/pseudonymize.ts`) when the model isn't on-prem. Never call a provider from the browser.
3. **No content in logs.** `audit()` details and `console.*` may contain ids, counts and model names, never prompt or document text.
4. **Secrets are encrypted at rest.** Store them through `encryptSecret` (provider configs and connector secrets do this already) and never return them unmasked from an API.
5. **Authorization server-side, every time.** Pages call `requireUser()`/`requireAdmin()`, API routes call `apiUser()`/`apiAdmin()`. Filter by owner in SQL (`WHERE user_id = …`), don't trust ids from the client.
6. **Migrations are append-only.** Add `db/migrations/NNNN_name.sql`; never edit an applied one. They run on boot inside a transaction.
7. **Residency is honest.** A provider's `residency` in `src/lib/providers/catalog.ts` must reflect its documented default behavior, with the required configuration spelled out in `note`.

## Conventions

- **Stack:** Next.js 16 App Router (`proxy.ts`, async `params`), React 19, AI SDK 7 (`instructions`, `isStepCount`, `toUIMessageStream`, `onEnd`), Tailwind 4, Radix primitives in `src/components/ui`, postgres.js tagged templates. The bundled docs in `node_modules/next/dist/docs` and `node_modules/ai/docs` are authoritative; APIs changed from older versions.
- **Server code** imports `server-only`. Client components get data as props; types may be imported with `import type`.
- **UI strings** live in `src/lib/i18n/en.ts` (defines the shape) and `de.ts`. Use `useI18n()` in client components and `getT()` on the server. German is the default locale.
- **Design:** monochrome dark tokens in `src/app/globals.css`; chrome buttons (`variant="chrome"`) for primary actions only; mono uppercase `.eyebrow` labels.
- **API routes** wrap handlers in `route()` and validate bodies with zod via `parseBody()`. Throw `HttpError` for expected failures. Route files may only export HTTP handlers and route config; shared helpers go in `src/lib`.
- **Comments** explain *why* (constraints, legal reasons, protocol quirks), not what.

## Where things are

| Need | File |
|---|---|
| Chat request pipeline | `src/app/api/chat/route.ts` |
| System prompt layers | `src/lib/chat/prompt.ts` |
| Tools the model can call | `src/lib/chat/tools.ts` |
| Provider list and compliance notes | `src/lib/providers/catalog.ts` |
| Retrieval | `src/lib/rag/search.ts`, `src/lib/chat/retrieval.ts` |
| Ingestion | `src/lib/rag/ingest.ts`, `extract.ts`, `chunk.ts` |
| Connectors | `src/lib/connectors/*` |
| Heartbeat, jobs, tasks | `src/lib/heartbeat/*` |
| Memory | `src/lib/memory/index.ts` |
| PII pseudonymization | `src/lib/pii.ts` |
| Org settings and defaults | `src/lib/settings.ts` |

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
