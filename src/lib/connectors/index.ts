import "server-only";
import { db } from "@/lib/db";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/crypto";
import { env } from "@/lib/env";
import { enqueue } from "@/lib/heartbeat/jobs";
import { detectMimeType, extractText } from "@/lib/rag/extract";
import { pagesToText } from "@/lib/rag/ingest";
import { getConnectorDef, type ConnectorType } from "./catalog";
import { folderDriver } from "./folder";
import { sharepointDriver } from "./sharepoint";
import { ConnectorConfigError, type ConnectorDriver, type RemoteItem } from "./types";
import { webdavDriver } from "./webdav";

const DRIVERS: Record<ConnectorType, ConnectorDriver> = {
  sharepoint: sharepointDriver,
  folder: folderDriver,
  webdav: webdavDriver,
};

/** Files processed per sync run; the rest follow on the next run. */
const MAX_CHANGES_PER_RUN = 300;

export type ConnectorRow = {
  id: string;
  kb_id: string;
  type: ConnectorType;
  name: string;
  config: Record<string, string>;
  state: Record<string, unknown>;
  enabled: boolean;
  sync_interval_minutes: number;
  next_sync_at: Date;
  last_sync_at: Date | null;
  last_status: string | null;
  last_error: string | null;
  last_stats: SyncStats | null;
};

export type SyncStats = {
  added: number;
  updated: number;
  removed: number;
  unchanged: number;
  skipped: number;
  failed: number;
  pending: number;
};

/** Connector as shown in the UI: secrets masked. */
export type PublicConnector = Omit<ConnectorRow, "config" | "state"> & {
  config: Record<string, string>;
  document_count: number;
};

function decryptConfig(type: ConnectorType, config: Record<string, string>): Record<string, string> {
  const def = getConnectorDef(type);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(config)) {
    const secret = def?.fields.find((f) => f.key === k)?.secret;
    out[k] = secret ? decryptSecret(v) : v;
  }
  return out;
}

/** Validates and encrypts a config from the UI. Empty secret = keep old. */
export function prepareConfig(
  type: ConnectorType,
  input: Record<string, string>,
  previous?: Record<string, string>,
): Record<string, string> {
  const def = getConnectorDef(type);
  if (!def) throw new ConnectorConfigError(`Unknown connector type ${type}`);
  const out: Record<string, string> = {};
  for (const f of def.fields) {
    const value = (input[f.key] ?? "").trim();
    if (f.secret && !value && previous?.[f.key]) {
      out[f.key] = previous[f.key];
      continue;
    }
    if (f.required && !value) throw new ConnectorConfigError(`${f.label.en} is required`);
    if (value) out[f.key] = f.secret ? encryptSecret(value) : value;
  }
  return out;
}

export async function listConnectors(kbId: string): Promise<PublicConnector[]> {
  const rows = await db()<(ConnectorRow & { document_count: number })[]>`
    SELECT c.*, (SELECT count(*)::int FROM documents d WHERE d.connector_id = c.id) AS document_count
      FROM connectors c WHERE c.kb_id = ${kbId} ORDER BY c.created_at`;
  return rows.map(({ state: _state, ...r }) => {
    const def = getConnectorDef(r.type);
    const config: Record<string, string> = {};
    for (const [k, v] of Object.entries(r.config)) {
      const secret = def?.fields.find((f) => f.key === k)?.secret;
      config[k] = secret ? maskSecret(decryptSecret(v)) : v;
    }
    return { ...r, config };
  });
}

export async function getConnector(id: string): Promise<ConnectorRow | null> {
  const [row] = await db()<ConnectorRow[]>`SELECT * FROM connectors WHERE id = ${id}`;
  return row ?? null;
}

export async function createConnector(
  input: { kbId: string; type: ConnectorType; name: string; config: Record<string, string>; intervalMinutes: number },
  userId: string,
): Promise<string> {
  const config = prepareConfig(input.type, input.config);
  const [row] = await db()<{ id: string }[]>`
    INSERT INTO connectors (kb_id, type, name, config, sync_interval_minutes, created_by)
    VALUES (${input.kbId}, ${input.type}, ${input.name.trim()}, ${db().json(config)},
            ${input.intervalMinutes}, ${userId})
    RETURNING id`;
  await requestSync(row.id);
  return row.id;
}

export async function updateConnector(
  id: string,
  patch: { name?: string; config?: Record<string, string>; enabled?: boolean; intervalMinutes?: number },
): Promise<void> {
  const current = await getConnector(id);
  if (!current) return;
  const config = patch.config ? prepareConfig(current.type, patch.config, current.config) : current.config;
  // A new configuration may point at a different source: start fresh.
  const state = patch.config ? {} : current.state;
  await db()`
    UPDATE connectors SET
      name = ${patch.name?.trim() || current.name},
      config = ${db().json(config)},
      state = ${db().json(state as never)},
      enabled = ${patch.enabled ?? current.enabled},
      sync_interval_minutes = ${patch.intervalMinutes ?? current.sync_interval_minutes}
    WHERE id = ${id}`;
  if (patch.config) await requestSync(id);
}

export async function deleteConnector(id: string): Promise<void> {
  await db()`DELETE FROM connectors WHERE id = ${id}`;
}

export async function requestSync(id: string): Promise<void> {
  await db()`UPDATE connectors SET last_status = 'queued' WHERE id = ${id}`;
  await enqueue("sync_connector", { connectorId: id }, { dedupeKey: `sync:${id}`, maxAttempts: 2 });
}

