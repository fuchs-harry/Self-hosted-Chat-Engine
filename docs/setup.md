# Admin guide: installing and running

This guide is for the person who sets up and maintains the server. It assumes basic Linux and Docker knowledge, nothing more.

## Hardware

| Setup | CPU / RAM | Disk | Notes |
|---|---|---|---|
| Hosted EU model (Mistral, STACKIT, Azure EU, …) | 2 vCPU, 4 GB | 20 GB | Enough for a typical SMB; the model runs at the provider |
| Local models, small team | 8 cores, 32 GB, **GPU with 24 GB VRAM** (e.g. RTX 4090 / L4) | 100 GB | `qwen3:30b-a3b` or `gpt-oss:20b` + `bge-m3` |
| Local models, department | 2× 48 GB GPUs or one 80 GB | 200 GB | 70B-class models via vLLM |

Without a GPU, local models work but answer slowly. Use a small model for testing only.

## Install

```bash
# Debian/Ubuntu: Docker Engine + compose plugin
curl -fsSL https://get.docker.com | sh

git clone https://github.com/fuchs-harry/Self-hosted-Chat-Engine.git /opt/chat-engine
cd /opt/chat-engine
cp .env.example .env
sed -i "s/^APP_SECRET=.*/APP_SECRET=$(openssl rand -hex 32)/" .env
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 16)/" .env
docker compose up -d
docker compose logs -f app      # wait for "[heartbeat] started"
```

Then open `http://<server>:3000` and create the admin account. To skip the setup page, for example for automated installs, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` before the first start.

> **Keep `APP_SECRET` safe** (in your password manager). It encrypts API keys and connector passwords stored in the database. If you lose it, you have to re-enter them.

## HTTPS

Put a reverse proxy in front. With [Caddy](https://caddyserver.com), certificates are automatic:

```caddyfile
# /etc/caddy/Caddyfile
chat.firma.at {
    reverse_proxy 127.0.0.1:3000
}
```

For an internal-only hostname, use your company CA (`tls /path/cert.pem /path/key.pem`). Then set `APP_URL=https://chat.firma.at` in `.env` so login cookies are marked `Secure`, and run `docker compose up -d` again.

## Connecting a Windows file share

The *Network share* connector reads folders inside the container under `/data/shares`. Mount the share on the host and pass it through as read-only:

```bash
sudo apt install cifs-utils
sudo mkdir -p /mnt/handbuch
# /etc/fstab (use a dedicated read-only AD account):
//fileserver.firma.local/Handbuch  /mnt/handbuch  cifs  credentials=/root/.smb-chat,ro,iocharset=utf8,vers=3.0  0  0
sudo mount -a
```

```yaml
# docker-compose.yml → services.app.volumes
- /mnt/handbuch:/data/shares/handbuch:ro
```

In the app, open *Knowledge → (base) → Connect source → Network share* and enter the path `/data/shares/handbuch`. Paths outside `CONNECTOR_FOLDER_ROOTS` are refused.

## Backups

All state lives in Postgres: chats, documents, the index, memories, settings and encrypted keys. A nightly dump is enough:

```bash
# /etc/cron.d/chat-engine-backup
0 2 * * * root cd /opt/chat-engine && docker compose exec -T postgres pg_dump -U chat -Fc chat > /backup/chat-$(date +\%F).dump
```

Restore with `pg_restore -U chat -d chat --clean`. Also back up `.env`, since the dump is useless for stored keys without `APP_SECRET`.

## Updates

```bash
cd /opt/chat-engine
git pull
docker compose up -d --build
```

Database migrations run automatically on start. They are forward-only and run in transactions, and several app replicas can start at once (an advisory lock serializes them).

## Monitoring

- `GET /api/health` returns `200 {"status":"ok","heartbeatAgeSeconds":12}`, or `503` when the database is down. Point Uptime Kuma, Zabbix or PRTG at it.
- *Administration → Overview* shows the heartbeat, job counts, periodic tasks and the latest failures.
- Logs: `docker compose logs app`. Prompts and document contents are never logged.

## Scaling

One app container handles a typical SMB comfortably. For more you can:

- Run several `app` replicas behind the proxy. Jobs are claimed with `FOR UPDATE SKIP LOCKED` and periodic tasks are guarded by an advisory lock, so the heartbeat runs safely on every replica.
- Use a managed or existing Postgres 15+ with the `vector` extension: set `DATABASE_URL` and remove the `postgres` service.

## Troubleshooting

| Symptom | Check |
|---|---|
| "No model is configured" in chat | *Administration → Models*: a provider must show **Connected** and be enabled |
| Uploads stay at "Queued" | Heartbeat on the overview page; `HEARTBEAT_ENABLED=true`; `docker compose logs app` |
| Documents "Failed: No text found" | Scanned PDF without text layer; OCR is on the roadmap |
| Answers ignore documents | Knowledge picker in the composer set to *All knowledge* or the right base; is an embedding model shown on the overview? Keyword search works without one |
| SharePoint 403 | The app registration lacks access to that site; see [connectors.md](connectors.md#microsoft-sharepoint--onedrive) |
| Login loops on HTTPS | `APP_URL` must match the public URL; the proxy must pass `X-Forwarded-Proto` |
