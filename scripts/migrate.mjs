import pg from "../node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js";

const { Client } = pg;

const client = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? "5432"),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

await client.connect();
console.log("Connected to Supabase DB");

const sql = `
-- Auth tables (better-auth)
CREATE TABLE IF NOT EXISTS auth_user (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  image TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_session (
  id TEXT PRIMARY KEY,
  expires_at TIMESTAMP NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auth_account (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  access_token_expires_at TIMESTAMP,
  refresh_token_expires_at TIMESTAMP,
  scope TEXT,
  password TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_verification (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Business profiles
CREATE TABLE IF NOT EXISTS business_profiles (
  user_id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL DEFAULT '',
  vat_number TEXT,
  address TEXT,
  logo_url TEXT,
  phone TEXT,
  email TEXT,
  stripe_customer_id TEXT,
  subscription_plan TEXT,
  subscription_status TEXT,
  subscription_period_end TIMESTAMPTZ,
  trial_started_at TIMESTAMPTZ,
  trial_downloads_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Settings
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Price catalog
CREATE TABLE IF NOT EXISTS price_catalog_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  nome TEXT NOT NULL,
  categoria TEXT,
  um TEXT NOT NULL DEFAULT 'cad',
  prezzo_unitario NUMERIC(10,2) NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Quotes
CREATE TABLE IF NOT EXISTS quotes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  client_data JSONB NOT NULL DEFAULT '{"nome":"","indirizzo":""}',
  descrizione_generale TEXT NOT NULL DEFAULT '',
  items JSONB NOT NULL DEFAULT '[]',
  capitoli JSONB DEFAULT '[]',
  sconto JSONB,
  condizioni_pagamento TEXT[] DEFAULT '{}',
  titolo_preventivo_riga1 TEXT DEFAULT 'Analisi Economica e Computo Metrico Prezzato',
  titolo_preventivo_riga2 TEXT DEFAULT '',
  numero_preventivo_data TEXT DEFAULT '',
  company_snapshot JSONB,
  subtotale NUMERIC(10,2) NOT NULL DEFAULT 0,
  iva_percentuale NUMERIC(5,2) NOT NULL DEFAULT 22,
  iva_valore NUMERIC(10,2) NOT NULL DEFAULT 0,
  totale NUMERIC(10,2) NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT 'Preventivo valido 30 giorni',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','unlocked','pending_payment')),
  pdf_url TEXT,
  raw_input TEXT NOT NULL DEFAULT '',
  stripe_session_id TEXT,
  unlocked_with_plan TEXT,
  capitolato_pro BOOLEAN NOT NULL DEFAULT false,
  capitolato_pdf_url TEXT,
  template_id TEXT DEFAULT 'standard',
  pdf_downloaded_at TIMESTAMPTZ,
  source TEXT DEFAULT 'web',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quote_attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size NUMERIC(15,0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- WhatsApp
DO $$ BEGIN
  CREATE TYPE whatsapp_session_state AS ENUM (
    'awaiting_template_selection','awaiting_client_choice','awaiting_job_input',
    'awaiting_confirmation','awaiting_client_data','menu_main','menu_clients',
    'menu_template','menu_iva'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS whatsapp_connections (
  user_id TEXT PRIMARY KEY REFERENCES auth_user(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  preferences JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS whatsapp_otp (
  phone_number TEXT PRIMARY KEY,
  otp TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  phone_number TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  state whatsapp_session_state NOT NULL,
  pending_quote_data JSONB NOT NULL,
  iteration_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Documents
DO $$ BEGIN
  CREATE TYPE document_status AS ENUM ('pending','processing','done','error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS uploaded_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  status document_status NOT NULL DEFAULT 'pending',
  extracted_data JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS price_intelligence (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  work_type TEXT NOT NULL,
  unit_price TEXT NOT NULL,
  unit TEXT,
  zone TEXT,
  source_document_id UUID REFERENCES uploaded_documents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conversations & messages
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

try {
  await client.query(sql);
  console.log("✓ All tables created successfully");
} catch (err) {
  console.error("Error:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
