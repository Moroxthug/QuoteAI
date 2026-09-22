-- Phase 77 (docs/PILOT-LAUNCH-PLAN.md): PWA + offline field mode + web push.
-- Idempotency refs for rows the offline outbox creates, and push subscriptions.
-- Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0042_phase77_offline_push.sql

ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS client_ref text;
CREATE UNIQUE INDEX IF NOT EXISTS time_entries_client_ref_idx ON time_entries (worker_id, client_ref) WHERE client_ref IS NOT NULL;

ALTER TABLE cost_entries ADD COLUMN IF NOT EXISTS client_ref text;
CREATE UNIQUE INDEX IF NOT EXISTS cost_entries_client_ref_idx ON cost_entries (user_id, client_ref) WHERE client_ref IS NOT NULL;

ALTER TABLE job_photos ADD COLUMN IF NOT EXISTS client_ref text;
CREATE UNIQUE INDEX IF NOT EXISTS job_photos_client_ref_idx ON job_photos (user_id, client_ref) WHERE client_ref IS NOT NULL;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  member_user_id text NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  language text NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'fr')),
  last_used_at timestamptz,
  failed_at timestamptz,
  failure_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_idx ON push_subscriptions (endpoint);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions (user_id);
