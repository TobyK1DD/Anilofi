-- ═══════════════════════════════════════════════════
-- Run this once in Supabase → SQL Editor
-- ═══════════════════════════════════════════════════

-- COMMENTS TABLE
CREATE TABLE IF NOT EXISTS comments (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id     UUID        REFERENCES blog_posts(id) ON DELETE CASCADE,
  author      TEXT        NOT NULL CHECK (char_length(trim(author)) BETWEEN 1 AND 50),
  content     TEXT        NOT NULL CHECK (char_length(trim(content)) BETWEEN 1 AND 500),
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read comments"
  ON comments FOR SELECT USING (true);

CREATE POLICY "Anyone can post a comment"
  ON comments FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin can delete comments"
  ON comments FOR DELETE USING (auth.role() = 'authenticated');


-- POLLS TABLE
CREATE TABLE IF NOT EXISTS polls (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  question    TEXT        NOT NULL,
  options     JSONB       NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read polls"
  ON polls FOR SELECT USING (true);

CREATE POLICY "Admin can create polls"
  ON polls FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admin can delete polls"
  ON polls FOR DELETE USING (auth.role() = 'authenticated');


-- POLL VOTES TABLE
CREATE TABLE IF NOT EXISTS poll_votes (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id     UUID        REFERENCES polls(id) ON DELETE CASCADE,
  option_index INTEGER    NOT NULL,
  voter_key   TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (poll_id, voter_key)   -- one vote per browser per poll
);

ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read votes"
  ON poll_votes FOR SELECT USING (true);

CREATE POLICY "Anyone can cast a vote"
  ON poll_votes FOR INSERT WITH CHECK (true);


-- EXCERPT COLUMN (run this if you haven't already)
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS excerpt TEXT;
