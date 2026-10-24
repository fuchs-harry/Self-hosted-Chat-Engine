import "server-only";
import { z } from "zod";
import { HttpError, uuid } from "@/lib/api";
import type { User } from "@/lib/auth/users";
import { getKnowledgeBase, requireManageable } from "@/lib/knowledge";
import { asHttp } from "@/lib/knowledge/http";
import { getConnectorDef, type ConnectorType } from "./catalog";
import { getConnector, type ConnectorRow } from "./index";
import { ConnectorConfigError } from "./types";

export const connectorType = z.enum(["sharepoint", "folder", "webdav"]);

/** Folder connectors read the server's file system: admins only. */
export function assertTypeAllowed(type: ConnectorType, user: User): void {
  if (getConnectorDef(type)?.adminOnly && user.role !== "admin") {
    throw new HttpError(403, "Only administrators can add this kind of source");
  }
}

export async function loadManageableConnector(
  ctx: { params: Promise<{ id: string }> },
  user: User,
): Promise<ConnectorRow> {
  const { id } = await ctx.params;
  if (!uuid.safeParse(id).success) throw new HttpError(404, "Connector not found");
  const connector = await getConnector(id);
  if (!connector || !(await getKnowledgeBase(connector.kb_id, user))) {
    throw new HttpError(404, "Connector not found");
  }
  await requireManageable(connector.kb_id, user).catch(asHttp);
  return connector;
}

export function configError(err: unknown): never {
  if (err instanceof ConnectorConfigError) throw new HttpError(400, err.message);
  throw err;
}
