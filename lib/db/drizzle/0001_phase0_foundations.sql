-- Phase 0 — Foundations for the quote → contract → job → invoice lifecycle.
-- Additive only. Safe to re-run (IF NOT EXISTS everywhere).
-- Apply with: pnpm --filter @workspace/db push   (or paste into the Supabase SQL editor)

-- ── clients ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'individual',
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  business_number TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'en',
  notes TEXT NOT NULL DEFAULT '',
  dedup_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS clients_user_id_idx ON clients (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS clients_user_dedup_idx ON clients (user_id, dedup_key);

-- ── quotes ──────────────────────────────────────────────────────────────────
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS province TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS payment_schedule JSONB;
CREATE INDEX IF NOT EXISTS quotes_client_id_idx ON quotes (client_id);

-- ── business_profiles ───────────────────────────────────────────────────────
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS province TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS gst_hst_number TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS qst_number TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS pst_number TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS licence_number TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS etransfer_email TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS default_payment_schedule JSONB;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS automation_settings JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS feature_flags JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ── automation plumbing ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  event TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  last_error TEXT,
  next_attempt_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS automation_runs_idempotency_idx ON automation_runs (idempotency_key);
CREATE INDEX IF NOT EXISTS automation_runs_status_next_idx ON automation_runs (status, next_attempt_at);
CREATE INDEX IF NOT EXISTS automation_runs_user_idx ON automation_runs (user_id, created_at);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  link TEXT,
  entity_type TEXT,
  entity_id TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications (user_id, read_at, created_at);

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  diff JSONB,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON audit_log (entity_type, entity_id, created_at);

-- ── backfill clients from existing quotes ───────────────────────────────────
-- One client per (user, lower(name)|lower(email)|phone), keeping the most
-- recent address details. Then link every quote to its client.
INSERT INTO clients (user_id, name, email, phone, address, city, province, postal_code, business_number, dedup_key)
SELECT DISTINCT ON (q.user_id, dk.key)
  q.user_id,
  COALESCE(NULLIF(trim(q.client_data->>'nome'), ''), 'Client'),
  NULLIF(trim(q.client_data->>'email'), ''),
  NULLIF(trim(q.client_data->>'phone'), ''),
  NULLIF(trim(q.client_data->>'indirizzo'), ''),
  NULLIF(trim(q.client_data->>'city'), ''),
  NULLIF(upper(trim(q.client_data->>'province')), ''),
  NULLIF(trim(q.client_data->>'postalCode'), ''),
  COALESCE(NULLIF(trim(q.client_data->>'businessNumber'), ''), NULLIF(trim(q.client_data->>'partitaIva'), '')),
  dk.key
FROM quotes q
CROSS JOIN LATERAL (
  SELECT concat_ws('|',
    lower(trim(coalesce(q.client_data->>'nome', ''))),
    lower(trim(coalesce(q.client_data->>'email', ''))),
    lower(trim(coalesce(q.client_data->>'phone', '')))
  ) AS key
) dk
WHERE trim(coalesce(q.client_data->>'nome', '')) <> ''
ORDER BY q.user_id, dk.key, q.created_at DESC
ON CONFLICT (user_id, dedup_key) DO NOTHING;

UPDATE quotes q
SET client_id = c.id
FROM clients c
WHERE q.client_id IS NULL
  AND c.user_id = q.user_id
  AND c.dedup_key = concat_ws('|',
    lower(trim(coalesce(q.client_data->>'nome', ''))),
    lower(trim(coalesce(q.client_data->>'email', ''))),
    lower(trim(coalesce(q.client_data->>'phone', '')))
  );

-- Province on quotes: copy from the client data when it looks like a code.
UPDATE quotes
SET province = upper(trim(client_data->>'province'))
WHERE province IS NULL
  AND upper(trim(coalesce(client_data->>'province', ''))) IN ('AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT');
