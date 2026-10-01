-- Pocket (docs/POCKET-APP-PLAN.md, Phase 125): a client can decline a quote on its page, and the
-- Quotes list shows Declined. Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0062_pocket_quote_declined.sql

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS declined_at timestamptz;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS declined_reason text;
