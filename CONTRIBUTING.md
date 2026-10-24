# Contributing

Thanks for helping. Bug reports, connectors, provider updates and translations are especially welcome.

## Before you start

- For larger changes, open an issue first so we can agree on the approach.
- Read [AGENTS.md](AGENTS.md). The invariants there (two runtime dependencies, no content in logs, honest residency labels) are not negotiable.

## Workflow

1. Fork and create a branch: `feat/confluence-connector`, `fix/webdav-umlauts`.
2. Run Postgres locally (see the README's *Development* section).
3. Make the change with tests. Logic in `src/lib` should have unit tests; anything touching SQL belongs in `tests/integration`.
4. Run `npm run typecheck && npm run lint && npm test`.
5. Use [Conventional Commits](https://www.conventionalcommits.org): `feat(connectors): add Confluence`, `fix(rag): …`, `docs: …`.
6. Open a pull request describing *why* and how you tested it. Add screenshots for UI changes.

## Updating model lists

Provider catalogs change often. When you update `src/lib/providers/catalog.ts`, link the provider's official model or region page in the PR and update [docs/models.md](docs/models.md).

## Translations

Add a dictionary next to `src/lib/i18n/de.ts` typed as `Dictionary`; TypeScript reports missing keys. Register the locale in `src/lib/i18n/index.ts`.
