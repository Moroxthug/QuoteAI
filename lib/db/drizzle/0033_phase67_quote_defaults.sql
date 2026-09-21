-- Phase 67: the quotes table still carried Italian-era column defaults
-- ("Analisi Economica e Computo Metrico Prezzato", "Preventivo valido 30
-- giorni", 22 % VAT). Every app code path sets these explicitly, but any row
-- inserted without them (fixtures, future scripts, a missed field) surfaced
-- Italian on the customer-facing quote page. Defaults only — no data change.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0033_phase67_quote_defaults.sql

ALTER TABLE quotes ALTER COLUMN titolo_preventivo_riga1 SET DEFAULT 'Project Quote & Itemized Estimate';
ALTER TABLE quotes ALTER COLUMN note SET DEFAULT 'Quote valid for 30 days';
ALTER TABLE quotes ALTER COLUMN iva_percentuale SET DEFAULT 0;
ALTER TABLE quote_variants ALTER COLUMN iva_percentuale SET DEFAULT 0;
