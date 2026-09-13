-- Phase 3 — Cost entries, workers & time, equipment, receipt AI. Additive, idempotent.

-- collaborators → workers (table name kept)
ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS worker_type TEXT NOT NULL DEFAULT 'employee';
ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS burden_percent NUMERIC(5,2) NOT NULL DEFAULT 15;
ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS time_token_hash TEXT;
ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS time_token_expires_at TIMESTAMPTZ;
ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS last_time_entry_at TIMESTAMPTZ;
ALTER TABLE collaborators ALTER COLUMN role SET DEFAULT 'worker';
CREATE UNIQUE INDEX IF NOT EXISTS collaborators_time_token_idx ON collaborators (time_token_hash) WHERE time_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS collaborators_user_idx ON collaborators (user_id, active);
-- Legacy Italian role values → worker type
UPDATE collaborators SET worker_type = 'subcontractor', burden_percent = 0 WHERE role IN ('collaboratore', 'subcontractor', 'sous-traitant');
UPDATE collaborators SET role = 'worker' WHERE role IN ('collaboratore', 'dipendente');

-- cost entries (every actual dollar spent on a job)
CREATE TABLE IF NOT EXISTS cost_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'misc',
  vendor TEXT NOT NULL DEFAULT '',
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  description TEXT NOT NULL DEFAULT '',
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  tax_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'confirmed',
  source TEXT NOT NULL DEFAULT 'manual',
  created_by TEXT NOT NULL DEFAULT 'user',
  source_document_id UUID REFERENCES uploaded_documents(id) ON DELETE SET NULL,
  time_entry_id UUID,
  equipment_usage_id UUID,
  ai_extraction JSONB,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS cost_entries_project_idx ON cost_entries (project_id, date);
CREATE INDEX IF NOT EXISTS cost_entries_user_status_idx ON cost_entries (user_id, status);

-- Migrate legacy extra_costs (same ids → re-runnable). The old table stays one phase for rollback.
INSERT INTO cost_entries (id, user_id, project_id, category, description, date, subtotal_cents, tax_cents, total_cents, status, source, created_by, confirmed_at, created_at)
SELECT e.id, p.user_id, e.project_id, 'misc', e.description, e.date, e.amount, 0, e.amount, 'confirmed', 'legacy', 'user', e.created_at, e.created_at
FROM extra_costs e JOIN projects p ON p.id = e.project_id
ON CONFLICT (id) DO NOTHING;

-- time entries
CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  worker_id UUID NOT NULL REFERENCES collaborators(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL,
  date TIMESTAMPTZ NOT NULL,
  hours NUMERIC(6,2) NOT NULL,
  rate_cents_snapshot INTEGER NOT NULL DEFAULT 0,
  burden_percent_snapshot NUMERIC(5,2) NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'submitted',
  entered_by TEXT NOT NULL DEFAULT 'company',
  approved_at TIMESTAMPTZ,
  rejected_reason TEXT,
  cost_entry_id UUID REFERENCES cost_entries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS time_entries_project_idx ON time_entries (project_id, date);
CREATE INDEX IF NOT EXISTS time_entries_worker_idx ON time_entries (worker_id, date);
CREATE INDEX IF NOT EXISTS time_entries_user_status_idx ON time_entries (user_id, status);

-- equipment register + usage
CREATE TABLE IF NOT EXISTS equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  ownership TEXT NOT NULL DEFAULT 'owned',
  purchase_cents INTEGER NOT NULL DEFAULT 0,
  financing JSONB NOT NULL DEFAULT '{}'::jsonb,
  usage_rate_cents INTEGER NOT NULL DEFAULT 0,
  usage_unit TEXT NOT NULL DEFAULT 'day',
  notes TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS equipment_user_idx ON equipment (user_id, active);

CREATE TABLE IF NOT EXISTS equipment_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL,
  date TIMESTAMPTZ NOT NULL,
  quantity NUMERIC(8,2) NOT NULL,
  unit TEXT NOT NULL DEFAULT 'day',
  rate_cents_snapshot INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  cost_entry_id UUID REFERENCES cost_entries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS equipment_usage_project_idx ON equipment_usage (project_id, date);

-- back-links from cost entries (tables above must exist first)
DO $$ BEGIN
  ALTER TABLE cost_entries ADD CONSTRAINT cost_entries_time_entry_fk FOREIGN KEY (time_entry_id) REFERENCES time_entries(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE cost_entries ADD CONSTRAINT cost_entries_equipment_usage_fk FOREIGN KEY (equipment_usage_id) REFERENCES equipment_usage(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- receipts are uploaded_documents with a purpose
ALTER TABLE uploaded_documents ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'price_intelligence';
ALTER TABLE uploaded_documents ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS uploaded_documents_project_idx ON uploaded_documents (project_id);
