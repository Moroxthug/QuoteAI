-- Phase 72 (docs/PILOT-LAUNCH-PLAN.md): "Export my data" requests and account
-- deletion requests (7-day grace, then purge; signed contracts + issued
-- invoices retained 7 years under a tombstone id). Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0037_phase72_account_export_deletion.sql

CREATE TABLE IF NOT EXISTS account_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  requested_by_user_id text NOT NULL,
  email text NOT NULL,
  language text NOT NULL DEFAULT 'en',
  status text NOT NULL DEFAULT 'pending',
  storage_path text,
  size_bytes integer,
  table_count integer,
  file_count integer,
  error text,
  ready_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS account_exports_user_idx ON account_exports (user_id, created_at);

CREATE TABLE IF NOT EXISTS account_deletions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  email text,
  email_hash text NOT NULL,
  language text NOT NULL DEFAULT 'en',
  company_name text,
  province text,
  gst_hst_number text,
  qst_number text,
  owns_profile boolean NOT NULL DEFAULT false,
  cancel_token_hash text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  scheduled_for timestamptz NOT NULL,
  cancelled_at timestamptz,
  purged_at timestamptz,
  retain_until timestamptz,
  retained_contracts integer,
  retained_invoices integer,
  retention_purged_at timestamptz,
  stripe_subscription_cancelled boolean NOT NULL DEFAULT false,
  ip text,
  user_agent text,
  error text
);
CREATE INDEX IF NOT EXISTS account_deletions_user_idx ON account_deletions (user_id);
CREATE INDEX IF NOT EXISTS account_deletions_scheduled_idx ON account_deletions (scheduled_for);
