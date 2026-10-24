import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

// Secrets entered in the admin UI (API keys, connector passwords) are
// encrypted with AES-256-GCM before they touch the database. The key is
// derived from APP_SECRET, so a leaked DB dump alone reveals nothing.
const PREFIX = "enc:v1:";

function key(): Buffer {
  return Buffer.from(
    hkdfSync("sha256", env().APP_SECRET, "self-hosted-chat-engine", "secret-encryption", 32),
  );
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, data]).toString("base64url");
}

export function decryptSecret(value: string): string {
  if (!value.startsWith(PREFIX)) return value;
  const raw = Buffer.from(value.slice(PREFIX.length), "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

/** For display: keeps the last 4 characters. */
export function maskSecret(value: string): string {
  if (!value) return "";
  return value.length <= 8 ? "••••" : `••••${value.slice(-4)}`;
}
