-- Phase 119 (docs/APP-PLAN.md "Native powers"): the phone app's push tokens
-- (Firebase Cloud Messaging), beside the Phase 77 browser subscriptions.
-- Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0058_phase119_device_tokens.sql

CREATE TABLE IF NOT EXISTS device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  member_user_id text NOT NULL,
  token text NOT NULL,
  install_id text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('android', 'ios')),
  app_version text,
  language text NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'fr')),
  last_used_at timestamptz,
  failed_at timestamptz,
  failure_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS device_tokens_install_idx ON device_tokens (install_id);
CREATE UNIQUE INDEX IF NOT EXISTS device_tokens_token_idx ON device_tokens (token);
CREATE INDEX IF NOT EXISTS device_tokens_user_idx ON device_tokens (user_id);

-- Server-only, like push_subscriptions: RLS on, no policies.
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

-- Which push categories each person turned off (no row = all on).
CREATE TABLE IF NOT EXISTS push_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  member_user_id text NOT NULL,
  muted text[] NOT NULL DEFAULT '{}'::text[],
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS push_preferences_member_idx ON push_preferences (user_id, member_user_id);
ALTER TABLE push_preferences ENABLE ROW LEVEL SECURITY;
