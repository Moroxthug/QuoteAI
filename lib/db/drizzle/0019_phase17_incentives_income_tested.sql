-- Phase 17: incentives_catalog.income_tested exists in the Drizzle schema
-- (lib/db/src/schema/incentives.ts) and in migration 0015's own file, but the
-- live table was missing it — 0015 apparently ran before this column was
-- added to that migration file. Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0019_phase17_incentives_income_tested.sql

ALTER TABLE incentives_catalog
  ADD COLUMN IF NOT EXISTS income_tested BOOLEAN NOT NULL DEFAULT FALSE;
