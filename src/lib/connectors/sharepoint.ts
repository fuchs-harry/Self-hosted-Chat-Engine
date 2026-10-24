import "server-only";
import { isSupported } from "@/lib/rag/extract";
import { ConnectorConfigError, type ConnectorDriver, type RemoteItem } from "./types";

/**
 * Microsoft SharePoint / OneDrive for Business via Microsoft Graph, using an
 * Entra ID app registration with application permissions (client
 * credentials). Recommended permission: Sites.Selected, granted only for
 * the sites you want to index. See docs/connectors.md.
 */

const GRAPH = "https://graph.microsoft.com/v1.0";

type Token = { value: string; expires: number };
const tokens = new Map<string, Token>();

async function accessToken(c: Record<string, string>): Promise<string> {
  const key = `${c.tenantId}:${c.clientId}`;
  const cached = tokens.get(key);
  if (cached && cached.expires > Date.now() + 60_000) return cached.value;

  const res = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(c.tenantId)}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: c.clientId,
        client_secret: c.clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    },
  );
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!res.ok || !body.access_token) {
    throw new ConnectorConfigError(
      `Sign-in to Microsoft Entra ID failed: ${body.error_description?.split("\r\n")[0] ?? res.statusText}`,
    );
  }
  tokens.set(key, { value: body.access_token, expires: Date.now() + (body.expires_in ?? 3600) * 1000 });
  return body.access_token;
}

class GraphError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function graph<T>(c: Record<string, string>, url: string): Promise<T> {
  const res = await fetch(url.startsWith("http") ? url : `${GRAPH}${url}`, {
    headers: { authorization: `Bearer ${await accessToken(c)}`, accept: "application/json" },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    const hint =
      res.status === 403
        ? " The app registration lacks permission for this site (grant Sites.Selected for it, or Sites.Read.All)."
        : "";
    throw new GraphError(res.status, `Microsoft Graph ${res.status}: ${body.error?.message ?? res.statusText}.${hint}`);
  }
  return (await res.json()) as T;
}

async function resolveDrive(c: Record<string, string>): Promise<{ siteName: string; driveId: string; driveName: string }> {
  let url: URL;
  try {
    url = new URL(c.siteUrl);
  } catch {
    throw new ConnectorConfigError("Site URL is not a valid URL");
  }
  const sitePath = url.pathname.replace(/\/+$/, "");
  const site = await graph<{ id: string; displayName: string }>(
    c,
    sitePath && sitePath !== "/" ? `/sites/${url.hostname}:${sitePath}` : `/sites/${url.hostname}`,
  );
  if (c.library) {
    const drives = await graph<{ value: { id: string; name: string }[] }>(c, `/sites/${site.id}/drives`);
    const drive = drives.value.find((d) => d.name.toLowerCase() === c.library.trim().toLowerCase());
    if (!drive) {
      throw new ConnectorConfigError(
        `Library "${c.library}" not found. Available: ${drives.value.map((d) => d.name).join(", ")}`,
      );
    }
    return { siteName: site.displayName, driveId: drive.id, driveName: drive.name };
  }
  const drive = await graph<{ id: string; name: string }>(c, `/sites/${site.id}/drive`);
  return { siteName: site.displayName, driveId: drive.id, driveName: drive.name };
}

type DriveItem = {
  id: string;
  name: string;
  size?: number;
  webUrl?: string;
  cTag?: string;
  eTag?: string;
  lastModifiedDateTime?: string;
  file?: { mimeType?: string };
  folder?: unknown;
  deleted?: unknown;
  parentReference?: { path?: string };
};

/** "/drive/root:/A/B" → "A/B" */
function parentPath(item: DriveItem): string {
  const p = item.parentReference?.path ?? "";
  const i = p.indexOf("root:");
  return i >= 0 ? decodeURIComponent(p.slice(i + 5)).replace(/^\/+/, "") : "";
}

function inFolder(relPath: string, folder: string): boolean {
  const f = folder.trim().replace(/^\/+|\/+$/g, "");
  return !f || relPath === f || relPath.startsWith(`${f}/`);
}

export const sharepointDriver: ConnectorDriver = {
  /**
   * Graph delta query: the first run returns every item, later runs only
   * changes since the stored delta link. SharePoint supports delta on the
   * drive root only, so a configured folder is applied as a path filter.
   */
  async list(c, state) {
    const drive = await resolveDrive(c);
    const sameDrive = state.driveId === drive.driveId;
    let next: string | undefined =
      sameDrive && typeof state.deltaLink === "string"
        ? state.deltaLink
        : `/drives/${drive.driveId}/root/delta?$select=id,name,size,webUrl,cTag,eTag,lastModifiedDateTime,file,folder,deleted,parentReference`;
    const complete = !(sameDrive && state.deltaLink);

    const items: RemoteItem[] = [];
    const deleted: string[] = [];
    let deltaLink: string | undefined;
    try {
      while (next) {
        const page: { value: DriveItem[]; "@odata.nextLink"?: string; "@odata.deltaLink"?: string } =
          await graph(c, next);
        for (const it of page.value) {
          if (it.deleted) {
            deleted.push(it.id);
            continue;
          }
          if (!it.file) continue;
          const dir = parentPath(it);
          const rel = dir ? `${dir}/${it.name}` : it.name;
          if (!inFolder(rel, c.folder ?? "") || !isSupported(it.name, it.file.mimeType)) {
            // Moved out of scope or unsupported: treat like a deletion.
            deleted.push(it.id);
            continue;
          }
          items.push({
            externalId: it.id,
            name: it.name,
            path: rel,
            size: it.size ?? 0,
            modifiedAt: it.lastModifiedDateTime ? new Date(it.lastModifiedDateTime) : null,
            version: it.cTag ?? it.eTag ?? it.lastModifiedDateTime ?? "",
            webUrl: it.webUrl ?? null,
          });
        }
        next = page["@odata.nextLink"];
        deltaLink = page["@odata.deltaLink"] ?? deltaLink;
      }
    } catch (err) {
      // 410 Gone: the delta token expired; start over with a full listing.
      if (err instanceof GraphError && err.status === 410 && !complete) {
        return sharepointDriver.list(c, {});
      }
      throw err;
    }

    return {
      items,
      complete,
      deleted: complete ? undefined : deleted,
      state: { driveId: drive.driveId, deltaLink },
    };
  },

  async download(c, item) {
    const drive = await resolveDrive(c);
    const res = await fetch(`${GRAPH}/drives/${drive.driveId}/items/${item.externalId}/content`, {
      headers: { authorization: `Bearer ${await accessToken(c)}` },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`Download of ${item.name} failed: ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  },

  async test(c) {
    const drive = await resolveDrive(c);
    return `${drive.siteName} → ${drive.driveName}`;
  },
};
