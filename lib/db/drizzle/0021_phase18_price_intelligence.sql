-- Phase 18: supplier price intelligence, extended (price-trend alerts + cross-supplier comparison).
-- Apply with: supabase db query --linked --file lib/db/drizzle/0021_phase18_price_intelligence.sql

ALTER TABLE price_intelligence ADD COLUMN IF NOT EXISTS vendor text;

DO $$ BEGIN
  CREATE TYPE price_trend_direction AS ENUM ('up', 'down');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS price_intelligence_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  work_type text NOT NULL,
  zone text,
  previous_avg_price text NOT NULL,
  current_avg_price text NOT NULL,
  percent_change text NOT NULL,
  direction price_trend_direction NOT NULL,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS price_intelligence_alerts_user_id_idx ON price_intelligence_alerts (user_id);
CREATE INDEX IF NOT EXISTS price_intelligence_vendor_idx ON price_intelligence (user_id, work_type, zone, vendor);
