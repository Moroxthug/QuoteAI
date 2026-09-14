-- Phase 8 — per-org cost/usage observability. Additive, idempotent.
-- Apply with: pnpm --filter @workspace/db push (or paste into the Supabase SQL editor)

CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  quantity NUMERIC(14, 4) NOT NULL,
  unit_cost_cents NUMERIC(10, 6) NOT NULL DEFAULT 0,
  related_entity_type TEXT,
  related_entity_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS usage_events_user_id_idx ON usage_events (user_id);
CREATE INDEX IF NOT EXISTS usage_events_user_id_kind_created_at_idx ON usage_events (user_id, kind, created_at);

CREATE TABLE IF NOT EXISTS usage_daily_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  kind TEXT NOT NULL,
  quantity NUMERIC(14, 4) NOT NULL DEFAULT 0,
  cost_cents NUMERIC(12, 4) NOT NULL DEFAULT 0,
  event_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS usage_daily_summary_user_date_kind_idx ON usage_daily_summary (user_id, date, kind);
CREATE INDEX IF NOT EXISTS usage_daily_summary_date_kind_idx ON usage_daily_summary (date, kind);
