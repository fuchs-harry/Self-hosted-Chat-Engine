import "server-only";
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import { isSupported } from "@/lib/rag/extract";
import { ConnectorConfigError, type ConnectorDriver, type RemoteItem } from "./types";

const MAX_FILES = 20_000;
const MAX_DEPTH = 20;

/** Allowed roots from CONNECTOR_FOLDER_ROOTS, resolved. */
async function allowedRoots(): Promise<string[]> {
  const roots = env()
    .CONNECTOR_FOLDER_ROOTS.split(",")
    .map((r) => r.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const r of roots) {
    try {
      out.push(await realpath(r));
    } catch {
      // root doesn't exist on this machine
    }
  }
  return out;
}

/**
 * Resolves the configured path (following symlinks) and refuses anything
 * outside the allowed roots, so the connector can't read /etc or the app.
 */
async function resolveRoot(config: Record<string, string>): Promise<string> {
  if (!config.path) throw new ConnectorConfigError("Path is required");
  let real: string;
  try {
    real = await realpath(config.path);
  } catch {
    throw new ConnectorConfigError(`Folder not found: ${config.path}`);
  }
  const roots = await allowedRoots();
  const inside = roots.some((root) => real === root || real.startsWith(root + path.sep));
  if (!inside) {
    throw new ConnectorConfigError(
      `Folder is outside the allowed roots (${env().CONNECTOR_FOLDER_ROOTS}). Mount the share there or extend CONNECTOR_FOLDER_ROOTS.`,
    );
  }
  return real;
}

async function walk(root: string): Promise<RemoteItem[]> {
  const items: RemoteItem[] = [];
  const queue: { dir: string; depth: number }[] = [{ dir: root, depth: 0 }];
  while (queue.length && items.length < MAX_FILES) {
    const { dir, depth } = queue.shift()!;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue; // unreadable folder: skip, don't fail the whole sync
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name.startsWith("~$")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (depth < MAX_DEPTH) queue.push({ dir: full, depth: depth + 1 });
        continue;
      }
      if (!entry.isFile() || !isSupported(entry.name)) continue;
      const info = await stat(full);
      const rel = path.relative(root, full).split(path.sep).join("/");
      items.push({
        externalId: rel,
        name: entry.name,
        path: rel,
        size: info.size,
        modifiedAt: info.mtime,
        version: `${info.mtimeMs}:${info.size}`,
        webUrl: null,
      });
    }
  }
  return items;
}

export const folderDriver: ConnectorDriver = {
  async list(config) {
    const root = await resolveRoot(config);
    return { items: await walk(root), complete: true, state: {} };
  },

  async download(config, item) {
    const root = await resolveRoot(config);
    const full = await realpath(path.join(root, item.externalId));
    if (!full.startsWith(root + path.sep)) throw new Error("Path escapes the connector root");
    return new Uint8Array(await readFile(full));
  },

  async test(config) {
    const root = await resolveRoot(config);
    const items = await walk(root);
    return `${root}: ${items.length} supported files`;
  },
};
