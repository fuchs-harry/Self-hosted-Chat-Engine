-- Provider credentials entered in the admin UI. Secret fields inside
-- `config` are AES-256-GCM encrypted by the app ("enc:v1:..."). Values set
-- through environment variables are never written here.

CREATE TABLE provider_configs (
    provider_id  TEXT PRIMARY KEY,
    enabled      BOOLEAN NOT NULL DEFAULT TRUE,
    config       JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Optional override of the catalog's model list.
    models       TEXT[],
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by   UUID REFERENCES users(id) ON DELETE SET NULL
);
