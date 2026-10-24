import "server-only";
import { HttpError, uuid } from "@/lib/api";
import { KnowledgeError } from "./index";

export async function kbIdFrom(ctx: { params: Promise<{ id: string }> }): Promise<string> {
  const { id } = await ctx.params;
  if (!uuid.safeParse(id).success) throw new HttpError(404, "Knowledge base not found");
  return id;
}

export function asHttp(err: unknown): never {
  if (err instanceof KnowledgeError) throw new HttpError(err.status, err.message);
  throw err;
}
