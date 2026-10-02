-- Pocket (docs/POCKET-APP-PLAN.md, Phase 128.3): what SetCompany shows beyond the profile (legal name, WSIB number, website, brand colour, language of
-- documents) and the choices the Settings pages save (taxes, quotes, invoices, messaging, widget). Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0072_pocket_settings.sql
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS legal_name text;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS wsib_number text;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS brand_color text;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS doc_language text;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS pocket_settings jsonb NOT NULL DEFAULT '{}'::jsonb;
