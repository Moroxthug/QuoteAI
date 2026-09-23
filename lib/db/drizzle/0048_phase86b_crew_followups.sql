-- Phase 86b (docs/OPERATIONS-PLATFORM-PLAN.md): what Phase 86 left open.
--  * A crew member the office trusts can add a task from the site
--    (collaborators.can_add_tasks, opt-in per worker). The task remembers who
--    added it, and an offline replay returns the same row (client_ref).
--  * "What changed since you last looked": collaborators.crew_seen_at is the
--    worker's own marker, and project_tasks.field_updated_* tell a change the
--    office made apart from one the worker made themselves.
--  * The schedule half of that list reads audit_log by tenant and type, which
--    the entity-only index could not serve.
-- Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0048_phase86b_crew_followups.sql

ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS can_add_tasks boolean NOT NULL DEFAULT false;
ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS crew_seen_at timestamptz;

ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS created_by_worker_id uuid REFERENCES collaborators(id) ON DELETE SET NULL;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS created_by_name text;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS field_updated_by uuid REFERENCES collaborators(id) ON DELETE SET NULL;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS field_updated_at timestamptz;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS client_ref text;
CREATE UNIQUE INDEX IF NOT EXISTS project_tasks_field_client_ref_idx ON project_tasks (created_by_worker_id, client_ref) WHERE client_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS project_tasks_project_updated_idx ON project_tasks (project_id, updated_at);

CREATE INDEX IF NOT EXISTS audit_log_user_type_created_idx ON audit_log (user_id, entity_type, created_at);
