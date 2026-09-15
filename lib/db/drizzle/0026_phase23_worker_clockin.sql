-- Phase 23: worker GPS clock-in/out.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0026_phase23_worker_clockin.sql

ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS clock_in_at timestamptz;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS clock_out_at timestamptz;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS clock_in_lat numeric(9, 6);
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS clock_in_lng numeric(9, 6);
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS clock_out_lat numeric(9, 6);
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS clock_out_lng numeric(9, 6);
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS geofence_flagged boolean NOT NULL DEFAULT false;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS latitude numeric(9, 6);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS longitude numeric(9, 6);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS geofence_radius_meters integer;
