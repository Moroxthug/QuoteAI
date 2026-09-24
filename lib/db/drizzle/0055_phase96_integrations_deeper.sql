-- Phase 96 (docs/LAUNCH-FINISH-PLAN.md): integrations, one level deeper.
--  * calendar_connections.calendar_name: the display name of the calendar
--    picked in Settings (calendar_id already existed and defaulted to
--    "primary"); null while events go to the account's main calendar.
--  * job_photos.thumb_url: the small JPEG made on upload (or lazily on first
--    request for older photos); null until one exists.
-- Nothing is backfilled: thumbnails appear as photos are viewed, QuickBooks
-- per-line syncs start with the next invoice. Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0055_phase96_integrations_deeper.sql

ALTER TABLE calendar_connections ADD COLUMN IF NOT EXISTS calendar_name text;
ALTER TABLE job_photos ADD COLUMN IF NOT EXISTS thumb_url text;
