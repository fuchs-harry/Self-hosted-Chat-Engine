import { z } from "zod";
import { HttpError, apiAdmin, parseBody, route, uuid } from "@/lib/api";
import { audit } from "@/lib/audit";
import { deleteUser, getUser, listUsers, updateUser } from "@/lib/auth/users";

type Ctx = { params: Promise<{ id: string }> };

async function target(ctx: Ctx) {
  const { id } = await ctx.params;
  if (!uuid.safeParse(id).success) throw new HttpError(404, "User not found");
  const user = await getUser(id);
  if (!user) throw new HttpError(404, "User not found");
  return user;
}

/** Refuse changes that would leave the installation without an active admin. */
async function assertAdminRemains(excludeId: string) {
  const admins = (await listUsers()).filter((u) => u.role === "admin" && !u.disabled && u.id !== excludeId);
  if (!admins.length) throw new HttpError(400, "At least one active administrator must remain");
}

const schema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  role: z.enum(["admin", "member"]).optional(),
  disabled: z.boolean().optional(),
  password: z.string().min(10).max(200).optional(),
});

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const admin = await apiAdmin();
  const user = await target(ctx);
  const patch = await parseBody(req, schema);
  if ((patch.role === "member" || patch.disabled) && user.role === "admin") await assertAdminRemains(user.id);
  await updateUser(user.id, patch);
  await audit("user.update", {
    userId: admin.id,
    target: user.id,
    detail: { role: patch.role, disabled: patch.disabled, passwordReset: Boolean(patch.password) },
  });
  return Response.json({ ok: true });
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const admin = await apiAdmin();
  const user = await target(ctx);
  if (user.id === admin.id) throw new HttpError(400, "You can't delete your own account");
  if (user.role === "admin") await assertAdminRemains(user.id);
  await deleteUser(user.id);
  await audit("user.delete", { userId: admin.id, target: user.id });
  return Response.json({ ok: true });
});
