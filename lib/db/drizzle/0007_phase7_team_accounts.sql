-- Phase 7 — team accounts. Additive, idempotent.

CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id TEXT NOT NULL,
  user_id TEXT,
  role TEXT NOT NULL DEFAULT 'viewer',
  status TEXT NOT NULL DEFAULT 'invited',
  invited_email TEXT NOT NULL,
  invited_by_user_id TEXT NOT NULL,
  invite_token_hash TEXT,
  invite_token_expires_at TIMESTAMPTZ,
  permissions JSONB NOT NULL DEFAULT '{}',
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS organization_members_owner_id_idx ON organization_members (owner_id);
CREATE INDEX IF NOT EXISTS organization_members_user_id_idx ON organization_members (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS organization_members_owner_email_idx ON organization_members (owner_id, invited_email);
