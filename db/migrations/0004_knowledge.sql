-- Knowledge bases, their documents and the searchable chunks.
--
-- Embeddings use an untyped `vector` column so the embedding model (and its
-- dimension) can be chosen at deploy time. The app creates a matching HNSW
-- index on first use, e.g. ((embedding::vector(1024)) vector_cosine_ops).

CREATE TABLE knowledge_bases (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    -- 'org': everyone can search it, admins manage it.
    -- 'private': only the owner sees and manages it.
    visibility   TEXT NOT NULL DEFAULT 'org' CHECK (visibility IN ('org', 'private')),
    owner_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE documents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kb_id               UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    -- Set for documents that come from a connector (SharePoint, folder, ...).
    connector_id        UUID,
    external_id         TEXT,
    title               TEXT NOT NULL,
    filename            TEXT NOT NULL,
    mime_type           TEXT NOT NULL DEFAULT 'application/octet-stream',
    size_bytes          BIGINT NOT NULL DEFAULT 0,
    content_hash        TEXT,
    -- Original bytes, only kept for direct uploads.
    content             BYTEA,
    -- Extracted plain text; lets us re-chunk/re-embed without the source.
    text_content        TEXT,
    source_url          TEXT,
    source_modified_at  TIMESTAMPTZ,
    status              TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
    error               TEXT,
    chunk_count         INT NOT NULL DEFAULT 0,
    created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX documents_kb_idx ON documents (kb_id, created_at DESC);
CREATE UNIQUE INDEX documents_connector_item_key
    ON documents (connector_id, external_id) WHERE connector_id IS NOT NULL;

CREATE TABLE chunks (
    id               BIGSERIAL PRIMARY KEY,
    document_id      UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    kb_id            UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    chunk_index      INT NOT NULL,
    content          TEXT NOT NULL,
    page             INT,
    embedding        vector,
    embedding_model  TEXT,
    -- 'simple' config: language-neutral, works for German and English alike.
    tsv              tsvector GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED
);

CREATE INDEX chunks_document_idx ON chunks (document_id, chunk_index);
CREATE INDEX chunks_kb_idx ON chunks (kb_id);
CREATE INDEX chunks_tsv_idx ON chunks USING gin (tsv);

ALTER TABLE chats
    ADD CONSTRAINT chats_knowledge_base_fk
    FOREIGN KEY (knowledge_base_id) REFERENCES knowledge_bases(id) ON DELETE SET NULL;
