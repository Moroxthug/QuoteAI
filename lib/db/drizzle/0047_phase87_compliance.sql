-- Phase 87 (docs/OPERATIONS-PLATFORM-PLAN.md): compliance and filings.
-- The filing calendar is derived from registrations + compliance_settings;
-- these tables hold only what cannot be derived: periods marked as filed,
-- reminders a company sets itself, and the permits on each job.
-- Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0047_phase87_compliance.sql

ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS compliance_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS compliance_filings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('sales_tax', 'sales_tax_payment', 'gst_instalment', 'pst', 't5018')),
  period_key text NOT NULL,
  filed_at timestamptz,
  filed_by_name text,
  note text NOT NULL DEFAULT '',
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS compliance_filings_period_idx ON compliance_filings (user_id, kind, period_key);

CREATE TABLE IF NOT EXISTS compliance_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  kind text NOT NULL DEFAULT 'other' CHECK (kind IN ('workers_comp', 'licence', 'insurance', 'other')),
  preset text,
  title text NOT NULL,
  authority text NOT NULL DEFAULT '',
  reference text NOT NULL DEFAULT '',
  url text,
  due_date timestamptz NOT NULL,
  recurrence text NOT NULL DEFAULT 'annual' CHECK (recurrence IN ('none', 'monthly', 'quarterly', 'annual')),
  remind_days_before integer NOT NULL DEFAULT 30 CHECK (remind_days_before BETWEEN 0 AND 180),
  notes text NOT NULL DEFAULT '',
  last_done_at timestamptz,
  notified_for_due timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS compliance_reminders_user_idx ON compliance_reminders (user_id, due_date);

CREATE TABLE IF NOT EXISTS job_permits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'building' CHECK (kind IN ('building', 'demolition', 'electrical', 'plumbing', 'gas', 'hvac', 'other')),
  title text NOT NULL,
  authority text NOT NULL DEFAULT '',
  reference_number text NOT NULL DEFAULT '',
  url text,
  status text NOT NULL DEFAULT 'needed' CHECK (status IN ('needed', 'applied', 'issued', 'closed', 'not_required')),
  applied_at timestamptz,
  issued_at timestamptz,
  inspection_at timestamptz,
  expires_at timestamptz,
  closed_at timestamptz,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS job_permits_project_idx ON job_permits (project_id);
CREATE INDEX IF NOT EXISTS job_permits_user_inspection_idx ON job_permits (user_id, inspection_at);
