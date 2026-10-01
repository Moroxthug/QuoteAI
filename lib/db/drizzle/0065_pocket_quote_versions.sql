-- Pocket (docs/POCKET-APP-PLAN.md, Phase 125): quote versions. A sent quote that is edited becomes version 2, 3, ...;
-- the replaced version is kept. Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0065_pocket_quote_versions.sql

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS revision_open boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS quote_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  version integer NOT NULL,
  total numeric(12, 2) NOT NULL DEFAULT 0,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quote_versions_quote_idx ON quote_versions (quote_id, version);
