-- Phase 1 — Contracts & e-signature. Additive, idempotent.

CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  project_id UUID,
  contract_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  province TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  template_key TEXT NOT NULL,
  document JSONB NOT NULL,
  variables JSONB NOT NULL,
  contract_value_cents INTEGER NOT NULL DEFAULT 0,
  holdback_enabled BOOLEAN NOT NULL DEFAULT false,
  holdback_percent INTEGER NOT NULL DEFAULT 10,
  unsigned_pdf_hash TEXT,
  unsigned_pdf_url TEXT,
  signed_pdf_hash TEXT,
  signed_pdf_url TEXT,
  sent_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  void_reason TEXT,
  last_reminder_at TIMESTAMPTZ,
  reminder_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS contracts_user_idx ON contracts (user_id, created_at);
CREATE INDEX IF NOT EXISTS contracts_quote_idx ON contracts (quote_id);
CREATE INDEX IF NOT EXISTS contracts_status_idx ON contracts (status, sent_at);

CREATE TABLE IF NOT EXISTS contract_signers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  token_hash TEXT,
  token_expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  otp_hash TEXT,
  otp_expires_at TIMESTAMPTZ,
  otp_attempts INTEGER NOT NULL DEFAULT 0,
  otp_verified_at TIMESTAMPTZ,
  signature_type TEXT,
  signature_data TEXT,
  consent_text TEXT,
  signed_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  decline_reason TEXT,
  viewed_at TIMESTAMPTZ,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS contract_signers_contract_idx ON contract_signers (contract_id);
CREATE UNIQUE INDEX IF NOT EXISTS contract_signers_token_idx ON contract_signers (token_hash);

CREATE TABLE IF NOT EXISTS contract_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  signer_id UUID REFERENCES contract_signers(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  actor TEXT NOT NULL,
  detail JSONB,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS contract_events_contract_idx ON contract_events (contract_id, created_at);

CREATE TABLE IF NOT EXISTS contract_sequences (
  user_id TEXT PRIMARY KEY,
  next INTEGER NOT NULL DEFAULT 1
);
