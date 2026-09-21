-- Phase 75 (docs/PILOT-LAUNCH-PLAN.md): schedule board. Per-worker timed
-- blocks + calendar sync rows for them. Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0040_phase75_schedule.sql

CREATE TABLE IF NOT EXISTS schedule_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id uuid REFERENCES milestones(id) ON DELETE SET NULL,
  collaborator_id uuid REFERENCES collaborators(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  notes text NOT NULL DEFAULT '',
  reminder_sent_at timestamptz,
  created_by_user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS schedule_blocks_user_start_idx ON schedule_blocks (user_id, starts_at);
CREATE INDEX IF NOT EXISTS schedule_blocks_worker_start_idx ON schedule_blocks (collaborator_id, starts_at);
CREATE INDEX IF NOT EXISTS schedule_blocks_project_idx ON schedule_blocks (project_id);

-- A synced event now belongs to either a milestone (Phase 12) or a block.
ALTER TABLE calendar_synced_events ALTER COLUMN milestone_id DROP NOT NULL;
ALTER TABLE calendar_synced_events ADD COLUMN IF NOT EXISTS schedule_block_id uuid REFERENCES schedule_blocks(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS calendar_synced_events_block_provider_idx ON calendar_synced_events (schedule_block_id, provider);
