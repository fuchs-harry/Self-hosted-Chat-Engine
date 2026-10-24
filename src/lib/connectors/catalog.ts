/**
 * Connector types and their settings. Client-safe: the admin UI renders
 * the forms from these definitions.
 */
import type { Localized } from "@/lib/providers/catalog";

export type ConnectorType = "sharepoint" | "folder" | "webdav";

export type ConnectorField = {
  key: string;
  label: Localized;
  secret?: boolean;
  required?: boolean;
  placeholder?: string;
  hint?: Localized;
};

export type ConnectorDef = {
  type: ConnectorType;
  name: string;
  description: Localized;
  adminOnly?: boolean;
  docs: string;
  fields: ConnectorField[];
};

export const CONNECTORS: ConnectorDef[] = [
  {
    type: "sharepoint",
    name: "Microsoft SharePoint / OneDrive",
    description: {
      de: "Synchronisiert eine SharePoint-Dokumentbibliothek über Microsoft Graph. Nur geänderte Dateien werden neu geladen (Delta-Abfrage).",
      en: "Syncs a SharePoint document library via Microsoft Graph. Only changed files are fetched again (delta query).",
    },
    docs: "docs/connectors.md#microsoft-sharepoint--onedrive",
    fields: [
      {
        key: "tenantId",
        label: { de: "Verzeichnis-ID (Tenant)", en: "Directory (tenant) ID" },
        required: true,
        placeholder: "00000000-0000-0000-0000-000000000000",
      },
      {
        key: "clientId",
        label: { de: "Anwendungs-ID (Client)", en: "Application (client) ID" },
        required: true,
        placeholder: "00000000-0000-0000-0000-000000000000",
      },
      {
        key: "clientSecret",
        label: { de: "Geheimer Clientschlüssel", en: "Client secret" },
        secret: true,
        required: true,
      },
      {
        key: "siteUrl",
        label: { de: "Website-URL", en: "Site URL" },
        required: true,
        placeholder: "https://firma.sharepoint.com/sites/Personal",
      },
      {
        key: "library",
        label: { de: "Bibliothek", en: "Library" },
        placeholder: "Dokumente",
        hint: {
          de: "Leer lassen für die Standardbibliothek.",
          en: "Leave empty for the default library.",
        },
      },
      {
        key: "folder",
        label: { de: "Ordner", en: "Folder" },
        placeholder: "Richtlinien/2026",
        hint: { de: "Optional: nur diesen Unterordner synchronisieren.", en: "Optional: only sync this subfolder." },
      },
    ],
  },
  {
    type: "folder",
    name: "Network share / folder",
    description: {
      de: "Liest einen Ordner auf dem Server, z. B. ein eingebundenes Windows-Netzlaufwerk (SMB) oder NFS-Share. Änderungen werden über Zeitstempel erkannt.",
      en: "Reads a folder on the server, e.g. a mounted Windows file share (SMB) or NFS export. Changes are detected via timestamps.",
    },
    adminOnly: true,
    docs: "docs/connectors.md#network-share--local-folder",
    fields: [
      {
        key: "path",
        label: { de: "Pfad", en: "Path" },
        required: true,
        placeholder: "/data/shares/handbuch",
        hint: {
          de: "Muss unter CONNECTOR_FOLDER_ROOTS liegen (Standard: /data/shares).",
          en: "Must be inside CONNECTOR_FOLDER_ROOTS (default: /data/shares).",
        },
      },
    ],
  },
  {
    type: "webdav",
    name: "Nextcloud / WebDAV",
    description: {
      de: "Synchronisiert einen Ordner aus Nextcloud, ownCloud oder einem anderen WebDAV-Server. Empfohlen: App-Passwort verwenden.",
      en: "Syncs a folder from Nextcloud, ownCloud or any WebDAV server. Recommended: use an app password.",
    },
    docs: "docs/connectors.md#nextcloud--webdav",
    fields: [
      {
        key: "url",
        label: { de: "WebDAV-URL des Ordners", en: "WebDAV folder URL" },
        required: true,
        placeholder: "https://cloud.firma.at/remote.php/dav/files/wissen/Handbuch",
      },
      { key: "username", label: { de: "Benutzername", en: "Username" }, required: true },
      {
        key: "password",
        label: { de: "App-Passwort", en: "App password" },
        secret: true,
        required: true,
      },
    ],
  },
];

export function getConnectorDef(type: string): ConnectorDef | undefined {
  return CONNECTORS.find((c) => c.type === type);
}
