-- Chats and their messages. Messages are stored in the AI SDK's UIMessage
-- shape (`parts` array) so tool calls, generated documents and citations
-- survive a reload exactly as they were streamed.

CREATE TABLE chats (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       TEXT NOT NULL DEFAULT '',
    model_key   TEXT,
    -- Knowledge base used for retrieval; FK added with the knowledge schema.
    knowledge_base_id UUID,
    pinned      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX chats_user_updated_idx ON chats (user_id, pinned DESC, updated_at DESC);

CREATE TABLE chat_messages (
    id          TEXT PRIMARY KEY,
    chat_id     UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    seq         BIGSERIAL,
    role        TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    parts       JSONB NOT NULL,
    metadata    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX chat_messages_chat_idx ON chat_messages (chat_id, seq);
