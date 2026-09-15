-- Phase 27: bank feed reconciliation (Flinks) — engineering track, inert
-- until Flinks accreditation is granted. Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0029_phase27_flinks.sql

CREATE TABLE IF NOT EXISTS flinks_connections (
  user_id TEXT PRIMARY KEY REFERENCES auth_user(id) ON DELETE CASCADE,
  login_id_enc TEXT NOT NULL,
  institution_name TEXT NOT NULL DEFAULT '',
  selected_account JSONB,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS flinks_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  flinks_transaction_id TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  amount_cents INTEGER NOT NULL,
  balance_cents INTEGER,
  match_status TEXT NOT NULL DEFAULT 'unmatched',
  matched_cost_entry_id UUID REFERENCES cost_entries(id) ON DELETE SET NULL,
  auto_matched BOOLEAN NOT NULL DEFAULT FALSE,
  raw JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS flinks_transactions_user_date_idx ON flinks_transactions (user_id, date);
CREATE INDEX IF NOT EXISTS flinks_transactions_user_status_idx ON flinks_transactions (user_id, match_status);
CREATE INDEX IF NOT EXISTS flinks_transactions_flinks_id_idx ON flinks_transactions (user_id, flinks_transaction_id);
