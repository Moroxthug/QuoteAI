-- Growth and owner analytics (docs/GROWTH-PLAN.md, Phase 131). Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0075_growth_analytics.sql
CREATE TABLE IF NOT EXISTS signup_attribution (
  user_id text PRIMARY KEY,
  source text NOT NULL DEFAULT 'direct',
  medium text,
  campaign text,
  referrer text,
  landing_path text,
  platform text NOT NULL DEFAULT 'web',
  referral_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS growth_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  at timestamptz NOT NULL DEFAULT now(),
  event text NOT NULL,
  user_id text,
  anon_id text,
  source text,
  platform text,
  props jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS growth_events_event_at_idx ON growth_events (event, at);
CREATE INDEX IF NOT EXISTS growth_events_user_idx ON growth_events (user_id);
CREATE TABLE IF NOT EXISTS billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'stripe',
  provider_event_id text NOT NULL,
  type text NOT NULL,
  user_id text,
  customer_id text,
  plan text,
  interval text,
  amount_cents bigint NOT NULL DEFAULT 0,
  tax_cents bigint NOT NULL DEFAULT 0,
  fee_cents bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'cad',
  founding integer NOT NULL DEFAULT 0,
  at timestamptz NOT NULL DEFAULT now(),
  raw jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS billing_events_provider_event_uq ON billing_events (provider, provider_event_id);
CREATE INDEX IF NOT EXISTS billing_events_at_idx ON billing_events (at);
CREATE INDEX IF NOT EXISTS billing_events_user_idx ON billing_events (user_id);
CREATE TABLE IF NOT EXISTS owner_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  amount_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'cad',
  cadence text NOT NULL DEFAULT 'monthly',
  starts_on date NOT NULL,
  ends_on date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS marketing_spend (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL,
  campaign text,
  spent_on date NOT NULL,
  amount_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'cad',
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketing_spend_on_idx ON marketing_spend (spent_on);
CREATE TABLE IF NOT EXISTS owner_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Only read through the owner-only API; keep them out of the public API.
ALTER TABLE signup_attribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_spend ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_settings ENABLE ROW LEVEL SECURITY;
