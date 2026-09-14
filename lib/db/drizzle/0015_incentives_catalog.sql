-- Incentives catalog: Canadian federal/provincial/municipal/utility renovation
-- rebate & grant programs (e.g. CGHAP, OHPA, provincial energy-efficiency
-- programs), plus room for a partner contractor's own custom program
-- (userId set). Never previously migrated — table did not exist in the DB.
-- Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0015_incentives_catalog.sql

CREATE TABLE IF NOT EXISTS incentives_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  level TEXT NOT NULL DEFAULT 'federal',
  codice TEXT NOT NULL,
  titolo TEXT NOT NULL,
  descrizione TEXT NOT NULL,
  province TEXT,
  city TEXT,
  categoria_intervento TEXT NOT NULL DEFAULT 'all',
  tipo_agevolazione TEXT NOT NULL DEFAULT 'rebate',
  percentuale_massima NUMERIC(5, 2),
  massimale_spesa NUMERIC(12, 2),
  massimale_contributo NUMERIC(12, 2),
  requisiti_isee_max NUMERIC(10, 2),
  income_tested BOOLEAN NOT NULL DEFAULT FALSE,
  scadenza TIMESTAMPTZ,
  stato TEXT NOT NULL DEFAULT 'active',
  fonte_ufficiale_url TEXT,
  is_verified_by_ai BOOLEAN NOT NULL DEFAULT TRUE,
  human_verified BOOLEAN NOT NULL DEFAULT FALSE,
  last_checked_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS incentives_catalog_level_idx ON incentives_catalog (level);
CREATE INDEX IF NOT EXISTS incentives_catalog_province_idx ON incentives_catalog (province);
CREATE INDEX IF NOT EXISTS incentives_catalog_user_idx ON incentives_catalog (user_id);
