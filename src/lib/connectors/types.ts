import "server-only";

/** A file in the external source. */
export type RemoteItem = {
  /** Stable id within the source (Graph item id, relative path, DAV href). */
  externalId: string;
  name: string;
  /** Path relative to the synced root, for display. */
  path: string;
  size: number;
  modifiedAt: Date | null;
  /** Changes whenever the content changes (cTag, ETag, mtime+size). */
  version: string;
  webUrl?: string | null;
};

export type Listing = {
  items: RemoteItem[];
  /** true: `items` is the complete set, anything else was deleted. */
  complete: boolean;
  /** For incremental sources: ids removed since the last sync. */
  deleted?: string[];
  /** Persisted and passed back next time (e.g. the Graph delta link). */
  state: Record<string, unknown>;
};

export interface ConnectorDriver {
  /** Lists files; incremental drivers use `state` to fetch only changes. */
  list(config: Record<string, string>, state: Record<string, unknown>): Promise<Listing>;
  download(config: Record<string, string>, item: RemoteItem): Promise<Uint8Array>;
  /** Checks credentials and reachability; returns a human readable summary. */
  test(config: Record<string, string>): Promise<string>;
}

export class ConnectorConfigError extends Error {}
