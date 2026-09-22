// Phase 79 — money intelligence end to end: the quote price check against
// catalog + learned receipt prices with one-click reprice (and its edit
// lock), the 60-day cash-flow outlook (Elite gate, every source counted),
// and the 90 % / 100 % budget alerts (live on cost confirmation, once per
// crossing, re-armed by the daily sweep when costs drop back under).

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { and, desc, eq } from "drizzle-orm";
import { db, invoicesTable, milestonesTable, notificationsTable, priceIntelligenceTable, projectsTable, quotesTable, timeEntriesTable, costEntriesTable } from "@workspace/db";
import { runBudgetAlertSweep } from "../jobs/budgetAlerts.js";
import { startServer, stopServer, createOrg, cleanupAll, daysFromNow, daysAgo } from "./harness.js";

const iso = (d: Date) => d.toISOString().slice(0, 10);

async function notificationsOf(userId: string, type: string) {
  return db.select().from(notificationsTable).where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.type, type))).orderBy(desc(notificationsTable.createdAt));
}

async function waitFor<T>(probe: () => Promise<T | null | undefined | false>, label: string, timeoutMs = 8_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const v = await probe();
    if (v) return v;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 150));
  }
}

describe("Money intelligence (Phase 79)", () => {
  beforeAll(async () => {
    await startServer();
  });
  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });

  test("price check: catalog + learned receipt prices flag drifting lines; reprice recomputes totals; locked after download", async () => {
    const org = await createOrg({ companyName: "Price Co" });
    // Catalog: painting at $2.50/sqft; lumber at $5.00 each (the quote will use $5.00 too).
    for (const item of [
      { nome: "Interior painting", um: "sqft", prezzoUnitario: 2.5 },
      { nome: "Lumber 2x4 8ft", um: "ea", prezzoUnitario: 5 },
      { nome: "Site cleanup", um: "lot", prezzoUnitario: 999 },
    ]) {
      expect((await org.api("/api/catalog", { body: item })).status).toBe(201);
    }
    // Four receipt samples for lumber (≥ 3 needed) averaging $5.40 — the learned price outranks the $5.00 catalog entry.
    await db.insert(priceIntelligenceTable).values(
      [5.6, 5.4, 5.2, 5.4].map((p, i) => ({ userId: org.userId, workType: "Lumber 2x4", unitPrice: p.toFixed(2), unit: "ea", vendor: i % 2 ? "Rona" : "Home Depot", createdAt: daysAgo(i) })),
    );
    // Two drywall samples only → not enough to become a reference.
    await db.insert(priceIntelligenceTable).values([{ userId: org.userId, workType: "Drywall sheet", unitPrice: "20.00", unit: "sheet" }, { userId: org.userId, workType: "Drywall sheet", unitPrice: "21.00", unit: "sheet" }]);

    const created = await org.api("/api/quotes/manual", {
      body: {
        capitoli: [
          { lettera: "A", titolo: "Framing", subtotale: 0, voci: [
            { descrizione: "2x4 lumber, 8 ft", um: "ea", quantita: 100, prezzoUnitario: 5, totale: 0 },
            { descrizione: "Drywall sheets", um: "sheet", quantita: 40, prezzoUnitario: 15, totale: 0 },
            { descrizione: "Site cleanup", um: "lot", quantita: 1, prezzoUnitario: 300, totale: 0 },
          ] },
          { lettera: "B", titolo: "Finishes", subtotale: 0, voci: [
            { descrizione: "Interior painting, two coats", um: "sqft", quantita: 200, prezzoUnitario: 3, totale: 0 },
          ] },
        ],
        clientData: { nome: "Pat Client", indirizzo: "1 Main St", city: "Ottawa", province: "ON" },
      },
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const quoteId = created.body.id as string;
    expect(created.body.subtotale).toBe(500 + 600 + 300 + 600);
    expect(created.body.totale).toBe(2260); // 13 % HST

    const check = await org.api(`/api/quotes/${quoteId}/price-check`);
    expect(check.status, JSON.stringify(check.body)).toBe(200);
    expect(check.body).toMatchObject({ editable: true, thresholdPct: 5, linesChecked: 4, references: 4 });
    expect(check.body.findings.map((f: any) => [f.chapter, f.index, f.source, f.referenceUnitPrice, f.changePct, f.deltaTotal, f.sampleCount])).toEqual([
      ["A", 0, "receipts", 5.4, 8, 40, 4],
      ["B", 0, "catalog", 2.5, -16.7, -100, 1],
    ]);
    expect(check.body.findings[0].vendor).toBeTruthy();
    expect(check.body.deltaTotal).toBe(-60);

    // Unknown line → 400; a real one is repriced and every total moves.
    expect((await org.api(`/api/quotes/${quoteId}/reprice`, { body: { items: [{ chapter: "Z", index: 0, unitPrice: 1 }] } })).status).toBe(400);
    const repriced = await org.api(`/api/quotes/${quoteId}/reprice`, { body: { items: [{ chapter: "A", index: 0, unitPrice: 5.4 }] } });
    expect(repriced.status, JSON.stringify(repriced.body)).toBe(200);
    expect(repriced.body).toMatchObject({ applied: 1, totale: { from: 2260, to: 2305.2 } });
    expect(repriced.body.quote.capitoli[0].voci[0]).toMatchObject({ prezzoUnitario: 5.4, totale: 540 });
    expect(repriced.body.quote.capitoli[0].subtotale).toBe(1440);
    expect(repriced.body.quote.subtotale).toBe(2040);
    expect(repriced.body.quote.ivaValore).toBe(265.2);

    // Only the painting line is left flagged now.
    const again = await org.api(`/api/quotes/${quoteId}/price-check`);
    expect(again.body.findings.map((f: any) => f.chapter)).toEqual(["B"]);

    // Another company sees nothing of it; a downloaded quote is read-only.
    const other = await createOrg({ companyName: "Other Co" });
    expect((await other.api(`/api/quotes/${quoteId}/price-check`)).status).toBe(404);
    await db.update(quotesTable).set({ pdfDownloadedAt: new Date() }).where(eq(quotesTable.id, quoteId));
    expect((await org.api(`/api/quotes/${quoteId}/price-check`)).body.editable).toBe(false);
    const locked = await org.api(`/api/quotes/${quoteId}/reprice`, { body: { items: [{ chapter: "B", index: 0, unitPrice: 2.5 }] } });
    expect(locked.status).toBe(400);
    expect(locked.body.error).toBe("LOCKED");
  });

  test("cash-flow outlook: Elite only; open + scheduled invoices, milestone terms, budgets and payroll all land in the right weeks", async () => {
    const pro = await createOrg({ plan: "monthly_pro" });
    const gated = await pro.api("/api/analytics/cash-flow");
    expect(gated.status).toBe(403);
    expect(gated.body).toMatchObject({ error: "PLAN_REQUIRED", requiredPlan: "monthly_elite" });

    const org = await createOrg({ companyName: "Cash Co" });
    const empty = await org.api("/api/analytics/cash-flow");
    expect(empty.status, JSON.stringify(empty.body)).toBe(200);
    expect(empty.body).toMatchObject({ days: 60, totals: { inCents: 0, outCents: 0, netCents: 0 }, budgetAlerts: [] });
    expect(empty.body.weeks).toHaveLength(9);

    // An active job: $10,000 budget (labour 4,000 + materials 6,000), $1,000 materials spent, a milestone term of $3,000 due in 3 weeks.
    const job = await org.api("/api/jobs", { body: { name: "Garage build", address: "9 Side Rd", plannedStart: iso(daysAgo(7)), plannedEnd: iso(daysFromNow(35)) } });
    expect(job.status, JSON.stringify(job.body)).toBe(201);
    const jobId = job.body.job.id as string;
    expect((await org.api(`/api/jobs/${jobId}/budget`, { method: "PUT", body: { lines: [{ category: "labour", plannedCents: 400_000 }, { category: "materials", plannedCents: 600_000 }] } })).status).toBe(200);
    expect((await org.api(`/api/jobs/${jobId}/costs`, { body: { category: "materials", vendor: "Rona", totalCents: 100_000, subtotalCents: 100_000 } })).status).toBe(201);
    const ms = await org.api(`/api/jobs/${jobId}/milestones`, { body: { title: "Roof on", plannedEnd: iso(daysFromNow(21)) } });
    expect(ms.status).toBe(201);
    await db.update(milestonesTable).set({ paymentAmountCents: 300_000, paymentTermId: "t2" }).where(eq(milestonesTable.id, ms.body.milestone.id));

    // Payroll: a worker at $40/h + 10 % burden; 20 h approved last week (run-rate) and 8 h submitted, not yet approved (owed now).
    const worker = (await org.api("/api/team/workers", { body: { name: "Sam Framer", hourlyRateCents: 4_000, burdenPercent: 10 } })).body.worker;
    expect((await org.api(`/api/jobs/${jobId}/time-entries`, { body: { workerId: worker.id, date: iso(daysAgo(5)), hours: 20, approve: true } })).status).toBe(201);
    expect((await org.api(`/api/jobs/${jobId}/time-entries`, { body: { workerId: worker.id, date: iso(daysAgo(1)), hours: 8, approve: false } })).status).toBe(201);

    // Invoices: $2,000 due in 10 days, $500 overdue, a $1,500 draft holdback release scheduled in 20 days with 30-day terms, a void one ignored.
    const party = { name: "Cash Co" };
    const customer = { name: "Pat Client" };
    await db.insert(invoicesTable).values([
      { userId: org.userId, projectId: jobId, number: "INV-2026-0001", type: "progress", status: "sent", province: "ON", issueDate: daysAgo(20), dueDate: daysFromNow(10), contractor: party, customer, lines: [], subtotalCents: 200_000, taxableCents: 200_000, taxCents: 0, totalCents: 200_000, sentAt: daysAgo(20) },
      { userId: org.userId, projectId: jobId, number: "INV-2026-0002", type: "progress", status: "overdue", province: "ON", issueDate: daysAgo(60), dueDate: daysAgo(30), contractor: party, customer, lines: [], subtotalCents: 50_000, taxableCents: 50_000, taxCents: 0, totalCents: 50_000, sentAt: daysAgo(60) },
      { userId: org.userId, projectId: jobId, number: "INV-2026-0003", type: "holdback_release", status: "draft", province: "ON", issueDate: daysAgo(1), dueDate: daysFromNow(29), scheduledFor: daysFromNow(20), contractor: party, customer, lines: [], subtotalCents: 150_000, taxableCents: 150_000, taxCents: 0, totalCents: 150_000 },
      { userId: org.userId, projectId: jobId, number: "INV-2026-0004", type: "manual", status: "void", province: "ON", issueDate: daysAgo(1), dueDate: daysFromNow(5), contractor: party, customer, lines: [], subtotalCents: 999_999, taxableCents: 999_999, taxCents: 0, totalCents: 999_999 },
    ]);

    const out = await org.api("/api/analytics/cash-flow");
    expect(out.status, JSON.stringify(out.body)).toBe(200);
    const labourCents = (h: number) => Math.round(h * 4_000 * 1.1);
    expect(out.body.sources).toEqual({ openInvoices: 2, overdueInvoices: 1, scheduledInvoices: 1, upcomingTerms: 1, activeJobs: 1, payrollWeeklyCents: Math.round(labourCents(20) / 4), payrollPendingCents: labourCents(8) });
    const weeks = out.body.weeks as { overdueCents: number; dueCents: number; scheduledCents: number; expectedCents: number; outflowCents: number; payrollCents: number; cumulativeCents: number }[];
    const sum = (k: keyof (typeof weeks)[number]) => weeks.reduce((s, w) => s + w[k], 0);
    expect(weeks[0]!.overdueCents).toBe(50_000);
    expect(sum("dueCents")).toBe(200_000);
    expect(sum("expectedCents")).toBe(300_000);
    expect(sum("scheduledCents")).toBe(150_000); // 20 + 30 days = day 50, inside the window
    // Materials budget left (6,000 − 1,000) spread over the job's remaining weeks; the labour budget is replaced by the payroll run-rate.
    expect(sum("outflowCents")).toBeGreaterThanOrEqual(499_000);
    expect(sum("outflowCents")).toBeLessThanOrEqual(501_000);
    expect(weeks[0]!.payrollCents).toBe(labourCents(8) + Math.round(labourCents(20) / 4));
    expect(weeks.filter((w) => w.payrollCents > 0).length).toBeGreaterThanOrEqual(5); // until the planned end (5 weeks out)
    expect(out.body.totals.inCents).toBe(50_000 + 200_000 + 300_000 + 150_000);
    expect(out.body.totals.outCents).toBe(sum("outflowCents") + sum("payrollCents"));
    expect(out.body.totals.netCents).toBe(out.body.totals.inCents - out.body.totals.outCents);
    expect(weeks[8]!.cumulativeCents).toBe(out.body.totals.netCents);
    // The labour cost from the approved hours (2,000 × 1.1 = 8,800 → $88) plus $1,000 materials = 10.9 % of budget: no alert yet.
    expect(out.body.budgetAlerts).toEqual([]);
  });

  test("budget alerts: 90 % then 100 % once each, re-armed when costs drop back, sweep is idempotent", async () => {
    const org = await createOrg({ companyName: "Budget Co" });
    const job = await org.api("/api/jobs", { body: { name: "Deck rebuild", address: "3 Lake Dr" } });
    const jobId = job.body.job.id as string;
    expect((await org.api(`/api/jobs/${jobId}/budget`, { method: "PUT", body: { lines: [{ category: "materials", plannedCents: 100_000 }] } })).status).toBe(200);

    // 85 % → nothing.
    const c1 = await org.api(`/api/jobs/${jobId}/costs`, { body: { category: "materials", vendor: "Rona", totalCents: 85_000, subtotalCents: 85_000 } });
    expect(c1.status).toBe(201);
    await new Promise((r) => setTimeout(r, 400));
    expect(await notificationsOf(org.userId, "budget_alert")).toHaveLength(0);

    // 92 % → one alert with the numbers, stamped on the job, pushed type.
    const c2 = await org.api(`/api/jobs/${jobId}/costs`, { body: { category: "materials", vendor: "Rona", totalCents: 7_000, subtotalCents: 7_000 } });
    expect(c2.status).toBe(201);
    const alert = await waitFor(async () => (await notificationsOf(org.userId, "budget_alert"))[0], "90 % alert");
    expect(alert.title).toBe("Deck rebuild: 92 % of the cost budget used");
    expect(alert.body).toContain("$920.00 of the $1,000.00 budget — $80.00 left");
    expect(alert).toMatchObject({ link: `/dashboard/jobs/${jobId}`, entityType: "project", entityId: jobId });
    let [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, jobId));
    expect(project!.budgetAlert90At).toBeTruthy();
    expect(project!.budgetAlert100At).toBeNull();

    // Still under 100 %: another cost, the sweep, nothing new.
    expect((await org.api(`/api/jobs/${jobId}/costs`, { body: { category: "materials", totalCents: 1_000, subtotalCents: 1_000 } })).status).toBe(201);
    await new Promise((r) => setTimeout(r, 400));
    await runBudgetAlertSweep();
    expect(await notificationsOf(org.userId, "budget_alert")).toHaveLength(1);
    expect(await notificationsOf(org.userId, "budget_exceeded")).toHaveLength(0);

    // Over: one "exceeded" alert. It shows on the dashboard outlook too.
    const c4 = await org.api(`/api/jobs/${jobId}/costs`, { body: { category: "materials", totalCents: 12_000, subtotalCents: 12_000 } });
    expect(c4.status).toBe(201);
    const over = await waitFor(async () => (await notificationsOf(org.userId, "budget_exceeded"))[0], "100 % alert");
    expect(over.title).toBe("Deck rebuild is over its cost budget");
    expect(over.body).toContain("$1,050.00 against a $1,000.00 budget (105 %) — $50.00 over");
    const outlook = await org.api("/api/analytics/cash-flow");
    expect(outlook.body.budgetAlerts).toEqual([{ id: jobId, name: "Deck rebuild", pct: 105, level: 100 }]);

    // Remove the last cost → back to 93 %: the sweep re-arms the 100 % stamp, keeps the 90 % one, sends nothing.
    await db.delete(costEntriesTable).where(eq(costEntriesTable.id, c4.body.entry.id));
    await runBudgetAlertSweep();
    [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, jobId));
    expect(project!.budgetAlert100At).toBeNull();
    expect(project!.budgetAlert90At).toBeTruthy();
    expect(await notificationsOf(org.userId, "budget_exceeded")).toHaveLength(1);

    // Cross 100 % again → a second "exceeded" (one per crossing).
    expect((await org.api(`/api/jobs/${jobId}/costs`, { body: { category: "materials", totalCents: 20_000, subtotalCents: 20_000 } })).status).toBe(201);
    await waitFor(async () => (await notificationsOf(org.userId, "budget_exceeded")).length === 2 || null, "second 100 % alert");

    // Budget raised well above the actuals → both stamps cleared by the sweep; a job without a budget never alerts.
    expect((await org.api(`/api/jobs/${jobId}/budget`, { method: "PUT", body: { lines: [{ category: "materials", plannedCents: 1_000_000 }] } })).status).toBe(200);
    await runBudgetAlertSweep();
    [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, jobId));
    expect(project!.budgetAlert90At).toBeNull();
    expect(project!.budgetAlert100At).toBeNull();
    const noBudget = await org.api("/api/jobs", { body: { name: "No budget job", address: "x" } });
    expect((await org.api(`/api/jobs/${noBudget.body.job.id}/costs`, { body: { category: "misc", totalCents: 500_000, subtotalCents: 500_000 } })).status).toBe(201);
    await new Promise((r) => setTimeout(r, 400));
    const sweep = await runBudgetAlertSweep();
    expect(sweep.alertsCreated).toBe(0);
    expect(await notificationsOf(org.userId, "budget_alert")).toHaveLength(1);
    expect(await notificationsOf(org.userId, "budget_exceeded")).toHaveLength(2);

    // Approved hours count too (labour lands in cost_entries through syncLabourCost).
    const w = (await org.api("/api/team/workers", { body: { name: "Lee", hourlyRateCents: 10_000, burdenPercent: 0 } })).body.worker;
    const small = await org.api("/api/jobs", { body: { name: "Fence", address: "y" } });
    const smallId = small.body.job.id as string;
    expect((await org.api(`/api/jobs/${smallId}/budget`, { method: "PUT", body: { lines: [{ category: "labour", plannedCents: 100_000 }] } })).status).toBe(200);
    expect((await org.api(`/api/jobs/${smallId}/time-entries`, { body: { workerId: w.id, date: iso(daysAgo(1)), hours: 9.5, approve: true } })).status).toBe(201);
    const labourAlert = await waitFor(async () => (await notificationsOf(org.userId, "budget_alert")).find((n) => n.entityId === smallId), "labour 90 % alert");
    expect(labourAlert.title).toBe("Fence: 95 % of the cost budget used");
    const entries = await db.select().from(timeEntriesTable).where(eq(timeEntriesTable.projectId, smallId));
    expect(entries[0]!.costEntryId).toBeTruthy();
  });
});
