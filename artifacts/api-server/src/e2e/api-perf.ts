// Phase 68 — API latency under a realistic account: 500 quotes (≈120 clients),
// 50 jobs with milestones, costs and invoices. Boots the real app on an
// ephemeral port against the staging database, seeds by direct insert, then
// samples every read endpoint the dashboard hits and reports p50/p95/max and
// the payload size. Exit 1 when a p95 is over its budget.
//
//   pnpm --filter @workspace/api-server qa:perf
//   pnpm --filter @workspace/api-server qa:perf -- --samples=40 --quotes=1000 --jobs=100
//
// Numbers are for a local Node process talking to the remote Supabase
// Postgres (one region hop per query, ~10–40 ms) — Vercel-to-Supabase is in
// the same ballpark. What matters is the shape: a p95 that scales with the
// row count is a missing index or an N+1, a big payload is over-fetching.

import { bootstrapQaEnv } from "./qaEnv.js";

process.env.LOG_LEVEL ??= "warn";
bootstrapQaEnv("qa-perf");

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const args = new Map<string, string>();
for (const a of process.argv.slice(2)) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (m) args.set(m[1]!, m[2] ?? "true");
}
const SAMPLES = Number(args.get("samples") ?? 20);
const QUOTES = Number(args.get("quotes") ?? 500);
const JOBS = Number(args.get("jobs") ?? 50);
const OUT = resolve(import.meta.dirname, "../../.qa/perf");

const { installVendorStubs } = await import("./vendorStub.js");
installVendorStubs();
const { db, quotesTable, clientsTable, projectsTable, milestonesTable, costEntriesTable, invoicesTable, invoicePaymentsTable, contractsTable } = await import("@workspace/db");
const { startServer, stopServer, createOrg, cleanupAll, daysAgo, daysFromNow, api } = await import("./harness.js");

// ── Seed ─────────────────────────────────────────────────────────────────────
const FIRST = ["Jordan", "Alex", "Sam", "Taylor", "Morgan", "Casey", "Riley", "Jamie", "Avery", "Quinn", "Drew", "Reese"];
const LAST = ["Tremblay", "Gagnon", "Roy", "Côté", "Bouchard", "Smith", "Brown", "Wilson", "Martin", "Lee"];
const STATUSES = ["draft", "unlocked", "unlocked", "accepted", "pending_payment"] as const;

function chapters(seed: number) {
  const lines = 6 + (seed % 7); // 6–12 lines over two chapters
  const voci = Array.from({ length: lines }, (_, i) => {
    const q = 1 + ((seed + i) % 9);
    const p = 120 + ((seed * 7 + i * 13) % 900);
    return { descrizione: `Line item ${i + 1} — supply and install, incl. prep and cleanup`, quantita: q, um: i % 3 ? "sq ft" : "lot", prezzoUnitario: p, totale: q * p };
  });
  const half = Math.ceil(voci.length / 2);
  const a = voci.slice(0, half);
  const b = voci.slice(half);
  const sum = (v: typeof voci) => v.reduce((s, x) => s + x.totale, 0);
  return { capitoli: [{ lettera: "A", titolo: "Demolition and prep", subtotale: sum(a), voci: a }, { lettera: "B", titolo: "Finishing", subtotale: sum(b), voci: b }], subtotal: sum(voci) };
}

