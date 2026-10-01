-- Pocket (docs/POCKET-APP-PLAN.md, Phase 125): "Not included" on a quote (Quote editor): what the price does not cover,
-- shown on the client's quote page and on the PDF. Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0063_pocket_quote_exclusions.sql

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS exclusions text[] NOT NULL DEFAULT '{}';
