-- Which knowledge a chat searches: nothing, everything the user can see,
-- or the single knowledge base in knowledge_base_id.
ALTER TABLE chats
    ADD COLUMN knowledge_scope TEXT NOT NULL DEFAULT 'none'
        CHECK (knowledge_scope IN ('none', 'all', 'kb'));
