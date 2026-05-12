-- ShareBox schema
-- Run this once in your Neon Postgres database before first launch.
-- User identity is managed by Clerk; we only store the Clerk user id
-- (text) alongside our own data — no users table needed here.

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT,
  size BIGINT NOT NULL,
  r2_key TEXT NOT NULL,
  password_hash TEXT,
  salt TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  access_count INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS allowed_users (
  email TEXT PRIMARY KEY,
  added_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Public upload "drop-box" links. Owner creates one, anonymous users upload
-- into it until the uploader clicks Confirm — then the link is sealed and
-- only serves the collected files for viewing/download.
CREATE TABLE IF NOT EXISTS share_links (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  label TEXT,
  max_files INTEGER,
  max_total_bytes BIGINT,
  allowed_extensions JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'open',
  short_url TEXT,
  expires_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE files
  ADD COLUMN IF NOT EXISTS share_link_id TEXT REFERENCES share_links(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS uploader_label TEXT,
  ADD COLUMN IF NOT EXISTS short_url TEXT;

CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_expires_at ON files(expires_at);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at);
CREATE INDEX IF NOT EXISTS idx_files_share_link ON files(share_link_id);
CREATE INDEX IF NOT EXISTS idx_allowed_users_created_at ON allowed_users(created_at);
CREATE INDEX IF NOT EXISTS idx_share_links_owner ON share_links(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_share_links_expires_at ON share_links(expires_at);
