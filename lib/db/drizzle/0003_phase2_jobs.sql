-- Phase 2 — Jobs, milestones, cost budget, change orders. Additive, idempotent.

-- projects → jobs
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS province TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS contract_value_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS change_orders_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS setup_status TEXT NOT NULL DEFAULT 'confirmed';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS setup_proposal JSONB;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS setup_confirmed_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS planned_start TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS planned_end TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS progress_percent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS projects_user_idx ON projects (user_id, created_at);
CREATE INDEX IF NOT EXISTS projects_contract_idx ON projects (contract_id);

-- Legacy projects: mirror the old budget column and carry the quote's client over.
UPDATE projects SET contract_value_cents = budget WHERE contract_value_cents = 0 AND budget > 0;
UPDATE projects p SET client_id = q.client_id FROM quotes q WHERE p.quote_id = q.id AND p.client_id IS NULL AND q.client_id IS NOT NULL;

-- milestones
CREATE TABLE IF NOT EXISTS milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  planned_start TIMESTAMPTZ,
  planned_end TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'planned',
  payment_term_id TEXT,
  payment_term_label TEXT,
  payment_amount_cents INTEGER,
  source_chapter TEXT,
  value_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS milestones_project_idx ON milestones (project_id, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS milestones_project_key_idx ON milestones (project_id, key);

-- tasks hang off milestones
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS project_tasks_milestone_idx ON project_tasks (milestone_id);

-- cost budget (AI-proposed split of the quote into expected costs)
CREATE TABLE IF NOT EXISTS cost_budget_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  chapter_ref TEXT,
  label TEXT NOT NULL DEFAULT '',
  planned_cents INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS cost_budget_lines_project_idx ON cost_budget_lines (project_id, sort_order);

-- contracts: change-order documents reuse the contract/signing machinery
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'agreement';
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS parent_contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS change_order_id UUID;
CREATE INDEX IF NOT EXISTS contracts_parent_idx ON contracts (parent_contract_id);
CREATE INDEX IF NOT EXISTS contracts_project_idx ON contracts (project_id);

-- change orders
CREATE TABLE IF NOT EXISTS change_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  document_contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  schedule_delta_days INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  signed_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS change_orders_project_idx ON change_orders (project_id, created_at);
CREATE INDEX IF NOT EXISTS change_orders_document_idx ON change_orders (document_contract_id);

DO $$ BEGIN
  ALTER TABLE contracts ADD CONSTRAINT contracts_change_order_fk FOREIGN KEY (change_order_id) REFERENCES change_orders(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
