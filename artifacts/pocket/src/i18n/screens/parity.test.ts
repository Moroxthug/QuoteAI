// Every string of the phase 126 screens exists in English and in French (CLAUDE.md: EN and FR from the first commit).
import test from "node:test";
import assert from "node:assert/strict";
import * as crew from "./crew.ts";
import * as foreman from "./foreman.ts";
import * as team from "./team.ts";
import * as crewMap from "./crewMap.ts";
import * as serviceCalls from "./serviceCalls.ts";
import * as books from "./books.ts";
import * as pay from "./pay.ts";
import * as accountant from "./accountant.ts";
import * as compliance from "./compliance.ts";
import * as contracts from "./contracts.ts";
import * as priceBook from "./priceBook.ts";
import * as suppliers from "./suppliers.ts";
import * as inventory from "./inventory.ts";
import * as documents from "./documents.ts";
import * as group from "./group.ts";
import * as analytics from "./analytics.ts";

/** Dotted paths of every string, with plural suffixes folded (`open_one`, `open_other` → `open`). */
function paths(v: unknown, prefix = ""): string[] {
  if (typeof v === "string") return [prefix];
  if (Array.isArray(v)) return v.flatMap((x, i) => paths(x, `${prefix}[${i}]`));
  if (v && typeof v === "object") return Object.entries(v).flatMap(([k, x]) => paths(x, prefix ? `${prefix}.${k.replace(/_(one|other|few|many|zero)$/, "")}` : k.replace(/_(one|other|few|many|zero)$/, "")));
  return [];
}

for (const [name, ns] of Object.entries({ crew, foreman, team, crewMap, serviceCalls, books, pay, accountant, compliance, contracts, priceBook, suppliers, inventory, documents, group, analytics })) {
  test(`${name}: French has every English string, and no extras`, () => {
    const en = new Set(paths(ns.en));
    const fr = new Set(paths(ns.fr));
    assert.deepEqual([...en].filter((p) => !fr.has(p)), [], "missing in French");
    assert.deepEqual([...fr].filter((p) => !en.has(p)), [], "only in French");
  });
}

test("plural strings come in pairs", () => {
  const all = JSON.stringify([crew, foreman, team, crewMap, serviceCalls, books, pay, accountant, compliance, contracts, priceBook, suppliers, inventory, documents, group, analytics]);
  const keys = [...all.matchAll(/"([a-zA-Z]+)_one"/g)].map((m) => m[1]);
  for (const k of keys) assert.ok(all.includes(`"${k}_other"`), `${k}_other`);
});
