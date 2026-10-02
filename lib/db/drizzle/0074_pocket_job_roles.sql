-- Pocket (docs/POCKET-APP-PLAN.md, Phase 128.7): who does what in the company (a job role) and the sensitive-access exceptions. Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0074_pocket_job_roles.sql
CREATE TABLE IF NOT EXISTS member_job_roles (
  org_id text NOT NULL,
  member_user_id text NOT NULL,
  job_role text NOT NULL,
  sensitive jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, member_user_id)
);
