-- Core: users, login sessions, key/value settings and the audit trail.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT NOT NULL,
    name            TEXT NOT NULL DEFAULT '',
    role            TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    password_hash   TEXT NOT NULL,
    memory_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
    disabled        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at   TIMESTAMPTZ
);

CREATE UNIQUE INDEX users_email_key ON users (lower(email));

-- Only a SHA-256 of the cookie token is stored, so a database dump can't be
-- used to hijack sessions.
CREATE TABLE auth_sessions (
    token_hash  TEXT PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL,
    user_agent  TEXT
);

CREATE INDEX auth_sessions_user_idx ON auth_sessions (user_id);
CREATE INDEX auth_sessions_expiry_idx ON auth_sessions (expires_at);

-- Organization-wide settings edited in the admin UI (assistant
-- instructions, retention, PII masking, ...). Values are JSON.
CREATE TABLE app_settings (
    key         TEXT PRIMARY KEY,
    value       JSONB NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Who did what, when. Never stores prompt or document content.
CREATE TABLE audit_events (
    id          BIGSERIAL PRIMARY KEY,
    at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    action      TEXT NOT NULL,
    target      TEXT,
    detail      JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX audit_events_at_idx ON audit_events (at DESC);
CREATE INDEX audit_events_user_idx ON audit_events (user_id, at DESC);
