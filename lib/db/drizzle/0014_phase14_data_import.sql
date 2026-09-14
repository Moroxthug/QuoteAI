-- Phase 14: data migration / import (CSV/Excel + AI-assisted PDF import into a review queue).
-- Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0014_phase14_data_import.sql

CREATE TABLE IF NOT EXISTS import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  file_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  total_rows INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS import_batches_user_idx ON import_batches (user_id);

CREATE TABLE IF NOT EXISTS quote_import_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  row_index INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending_review',
  raw_row JSONB,
  extraction JSONB NOT NULL,
  matched_client_id UUID,
  created_quote_id UUID,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS quote_import_candidates_batch_idx ON quote_import_candidates (batch_id);
CREATE INDEX IF NOT EXISTS quote_import_candidates_user_status_idx ON quote_import_candidates (user_id, status);

-- New uploaded_documents.purpose value used by the PDF-import path: 'import_pdf'.
-- No DDL needed — that column is plain TEXT with no CHECK constraint (see 0004).
