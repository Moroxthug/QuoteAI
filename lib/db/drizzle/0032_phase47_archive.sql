-- Phase 47: soft-archive for quotes, clients, invoices, contracts and jobs (projects),
-- plus the Notifications page (reuses the existing Phase-earlier notifications table — no schema change there).
-- Additive, idempotent. Apply with: supabase db query --linked --file lib/db/drizzle/0032_phase47_archive.sql

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS archived_by_name TEXT;
CREATE INDEX IF NOT EXISTS quotes_archived_idx ON quotes (user_id, archived_at);

ALTER TABLE clients ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS archived_by_name TEXT;
CREATE INDEX IF NOT EXISTS clients_archived_idx ON clients (user_id, archived_at);

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS archived_by_name TEXT;
CREATE INDEX IF NOT EXISTS invoices_archived_idx ON invoices (user_id, archived_at);

ALTER TABLE contracts ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS archived_by_name TEXT;
CREATE INDEX IF NOT EXISTS contracts_archived_idx ON contracts (user_id, archived_at);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived_by_name TEXT;
CREATE INDEX IF NOT EXISTS projects_archived_idx ON projects (user_id, archived_at);
