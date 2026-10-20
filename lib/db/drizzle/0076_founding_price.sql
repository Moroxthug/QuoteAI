-- Phase 133 (docs/GROWTH-PLAN.md): a company that subscribed at the $19 launch price keeps it for life. Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0076_founding_price.sql
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS founding_price boolean NOT NULL DEFAULT false;
