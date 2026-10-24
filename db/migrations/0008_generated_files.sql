-- Files the assistant generated (create_document tool) or the user exported
-- from a message. Stored in Postgres so backups cover them too.
CREATE TABLE generated_files (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chat_id     UUID REFERENCES chats(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    format      TEXT NOT NULL CHECK (format IN ('pdf', 'docx', 'md')),
    filename    TEXT NOT NULL,
    markdown    TEXT NOT NULL,
    content     BYTEA NOT NULL,
    size_bytes  INT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX generated_files_user_idx ON generated_files (user_id, created_at DESC);
CREATE INDEX generated_files_chat_idx ON generated_files (chat_id);
