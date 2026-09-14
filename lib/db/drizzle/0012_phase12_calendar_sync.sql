-- Phase 12: calendar sync (Google Calendar / Outlook).
-- Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0012_phase12_calendar_sync.sql

CREATE TABLE IF NOT EXISTS calendar_connections (
  user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  account_email TEXT NOT NULL DEFAULT '',
  access_token_enc TEXT NOT NULL,
  refresh_token_enc TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, provider)
);

CREATE TABLE IF NOT EXISTS calendar_synced_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  milestone_id UUID NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  external_event_id TEXT,
  status TEXT NOT NULL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS calendar_synced_events_milestone_provider_idx ON calendar_synced_events (milestone_id, provider);
CREATE INDEX IF NOT EXISTS calendar_synced_events_user_idx ON calendar_synced_events (user_id, updated_at);
