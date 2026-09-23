-- Phase 88 (docs/OPERATIONS-PLATFORM-PLAN.md): accounting, both directions.
--  * accounting_links: "this QuoteAI thing IS that QuickBooks/Wave thing" —
--    customers and vendors matched once and reused, invoices and payments
--    known on both sides so nothing is pushed back or pulled twice.
--  * quickbooks_connections: the income account, the deposit account and the
--    sales-tax-code mapping the company picks (instead of guesses), and the
--    cursor for payments recorded in QuickBooks.
--  * flinks_transactions.matched_invoice_payment_id: a deposit matched to the
--    payment it is.
--  * books_closes: months someone marked as closed.
-- Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0049_phase88_two_way_accounting.sql

CREATE TABLE IF NOT EXISTS accounting_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  provider text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  external_id text NOT NULL,
  external_type text NOT NULL,
  origin text NOT NULL DEFAULT 'quoteai',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS accounting_links_entity_idx ON accounting_links (user_id, provider, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS accounting_links_external_idx ON accounting_links (user_id, provider, external_type, external_id);
ALTER TABLE accounting_links ENABLE ROW LEVEL SECURITY;

ALTER TABLE quickbooks_connections ADD COLUMN IF NOT EXISTS income_account jsonb;
ALTER TABLE quickbooks_connections ADD COLUMN IF NOT EXISTS deposit_account jsonb;
ALTER TABLE quickbooks_connections ADD COLUMN IF NOT EXISTS tax_code_map jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE quickbooks_connections ADD COLUMN IF NOT EXISTS pull_payments boolean NOT NULL DEFAULT true;
ALTER TABLE quickbooks_connections ADD COLUMN IF NOT EXISTS payments_cursor timestamptz;
ALTER TABLE quickbooks_connections ADD COLUMN IF NOT EXISTS payments_pulled_at timestamptz;

ALTER TABLE flinks_transactions ADD COLUMN IF NOT EXISTS matched_invoice_payment_id uuid REFERENCES invoice_payments(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS flinks_transactions_payment_idx ON flinks_transactions (matched_invoice_payment_id) WHERE matched_invoice_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS flinks_transactions_cost_idx ON flinks_transactions (matched_cost_entry_id) WHERE matched_cost_entry_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS books_closes (
  user_id text NOT NULL,
  month text NOT NULL,
  closed_at timestamptz NOT NULL DEFAULT now(),
  closed_by_name text,
  note text NOT NULL DEFAULT '',
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (user_id, month)
);
ALTER TABLE books_closes ENABLE ROW LEVEL SECURITY;