async function seed(userId: string) {
  const t0 = Date.now();
  const clientCount = Math.max(1, Math.round(QUOTES / 4));
  const quoteRows = Array.from({ length: QUOTES }, (_, i) => {
    const c = i % clientCount;
    const name = `${FIRST[c % FIRST.length]} ${LAST[Math.floor(c / FIRST.length) % LAST.length]}${c >= FIRST.length * LAST.length ? ` ${c}` : ""}`;
    const { capitoli, subtotal } = chapters(i);
    const tax = Math.round(subtotal * 0.13 * 100) / 100;
    return {
      userId,
      province: "ON" as const,
      clientData: { nome: name, indirizzo: `${100 + c} Client Ave`, city: "Ottawa", province: "ON", postalCode: "K1A 0B1", email: `client${c}@e2e-test.invalid`, phone: `613555${String(c).padStart(4, "0")}` },
      descrizioneGenerale: `Renovation job #${i + 1}`,
      rawInput: `Renovation job #${i + 1}: ${capitoli[0]!.voci.length + capitoli[1]!.voci.length} lines, ON, HST.`,
      capitoli,
      condizioniPagamento: ["30% deposit upon signing", "40% at start of work", "30% upon completion"],
      subtotale: String(subtotal),
      ivaPercentuale: "13",
      ivaValore: String(tax),
      totale: String(Math.round((subtotal + tax) * 100) / 100),
      status: STATUSES[i % STATUSES.length],
      createdAt: daysAgo(i % 400),
      archivedAt: i % 25 === 24 ? daysAgo(3) : null,
    };
  });
  for (let i = 0; i < quoteRows.length; i += 100) await db.insert(quotesTable).values(quoteRows.slice(i, i + 100));

  const clients = await db.insert(clientsTable).values(
    Array.from({ length: Math.min(clientCount, JOBS) }, (_, c) => ({ userId, name: `${FIRST[c % FIRST.length]} ${LAST[Math.floor(c / FIRST.length) % LAST.length]}`, email: `client${c}@e2e-test.invalid`, dedupKey: `perf-${c}` })),
  ).returning({ id: clientsTable.id });

  const projects = await db.insert(projectsTable).values(
    Array.from({ length: JOBS }, (_, j) => ({
      userId,
      clientId: clients[j % clients.length]!.id,
      name: `Job ${j + 1} — kitchen`,
      status: (["active", "active", "planning", "completed", "suspended"] as const)[j % 5],
      address: `${200 + j} Site Rd, Ottawa ON`,
      contractValueCents: 1_000_000 + j * 25_000,
      changeOrdersCents: j % 4 === 0 ? 50_000 : 0,
      plannedStart: daysAgo(60 - j),
      plannedEnd: daysFromNow(30 + j),
      progressPercent: (j * 17) % 100,
      completedAt: j % 5 === 3 ? daysAgo(10) : null,
      createdAt: daysAgo(90 - j),
    })),
  ).returning({ id: projectsTable.id, clientId: projectsTable.clientId });

  const milestoneRows = projects.flatMap((p, j) =>
    Array.from({ length: 4 }, (_, m) => ({
      userId, projectId: p.id, key: `m${m + 1}`, title: `Milestone ${m + 1}`, sortOrder: m,
      status: (["completed", "in_progress", "planned", "planned"] as const)[m],
      plannedStart: daysAgo(50 - j - m * 10), plannedEnd: daysAgo(40 - j - m * 10),
      paymentAmountCents: m === 3 ? 300_000 : null, valueCents: 250_000,
    })),
  );
  await db.insert(milestonesTable).values(milestoneRows);

  await db.insert(costEntriesTable).values(
    projects.flatMap((p, j) =>
      Array.from({ length: 3 }, (_, k) => ({
        userId, projectId: p.id, category: (["materials", "subcontractor", "labour"] as const)[k], vendor: `Vendor ${k}`, description: `Cost ${k + 1}`,
        date: daysAgo(30 - k - (j % 20)), subtotalCents: 50_000 + k * 10_000, taxCents: 6_500, totalCents: 56_500 + k * 10_000,
        status: (k === 2 ? "pending_review" : "confirmed") as "confirmed" | "pending_review", source: "manual" as const, createdBy: "user" as const,
      })),
    ),
  );

  const party = { name: "Northside Renovations Ltd.", address: "1 Contractor Way", city: "Ottawa", province: "ON", postalCode: "K1A 0B1", email: "owner@e2e-test.invalid" };
  const invoices = await db.insert(invoicesTable).values(
    projects.flatMap((p, j) =>
      Array.from({ length: 2 }, (_, k) => ({
        userId, projectId: p.id, clientId: p.clientId, number: `INV-2026-${String(j * 2 + k + 1).padStart(4, "0")}`, type: "progress" as const,
        status: (["sent", "paid", "overdue", "partially_paid", "draft"] as const)[(j + k) % 5], province: "ON",
        issueDate: daysAgo(40 - j), dueDate: daysAgo(10 - j), contractor: party, customer: { name: `Client ${j}`, email: `client${j}@e2e-test.invalid` },
        lines: [{ id: `l${k}`, description: "Progress billing", quantity: 1, unit: "lot", unitCents: 300_000, amountCents: 300_000 }],
        subtotalCents: 300_000, taxableCents: 300_000, taxCents: 39_000, totalCents: 339_000, paidCents: (j + k) % 5 === 1 ? 339_000 : (j + k) % 5 === 3 ? 100_000 : 0,
        sentAt: daysAgo(40 - j),
      })),
    ),
  ).returning({ id: invoicesTable.id, paidCents: invoicesTable.paidCents });
  const paid = invoices.filter((i) => i.paidCents > 0);
  if (paid.length) await db.insert(invoicePaymentsTable).values(paid.map((i) => ({ userId, invoiceId: i.id, amountCents: i.paidCents, method: "etransfer" as const, date: daysAgo(5) })));

  return { projects, seconds: Math.round((Date.now() - t0) / 1000) };
}

