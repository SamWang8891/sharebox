-- ShareBox schema (Neon Auth / Stack Auth compatible)
--
-- Prerequisite: enable Neon Auth in your Neon project. Neon will create
-- the `neon_auth` schema and a `users_sync` table that mirrors Stack Auth
-- users. We don't manage that table — it's read-only and auto-synced.
--
-- This file only creates the ShareBox-specific tables. Run it once in your
-- Neon database after enabling Neon Auth.

-- Files uploaded by approved users.
-- user_id stores the Stack Auth user id (text/uuid). We don't FK to
-- neon_auth.users_sync because it's a sync target — rows can disappear
-- if a user is deleted in Stack Auth, and we want the file row to remain
-- recoverable rather than cascade-deleted unexpectedly.
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

-- Emails approved to upload (in addition to ADMIN_EMAILS).
CREATE TABLE IF NOT EXISTS allowed_users (
  email TEXT PRIMARY KEY,
  added_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_expires_at ON files(expires_at);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at);
CREATE INDEX IF NOT EXISTS idx_allowed_users_created_at ON allowed_users(created_at);
