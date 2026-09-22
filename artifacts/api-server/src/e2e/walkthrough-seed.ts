// Phase 77 — seeds a "field mode" showcase for the walkthrough server and
// prints what the Browser pane needs: an Elite org with an active job and a
// worker, the worker's /t link, and a signed session cookie for the dashboard
// (no sign-up/verification round trip). Shares the database with the running
// walkthrough server (E2E_NO_PURGE), and is cleaned up by walkthrough-cleanup.
//
//   pnpm --filter @workspace/api-server walkthrough              # API on :5000
//   WALKTHROUGH_FRONTEND=http://localhost:5199 pnpm --filter @workspace/api-server walkthrough:seed
//
// Then in the browser at the frontend origin: document.cookie = <printed line>.

import { resolve } from "node:path";
import { bootstrapQaEnv } from "./qaEnv.js";

process.env.E2E_NO_PURGE = "1";
process.env.LOG_LEVEL ??= "warn";
bootstrapQaEnv("walkthrough");
const FRONTEND = process.env.WALKTHROUGH_FRONTEND ?? "http://localhost:5183";
process.env.QUOTEAI_BASE_URL = FRONTEND;
process.env.BETTER_AUTH_URL = FRONTEND;

// The db module reads DATABASE_URL at import time — after bootstrapQaEnv.
const { db, projectsTable, milestonesTable, costBudgetLinesTable, costEntriesTable, invoicesTable, priceIntelligenceTable } = await import("@workspace/db");
const { makeSignature } = await import("better-auth/crypto");
const { startServer, stopServer, createOrg } = await import("./harness.js");

await startServer();
const org = await createOrg({ plan: "monthly_elite", province: "ON", companyName: "Field Mode Contracting" });
const [job] = await db.insert(projectsTable).values({ userId: org.userId, name: "Basement finish — 12 Elm St", status: "active", setupStatus: "confirmed", setupConfirmedAt: new Date(), address: "12 Elm St, Ottawa", latitude: "45.423600", longitude: "-75.700900", geofenceRadiusMeters: 300, contractValueCents: 2_450_000 }).returning();
await db.insert(milestonesTable).values([
  { userId: org.userId, projectId: job!.id, key: "framing", title: "Framing", sortOrder: 0, status: "completed", valueCents: 800_000 },
  { userId: org.userId, projectId: job!.id, key: "drywall", title: "Drywall + taping", sortOrder: 1, status: "in_progress", valueCents: 900_000 },
  { userId: org.userId, projectId: job!.id, key: "finish", title: "Trim + paint", sortOrder: 2, status: "planned", valueCents: 750_000 },
]);
const worker = await org.api("/api/team/workers", { body: { name: "Sam Tremblay", email: `sam-${org.userId.slice(-6)}@example.invalid`, hourlyRateCents: 3800 } });
if (worker.status !== 201) throw new Error(`worker: ${worker.status} ${JSON.stringify(worker.body)}`);
const invite = await org.api(`/api/team/workers/${worker.body.worker.id}/invite`, { body: {} });
if (invite.status !== 200) throw new Error(`invite: ${invite.status} ${JSON.stringify(invite.body)}`);
await org.api(`/api/jobs/${job!.id}/assignments`, { body: { workerId: worker.body.worker.id } });

