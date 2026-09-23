-- Phase 86 (docs/OPERATIONS-PLATFORM-PLAN.md): the crew's app.
-- Reports a worker sends from /t/:token without an account — a photo with a
-- note, a "blocked" flag, materials used. The photo itself goes to job_photos
-- and the materials to cost_entries (pending_review); this table is who sent
-- what, and whether a blocker has been answered.
-- Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0046_phase86_field_reports.sql

CREATE TABLE IF NOT EXISTS field_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id uuid REFERENCES milestones(id) ON DELETE SET NULL,
  worker_id uuid REFERENCES collaborators(id) ON DELETE SET NULL,
  author_name text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'note' CHECK (kind IN ('note', 'blocker', 'materials')),
  body text NOT NULL DEFAULT '',
  photo_id uuid REFERENCES job_photos(id) ON DELETE SET NULL,
  materials_cents integer CHECK (materials_cents IS NULL OR materials_cents >= 0),
  cost_entry_id uuid REFERENCES cost_entries(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolved_by_name text,
  resolution_note text,
  client_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS field_reports_project_idx ON field_reports (project_id, created_at);
CREATE INDEX IF NOT EXISTS field_reports_user_open_idx ON field_reports (user_id, kind, resolved_at);
CREATE UNIQUE INDEX IF NOT EXISTS field_reports_client_ref_idx ON field_reports (worker_id, client_ref) WHERE client_ref IS NOT NULL;
