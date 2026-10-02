-- Pocket (docs/POCKET-APP-PLAN.md, Phase 128.1): the company assistant's suggestions (Proposals), its activity log (Activity) and how much it may do
-- alone (Permissions). Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0071_pocket_assistant.sql
CREATE TABLE IF NOT EXISTS assistant_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  key text NOT NULL,
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  decided_by text,
  decided_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS assistant_suggestions_key_idx ON assistant_suggestions (user_id, key);
CREATE INDEX IF NOT EXISTS assistant_suggestions_status_idx ON assistant_suggestions (user_id, status);

CREATE TABLE IF NOT EXISTS assistant_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL,
  title text NOT NULL,
  detail text NOT NULL DEFAULT '',
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  who text NOT NULL DEFAULT '',
  who_kind text NOT NULL DEFAULT 'auto',
  category text NOT NULL DEFAULT 'jobs',
  undo text NOT NULL DEFAULT 'none',
  undo_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  word text NOT NULL DEFAULT '',
  entity_type text,
  entity_id text,
  undone_at timestamptz
);
CREATE INDEX IF NOT EXISTS assistant_activity_user_idx ON assistant_activity (user_id, at);

CREATE TABLE IF NOT EXISTS assistant_settings (
  user_id text PRIMARY KEY,
  levels jsonb NOT NULL DEFAULT '{}'::jsonb,
  spend_limit_cents integer NOT NULL DEFAULT 30000,
  quiet_hours text NOT NULL DEFAULT 'on',
  quiet_from integer NOT NULL DEFAULT 1200,
  quiet_until integer NOT NULL DEFAULT 420,
  quiet_sunday text NOT NULL DEFAULT 'on',
  read_back text NOT NULL DEFAULT 'on',
  updated_at timestamptz NOT NULL DEFAULT now()
);
