-- Phase 22: Good/Better/Best tiered quotes.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0025_phase22_quote_variants.sql

CREATE TABLE IF NOT EXISTS quote_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  label text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  "position" integer NOT NULL DEFAULT 0,
  items jsonb NOT NULL DEFAULT '[]',
  capitoli jsonb DEFAULT '[]',
  sconto jsonb,
  condizioni_pagamento text[] DEFAULT '{}',
  subtotale numeric(10, 2) NOT NULL DEFAULT 0,
  iva_percentuale numeric(5, 2) NOT NULL DEFAULT 22,
  iva_valore numeric(10, 2) NOT NULL DEFAULT 0,
  totale numeric(10, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quote_variants_quote_id_idx ON quote_variants (quote_id);

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS accepted_variant_id uuid;
