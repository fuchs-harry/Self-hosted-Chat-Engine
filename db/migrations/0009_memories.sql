-- Long-term memory: short facts about a user that personalize future chats
-- ("Works in accounting in Graz", "Prefers answers as bullet points").
-- Users can view, edit and delete every entry (GDPR Art. 15-17).
CREATE TABLE memories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content     TEXT NOT NULL CHECK (length(content) <= 300),
    category    TEXT NOT NULL DEFAULT 'other'
                    CHECK (category IN ('profile', 'preference', 'work', 'other')),
    -- auto: learned by the heartbeat, tool: "remember this", manual: typed by the user
    source      TEXT NOT NULL DEFAULT 'auto' CHECK (source IN ('auto', 'tool', 'manual')),
    chat_id     UUID REFERENCES chats(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX memories_user_idx ON memories (user_id, updated_at DESC);
