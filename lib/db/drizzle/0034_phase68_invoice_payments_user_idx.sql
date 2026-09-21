-- Phase 68: company analytics reads invoice_payments by (user_id, date >= since);
-- the only index was (invoice_id, date), so the query scanned every payment row
-- of every account. Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0034_phase68_invoice_payments_user_idx.sql

CREATE INDEX IF NOT EXISTS invoice_payments_user_date_idx ON invoice_payments (user_id, date);
