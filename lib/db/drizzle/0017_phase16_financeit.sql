-- Phase 16: point-of-sale financing via Financeit (engineering built against
-- their documented hosted direct_invites/send flow, ahead of partner API
-- access being granted — see docs/EDGE-FEATURES-PLAN.md §3). Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0017_phase16_financeit.sql

CREATE TABLE IF NOT EXISTS financeit_connections (
  user_id TEXT PRIMARY KEY REFERENCES auth_user(id) ON DELETE CASCADE,
  dealer_id TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_applied_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS financeit_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  quote_id UUID NOT NULL,
  dealer_id TEXT NOT NULL,
  financeit_application_id TEXT,
  application_link TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS financeit_applications_user_idx ON financeit_applications (user_id, created_at);
CREATE INDEX IF NOT EXISTS financeit_applications_quote_idx ON financeit_applications (quote_id);
CREATE INDEX IF NOT EXISTS financeit_applications_financeit_id_idx ON financeit_applications (financeit_application_id);

CREATE TABLE IF NOT EXISTS financeit_loan_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES financeit_applications(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  loan_state TEXT,
  raw JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS financeit_loan_events_application_idx ON financeit_loan_events (application_id, created_at);
