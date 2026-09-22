-- Phase 78 (docs/PILOT-LAUNCH-PLAN.md): voice-first job actions.
-- Job notes (from the Overview card, a dictation or a photo). The new
-- assistant proposal kinds (change_order, job_note) need no DDL: `kind` is TEXT.
-- Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0043_phase78_job_notes.sql

CREATE TABLE IF NOT EXISTS job_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id uuid REFERENCES milestones(id) ON DELETE SET NULL,
  photo_id uuid REFERENCES job_photos(id) ON DELETE SET NULL,
  body text NOT NULL,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'voice', 'photo', 'assistant')),
  author_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS job_notes_project_idx ON job_notes (project_id, created_at);