export async function testConnector(type: ConnectorType, input: Record<string, string>, existingId?: string): Promise<string> {
  const previous = existingId ? (await getConnector(existingId))?.config : undefined;
  const config = decryptConfig(type, prepareConfig(type, input, previous));
  return DRIVERS[type].test(config);
}

/** Connectors due for their periodic sync get a job. Called by the heartbeat. */
export async function scheduleDueConnectors(): Promise<number> {
  const due = await db()<{ id: string }[]>`
    SELECT id FROM connectors WHERE enabled AND next_sync_at <= now() AND last_status IS DISTINCT FROM 'running'`;
  for (const c of due) await requestSync(c.id);
  return due.length;
}

type ExistingDoc = { id: string; external_id: string; content_hash: string | null };

/**
 * One sync run: list the source, fetch new or changed files, extract their
 * text and queue them for indexing, and remove documents that are gone.
 */
export async function syncConnector(id: string): Promise<SyncStats> {
  const sql = db();
  const connector = await getConnector(id);
  if (!connector) return { added: 0, updated: 0, removed: 0, unchanged: 0, skipped: 0, failed: 0, pending: 0 };

  await sql`UPDATE connectors SET last_status = 'running', last_error = NULL WHERE id = ${id}`;
  const stats: SyncStats = { added: 0, updated: 0, removed: 0, unchanged: 0, skipped: 0, failed: 0, pending: 0 };
  const failures: string[] = [];

  try {
    const driver = DRIVERS[connector.type];
    const config = decryptConfig(connector.type, connector.config);
    const listing = await driver.list(config, connector.state);

    const existing = new Map(
      (
        await sql<ExistingDoc[]>`
          SELECT id, external_id, content_hash FROM documents WHERE connector_id = ${id}`
      ).map((d) => [d.external_id, d]),
    );

    const maxBytes = env().MAX_UPLOAD_MB * 1024 * 1024;
    let processed = 0;
    for (const item of listing.items) {
      const prev = existing.get(item.externalId);
      if (prev && prev.content_hash === item.version) {
        stats.unchanged++;
        continue;
      }
      if (item.size > maxBytes) {
        stats.skipped++;
        continue;
      }
      if (processed >= MAX_CHANGES_PER_RUN) {
        stats.pending++;
        continue;
      }
      processed++;
      try {
        await importItem(connector, driver, config, item);
        if (prev) stats.updated++;
        else stats.added++;
      } catch (err) {
        stats.failed++;
        failures.push(`${item.path}: ${(err as Error).message}`);
      }
    }

    // Deletions: everything not listed (full listing) or reported deleted.
    const listed = new Set(listing.items.map((i) => i.externalId));
    const gone = listing.complete
      ? [...existing.keys()].filter((ext) => !listed.has(ext))
      : (listing.deleted ?? []).filter((ext) => existing.has(ext) && !listed.has(ext));
    if (gone.length) {
      const res = await sql`DELETE FROM documents WHERE connector_id = ${id} AND external_id = ANY(${gone})`;
      stats.removed = res.count;
    }

    // Keep the old delta link if this run couldn't process everything, so
    // the remaining changes are listed again next time.
    const state = stats.pending > 0 ? connector.state : listing.state;
    const nextMinutes = stats.pending > 0 ? 0 : connector.sync_interval_minutes;
    await sql`
      UPDATE connectors SET
        state = ${sql.json(state as never)},
        last_sync_at = now(),
        last_status = ${stats.failed ? "partial" : "ok"},
        last_error = ${failures.length ? failures.slice(0, 5).join("\n").slice(0, 2000) : null},
        last_stats = ${sql.json(stats)},
        next_sync_at = now() + make_interval(mins => ${nextMinutes})
      WHERE id = ${id}`;
    return stats;
  } catch (err) {
    await sql`
      UPDATE connectors SET
        last_status = 'error', last_error = ${(err as Error).message.slice(0, 2000)},
        last_sync_at = now(),
        next_sync_at = now() + make_interval(mins => ${connector.sync_interval_minutes})
      WHERE id = ${id}`;
    if (err instanceof ConnectorConfigError) return stats; // retrying won't help
    throw err;
  }
}

async function importItem(
  connector: ConnectorRow,
  driver: ConnectorDriver,
  config: Record<string, string>,
  item: RemoteItem,
): Promise<void> {
  const bytes = await driver.download(config, item);
  const mime = detectMimeType(item.name);
  const text = pagesToText(await extractText(bytes, item.name, mime));
  const title = item.name.replace(/\.[^.]+$/, "");

  const [row] = await db()<{ id: string }[]>`
    INSERT INTO documents (kb_id, connector_id, external_id, title, filename, mime_type, size_bytes,
                           content_hash, text_content, source_url, source_modified_at, status)
    VALUES (${connector.kb_id}, ${connector.id}, ${item.externalId}, ${title}, ${item.path}, ${mime},
            ${bytes.byteLength}, ${item.version}, ${text}, ${item.webUrl ?? null}, ${item.modifiedAt}, 'pending')
    ON CONFLICT (connector_id, external_id) WHERE connector_id IS NOT NULL DO UPDATE SET
      title = EXCLUDED.title, filename = EXCLUDED.filename, mime_type = EXCLUDED.mime_type,
      size_bytes = EXCLUDED.size_bytes, content_hash = EXCLUDED.content_hash,
      text_content = EXCLUDED.text_content, source_url = EXCLUDED.source_url,
      source_modified_at = EXCLUDED.source_modified_at, status = 'pending', error = NULL, updated_at = now()
    RETURNING id`;
  await enqueue("ingest_document", { documentId: row.id }, { dedupeKey: `ingest:${row.id}` });
}
