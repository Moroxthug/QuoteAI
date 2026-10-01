-- Pocket (docs/POCKET-APP-PLAN.md, Phase 126): where a crew member is, only while they are on the clock and have allowed it. One row per worker, the latest
-- position; it is deleted at clock-out. Additive, idempotent. Apply with: supabase db query --linked --file lib/db/drizzle/0067_pocket_crew_locations.sql
CREATE TABLE IF NOT EXISTS crew_locations (
  worker_id uuid PRIMARY KEY REFERENCES collaborators(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crew_locations_user_idx ON crew_locations (user_id);
