"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { verifyPassword } from "@/lib/auth/password";
import { clearFailures, recordFailure, tooManyAttempts } from "@/lib/auth/rate-limit";
import { createSession, destroySession, getCurrentUser } from "@/lib/auth/session";
import { countUsers, createUser, findUserForLogin } from "@/lib/auth/users";
import { getT } from "@/lib/i18n/server";

export type FormState = { error?: string } | undefined;

async function clientKey(email: string): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  return `${ip}|${email.toLowerCase()}`;
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const t = await getT();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const key = await clientKey(email);

  if (tooManyAttempts(key)) {
    return { error: t.auth.invalid };
  }

  const user = await findUserForLogin(email);
  const ok = user && !user.disabled && (await verifyPassword(password, user.password_hash));
  if (!ok) {
    recordFailure(key);
    await audit("auth.login_failed", { userId: user?.id, detail: { reason: "credentials" } });
    return { error: t.auth.invalid };
  }

  clearFailures(key);
  await createSession(user.id);
  await audit("auth.login", { userId: user.id });
  redirect("/");
}

const setupSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  password: z.string().min(10).max(200),
});

export async function setup(_: FormState, form: FormData): Promise<FormState> {
  const t = await getT();
  // /setup only works while no account exists.
  if ((await countUsers()) > 0) redirect("/login");

  const parsed = setupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: t.auth.passwordHint };

  const user = await createUser({ ...parsed.data, role: "admin" });
  await createSession(user.id);
  await audit("auth.setup", { userId: user.id });
  redirect("/");
}

export async function logout(): Promise<void> {
  const user = await getCurrentUser();
  await destroySession();
  if (user) await audit("auth.logout", { userId: user.id });
  redirect("/login");
}
