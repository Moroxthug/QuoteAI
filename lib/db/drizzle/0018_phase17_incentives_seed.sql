-- Phase 17: starting catalog of major Canadian federal/provincial/utility
-- renovation rebate & grant programs. Hand-curated, not scraped — flagged
-- is_verified_by_ai = false / human_verified = false on insert so an admin
-- reviews each one against its official source before treating it as fully
-- trustworthy; the daily freshness cron (see incentives/maintenance.ts) will
-- start rechecking fonte_ufficiale_url from the next run onward.
-- Idempotent: skips any codice that already exists.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0018_phase17_incentives_seed.sql

INSERT INTO incentives_catalog (
  level, codice, titolo, descrizione, province, city, categoria_intervento,
  tipo_agevolazione, percentuale_massima, massimale_spesa, massimale_contributo,
  income_tested, stato, fonte_ufficiale_url, is_verified_by_ai, human_verified
)
SELECT * FROM (VALUES
  ('federal', 'CGHAP', 'Canada Greener Homes Affordability Program',
   'Federal program offering free energy-efficiency upgrades (insulation, air sealing, windows/doors) to low- and moderate-income homeowners, delivered through provincial/territorial delivery partners.',
   NULL, NULL, 'insulation', 'no_cost_direct_install', NULL::numeric(5,2), NULL, NULL,
   TRUE, 'active', 'https://natural-resources.canada.ca/energy-efficiency/homes/canada-greener-homes-initiative/canada-greener-homes-affordability-program/25010',
   FALSE, FALSE),

  ('federal', 'HATC', 'Home Accessibility Tax Credit',
   'Federal non-refundable tax credit for accessibility renovations (ramps, grab bars, walk-in tubs, widened doorways) for seniors or persons eligible for the Disability Tax Credit.',
   NULL, NULL, 'accessibility', 'tax_credit', NULL::numeric(5,2), 20000.00, 3000.00,
   FALSE, 'active', 'https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-31285-home-accessibility-expenses.html',
   FALSE, FALSE),

  ('provincial', 'ON_HOME_RENO_SAVINGS', 'Ontario Home Renovation Savings Program',
   'Ontario program (delivered with Enbridge Gas and Save on Energy) offering rebates on home energy upgrades such as insulation, heat pumps, and smart thermostats for Ontario homeowners.',
   'ON', NULL, 'energy_efficiency', 'rebate', NULL::numeric(5,2), NULL, 10000.00,
   FALSE, 'active', 'https://www.homerenovationsavings.ca/',
   FALSE, FALSE),

  ('provincial', 'ON_HEAT_PUMP_REBATE', 'Ontario Cold Climate Heat Pump Rebate',
   'Rebate toward the cost of installing a cold-climate air-source or ground-source heat pump for eligible Ontario homes replacing an oil, propane, or electric resistance heating system.',
   'ON', NULL, 'heat_pump', 'rebate', NULL::numeric(5,2), NULL, 7100.00,
   FALSE, 'active', 'https://www.homerenovationsavings.ca/',
   FALSE, FALSE),

  ('provincial', 'QC_RENOCLIMAT', 'Rénoclimat',
   'Québec provincial program (in partnership with Transition énergétique Québec) offering rebates for energy-efficiency renovations following an energy evaluation — insulation, air sealing, windows, heating systems.',
   'QC', NULL, 'energy_efficiency', 'rebate', NULL::numeric(5,2), NULL, 5475.00,
   FALSE, 'active', 'https://www.transitionenergetique.gouv.qc.ca/en/residential/programs/renoclimat',
   FALSE, FALSE),

  ('provincial', 'QC_CHAUFFEZ_VERT', 'Chauffez vert',
   'Québec program offering a grant to homeowners who replace an oil or propane heating system with a certified low-emission heating system such as a heat pump.',
   'QC', NULL, 'heat_pump', 'direct_grant', NULL::numeric(5,2), NULL, 1275.00,
   FALSE, 'active', 'https://www.transitionenergetique.gouv.qc.ca/en/residential/programs/chauffez-vert',
   FALSE, FALSE),

  ('provincial', 'BC_CLEANBC_BETTER_HOMES', 'CleanBC Better Homes Renovation Rebates',
   'British Columbia rebates for energy-efficient home upgrades including heat pumps, insulation, and windows/doors, stackable with utility rebates from BC Hydro and FortisBC.',
   'BC', NULL, 'heat_pump', 'rebate', NULL::numeric(5,2), NULL, 3000.00,
   FALSE, 'active', 'https://betterhomesbc.ca/rebates/',
   FALSE, FALSE),

  ('utility', 'ON_ENBRIDGE_HOME_EFFICIENCY', 'Enbridge Gas Home Efficiency Rebate Plus',
   'Enbridge Gas rebate for Ontario natural-gas customers upgrading insulation, air sealing, and high-efficiency heating equipment, typically combined with provincial programs.',
   'ON', NULL, 'insulation', 'rebate', NULL::numeric(5,2), NULL, 5000.00,
   FALSE, 'active', 'https://www.enbridgegas.com/energy-savings/homes/home-efficiency-rebate-plus',
   FALSE, FALSE),

  ('utility', 'BC_HYDRO_EFFICIENCY', 'BC Hydro Energy Savings Rebates',
   'BC Hydro rebates on qualifying electric heat pumps, insulation, and windows for residential customers, stackable with CleanBC provincial rebates.',
   'BC', NULL, 'windows_doors', 'rebate', NULL::numeric(5,2), NULL, 1000.00,
   FALSE, 'active', 'https://www.bchydro.com/powersmart/residential/rebates.html',
   FALSE, FALSE),

  ('utility', 'QC_HYDRO_QUEBEC_RENO', 'Hydro-Québec Résidentiel Rénovation',
   'Hydro-Québec rebate program for insulation and window upgrades in existing homes, intended to be combined with the provincial Rénoclimat program.',
   'QC', NULL, 'windows_doors', 'rebate', NULL::numeric(5,2), NULL, 2000.00,
   FALSE, 'active', 'https://www.hydroquebec.com/residential/energy-wise/renovation/',
   FALSE, FALSE)
) AS seed(level, codice, titolo, descrizione, province, city, categoria_intervento, tipo_agevolazione, percentuale_massima, massimale_spesa, massimale_contributo, income_tested, stato, fonte_ufficiale_url, is_verified_by_ai, human_verified)
WHERE NOT EXISTS (
  SELECT 1 FROM incentives_catalog existing WHERE existing.codice = seed.codice
);
