-- Phase 20: connected email sending (send-only Gmail per company).
-- Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0023_phase20_email_connections.sql

CREATE TABLE IF NOT EXISTS email_connections (
  user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  account_email TEXT NOT NULL DEFAULT '',
  access_token_enc TEXT NOT NULL,
  refresh_token_enc TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_send_at TIMESTAMPTZ,
  last_send_error TEXT,
  PRIMARY KEY (user_id, provider)
);
