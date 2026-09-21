-- Phase 69 (docs/QA-VERIFICATION-PLAN.md): one row per /api/cron/tick run so
-- /api/healthz/ops can tell whether the scheduler is alive (Vercel Cron gives
-- no callback when a schedule silently stops) and so an on-call can see what
-- the last ticks did without reading Vercel logs. Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0035_phase69_cron_ticks.sql

CREATE TABLE IF NOT EXISTS cron_ticks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  ok boolean,
  result jsonb,
  error text,
  took_ms integer
);

CREATE INDEX IF NOT EXISTS cron_ticks_started_idx ON cron_ticks (started_at DESC);
