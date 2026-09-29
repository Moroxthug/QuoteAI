-- Pocket (docs/POCKET-DESIGN-PLAN.md, Phase 146): the phone Home's "Today" list —
-- what a person ticked as dealt with today (job tasks are done in project_tasks).
-- Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0059_pocket_today_checks.sql

CREATE TABLE IF NOT EXISTS today_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  member_user_id text NOT NULL,
  day date NOT NULL,
  item_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS today_checks_member_day_item_idx ON today_checks (member_user_id, day, item_id);
CREATE INDEX IF NOT EXISTS today_checks_user_idx ON today_checks (user_id);

-- Server-only, like push_preferences: RLS on, no policies.
ALTER TABLE today_checks ENABLE ROW LEVEL SECURITY;
