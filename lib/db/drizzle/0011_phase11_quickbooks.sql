-- Phase 11: QuickBooks Online integration.
-- Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0011_phase11_quickbooks.sql

CREATE TABLE IF NOT EXISTS quickbooks_connections (
  user_id TEXT PRIMARY KEY REFERENCES auth_user(id) ON DELETE CASCADE,
  realm_id TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'production',
  company_name TEXT NOT NULL DEFAULT '',
  access_token_enc TEXT NOT NULL,
  refresh_token_enc TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  payment_account JSONB,
  category_map JSONB NOT NULL DEFAULT '{}',
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS quickbooks_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  qbo_id TEXT,
  qbo_type TEXT,
  status TEXT NOT NULL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS quickbooks_sync_log_user_idx ON quickbooks_sync_log (user_id, created_at);
CREATE INDEX IF NOT EXISTS quickbooks_sync_log_entity_idx ON quickbooks_sync_log (entity_type, entity_id, created_at);
