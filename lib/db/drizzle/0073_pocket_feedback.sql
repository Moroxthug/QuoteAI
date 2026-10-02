-- Pocket (docs/POCKET-APP-PLAN.md, Phase 128.6): feedback sent from the phone. Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0073_pocket_feedback.sql
CREATE TABLE IF NOT EXISTS app_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref serial NOT NULL,
  user_id text NOT NULL,
  author_email text,
  kind text NOT NULL DEFAULT 'wrong',
  note text NOT NULL DEFAULT '',
  reply_ok boolean NOT NULL DEFAULT true,
  include_logs boolean NOT NULL DEFAULT true,
  app_version text,
  device text,
  screen text,
  screenshot_path text,
  markup jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_feedback_user_idx ON app_feedback (user_id, created_at);
