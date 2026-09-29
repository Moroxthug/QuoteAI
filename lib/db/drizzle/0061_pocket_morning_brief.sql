-- Pocket (docs/POCKET-DESIGN-PLAN.md, Phase 149): Settings → Notifications → Morning brief —
-- the company's local day the 6:30 brief last went out, so a late or repeated run sends it once.
-- Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0061_pocket_morning_brief.sql

ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS last_brief_day date;
