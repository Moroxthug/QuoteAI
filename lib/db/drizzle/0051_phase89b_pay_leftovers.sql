-- Phase 89b (docs/OPERATIONS-PLATFORM-PLAN.md): what Phase 89 left open.
--  * pay_allowances.status / entered_by / client_ref / rejected_reason /
--    reviewed_at / reviewed_by_name: the crew logs km and per diem from the
--    magic link; those lines wait for the office (the office's own lines stay
--    approved as entered). client_ref makes an offline replay idempotent.
-- The rest of 89b (overtime across midnight, holiday pay base, substitute
-- days, trade presets) lives in business_profiles.pay_settings (jsonb) and
-- needs no column.
-- Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0051_phase89b_pay_leftovers.sql

ALTER TABLE pay_allowances ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved';
ALTER TABLE pay_allowances ADD COLUMN IF NOT EXISTS entered_by text NOT NULL DEFAULT 'office';
ALTER TABLE pay_allowances ADD COLUMN IF NOT EXISTS client_ref uuid;
ALTER TABLE pay_allowances ADD COLUMN IF NOT EXISTS rejected_reason text;
ALTER TABLE pay_allowances ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE pay_allowances ADD COLUMN IF NOT EXISTS reviewed_by_name text;

DO $$ BEGIN
  ALTER TABLE pay_allowances ADD CONSTRAINT pay_allowances_status_check CHECK (status IN ('submitted', 'approved', 'rejected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE pay_allowances ADD CONSTRAINT pay_allowances_entered_by_check CHECK (entered_by IN ('office', 'worker'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS pay_allowances_client_ref_idx ON pay_allowances (worker_id, client_ref) WHERE client_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS pay_allowances_pending_idx ON pay_allowances (user_id, status) WHERE status = 'submitted';
