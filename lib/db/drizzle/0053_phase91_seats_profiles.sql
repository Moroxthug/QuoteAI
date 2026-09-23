-- Phase 91 (docs/OPERATIONS-PLATFORM-PLAN.md): seats, the company's setup
-- answers, access codes, and a profile for every person.
--  * business_profiles.extra_seats: paid seats beyond the plan's included ones
--    (kept in step with the subscription's extra-seat item).
--  * business_profiles.company_setup: what the company said at sign-up
--    (trades, team size, seats wanted, field crew).
--  * organization_members.access_code_hash / access_code_hint: a short code an
--    employee types at /join instead of following an emailed link.
--  * user_profiles: one row per login (phone, job title, bio, setup done).
--  * created_by_user_id on quotes, invoices, projects, contracts: the person
--    who made it, so each person's history and numbers can be shown.
-- Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0053_phase91_seats_profiles.sql

ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS extra_seats integer NOT NULL DEFAULT 0;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS company_setup jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS access_code_hash text;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS access_code_hint text;
CREATE UNIQUE INDEX IF NOT EXISTS organization_members_access_code_idx ON organization_members (access_code_hash) WHERE access_code_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id text PRIMARY KEY,
  phone text,
  job_title text,
  bio text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS created_by_user_id text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_by_user_id text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_by_user_id text;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS created_by_user_id text;
CREATE INDEX IF NOT EXISTS quotes_created_by_idx ON quotes (user_id, created_by_user_id) WHERE created_by_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS invoices_created_by_idx ON invoices (user_id, created_by_user_id) WHERE created_by_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS projects_created_by_idx ON projects (user_id, created_by_user_id) WHERE created_by_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS contracts_created_by_idx ON contracts (user_id, created_by_user_id) WHERE created_by_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON audit_log (actor_id, created_at) WHERE actor_id IS NOT NULL;