// ── Measure ──────────────────────────────────────────────────────────────────
type Row = { name: string; path: string; status: number; bytes: number; p50: number; p95: number; max: number; budgetMs: number };
const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))]!;

async function measure(name: string, path: string, token: string, budgetMs: number): Promise<Row> {
  for (let i = 0; i < 2; i++) await api(path, { token }); // warm-up: JIT, pool, plan cache
  const times: number[] = [];
  let status = 0;
  let bytes = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const t = performance.now();
    const res = await api(path, { token });
    times.push(performance.now() - t);
    status = res.status;
    bytes = Buffer.byteLength(typeof res.body === "string" ? res.body : JSON.stringify(res.body ?? ""));
  }
  const row = { name, path, status, bytes, p50: pct(times, 0.5), p95: pct(times, 0.95), max: Math.max(...times), budgetMs };
  const flag = row.status !== 200 ? ` HTTP ${row.status}` : row.p95 > budgetMs ? " OVER BUDGET" : "";
  console.log(`${name.padEnd(30)} p50 ${row.p50.toFixed(0).padStart(5)} ms  p95 ${row.p95.toFixed(0).padStart(5)} ms  max ${row.max.toFixed(0).padStart(5)} ms  ${(bytes / 1024).toFixed(0).padStart(5)} kB${flag}`);
  return row;
}

mkdirSync(OUT, { recursive: true });
const t0 = Date.now();
try {
  await startServer();
  const org = await createOrg({ province: "ON", companyName: "Northside Renovations Ltd." });
  const { projects, seconds } = await seed(org.userId);
  const [contract] = await db.select({ id: contractsTable.id }).from(contractsTable).limit(1);
  console.log(`[qa-perf] seeded ${QUOTES} quotes / ${JOBS} jobs in ${seconds}s — ${SAMPLES} samples per endpoint\n`);
  const job = projects[0]!.id;
  const rows: Row[] = [];
  const t = org.token;
  rows.push(await measure("dashboard home (quotes/stats)", "/api/quotes/stats", t, 600));
  rows.push(await measure("quotes list", "/api/quotes", t, 800));
  rows.push(await measure("clients (virtual)", "/api/clients", t, 600));
  rows.push(await measure("jobs list", "/api/jobs", t, 600));
  rows.push(await measure("job detail", `/api/jobs/${job}`, t, 600));
  rows.push(await measure("job analytics", `/api/jobs/${job}/analytics`, t, 600));
  rows.push(await measure("company analytics", "/api/analytics/company?months=6", t, 1000));
  rows.push(await measure("invoices list", "/api/invoices", t, 800));
  rows.push(await measure("contracts list", "/api/contracts", t, 600));
  rows.push(await measure("archive", "/api/archive", t, 600));
  rows.push(await measure("notifications", "/api/notifications", t, 400));
  rows.push(await measure("business profile", "/api/business-profile", t, 400));
  void contract;

  const lines = [
    "# API latency — Phase 68",
    "",
    `${QUOTES} quotes / ${JOBS} jobs seeded · ${SAMPLES} samples per endpoint after 2 warm-ups · local app → staging Postgres · ${new Date().toISOString()}`,
    "",
    "| endpoint | path | status | payload | p50 | p95 | max | budget (p95) |",
    "|---|---|---|---|---|---|---|---|",
    ...rows.map((r) => `| ${r.name} | \`${r.path.replace(job, ":id")}\` | ${r.status} | ${(r.bytes / 1024).toFixed(0)} kB | ${r.p50.toFixed(0)} ms | ${r.p95.toFixed(0)} ms | ${r.max.toFixed(0)} ms | ${r.budgetMs} ms${r.p95 > r.budgetMs || r.status !== 200 ? " ❌" : ""} |`),
    "",
  ];
  writeFileSync(resolve(OUT, "report.md"), lines.join("\n"));
  writeFileSync(resolve(OUT, "report.json"), JSON.stringify(rows, null, 2));
  const over = rows.filter((r) => r.p95 > r.budgetMs || r.status !== 200);
  console.log(`\n[qa-perf] ${rows.length} endpoints in ${Math.round((Date.now() - t0) / 1000)}s → ${resolve(OUT, "report.md")}${over.length ? ` — ${over.length} over budget` : " — all within budget"}`);
  process.exitCode = over.length ? 1 : 0;
} finally {
  await cleanupAll().catch((e) => console.error("[qa-perf] cleanup failed", e));
  await stopServer();
}
process.exit();
