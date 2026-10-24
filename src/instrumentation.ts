/**
 * Runs once per server start, before the first request is served.
 * Applies database migrations and starts the heartbeat.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Skip during `next build`, which also loads this file.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { boot } = await import("@/lib/boot");
  await boot();
}
