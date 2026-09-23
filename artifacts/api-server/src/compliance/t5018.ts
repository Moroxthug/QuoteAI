// Phase 87 — T5018 preparation: who was paid for construction services in a
// year, and how much. Two sources: confirmed costs filed under
// "subcontractor", and approved hours of workers set up as subcontractors
// (their labour cost entries). Grouped by supplier or by name.
//
// It is a list to reconcile against what was actually paid, not a slip:
// the slip needs each recipient's business number or SIN and address, which
// QuoteAI does not hold, and the reporting threshold is judged on payments
// made, which the bookkeeper has and we only approximate by entry date.

import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { db, collaboratorsTable, costEntriesTable, suppliersTable, timeEntriesTable } from "@workspace/db";
import { dayOf } from "./remittance.js";

/** CRA: slips are required for recipients paid $500 or more in the year. */
const T5018_THRESHOLD_CENTS = 50_000;

export type T5018Recipient = {
  key: string;
  name: string;
  source: "supplier" | "vendor" | "worker";
  entryCount: number;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  overThreshold: boolean;
};

export async function loadT5018(userId: string, province: string | null, year: number) {
  const lo = new Date(Date.UTC(year, 0, 1) - 86_400_000);
  const hi = new Date(Date.UTC(year + 1, 0, 1) + 86_400_000);
  const inYear = (d: Date) => dayOf(d, province).startsWith(`${year}-`);

  const subs = await db
    .select({ id: costEntriesTable.id, date: costEntriesTable.date, vendor: costEntriesTable.vendor, supplierId: costEntriesTable.supplierId, supplierName: suppliersTable.name, subtotalCents: costEntriesTable.subtotalCents, taxCents: costEntriesTable.taxCents, totalCents: costEntriesTable.totalCents })
    .from(costEntriesTable)
    .leftJoin(suppliersTable, eq(costEntriesTable.supplierId, suppliersTable.id))
    .where(and(eq(costEntriesTable.userId, userId), eq(costEntriesTable.status, "confirmed"), eq(costEntriesTable.category, "subcontractor"), gte(costEntriesTable.date, lo), lt(costEntriesTable.date, hi)));

  const labour = await db
    .select({ costEntryId: timeEntriesTable.costEntryId, date: timeEntriesTable.date, workerId: collaboratorsTable.id, workerName: collaboratorsTable.name, totalCents: costEntriesTable.totalCents, subtotalCents: costEntriesTable.subtotalCents, taxCents: costEntriesTable.taxCents })
    .from(timeEntriesTable)
    .innerJoin(collaboratorsTable, eq(timeEntriesTable.workerId, collaboratorsTable.id))
    .innerJoin(costEntriesTable, eq(timeEntriesTable.costEntryId, costEntriesTable.id))
    .where(and(eq(timeEntriesTable.userId, userId), eq(timeEntriesTable.status, "approved"), eq(collaboratorsTable.workerType, "subcontractor"), inArray(costEntriesTable.status, ["confirmed"]), gte(timeEntriesTable.date, lo), lt(timeEntriesTable.date, hi)));

  const byKey = new Map<string, T5018Recipient>();
  const seenCost = new Set<string>();
  const add = (key: string, name: string, source: T5018Recipient["source"], sub: number, tax: number, total: number) => {
    const r = byKey.get(key) ?? { key, name, source, entryCount: 0, subtotalCents: 0, taxCents: 0, totalCents: 0, overThreshold: false };
    r.entryCount += 1;
    r.subtotalCents += sub;
    r.taxCents += tax;
    r.totalCents += total;
    byKey.set(key, r);
  };

  for (const l of labour) {
    if (!inYear(l.date) || !l.costEntryId) continue;
    seenCost.add(l.costEntryId);
    add(`worker:${l.workerId}`, l.workerName, "worker", l.subtotalCents, l.taxCents, l.totalCents);
  }
  for (const c of subs) {
    if (seenCost.has(c.id) || !inYear(c.date)) continue;
    if (c.supplierId) add(`supplier:${c.supplierId}`, c.supplierName ?? c.vendor, "supplier", c.subtotalCents, c.taxCents, c.totalCents);
    else {
      const name = c.vendor.trim() || "—";
      add(`vendor:${name.toLowerCase().replace(/\s+/g, " ")}`, name, "vendor", c.subtotalCents, c.taxCents, c.totalCents);
    }
  }

  const recipients = [...byKey.values()]
    .map((r) => ({ ...r, overThreshold: r.totalCents >= T5018_THRESHOLD_CENTS }))
    .sort((a, b) => b.totalCents - a.totalCents || a.name.localeCompare(b.name));
  return {
    year,
    thresholdCents: T5018_THRESHOLD_CENTS,
    recipients,
    totalCents: recipients.reduce((s, r) => s + r.totalCents, 0),
  };
}

export function t5018Csv(data: Awaited<ReturnType<typeof loadT5018>>): string {
  const cell = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const money = (c: number) => (c / 100).toFixed(2);
  const rows: (string | number)[][] = [["recipient", "source", "entries", "pre_tax", "tax", "total", "500_or_more", "business_number_or_sin", "address"]];
  for (const r of data.recipients) rows.push([r.name, r.source, r.entryCount, money(r.subtotalCents), money(r.taxCents), money(r.totalCents), r.overThreshold ? "yes" : "no", "", ""]);
  return rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
