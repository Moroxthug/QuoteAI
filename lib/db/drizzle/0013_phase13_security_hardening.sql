-- Phase 13: security hardening (2FA, session management, audit log UI).
-- Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0013_phase13_security_hardening.sql

ALTER TABLE auth_user ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Better-auth's `twoFactor` plugin table: one row per user with 2FA enabled.
CREATE TABLE IF NOT EXISTS two_factor (
  id TEXT PRIMARY KEY,
  secret TEXT NOT NULL,
  backup_codes TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  verified BOOLEAN NOT NULL DEFAULT TRUE,
  failed_verification_count INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMP
);

CREATE INDEX IF NOT EXISTS two_factor_user_id_idx ON two_factor (user_id);
CREATE INDEX IF NOT EXISTS two_factor_secret_idx ON two_factor (secret);

-- No new audit_log table — Phase 13 reuses the existing `audit_log` table
-- (schema/automation.ts) via a new "security" entity_type, so the Settings →
-- Security tab's audit feed is queryable with the same index it already has.
