-- The heartbeat: a job queue and periodic tasks that run inside the app
-- process. Postgres row locks (FOR UPDATE SKIP LOCKED) make it safe to run
-- several app replicas without Redis or a separate worker.

CREATE TABLE jobs (
    id            BIGSERIAL PRIMARY KEY,
    type          TEXT NOT NULL,
    payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
    status        TEXT NOT NULL DEFAULT 'queued'
                      CHECK (status IN ('queued', 'running', 'done', 'failed')),
    attempts      INT NOT NULL DEFAULT 0,
    max_attempts  INT NOT NULL DEFAULT 3,
    run_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    locked_at     TIMESTAMPTZ,
    last_error    TEXT,
    -- Prevents queuing the same work twice (e.g. two syncs of one connector).
    dedupe_key    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at   TIMESTAMPTZ
);

CREATE INDEX jobs_queue_idx ON jobs (run_at) WHERE status = 'queued';
CREATE INDEX jobs_type_status_idx ON jobs (type, status);
CREATE UNIQUE INDEX jobs_dedupe_key ON jobs (dedupe_key) WHERE status IN ('queued', 'running');

-- Last run of each periodic task, so intervals survive restarts.
CREATE TABLE heartbeat_tasks (
    name              TEXT PRIMARY KEY,
    last_run_at       TIMESTAMPTZ,
    last_status       TEXT,
    last_error        TEXT,
    last_duration_ms  INT
);

-- One row per beat, for the admin status page. Trimmed to seven days.
CREATE TABLE heartbeats (
    id           BIGSERIAL PRIMARY KEY,
    started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    duration_ms  INT NOT NULL,
    node         TEXT NOT NULL,
    jobs_done    INT NOT NULL DEFAULT 0,
    jobs_failed  INT NOT NULL DEFAULT 0,
    tasks        TEXT[] NOT NULL DEFAULT '{}'
);

CREATE INDEX heartbeats_started_idx ON heartbeats (started_at DESC);
