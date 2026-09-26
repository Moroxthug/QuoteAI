-- Phase 99 (restore rehearsal, 2026-09-26): columns production got from an
-- early `drizzle-kit push` that no migration ever added, found when a rebuild
-- from lib/db/drizzle/*.sql was compared with a production backup. The tables
-- themselves are in 0000_zz_pushed_tables.sql. A no-op on production.

ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS api_key TEXT;

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS accepted_by_name TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS accepted_ip TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS prompt_tokens INTEGER;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS completion_tokens INTEGER;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS total_tokens INTEGER;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS model_used TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS api_cost NUMERIC(10, 6);
