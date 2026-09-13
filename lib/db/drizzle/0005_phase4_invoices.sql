-- Phase 4 — Invoicing. Additive, idempotent.

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL,
  change_order_id UUID REFERENCES change_orders(id) ON DELETE SET NULL,
  payment_term_id TEXT,
  payment_term_label TEXT,
  credit_note_for_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  number TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'draft',
  source TEXT NOT NULL DEFAULT 'manual',
  language TEXT NOT NULL DEFAULT 'en',
  province TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  issue_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date TIMESTAMPTZ NOT NULL,
  scheduled_for TIMESTAMPTZ,
  scheduled_notified_at TIMESTAMPTZ,
  contractor JSONB NOT NULL DEFAULT '{}'::jsonb,
  customer JSONB NOT NULL DEFAULT '{}'::jsonb,
  site_address TEXT NOT NULL DEFAULT '',
  lines JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  holdback_percent INTEGER NOT NULL DEFAULT 0,
  holdback_cents INTEGER NOT NULL DEFAULT 0,
  taxable_cents INTEGER NOT NULL DEFAULT 0,
  tax_lines JSONB NOT NULL DEFAULT '[]'::jsonb,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  paid_cents INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  payment_instructions JSONB NOT NULL DEFAULT '{}'::jsonb,
  public_token_hash TEXT,
  pdf_url TEXT,
  pdf_hash TEXT,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  void_reason TEXT,
  auto_send_at TIMESTAMPTZ,
  reminder_count INTEGER NOT NULL DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS invoices_user_idx ON invoices (user_id, issue_date);
CREATE INDEX IF NOT EXISTS invoices_project_idx ON invoices (project_id);
CREATE INDEX IF NOT EXISTS invoices_status_due_idx ON invoices (status, due_date);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_user_number_idx ON invoices (user_id, number);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_public_token_idx ON invoices (public_token_hash) WHERE public_token_hash IS NOT NULL;
-- One live invoice per payment term per job (the automations are idempotent on this).
CREATE UNIQUE INDEX IF NOT EXISTS invoices_project_term_live_idx ON invoices (project_id, payment_term_id)
  WHERE payment_term_id IS NOT NULL AND status <> 'void';
-- One live holdback-release / final invoice per job.
CREATE UNIQUE INDEX IF NOT EXISTS invoices_project_type_live_idx ON invoices (project_id, type)
  WHERE type IN ('final', 'holdback_release') AND status <> 'void';

CREATE TABLE IF NOT EXISTS invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  amount_cents INTEGER NOT NULL,
  method TEXT NOT NULL DEFAULT 'etransfer',
  reference TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  credit_note_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS invoice_payments_invoice_idx ON invoice_payments (invoice_id, date);

CREATE TABLE IF NOT EXISTS invoice_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  actor TEXT NOT NULL,
  detail JSONB,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS invoice_events_invoice_idx ON invoice_events (invoice_id, created_at);

CREATE TABLE IF NOT EXISTS invoice_sequences (
  user_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'INV',
  next INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, year, kind)
);
