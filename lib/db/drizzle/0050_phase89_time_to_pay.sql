-- Phase 89 (docs/OPERATIONS-PLATFORM-PLAN.md): time to pay — no payroll engine.
--  * business_profiles.pay_settings: pay periods, overtime and holiday rules
--    (province defaults unless the company overrides them), allowance rates,
--    the export format and its earning codes.
--  * collaborators.payroll_id: the employee number the payroll provider's
--    import matches on.
--  * time_entries.overtime_hours / double_hours / holiday_hours / premium_cents:
--    how approved hours split under those rules, so the premium lands on the
--    job it was worked on.
--  * pay_allowances: travel (km) and per-diem lines.
--  * pay_exports: which pay period was exported, by whom, and what it held.
-- Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0050_phase89_time_to_pay.sql

ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS pay_settings jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS payroll_id text;

ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS overtime_hours numeric(6,2) NOT NULL DEFAULT 0;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS double_hours numeric(6,2) NOT NULL DEFAULT 0;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS holiday_hours numeric(6,2) NOT NULL DEFAULT 0;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS premium_cents integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS pay_allowances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  worker_id uuid NOT NULL REFERENCES collaborators(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  time_entry_id uuid REFERENCES time_entries(id) ON DELETE SET NULL,
  date date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('mileage', 'per_diem', 'other')),
  quantity numeric(8,2) NOT NULL,
  rate_cents integer NOT NULL,
  amount_cents integer NOT NULL,
  taxable boolean NOT NULL DEFAULT false,
  note text NOT NULL DEFAULT '',
  cost_entry_id uuid REFERENCES cost_entries(id) ON DELETE SET NULL,
  created_by_user_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pay_allowances_user_date_idx ON pay_allowances (user_id, date);
CREATE INDEX IF NOT EXISTS pay_allowances_worker_idx ON pay_allowances (worker_id, date);
ALTER TABLE pay_allowances ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS pay_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  format text NOT NULL,
  exported_by_name text,
  exported_at timestamptz NOT NULL DEFAULT now(),
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS pay_exports_period_idx ON pay_exports (user_id, period_start);
ALTER TABLE pay_exports ENABLE ROW LEVEL SECURITY;
