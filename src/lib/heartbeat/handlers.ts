import "server-only";

/**
 * Job type → implementation. Handlers receive the job payload and throw to
 * signal failure (the job is then retried with backoff).
 */
export type JobHandler = (payload: Record<string, unknown>) => Promise<void>;

export const JOB_HANDLERS: Record<string, JobHandler> = {};
