import "server-only";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";

// Arbitrary constant; serializes migrations when several replicas boot at once.
const MIGRATION_LOCK = 727_001;

export function migrationsDir(): string {
  return process.env.MIGRATIONS_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "db", "migrations");
}

/**
 * Applies every `db/migrations/NNNN_name.sql` file that has not run yet, in
 * filename order, each in its own transaction. Safe to call on every boot.
 */
export async function migrate(): Promise<string[]> {
  const sql = db();
  const applied: string[] = [];

  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(${MIGRATION_LOCK})`;
    const done = new Set(
      (await tx<{ version: string }[]>`SELECT version FROM schema_migrations`).map(
        (r) => r.version,
      ),
    );
    const files = (await readdir(/*turbopackIgnore: true*/ migrationsDir())).filter((f) => f.endsWith(".sql")).sort();

    for (const file of files) {
      const version = file.replace(/\.sql$/, "");
      if (done.has(version)) continue;
      const body = await readFile(/*turbopackIgnore: true*/ path.join(migrationsDir(), file), "utf8");
      await tx.unsafe(body);
      await tx`INSERT INTO schema_migrations (version) VALUES (${version})`;
      applied.push(version);
    }
  });

  return applied;
}
