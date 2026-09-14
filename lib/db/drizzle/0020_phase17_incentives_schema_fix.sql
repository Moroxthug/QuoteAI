-- Phase 17: migration 0015 ("Canadianize incentives_catalog") was written but
-- never actually applied against the live table — the live schema still had
-- the original Italian-market defaults/constraints (level default 'statale',
-- categoria_intervento default 'tutti', tipo_agevolazione default
-- 'detrazione_10_anni', percentuale_massima NOT NULL default 50.00), which
-- don't match lib/db/src/schema/incentives.ts. Brings the live table in line
-- with the Drizzle schema. Additive/idempotent (guarded ALTERs only).
-- Apply with: supabase db query --linked --file lib/db/drizzle/0020_phase17_incentives_schema_fix.sql

ALTER TABLE incentives_catalog ALTER COLUMN level SET DEFAULT 'federal';
ALTER TABLE incentives_catalog ALTER COLUMN categoria_intervento SET DEFAULT 'all';
ALTER TABLE incentives_catalog ALTER COLUMN tipo_agevolazione SET DEFAULT 'rebate';
ALTER TABLE incentives_catalog ALTER COLUMN percentuale_massima DROP NOT NULL;
ALTER TABLE incentives_catalog ALTER COLUMN percentuale_massima DROP DEFAULT;
