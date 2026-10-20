-- Phase 134 (docs/GROWTH-PLAN.md): lifecycle emails to people who signed up. Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0077_lifecycle_emails.sql
-- Nothing is sent until LIFECYCLE_EMAILS_ENABLED=1 is set on the API.
CREATE TABLE IF NOT EXISTS lifecycle_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  message_key text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  provider_id text,
  CONSTRAINT lifecycle_sends_user_key_unique UNIQUE (user_id, message_key)
);
CREATE INDEX IF NOT EXISTS lifecycle_sends_sent_at_idx ON lifecycle_sends (sent_at);
ALTER TABLE lifecycle_sends ENABLE ROW LEVEL SECURITY;

-- A person who opts out of lifecycle (nurture) emails stops the whole sequence. Account emails (verification, password reset, receipts) are not affected.
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS marketing_emails_opt_out boolean NOT NULL DEFAULT false;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS marketing_opt_out_at timestamptz;
