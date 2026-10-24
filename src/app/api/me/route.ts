import { z } from "zod";
import { HttpError, apiUser, parseBody, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { verifyPassword } from "@/lib/auth/password";
import { findUserForLogin, updateUser } from "@/lib/auth/users";

const schema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  memory_enabled: z.boolean().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(10).max(200).optional(),
});

export const PATCH = route(async (req: Request) => {
  const user = await apiUser();
  const input = await parseBody(req, schema);

  if (input.newPassword) {
    const full = await findUserForLogin(user.email);
    if (!full || !(await verifyPassword(input.currentPassword ?? "", full.password_hash))) {
      throw new HttpError(400, "Current password is incorrect");
    }
  }

  await updateUser(user.id, {
    name: input.name,
    memory_enabled: input.memory_enabled,
    password: input.newPassword,
  });
  if (input.memory_enabled !== undefined) {
    await audit("memory.update", { userId: user.id, detail: { enabled: input.memory_enabled } });
  }
  if (input.newPassword) await audit("user.update", { userId: user.id, detail: { password: true } });
  return Response.json({ ok: true, signedOut: Boolean(input.newPassword) });
});
