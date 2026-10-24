import { z } from "zod";
import { HttpError, apiAdmin, parseBody, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { createUser, findUserForLogin, listUsers } from "@/lib/auth/users";

export const GET = route(async () => {
  await apiAdmin();
  return Response.json(await listUsers());
});

const schema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().min(1).max(120),
  password: z.string().min(10).max(200),
  role: z.enum(["admin", "member"]).default("member"),
});

export const POST = route(async (req: Request) => {
  const admin = await apiAdmin();
  const input = await parseBody(req, schema);
  if (await findUserForLogin(input.email)) throw new HttpError(409, "A user with this e-mail already exists");
  const user = await createUser(input);
  await audit("user.create", { userId: admin.id, target: user.id, detail: { role: input.role } });
  return Response.json(user, { status: 201 });
});
