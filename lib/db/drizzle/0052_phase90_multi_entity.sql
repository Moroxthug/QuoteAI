-- Phase 90 (docs/OPERATIONS-PLATFORM-PLAN.md): multi-entity.
--  * company_groups / company_group_members: companies that belong together.
--    A company is in at most one group; joining is pending until the joining
--    company's owner accepts.
--  * collaborators.group_person_id: the same person on two companies' crews,
--    so one magic link reaches both payrolls.
--  * business_profiles.plan_covered_by: the plan on this profile is paid by
--    that company's subscription (one bill), not by its own.
-- Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0052_phase90_multi_entity.sql

CREATE TABLE IF NOT EXISTS company_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  name text NOT NULL,
  created_by_user_id text NOT NULL,
  catalog_org_id text,
  billing_org_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS company_groups_user_id_idx ON company_groups (user_id);
ALTER TABLE company_groups ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS company_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES company_groups(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  invited_by_user_id text NOT NULL,
  use_group_catalog boolean NOT NULL DEFAULT true,
  covered boolean NOT NULL DEFAULT false,
  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS company_group_members_user_idx ON company_group_members (user_id);
CREATE INDEX IF NOT EXISTS company_group_members_group_idx ON company_group_members (group_id);
DO $$ BEGIN
  ALTER TABLE company_group_members ADD CONSTRAINT company_group_members_status_check CHECK (status IN ('pending', 'active'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE company_group_members ENABLE ROW LEVEL SECURITY;

ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS group_person_id uuid;
CREATE INDEX IF NOT EXISTS collaborators_group_person_idx ON collaborators (group_person_id) WHERE group_person_id IS NOT NULL;

ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS plan_covered_by text;
