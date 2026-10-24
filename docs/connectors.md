# Connecting company data

Every knowledge base can get documents in two ways: **uploads** (drag and drop in the browser) and **connectors**, which keep the knowledge base in sync with an existing source. Connectors are added under *Knowledge → (knowledge base) → Connect source*. Each one gets a sync interval; the heartbeat runs it on schedule, and *Sync now* triggers it immediately.

What every connector does:

- New and changed files are downloaded, their text extracted and indexed.
- Unchanged files are skipped (version tag or timestamp comparison).
- Deleted files disappear from the knowledge base.
- Original files **stay at the source**. Citations link back to them (SharePoint web URL) or, for file shares, show the path.
- Supported formats: PDF, DOCX, TXT, Markdown, CSV, JSON, HTML. Files larger than `MAX_UPLOAD_MB` are skipped.
- At most 300 changed files are processed per run; the rest follow on the next run automatically.

> **Who sees what:** documents in a *company* knowledge base are searchable by every user. The source's own permissions are **not** mirrored yet (it's on the roadmap). Connect only folders that everyone may read, or use separate private knowledge bases.

---

## Microsoft SharePoint / OneDrive

Uses Microsoft Graph with an app registration (application permissions, no user sign-in) and **delta queries**: after the first full run, only changes are fetched.

### 1. Register an app in Microsoft Entra ID

1. [Entra admin center](https://entra.microsoft.com) → *Identity → Applications → App registrations → New registration*.
   Name: `Chat Engine Connector`, single tenant, no redirect URI.
2. Note the **Application (client) ID** and **Directory (tenant) ID**.
3. *Certificates & secrets → New client secret*. Copy the **value**; it is shown only once.
4. *API permissions → Add → Microsoft Graph → Application permissions*:
   - **Recommended:** `Sites.Selected`. The app can then only read sites you grant explicitly (step 2).
   - Simpler but broader: `Sites.Read.All` (all sites) or `Files.Read.All`.
5. *Grant admin consent*.

### 2. Grant access to the site (only with `Sites.Selected`)

With PnP PowerShell, run as a SharePoint admin:

```powershell
Connect-PnPOnline -Url https://firma.sharepoint.com/sites/Handbuch -Interactive
Grant-PnPAzureADAppSitePermission -AppId <client-id> -DisplayName "Chat Engine Connector" -Permissions Read
```

Or via Microsoft Graph (`POST /sites/{site-id}/permissions` with role `read` for the application).

### 3. Add the connector

| Field | Example |
|---|---|
| Directory (tenant) ID | `8f1c…` |
| Application (client) ID | `2b7e…` |
| Client secret | `…` (stored encrypted) |
| Site URL | `https://firma.sharepoint.com/sites/Handbuch` |
| Library | `Dokumente` (empty = default library) |
| Folder | `Richtlinien/2026` (optional) |

Press **Test connection**. It should show `Handbuch → Dokumente`. Save, and the first sync starts right away.

**Notes**
- SharePoint supports delta queries on the library root only, so a configured folder acts as a path filter. Moving a file out of the folder removes it from the knowledge base.
- If the delta token expires (HTTP 410), the connector does a full resync automatically.
- Client secrets expire (max. 24 months). Put a reminder in your calendar, or the connector status will turn red with a sign-in error.

---

## Network share / local folder

Reads a folder on the server. That's the classic Windows file server (SMB/CIFS) or an NFS export, mounted on the Docker host and passed into the container read-only. See the [admin guide](setup.md#connecting-a-windows-file-share) for the mount.

| Field | Example |
|---|---|
| Path | `/data/shares/handbuch` |

- Only administrators can add this connector, since it reads the server's file system.
- The path must be inside `CONNECTOR_FOLDER_ROOTS` (default `/data/shares`). Symlinks pointing outside are rejected.
- Changes are detected by modification time and size. Hidden files and Office lock files (`~$…`) are ignored.

---

## Nextcloud / WebDAV

Works with Nextcloud, ownCloud, and any WebDAV server (Apache `mod_dav`, IIS, NAS systems such as Synology).

| Field | Example |
|---|---|
| WebDAV folder URL | `https://cloud.firma.at/remote.php/dav/files/wissen/Handbuch` |
| Username | `wissen` |
| App password | Nextcloud: *Settings → Security → Create new app password* |

Use a dedicated service account that only has the shared folders it should index.

---

## Writing a new connector

A connector is a small module implementing three functions ([`src/lib/connectors/types.ts`](../src/lib/connectors/types.ts)):

```ts
interface ConnectorDriver {
  // List files. Return complete=true for a full listing, or use `state`
  // (e.g. a delta token) to return only changes plus deleted ids.
  list(config, state): Promise<{ items: RemoteItem[]; complete: boolean; deleted?: string[]; state }>;
  download(config, item): Promise<Uint8Array>;
  test(config): Promise<string>; // human-readable summary for "Test connection"
}
```

1. Implement the driver in `src/lib/connectors/<name>.ts` (see `webdav.ts` for a compact example).
2. Register it in `DRIVERS` in [`src/lib/connectors/index.ts`](../src/lib/connectors/index.ts).
3. Describe its settings in [`catalog.ts`](../src/lib/connectors/catalog.ts). The UI form is generated from that, and fields marked `secret` are encrypted automatically.
4. Add the type to the `CHECK` constraint in a new migration.

The sync engine handles change detection, extraction, indexing, deletions, batching and retries for you.
