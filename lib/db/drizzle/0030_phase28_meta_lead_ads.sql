-- Phase 28: Meta (Facebook/Instagram) Lead Ads capture. Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0030_phase28_meta_lead_ads.sql

CREATE TABLE IF NOT EXISTS meta_lead_ads_connections (
  user_id TEXT PRIMARY KEY REFERENCES auth_user(id) ON DELETE CASCADE,
  page_id TEXT NOT NULL,
  page_name TEXT NOT NULL DEFAULT '',
  page_access_token_enc TEXT NOT NULL,
  user_token_expires_at TIMESTAMPTZ,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_lead_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS meta_lead_ads_import_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  meta_lead_id TEXT NOT NULL,
  form_id TEXT,
  status TEXT NOT NULL,
  error TEXT,
  raw JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS meta_lead_ads_import_log_user_idx ON meta_lead_ads_import_log (user_id, created_at);
CREATE INDEX IF NOT EXISTS meta_lead_ads_import_log_lead_idx ON meta_lead_ads_import_log (meta_lead_id);

-- Attribution columns on the existing Phase 9 leads table (all null for every non-Meta lead).
ALTER TABLE leads ADD COLUMN IF NOT EXISTS meta_lead_id TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS meta_form_id TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS meta_form_name TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS meta_campaign_id TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS meta_campaign_name TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS meta_ad_id TEXT;
