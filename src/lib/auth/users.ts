import "server-only";
import { db } from "@/lib/db";
import { hashPassword } from "./password";

export type Role = "admin" | "member";

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  memory_enabled: boolean;
  disabled: boolean;
  created_at: Date;
  last_login_at: Date | null;
};

const columns = () => db()`id, email, name, role, memory_enabled, disabled, created_at, last_login_at`;

export async function countUsers(): Promise<number> {
  const [row] = await db()<{ n: number }[]>`SELECT count(*)::int AS n FROM users`;
  return row.n;
}

export async function listUsers(): Promise<User[]> {
  return db()<User[]>`SELECT ${columns()} FROM users ORDER BY created_at`;
}

export async function getUser(id: string): Promise<User | null> {
  const [row] = await db()<User[]>`SELECT ${columns()} FROM users WHERE id = ${id}`;
  return row ?? null;
}

export async function findUserForLogin(
  email: string,
): Promise<(User & { password_hash: string }) | null> {
  const [row] = await db()<(User & { password_hash: string })[]>`
    SELECT ${columns()}, password_hash FROM users WHERE lower(email) = lower(${email.trim()})`;
  return row ?? null;
}

export async function createUser(input: {
  email: string;
  name: string;
  password: string;
  role: Role;
}): Promise<User> {
  const password_hash = await hashPassword(input.password);
  const [row] = await db()<User[]>`
    INSERT INTO users (email, name, role, password_hash)
    VALUES (${input.email.trim()}, ${input.name.trim()}, ${input.role}, ${password_hash})
    RETURNING ${columns()}`;
  return row;
}

export async function updateUser(
  id: string,
  patch: Partial<{ name: string; role: Role; disabled: boolean; memory_enabled: boolean; password: string }>,
): Promise<void> {
  const sql = db();
  const { password, ...rest } = patch;
  const fields: Record<string, unknown> = { ...rest };
  if (password) fields.password_hash = await hashPassword(password);
  const keys = Object.keys(fields);
  if (!keys.length) return;
  await sql`UPDATE users SET ${sql(fields as Record<string, string>, keys)} WHERE id = ${id}`;
  if (patch.disabled || password) {
    await sql`DELETE FROM auth_sessions WHERE user_id = ${id}`;
  }
}

export async function deleteUser(id: string): Promise<void> {
  await db()`DELETE FROM users WHERE id = ${id}`;
}

/**
 * Creates the first admin from ADMIN_EMAIL / ADMIN_PASSWORD when the users
 * table is empty. Lets an IT admin provision a box without opening /setup.
 */
export async function bootstrapAdminFromEnv(email?: string, password?: string): Promise<boolean> {
  if (!email || !password) return false;
  if ((await countUsers()) > 0) return false;
  await createUser({ email, password, name: "Administrator", role: "admin" });
  return true;
}
