import "server-only";
import { env } from "@/lib/env";
import { migrate } from "@/lib/db/migrate";

export async function boot(): Promise<void> {
  env(); // fail fast on bad configuration

  const applied = await migrate();
  if (applied.length) console.log(`[boot] applied migrations: ${applied.join(", ")}`);
}
