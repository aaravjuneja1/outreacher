CREATE TABLE IF NOT EXISTS launch_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  seats_taken INTEGER NOT NULL DEFAULT 0 CHECK (seats_taken >= 0 AND seats_taken <= 20),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO launch_state (id, seats_taken)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT,
  institution TEXT,
  current_position TEXT,
  disciplines JSONB NOT NULL DEFAULT '[]'::jsonb,
  specialisation TEXT,
  purpose TEXT,
  background TEXT,
  links JSONB NOT NULL DEFAULT '[]'::jsonb,
  live_sending BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
  privacy_accepted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_usage (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  credits_used INTEGER NOT NULL DEFAULT 0 CHECK (credits_used >= 0 AND credits_used <= 10),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0 AND byte_size <= 10485760),
  storage_path TEXT NOT NULL,
  extracted_text TEXT NOT NULL DEFAULT '',
  use_for_context BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_uploads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0 AND byte_size <= 10485760),
  storage_path TEXT NOT NULL UNIQUE,
  use_for_context BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS research_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('running', 'complete', 'failed')),
  stage TEXT NOT NULL,
  profiles_checked INTEGER NOT NULL DEFAULT 0,
  papers_reviewed INTEGER NOT NULL DEFAULT 0,
  candidates_found INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS prospects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  research_run_id TEXT NOT NULL REFERENCES research_runs(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT,
  institution TEXT NOT NULL,
  public_email TEXT,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  email_source_url TEXT,
  openalex_author_url TEXT NOT NULL,
  official_profile_url TEXT,
  source_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  works JSONB NOT NULL DEFAULT '[]'::jsonb,
  research_summary TEXT NOT NULL,
  why_match TEXT NOT NULL,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'generating', 'drafted', 'skipped', 'sent', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS prospects_queue_index ON prospects (user_id, status, created_at);

CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prospect_id TEXT NOT NULL UNIQUE REFERENCES prospects(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  attachment_document_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'drafted' CHECK (status IN ('drafted', 'sending', 'sent', 'failed', 'skipped')),
  validation_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS draft_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prospect_id TEXT NOT NULL UNIQUE REFERENCES prospects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'complete')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS draft_jobs_queue_index ON draft_jobs (user_id, status, created_at);

CREATE TABLE IF NOT EXISTS gmail_connections (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  account_email TEXT,
  encrypted_refresh_token TEXT NOT NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS send_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  draft_id TEXT NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
  prospect_id TEXT NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  provider_message_id TEXT,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS security_events (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
