import "server-only";
import { env } from "@/lib/env";
import { migrate } from "@/lib/db/migrate";
import { bootstrapAdminFromEnv } from "@/lib/auth/users";
import { startHeartbeat } from "@/lib/heartbeat";

export async function boot(): Promise<void> {
  env(); // fail fast on bad configuration

  const applied = await migrate();
  if (applied.length) console.log(`[boot] applied migrations: ${applied.join(", ")}`);

  const { ADMIN_EMAIL, ADMIN_PASSWORD } = env();
  if (await bootstrapAdminFromEnv(ADMIN_EMAIL, ADMIN_PASSWORD)) {
    console.log(`[boot] created admin account ${ADMIN_EMAIL}`);
  }

  startHeartbeat();
}
