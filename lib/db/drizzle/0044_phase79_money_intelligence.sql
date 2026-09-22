-- Phase 79 (docs/PILOT-LAUNCH-PLAN.md): money intelligence.
-- Budget alert stamps on jobs: set when confirmed costs cross 90 % / 100 % of
-- the cost budget (one notification per crossing), cleared again when costs
-- drop back under so the next crossing alerts again. The quote price check
-- and the 60-day cash-flow forecast are computed on read — no DDL.
-- Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0044_phase79_money_intelligence.sql

ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget_alert_90_at timestamptz;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget_alert_100_at timestamptz;
