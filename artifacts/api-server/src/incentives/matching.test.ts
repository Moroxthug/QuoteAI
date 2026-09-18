// vitest suite (Phase 61): the assertions below were a plain node:assert script; now run by `pnpm test`.
import assert from "node:assert/strict";
import { inferInterventionCategories, matchIncentivesForQuote } from "./matching.js";
import type { IncentiveCatalogItem } from "@workspace/db";
import { test } from "vitest";

test("incentives/matching", () => {

  // Category inference from free text.
  assert.deepEqual(inferInterventionCategories("Installing a new heat pump and ductwork"), ["heat_pump"]);
  assert.deepEqual(inferInterventionCategories("New windows and attic insulation upgrade").sort(), ["insulation", "windows_doors"]);
  assert.deepEqual(inferInterventionCategories("Repainting the fence"), []);

  function item(overrides: Partial<IncentiveCatalogItem>): IncentiveCatalogItem {
    return {
      id: "id",
      userId: null,
      level: "federal",
      codice: "TEST",
      titolo: "Test program",
      descrizione: "desc",
      province: null,
      city: null,
      categoriaIntervento: "all",
      tipoAgevolazione: "rebate",
      percentualeMassima: null,
      massimaleSpesa: null,
      massimaleContributo: null,
      requisitiIseeMax: null,
      incomeTested: false,
      scadenza: null,
      stato: "active",
      fonteUfficialeUrl: null,
      isVerifiedByAi: true,
      humanVerified: false,
      lastCheckedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    } as IncentiveCatalogItem;
  }

  const catalog: IncentiveCatalogItem[] = [
    item({ codice: "FEDERAL_ALL", level: "federal", province: null, categoriaIntervento: "all" }),
    item({ codice: "ON_HEAT_PUMP", level: "provincial", province: "ON", categoriaIntervento: "heat_pump" }),
    item({ codice: "QC_INSULATION", level: "provincial", province: "QC", categoriaIntervento: "insulation" }),
    item({ codice: "ON_ENBRIDGE_CITY", level: "utility", province: "ON", city: "Toronto", categoriaIntervento: "energy_efficiency" }),
    item({ codice: "CLOSED_PROGRAM", level: "federal", province: null, categoriaIntervento: "all", stato: "closed" }),
  ];

  // Ontario heat-pump quote: federal (region-less) + ON heat-pump match, QC and closed program excluded.
  assert.deepEqual(
    matchIncentivesForQuote(catalog, { province: "ON", categories: ["heat_pump"] }).map((i) => i.codice).sort(),
    ["FEDERAL_ALL", "ON_HEAT_PUMP"],
  );

  // Municipal/utility program only matches when the city also matches.
  assert.deepEqual(
    matchIncentivesForQuote(catalog, { province: "ON", city: "Ottawa", categories: ["energy_efficiency"] }).map((i) => i.codice),
    ["FEDERAL_ALL"],
  );
  assert.deepEqual(
    matchIncentivesForQuote(catalog, { province: "ON", city: "Toronto", categories: ["energy_efficiency"] }).map((i) => i.codice).sort(),
    ["FEDERAL_ALL", "ON_ENBRIDGE_CITY"],
  );

  // Quebec quote never sees Ontario-only programs.
  assert.deepEqual(
    matchIncentivesForQuote(catalog, { province: "QC", categories: ["insulation"] }).map((i) => i.codice).sort(),
    ["FEDERAL_ALL", "QC_INSULATION"],
  );

  // No category match beyond "all" still surfaces the federal catch-all.
  assert.deepEqual(
    matchIncentivesForQuote(catalog, { province: "ON", categories: [] }).map((i) => i.codice),
    ["FEDERAL_ALL"],
  );
});
