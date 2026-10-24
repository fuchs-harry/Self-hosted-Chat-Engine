/**
 * Integration test against a real Postgres with pgvector: migrations,
 * ingestion, keyword retrieval, job queue and encryption round trip.
 *
 *   docker run -d -p 55433:5432 -e POSTGRES_PASSWORD=test pgvector/pgvector:pg17
 *   TEST_DATABASE_URL=postgres://postgres:test@localhost:55433/postgres npm test
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("knowledge pipeline (Postgres)", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.APP_SECRET ??= "test-secret-test-secret-test-secret-1234";
    process.env.HEARTBEAT_ENABLED = "false";
    // No provider configured: search runs keyword-only, ingestion stores no vectors.
    const { db } = await import("@/lib/db");
    await db().unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    const { migrate } = await import("@/lib/db/migrate");
    await migrate();
  });

  afterAll(async () => {
    const { db } = await import("@/lib/db");
    await db().end();
  });

  it("applies all migrations idempotently", async () => {
    const { migrate } = await import("@/lib/db/migrate");
    expect(await migrate()).toEqual([]);
  });

  it("ingests an upload and finds it via hybrid search", async () => {
    const { createUser } = await import("@/lib/auth/users");
    const { addUpload, createKnowledgeBase, listDocuments, searchableKbIds } = await import("@/lib/knowledge");
    const { ingestDocument } = await import("@/lib/rag/ingest");
    const { hybridSearch } = await import("@/lib/rag/search");

    const admin = await createUser({ email: "it@example.at", name: "IT", password: "test-password-123", role: "admin" });
    const member = await createUser({ email: "m@example.at", name: "M", password: "test-password-123", role: "member" });
    const kb = await createKnowledgeBase({ name: "Richtlinien", visibility: "org" }, admin);
    const priv = await createKnowledgeBase({ name: "Privat", visibility: "private" }, admin);

    const text = "# Reisekosten\n\nDas Kilometergeld beträgt 0,50 € pro Kilometer. Abrechnung binnen 30 Tagen.";
    const docId = await addUpload(kb, { name: "Reisekosten.md", type: "text/markdown", bytes: new TextEncoder().encode(text) }, admin);
    await ingestDocument(docId);

    const [doc] = await listDocuments(kb);
    expect(doc.status).toBe("ready");
    expect(doc.chunk_count).toBeGreaterThan(0);

    const hits = await hybridSearch([kb], "Wie hoch ist das Kilometergeld?");
    expect(hits[0]?.content).toContain("0,50 €");

    // Members see company knowledge but not someone else's private base.
    expect(await searchableKbIds(member)).toEqual([kb]);
    expect((await searchableKbIds(admin)).sort()).toEqual([kb, priv].sort());
  });

  it("claims jobs exactly once and retries with backoff", async () => {
    const { db } = await import("@/lib/db");
    const { claimJobs, failJob } = await import("@/lib/heartbeat/jobs");
    await db()`INSERT INTO jobs (type, payload, dedupe_key) VALUES ('noop', '{}', 'x')`;
    await db()`INSERT INTO jobs (type, payload, dedupe_key) VALUES ('noop', '{}', 'x') ON CONFLICT DO NOTHING`;

    const [first, second] = await Promise.all([claimJobs(5), claimJobs(5)]);
    const claimed = [...first, ...second].filter((j) => j.type === "noop");
    expect(claimed).toHaveLength(1);

    await failJob(claimed[0], new Error("boom"));
    const [row] = await db()<{ status: string; run_at: Date }[]>`SELECT status, run_at FROM jobs WHERE id = ${claimed[0].id}`;
    expect(row.status).toBe("queued");
    expect(row.run_at.getTime()).toBeGreaterThan(Date.now());
  });

  it("encrypts provider secrets at rest", async () => {
    const { db } = await import("@/lib/db");
    const { saveProviderConfig, resolveProviders } = await import("@/lib/providers/registry");
    const [admin] = await db()<{ id: string }[]>`SELECT id FROM users WHERE role = 'admin' LIMIT 1`;
    await saveProviderConfig("mistral", { values: { apiKey: "mistral-secret-key" } }, admin.id);

    const [row] = await db()<{ config: { apiKey: string } }[]>`SELECT config FROM provider_configs WHERE provider_id = 'mistral'`;
    expect(row.config.apiKey.startsWith("enc:v1:")).toBe(true);
    expect(row.config.apiKey).not.toContain("mistral-secret-key");
    const mistral = (await resolveProviders()).find((p) => p.def.id === "mistral");
    expect(mistral?.values.apiKey).toBe("mistral-secret-key");
    expect(mistral?.configured).toBe(true);
  });
});
