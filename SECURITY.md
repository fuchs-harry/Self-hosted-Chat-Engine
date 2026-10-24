# Security policy

## Reporting a vulnerability

Please **don't open a public issue** for security problems. Use GitHub's [private vulnerability reporting](https://github.com/fuchs-harry/Self-hosted-Chat-Engine/security/advisories/new) instead. Include steps to reproduce and the affected version or commit.

You can expect an acknowledgement within a few days. Fixes are released as soon as possible and credited unless you prefer otherwise.

## Scope

Particularly interesting are authorization bypasses (accessing another user's chats, files or private knowledge), leaks of stored secrets, ways to make personal data reach a cloud model despite pseudonymization, path traversal in the folder connector, and prompt injection that leads to cross-user data access through tools.

## Hardening checklist for operators

- Serve over HTTPS and set `APP_URL` to the `https://` URL.
- Keep `APP_SECRET` out of version control and back it up separately.
- Don't publish the Postgres port; in `docker-compose.yml` only the app talks to it.
- Mount file shares read-only and use dedicated read-only service accounts for SharePoint (`Sites.Selected`) and WebDAV.
- Update regularly: `git pull && docker compose up -d --build`.
