-- Phase 15: invoice payment collection (Interac e-Transfer self-report/confirm
-- workflow + Stripe Connect card payments). Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0016_phase15_invoice_payments.sql

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS etransfer_self_reported_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;

CREATE TABLE IF NOT EXISTS stripe_connect_accounts (
  user_id TEXT PRIMARY KEY REFERENCES auth_user(id) ON DELETE CASCADE,
  stripe_account_id TEXT NOT NULL,
  charges_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  details_submitted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
