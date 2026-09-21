-- Phase 74 (docs/PILOT-LAUNCH-PLAN.md): SMS channel (Twilio) with CASL baked
-- in. Outbound/inbound log + phone-keyed opt-outs. Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0039_phase74_sms.sql

CREATE TABLE IF NOT EXISTS sms_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text,
  direction text NOT NULL,
  purpose text NOT NULL,
  status text NOT NULL,
  phone text NOT NULL,
  body text NOT NULL,
  segments integer NOT NULL DEFAULT 1,
  language text NOT NULL DEFAULT 'en',
  related_entity_type text,
  related_entity_id text,
  provider_sid text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sms_messages_user_created_idx ON sms_messages (user_id, created_at);
CREATE INDEX IF NOT EXISTS sms_messages_phone_created_idx ON sms_messages (phone, created_at);

CREATE TABLE IF NOT EXISTS sms_opt_outs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  source text NOT NULL DEFAULT 'stop_keyword',
  keyword text,
  user_id text,
  opted_out_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sms_opt_outs_phone_idx ON sms_opt_outs (phone);
