-- Phase 76 (docs/PILOT-LAUNCH-PLAN.md): client portal. Portal link + OTP
-- state on clients, portal sessions, and the client message thread.
-- Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0041_phase76_client_portal.sql

ALTER TABLE clients ADD COLUMN IF NOT EXISTS portal_token_hash text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS portal_otp_hash text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS portal_otp_expires_at timestamptz;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS portal_otp_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS portal_invited_at timestamptz;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS portal_last_seen_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS clients_portal_token_idx ON clients (portal_token_hash);

CREATE TABLE IF NOT EXISTS client_portal_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_portal_sessions_token_idx ON client_portal_sessions (token_hash);
CREATE INDEX IF NOT EXISTS client_portal_sessions_client_idx ON client_portal_sessions (client_id);

CREATE TABLE IF NOT EXISTS client_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  sender text NOT NULL CHECK (sender IN ('contractor', 'client')),
  sender_name text NOT NULL DEFAULT '',
  body text NOT NULL,
  read_at timestamptz,
  emailed_at timestamptz,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_messages_client_idx ON client_messages (client_id, created_at);
CREATE INDEX IF NOT EXISTS client_messages_unread_idx ON client_messages (user_id, sender, read_at);
CREATE INDEX IF NOT EXISTS client_messages_project_idx ON client_messages (project_id);
