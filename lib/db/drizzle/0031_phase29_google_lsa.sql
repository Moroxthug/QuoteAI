-- Phase 29: Google Local Services Ads (LSA) lead capture — engineering track,
-- gated on Google developer-token approval + manager (MCC) account setup.
-- Additive, idempotent. Apply with: supabase db query --linked --file lib/db/drizzle/0031_phase29_google_lsa.sql

CREATE TABLE IF NOT EXISTS google_lsa_connections (
  user_id TEXT PRIMARY KEY REFERENCES auth_user(id) ON DELETE CASCADE,
  lsa_customer_id TEXT NOT NULL,
  refresh_token_enc TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_polled_at TIMESTAMPTZ,
  last_lead_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS google_lsa_import_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  google_lsa_lead_id TEXT NOT NULL,
  lead_type TEXT,
  status TEXT NOT NULL,
  error TEXT,
  raw JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS google_lsa_import_log_user_idx ON google_lsa_import_log (user_id, created_at);
CREATE INDEX IF NOT EXISTS google_lsa_import_log_lead_idx ON google_lsa_import_log (google_lsa_lead_id);

-- Attribution columns on the existing Phase 9 leads table (all null for every non-Google-LSA lead).
ALTER TABLE leads ADD COLUMN IF NOT EXISTS google_lsa_lead_id TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS google_lsa_lead_type TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS google_lsa_category TEXT;
