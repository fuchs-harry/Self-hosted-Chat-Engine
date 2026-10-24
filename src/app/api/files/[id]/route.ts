import { HttpError, apiUser, route, uuid } from "@/lib/api";
import { MIME, getFile } from "@/lib/documents";

type Ctx = { params: Promise<{ id: string }> };

/** Downloads a generated file. Only its owner can fetch it. */
export const GET = route(async (_req: Request, ctx: Ctx) => {
  const user = await apiUser();
  const { id } = await ctx.params;
  if (!uuid.safeParse(id).success) throw new HttpError(404, "File not found");
  const file = await getFile(id, user.id);
  if (!file) throw new HttpError(404, "File not found");
  return new Response(new Uint8Array(file.content), {
    headers: {
      "content-type": MIME[file.format],
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    },
  });
});
