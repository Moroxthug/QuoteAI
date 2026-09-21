-- Phase 73 (docs/PILOT-LAUNCH-PLAN.md): annual billing. The tier keeps living
-- in subscription_plan ("monthly_pro" is a tier name, not a cadence); the
-- cadence is a separate column so features/allowances need no change.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0038_phase73_subscription_interval.sql

ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS subscription_interval text;
