import "server-only";
import { isSupported } from "@/lib/rag/extract";
import { ConnectorConfigError, type ConnectorDriver, type RemoteItem } from "./types";

const MAX_FILES = 20_000;
const MAX_FOLDERS = 5_000;

const PROPFIND_BODY = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop><d:resourcetype/><d:getcontentlength/><d:getlastmodified/><d:getetag/></d:prop>
</d:propfind>`;

function auth(c: Record<string, string>): string {
  return `Basic ${Buffer.from(`${c.username}:${c.password}`).toString("base64")}`;
}

type Entry = { href: string; isDir: boolean; size: number; modified: Date | null; etag: string };

// DAV responses use arbitrary namespace prefixes (d:, D:, none), so match
// on local names. Good enough for Nextcloud, ownCloud, Apache mod_dav, IIS.
const tag = (name: string) => new RegExp(`<(?:[\\w-]+:)?${name}[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${name}>`, "i");

export function parseMultistatus(xml: string): Entry[] {
  const out: Entry[] = [];
  const responses = xml.match(/<(?:[\w-]+:)?response[\s>][\s\S]*?<\/(?:[\w-]+:)?response>/gi) ?? [];
  for (const r of responses) {
    const href = r.match(tag("href"))?.[1]?.trim();
    if (!href) continue;
    const isDir = /<(?:[\w-]+:)?collection\s*\/?>/i.test(r);
    const size = Number(r.match(tag("getcontentlength"))?.[1] ?? 0);
    const lm = r.match(tag("getlastmodified"))?.[1];
    const etag = (r.match(tag("getetag"))?.[1] ?? "").replace(/&quot;|"/g, "");
    out.push({ href, isDir, size, modified: lm ? new Date(lm) : null, etag });
  }
  return out;
}

async function propfind(c: Record<string, string>, url: string): Promise<Entry[]> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "PROPFIND",
      headers: { authorization: auth(c), depth: "1", "content-type": "application/xml" },
      body: PROPFIND_BODY,
    });
  } catch (err) {
    const cause = (err as { cause?: { code?: string } }).cause?.code;
    throw new ConnectorConfigError(`WebDAV server not reachable (${cause ?? (err as Error).message})`);
  }
  if (res.status === 401) throw new ConnectorConfigError("WebDAV login failed (check user and app password)");
  if (res.status === 404) throw new ConnectorConfigError(`Folder not found: ${url}`);
  if (res.status !== 207) throw new Error(`WebDAV PROPFIND returned ${res.status}`);
  return parseMultistatus(await res.text());
}

function baseUrl(c: Record<string, string>): URL {
  try {
    const u = new URL(c.url);
    if (!u.pathname.endsWith("/")) u.pathname += "/";
    return u;
  } catch {
    throw new ConnectorConfigError("WebDAV URL is not a valid URL");
  }
}

async function walk(c: Record<string, string>): Promise<RemoteItem[]> {
  const base = baseUrl(c);
  const rootPath = decodeURIComponent(base.pathname);
  const items: RemoteItem[] = [];
  const queue = [base.toString()];
  const seen = new Set<string>();

  while (queue.length && seen.size < MAX_FOLDERS && items.length < MAX_FILES) {
    const folder = queue.shift()!;
    if (seen.has(folder)) continue;
    seen.add(folder);
    for (const e of await propfind(c, folder)) {
      const abs = new URL(e.href, base);
      if (abs.toString() === folder) continue; // the folder itself
      const decoded = decodeURIComponent(abs.pathname);
      const name = decoded.replace(/\/$/, "").split("/").pop() ?? "";
      if (name.startsWith(".")) continue;
      if (e.isDir) {
        queue.push(abs.toString());
        continue;
      }
      if (!isSupported(name)) continue;
      items.push({
        externalId: decoded,
        name,
        path: decoded.startsWith(rootPath) ? decoded.slice(rootPath.length) : decoded,
        size: e.size,
        modifiedAt: e.modified,
        version: e.etag || `${e.modified?.getTime() ?? 0}:${e.size}`,
        webUrl: null,
      });
    }
  }
  return items;
}

export const webdavDriver: ConnectorDriver = {
  async list(c) {
    return { items: await walk(c), complete: true, state: {} };
  },

  async download(c, item) {
    const url = new URL(item.externalId.split("/").map(encodeURIComponent).join("/"), baseUrl(c));
    const res = await fetch(url, { headers: { authorization: auth(c) } });
    if (!res.ok) throw new Error(`Download of ${item.name} failed: ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  },

  async test(c) {
    const entries = await propfind(c, baseUrl(c).toString());
    return `${baseUrl(c).host}: ${Math.max(entries.length - 1, 0)} entries in folder`;
  },
};
