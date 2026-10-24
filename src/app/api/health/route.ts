import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Liveness/readiness for Docker, Kubernetes or a monitoring system.
 * Public, and deliberately reveals nothing beyond up/down.
 */
export async function GET() {
  const started = Date.now();
  try {
    await db()`SELECT 1`;
    const [beat] = await db()<{ age: number }[]>`
      SELECT extract(epoch FROM now() - max(started_at))::int AS age FROM heartbeats`;
    return Response.json({
      status: "ok",
      database: "ok",
      heartbeatAgeSeconds: beat?.age ?? null,
      latencyMs: Date.now() - started,
    });
  } catch {
    return Response.json({ status: "error", database: "unreachable" }, { status: 503 });
  }
}
