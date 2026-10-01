-- Pocket (docs/POCKET-APP-PLAN.md, Phase 125): the option the contractor recommends among Good / Better / Best
-- (Quote editor), shown as "Recommended" on the client's quote page. Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0064_pocket_variant_recommended.sql

ALTER TABLE quote_variants ADD COLUMN IF NOT EXISTS recommended boolean NOT NULL DEFAULT false;