// Phase 79 — money intelligence showcase: a budget the job is 92 % through,
// invoices due / overdue / scheduled, approved hours (payroll run-rate) and a
// draft quote whose lumber line drifted from the last receipts.
const day = (n: number) => new Date(Date.now() + n * 86_400_000);
await db.insert(costBudgetLinesTable).values([
  { projectId: job!.id, category: "materials", label: "Materials", plannedCents: 900_000, sortOrder: 0 },
  { projectId: job!.id, category: "labour", label: "Labour", plannedCents: 600_000, sortOrder: 1 },
]);
await db.insert(costEntriesTable).values([
  { userId: org.userId, projectId: job!.id, category: "materials", vendor: "Home Depot", description: "Drywall, mud, tape", date: day(-12), subtotalCents: 610_000, taxCents: 79_300, totalCents: 689_300, status: "confirmed", source: "manual", confirmedAt: day(-12) },
  { userId: org.userId, projectId: job!.id, category: "labour", vendor: "Crew", description: "Framing crew", date: day(-9), subtotalCents: 690_000, taxCents: 0, totalCents: 690_000, status: "confirmed", source: "manual", confirmedAt: day(-9) },
]);
for (const h of [8, 8, 7.5, 8]) await org.api(`/api/jobs/${job!.id}/time-entries`, { body: { workerId: worker.body.worker.id, date: day(-3).toISOString().slice(0, 10), hours: h, approve: true } });
await org.api(`/api/jobs/${job!.id}/time-entries`, { body: { workerId: worker.body.worker.id, date: day(-1).toISOString().slice(0, 10), hours: 8, approve: false } });
const party = { name: "Field Mode Contracting", email: org.email };
const customer = { name: "Dana Homeowner", email: "dana@example.invalid" };
await db.insert(invoicesTable).values([
  { userId: org.userId, projectId: job!.id, number: "INV-2026-0007", type: "progress", status: "sent", province: "ON", issueDate: day(-18), dueDate: day(12), contractor: party, customer, lines: [], subtotalCents: 800_000, taxableCents: 800_000, taxCents: 104_000, totalCents: 904_000, sentAt: day(-18) },
  { userId: org.userId, projectId: job!.id, number: "INV-2026-0006", type: "deposit", status: "overdue", province: "ON", issueDate: day(-50), dueDate: day(-20), contractor: party, customer, lines: [], subtotalCents: 200_000, taxableCents: 200_000, taxCents: 26_000, totalCents: 226_000, paidCents: 100_000, sentAt: day(-50) },
  { userId: org.userId, projectId: job!.id, number: "INV-2026-0008", type: "holdback_release", status: "draft", province: "ON", issueDate: day(0), dueDate: day(30), scheduledFor: day(25), contractor: party, customer, lines: [], subtotalCents: 245_000, taxableCents: 245_000, taxCents: 31_850, totalCents: 276_850 },
]);
for (const item of [{ nome: "Interior painting", um: "sqft", prezzoUnitario: 2.5 }, { nome: "Lumber 2x4 8ft", um: "ea", prezzoUnitario: 5 }]) await org.api("/api/catalog", { body: item });
await db.insert(priceIntelligenceTable).values([5.6, 5.4, 5.2, 5.4].map((p, i) => ({ userId: org.userId, workType: "Lumber 2x4", unitPrice: p.toFixed(2), unit: "ea", vendor: i % 2 ? "Rona" : "Home Depot", createdAt: day(-i) })));
const quote = await org.api("/api/quotes/manual", {
  body: {
    titoloPreventivoRiga2: "Garage framing and paint",
    capitoli: [
      { lettera: "A", titolo: "Framing", subtotale: 0, voci: [{ descrizione: "2x4 lumber, 8 ft", um: "ea", quantita: 120, prezzoUnitario: 5, totale: 0 }, { descrizione: "Site cleanup", um: "lot", quantita: 1, prezzoUnitario: 300, totale: 0 }] },
      { lettera: "B", titolo: "Finishes", subtotale: 0, voci: [{ descrizione: "Interior painting, two coats", um: "sqft", quantita: 400, prezzoUnitario: 3, totale: 0 }] },
    ],
    clientData: { nome: "Dana Homeowner", indirizzo: "12 Elm St", city: "Ottawa", province: "ON" },
  },
});
if (quote.status !== 201) throw new Error(`quote: ${quote.status} ${JSON.stringify(quote.body)}`);
console.log("[seed] quote (price check):", `${FRONTEND}/dashboard/quotes/${quote.body.id}`);

const cookieValue = `${org.token}.${await makeSignature(org.token, process.env.BETTER_AUTH_SECRET!)}`;
console.log("\n[seed] org:", org.userId, org.email);
console.log("[seed] job:", job!.id, `${FRONTEND}/dashboard/jobs/${job!.id}`);
console.log("[seed] worker page:", invite.body.url);
console.log(`[seed] cookie (run in the browser console at ${FRONTEND}):`);
console.log(`document.cookie = "better-auth.session_token=${encodeURIComponent(cookieValue)}; path=/; max-age=86400"`);
console.log(`[seed] mailbox → ${resolve(import.meta.dirname, "../../.walkthrough-mailbox.json")}`);
await stopServer();
process.exit(0);
