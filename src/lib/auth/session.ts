import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { User } from "./users";

export const SESSION_COOKIE = "sce_session";
const SESSION_DAYS = 30;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function secureCookies(): Promise<boolean> {
  if (process.env.COOKIE_SECURE) return process.env.COOKIE_SECURE === "true";
  const url = env().APP_URL;
  if (url) return url.startsWith("https://");
  return (await headers()).get("x-forwarded-proto") === "https";
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  const userAgent = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
  await db()`
    INSERT INTO auth_sessions (token_hash, user_id, expires_at, user_agent)
    VALUES (${sha256(token)}, ${userId}, ${expires}, ${userAgent})`;
  await db()`UPDATE users SET last_login_at = now() WHERE id = ${userId}`;
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await secureCookies(),
    path: "/",
    expires,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db()`DELETE FROM auth_sessions WHERE token_hash = ${sha256(token)}`;
  jar.delete(SESSION_COOKIE);
}

/** The signed-in user for this request, or null. Memoized per request. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db()<User[]>`
    SELECT u.id, u.email, u.name, u.role, u.memory_enabled, u.disabled, u.created_at, u.last_login_at
    FROM auth_sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${sha256(token)} AND s.expires_at > now() AND NOT u.disabled`;
  return row ?? null;
});

/** For pages: redirects to /login when signed out. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}

export async function purgeExpiredSessions(): Promise<number> {
  const rows = await db()`DELETE FROM auth_sessions WHERE expires_at < now()`;
  return rows.count;
}
