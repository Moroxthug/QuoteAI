-- Security audit 2026-11, batch B (docs/SECURITY-AUDIT-2026-11.md). Additive, idempotent. NOT applied yet.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0079_security_batch_b.sql
-- The code deployed before this runs is safe: the rate limiter falls back to
-- per-instance counters while rate_limit_hits is missing, and the audit-log
-- maintenance flag is a no-op until the trigger exists.

-- B2: shared rate-limit counters (lib/rateLimitStore.ts). One row per key.
CREATE TABLE IF NOT EXISTS rate_limit_hits (
  key text PRIMARY KEY,
  hits integer NOT NULL,
  reset_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_limit_hits_reset_idx ON rate_limit_hits (reset_at);
-- Server-only table: no access through the Supabase data API.
ALTER TABLE rate_limit_hits ENABLE ROW LEVEL SECURITY;

-- B10: audit_log is append-only. UPDATE, DELETE and TRUNCATE are refused
-- unless the transaction set quoteai.audit_maintenance = 'on'
-- (lib/auditLog.ts withAuditMaintenance: account purge, retention purge,
-- test cleanup). This stops the application — or anyone holding its
-- connection string without also knowing to set the flag — from quietly
-- rewriting history; it is not a defence against a database superuser.
CREATE OR REPLACE FUNCTION audit_log_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF coalesce(current_setting('quoteai.audit_maintenance', true), '') = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    IF TG_OP = 'TRUNCATE' THEN RETURN NULL; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'audit_log is append-only (% refused)', TG_OP USING ERRCODE = 'insufficient_privilege';
END $$;

DROP TRIGGER IF EXISTS audit_log_append_only ON audit_log;
CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_append_only();

DROP TRIGGER IF EXISTS audit_log_no_truncate ON audit_log;
CREATE TRIGGER audit_log_no_truncate
  BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_append_only();

-- B12: the retention purge deletes by age on these tables.
CREATE INDEX IF NOT EXISTS email_events_created_idx ON email_events (created_at);
CREATE INDEX IF NOT EXISTS audit_log_type_created_idx ON audit_log (entity_type, created_at);
