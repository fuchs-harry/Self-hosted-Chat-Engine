-- Connectors keep a knowledge base in sync with an external source
-- (SharePoint, a network share, Nextcloud). Secret fields in `config` are
-- encrypted by the app. `state` holds driver bookkeeping such as the
-- Microsoft Graph delta link.

CREATE TABLE connectors (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kb_id                  UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    type                   TEXT NOT NULL CHECK (type IN ('sharepoint', 'folder', 'webdav')),
    name                   TEXT NOT NULL,
    config                 JSONB NOT NULL DEFAULT '{}'::jsonb,
    state                  JSONB NOT NULL DEFAULT '{}'::jsonb,
    enabled                BOOLEAN NOT NULL DEFAULT TRUE,
    sync_interval_minutes  INT NOT NULL DEFAULT 60 CHECK (sync_interval_minutes >= 5),
    next_sync_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_sync_at           TIMESTAMPTZ,
    last_status            TEXT,
    last_error             TEXT,
    last_stats             JSONB,
    created_by             UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX connectors_kb_idx ON connectors (kb_id);
CREATE INDEX connectors_due_idx ON connectors (next_sync_at) WHERE enabled;

-- Removing a connector removes the documents it brought in.
ALTER TABLE documents
    ADD CONSTRAINT documents_connector_fk
    FOREIGN KEY (connector_id) REFERENCES connectors(id) ON DELETE CASCADE;
