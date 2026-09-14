-- Phase 9 — customer reachout pipeline (leads, CASL consent/unsubscribe trail). Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0009_phase9_lead_pipeline.sql

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'en',
  preferred_channel TEXT NOT NULL DEFAULT 'email',
  source TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'new',
  consent_source TEXT NOT NULL DEFAULT 'manual_entry',
  consent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unsubscribe_token TEXT NOT NULL,
  unsubscribed_at TIMESTAMPTZ,
  follow_up_stage INTEGER NOT NULL DEFAULT 0,
  next_follow_up_at TIMESTAMPTZ,
  last_contacted_at TIMESTAMPTZ,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS leads_user_status_idx ON leads (user_id, status);
CREATE INDEX IF NOT EXISTS leads_user_created_idx ON leads (user_id, created_at);
CREATE INDEX IF NOT EXISTS leads_followup_due_idx ON leads (status, next_follow_up_at);
CREATE UNIQUE INDEX IF NOT EXISTS leads_unsubscribe_token_idx ON leads (unsubscribe_token);

CREATE TABLE IF NOT EXISTS lead_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  channel TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lead_events_lead_idx ON lead_events (lead_id, created_at);
