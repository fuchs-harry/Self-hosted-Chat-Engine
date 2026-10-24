import "server-only";
import { z } from "zod";

/**
 * Core runtime configuration. Provider keys are read separately in
 * `lib/providers` because each provider is optional.
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  APP_SECRET: z
    .string()
    .min(32, "APP_SECRET must be at least 32 characters (try: openssl rand -hex 32)"),
  APP_NAME: z.string().default("Chat Engine"),
  APP_URL: z.string().optional(),
  APP_LOCALE: z.enum(["de", "en"]).default("de"),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(10).optional(),
  HEARTBEAT_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  HEARTBEAT_INTERVAL_SECONDS: z.coerce.number().int().min(5).max(3600).default(30),
  // Folders the "local folder" connector may read. Comma separated.
  CONNECTOR_FOLDER_ROOTS: z.string().default("/data/shares"),
  MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(200).default(25),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid configuration:\n${issues.join("\n")}`);
  }
  cached = parsed.data;
  return cached;
}
