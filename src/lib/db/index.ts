import "server-only";
import postgres from "postgres";
import { env } from "@/lib/env";

type Sql = postgres.Sql<Record<string, never>>;

// One pool per server process. Kept on globalThis so dev-mode hot reloads
// don't open a new pool on every edit.
const globalForDb = globalThis as unknown as { __sql?: Sql };

function create(): Sql {
  return postgres(env().DATABASE_URL, {
    max: 10,
    idle_timeout: 30,
    // Return JSON/JSONB columns as parsed objects.
    transform: { undefined: null },
    onnotice: () => {},
  });
}

export function db(): Sql {
  if (!globalForDb.__sql) globalForDb.__sql = create();
  return globalForDb.__sql;
}

export type { Sql };
