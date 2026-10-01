-- Pocket (docs/POCKET-APP-PLAN.md, Phase 126): warranty and service calls on finished jobs (ServiceCalls). Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0068_pocket_service_calls.sql
CREATE TABLE IF NOT EXISTS service_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  issue text NOT NULL,
  note text NOT NULL DEFAULT '',
  reported_by text NOT NULL DEFAULT '',
  channel text NOT NULL DEFAULT 'phone',
  status text NOT NULL DEFAULT 'open',
  billing text NOT NULL DEFAULT 'warranty',
  amount_cents integer NOT NULL DEFAULT 0,
  visit_starts_at timestamptz,
  visit_ends_at timestamptz,
  worker_id uuid REFERENCES collaborators(id) ON DELETE SET NULL,
  schedule_block_id uuid,
  reported_at timestamptz NOT NULL DEFAULT now(),
  first_visit_at timestamptz,
  done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS service_calls_user_idx ON service_calls (user_id, status);
CREATE INDEX IF NOT EXISTS service_calls_project_idx ON service_calls (project_id);
