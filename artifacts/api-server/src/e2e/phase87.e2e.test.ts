// Phase 87 — compliance and filings: the derived filing calendar, the
// remittance worksheet, T5018, the company's own reminders, and permits that
// keep a job from being completed.

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { db, costEntriesTable, invoicesTable, notificationsTable, projectsTable, suppliersTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { startServer, stopServer, createOrg, createUser, cleanupAll, type TestUser } from "./harness.js";
import { runComplianceReminders } from "../compliance/service.js";

async function member(owner: TestUser, role: "foreman" | "viewer"): Promise<TestUser> {
  const email = `e2e-${role}-${owner.userId}@example.invalid`;
  const invite = await owner.api("/api/team/members/invite", { body: { email, role } });
  expect(invite.status, JSON.stringify(invite.body)).toBe(201);
  const token = invite.body.url.split("/team-invite/")[1];
  const user = await createUser({ email, name: `${role} person` });
  expect((await user.api(`/api/team/invite/${token}/accept`, { method: "POST" })).status).toBe(200);
  return user;
}

const party = { name: "Pat Homeowner" };
const at = (day: string) => new Date(`${day}T00:00:00Z`);

describe("Phase 87 — compliance and filings", () => {
  let owner: TestUser;
  let other: TestUser;
  let starter: TestUser;
  let foreman: TestUser;
  let viewer: TestUser;
  let jobId: string;

  beforeAll(async () => {
    await startServer();
    owner = await createOrg({ companyName: "Filing Co", plan: "monthly_elite" }); // Elite: seats for a foreman and a viewer
    other = await createOrg({ companyName: "Other Co", plan: "monthly_pro" });
    starter = await createOrg({ companyName: "Starter Co", plan: "monthly_starter" });
    foreman = await member(owner, "foreman");
    viewer = await member(owner, "viewer");

    // Q3 2026 in Ontario: two issued invoices, a credit note, and two that must not count.
    const inv = (number: string, status: "sent" | "paid" | "draft" | "void", taxable: number, hst: number, day: string, type: "manual" | "credit_note" = "manual") => ({
      userId: owner.userId, number, status, type, province: "ON", issueDate: at(day), dueDate: at(day), contractor: party, customer: party,
      subtotalCents: taxable, taxableCents: taxable, taxLines: [{ code: "HST", label: "HST", rate: 13, amountCents: hst }], taxCents: hst, totalCents: taxable + hst,
    });
    await db.insert(invoicesTable).values([
      inv("INV-2026-9001", "sent", 100_000, 13_000, "2026-07-15"),
      inv("INV-2026-9002", "paid", 50_000, 6_500, "2026-09-30"),
      inv("CN-2026-9001", "sent", -10_000, -1_300, "2026-08-01", "credit_note"),
      inv("INV-2026-9003", "draft", 999_900, 129_987, "2026-08-02"),
      inv("INV-2026-9004", "void", 888_800, 115_544, "2026-08-03"),
      inv("INV-2026-9005", "sent", 70_000, 9_100, "2026-10-01"), // next quarter
    ]);
    const [supplier] = await db.insert(suppliersTable).values({ userId: owner.userId, name: "Framing Brothers Ltd" }).returning();
    const cost = (v: Partial<typeof costEntriesTable.$inferInsert>) => ({ userId: owner.userId, vendor: "Home Depot", date: at("2026-08-10"), subtotalCents: 10_000, taxCents: 1_300, totalCents: 11_300, taxBreakdown: { HST: 1_300 }, status: "confirmed" as const, ...v });
    await db.insert(costEntriesTable).values([
      cost({}),
      cost({ taxBreakdown: {} }), // tax never split: not a credit
      cost({ status: "pending_review" }), // awaiting review: not a credit
      cost({ category: "subcontractor", supplierId: supplier!.id, vendor: "Framing Bros", subtotalCents: 400_000, taxCents: 52_000, totalCents: 452_000, taxBreakdown: { HST: 52_000 } }),
      cost({ category: "subcontractor", vendor: "Joe's Drywall", date: at("2026-03-02"), subtotalCents: 30_000, taxCents: 0, totalCents: 30_000, taxBreakdown: {} }),
    ]);

    jobId = (await owner.api("/api/jobs", { body: { name: "Basement finish", address: "12 Elm St, Toronto, ON" } })).body.job.id;
    await db.update(projectsTable).set({ status: "active", province: "ON" }).where(eq(projectsTable.id, jobId));
  }, 180_000);

  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });

  test("no filing setup, no guessed deadlines; the setup is the owner's, not the foreman's", async () => {
    const before = await owner.api("/api/compliance/overview");
    expect(before.status).toBe(200);
    expect(before.body).toMatchObject({ enabled: true, deadlines: [] });
    expect(before.body.registrations.gstHstNumber).toBe("123456789RT0001");

    expect((await foreman.api("/api/compliance/settings", { method: "PUT", body: { salesTaxFrequency: "quarterly" } })).status).toBe(403);
    expect((await owner.api("/api/compliance/settings", { method: "PUT", body: { salesTaxFrequency: "weekly" } })).status).toBe(400);
    const saved = await owner.api("/api/compliance/settings", { method: "PUT", body: { salesTaxFrequency: "quarterly", fiscalYearEnd: "12-31", t5018: true } });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);

    const after = await viewer.api("/api/compliance/overview");
    expect(after.status).toBe(200);
    const q3 = after.body.deadlines.find((d: { key: string }) => d.key === "sales_tax:Q2026-09");
    expect(q3).toMatchObject({ dueDate: "2026-10-31", periodStart: "2026-07-01", periodEnd: "2026-09-30", tax: "GST/HST", hasWorksheet: true });
    expect(after.body.deadlines.some((d: { key: string }) => d.key === "t5018:2026")).toBe(true);
    // Deadlines from well before the setup were handled elsewhere — never "146 days late".
    const configuredAt: string = saved.body.settings.configuredAt;
    expect(configuredAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const cutoff = new Date(Date.parse(`${configuredAt}T00:00:00Z`) - 31 * 86_400_000).toISOString().slice(0, 10);
    expect(after.body.deadlines.filter((d: { dueDate: string }) => d.dueDate < cutoff)).toEqual([]);
    // Saving again keeps the first setup date.
    expect((await owner.api("/api/compliance/settings", { method: "PUT", body: { t5018: true } })).body.settings.configuredAt).toBe(configuredAt);
  });

  test("mark filed, then undo — and a viewer cannot", async () => {
    expect((await viewer.api("/api/compliance/filings", { body: { kind: "sales_tax", periodKey: "Q2026-09" } })).status).toBe(403);
    const filed = await owner.api("/api/compliance/filings", { body: { kind: "sales_tax", periodKey: "Q2026-09", note: "Filed by Sam at the accountant" } });
    expect(filed.status, JSON.stringify(filed.body)).toBe(201);
    let d = (await owner.api("/api/compliance/overview")).body.deadlines.find((x: { key: string }) => x.key === "sales_tax:Q2026-09");
    expect(d.state).toBe("filed");
    expect((await owner.api("/api/compliance/filings?kind=sales_tax&periodKey=Q2026-09", { method: "DELETE" })).status).toBe(204);
    d = (await owner.api("/api/compliance/overview")).body.deadlines.find((x: { key: string }) => x.key === "sales_tax:Q2026-09");
    expect(d.state).not.toBe("filed");
  });

  test("the worksheet: issued invoices minus split, confirmed credits — drafts, voids and guesses stay out", async () => {
    const res = await owner.api("/api/compliance/remittance?from=2026-07-01&to=2026-09-30");
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const s = res.body.summary;
    expect(res.body.invoices.map((i: { number: string }) => i.number).sort()).toEqual(["CN-2026-9001", "INV-2026-9001", "INV-2026-9002"]);
    expect(s.salesCents).toBe(140_000);
    // 13 000 + 6 500 − 1 300 collected; 1 300 + 52 000 credits from the two split, confirmed receipts.
    expect(s.gstHst).toEqual({ collectedCents: 18_200, creditsCents: 53_300, netCents: -35_100 });
    expect(s.warnings).toMatchObject({ unsplitCostCount: 1, unsplitTaxCents: 1_300, pendingCostCount: 1, pendingTaxCents: 1_300 });

    const csv = await owner.api("/api/compliance/remittance.csv?from=2026-07-01&to=2026-09-30");
    expect(csv.status).toBe(200);
    expect(csv.headers.get("content-type")).toContain("text/csv");
    expect(String(csv.body)).toContain("INV-2026-9001");
    expect(String(csv.body)).toContain("no (tax not split)");
    expect(String(csv.body)).not.toContain("INV-2026-9003");

    expect((await owner.api("/api/compliance/remittance?from=2026-09-30&to=2026-07-01")).status).toBe(400);
    // Another company sees none of it.
    const theirs = await other.api("/api/compliance/remittance?from=2026-07-01&to=2026-09-30");
    expect(theirs.body.invoices).toEqual([]);
  });

  test("T5018: subcontractors by recipient, with the $500 line", async () => {
    const res = await owner.api("/api/compliance/t5018?year=2026");
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const byName = Object.fromEntries(res.body.recipients.map((r: { name: string }) => [r.name, r]));
    expect(byName["Framing Brothers Ltd"]).toMatchObject({ source: "supplier", totalCents: 452_000, overThreshold: true });
    expect(byName["Joe's Drywall"]).toMatchObject({ source: "vendor", totalCents: 30_000, overThreshold: false });
    expect(Object.keys(byName)).not.toContain("Home Depot");
    const csv = await owner.api("/api/compliance/t5018.csv?year=2026");
    expect(String(csv.body)).toContain("Framing Brothers Ltd");
  });

  test("reminders: create from a preset, done moves it a year, and another company cannot touch it", async () => {
    const created = await owner.api("/api/compliance/reminders", { body: { kind: "licence", preset: "hcra", title: "HCRA licence renewal", dueDate: "2026-11-15", recurrence: "annual", remindDaysBefore: 30 } });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const id = created.body.reminder.id;
    expect((await owner.api("/api/compliance/reminders", { body: { title: "Bad link", dueDate: "2026-11-15", url: "javascript:alert(1)" } })).status).toBe(400);

    expect((await other.api(`/api/compliance/reminders/${id}`, { method: "PATCH", body: { title: "hijack" } })).status).toBe(404);
    expect((await other.api(`/api/compliance/reminders/${id}/done`, { method: "POST" })).status).toBe(404);
    expect((await foreman.api(`/api/compliance/reminders/${id}/done`, { method: "POST" })).status).toBe(403);

    const done = await owner.api(`/api/compliance/reminders/${id}/done`, { method: "POST" });
    expect(done.status).toBe(200);
    expect(done.body.reminder).toMatchObject({ dueDate: "2027-11-15", title: "HCRA licence renewal" });

    const once = await owner.api("/api/compliance/reminders", { body: { title: "Insurance certificate to the GC", dueDate: "2026-10-05", recurrence: "none" } });
    expect((await owner.api(`/api/compliance/reminders/${once.body.reminder.id}/done`, { method: "POST" })).body.reminder).toBeNull();
  });

  test("the daily sweep rings the bell once per deadline", async () => {
    const reminder = await owner.api("/api/compliance/reminders", { body: { kind: "workers_comp", title: "WSIB premium report", dueDate: "2026-10-30", recurrence: "quarterly", remindDaysBefore: 14 } });
    const now = new Date("2026-10-25T15:00:00Z");
    const first = await runComplianceReminders(now, [owner.userId]);
    expect(first.filings).toBeGreaterThanOrEqual(1); // Q3 GST/HST, due Oct 31
    expect(first.reminders).toBeGreaterThanOrEqual(1);
    const second = await runComplianceReminders(now, [owner.userId]);
    expect(second).toEqual({ filings: 0, reminders: 0 });
    const notes = await db.select().from(notificationsTable).where(and(eq(notificationsTable.userId, owner.userId), eq(notificationsTable.type, "compliance_due")));
    expect(notes.some((n) => n.entityId === "sales_tax:Q2026-09")).toBe(true);
    expect(notes.some((n) => n.entityId === reminder.body.reminder.id)).toBe(true);
    // A sweep scoped to nobody touches nobody.
    expect(await runComplianceReminders(now, [])).toEqual({ filings: 0, reminders: 0 });
  });

  test("permits: suggestions for the work, and an open permit blocks completion on both job routes", async () => {
    const sug = await owner.api(`/api/jobs/${jobId}/permits/suggest?work=basement`);
    expect(sug.status).toBe(200);
    expect(sug.body.suggestions.map((s: { kind: string }) => s.kind)).toEqual(["building", "electrical", "plumbing"]);
    expect(sug.body.suggestions.find((s: { kind: string }) => s.kind === "electrical").url).toBe("https://esasafe.com");

    expect((await viewer.api(`/api/jobs/${jobId}/permits`, { body: { title: "Nope" } })).status).toBe(403);
    const added = await foreman.api(`/api/jobs/${jobId}/permits`, { body: { permits: [{ kind: "building", title: "Building permit", status: "applied", inspectionAt: "2026-10-02T14:00:00.000Z" }, { kind: "electrical", title: "Electrical permit" }] } });
    expect(added.status, JSON.stringify(added.body)).toBe(201);
    const [building, electrical] = added.body.permits;
    expect(building).toMatchObject({ status: "applied", open: true });
    expect(building.appliedAt).not.toBeNull();

    const blocked = await owner.api(`/api/jobs/${jobId}`, { method: "PUT", body: { status: "completed" } });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toBe("PERMITS_OPEN");
    expect(blocked.body.permits).toHaveLength(2);
    const legacy = await owner.api(`/api/crm/projects/${jobId}`, { method: "PUT", body: { status: "completed" } });
    expect(legacy.status).toBe(409);

    // Another company's completion attempt learns nothing about these permits.
    const foreign = await other.api(`/api/crm/projects/${jobId}`, { method: "PUT", body: { status: "completed" } });
    expect(foreign.status).toBe(404);
    expect(JSON.stringify(foreign.body)).not.toContain("Building permit");
    expect((await other.api(`/api/jobs/${jobId}/permits/${building.id}`, { method: "PATCH", body: { status: "closed" } })).status).toBe(404);

    // The inspection is on the calendar.
    const agenda = await owner.api(`/api/calendar/agenda?from=${encodeURIComponent("2026-09-28T00:00:00.000Z")}&to=${encodeURIComponent("2026-11-05T00:00:00.000Z")}`);
    const kinds = agenda.body.entries.map((e: { kind: string; id: string }) => `${e.kind}:${e.id}`);
    expect(kinds).toContain(`permit:permit:${building.id}`);
    expect(kinds.some((k: string) => k.startsWith("filing:filing:sales_tax:Q2026-09"))).toBe(true);

    expect((await foreman.api(`/api/jobs/${jobId}/permits/${building.id}`, { method: "PATCH", body: { status: "closed" } })).body.permit).toMatchObject({ status: "closed", open: false });
    expect((await foreman.api(`/api/jobs/${jobId}/permits/${electrical.id}`, { method: "PATCH", body: { status: "not_required" } })).status).toBe(200);
    const completed = await owner.api(`/api/jobs/${jobId}`, { method: "PUT", body: { status: "completed" } });
    expect(completed.status, JSON.stringify(completed.body)).toBe(200);
  });

  test("the plan gate: Starter sees one honest line, and cannot write", async () => {
    const res = await starter.api("/api/compliance/overview");
    expect(res.body).toMatchObject({ enabled: false, requiredPlan: "monthly_pro" });
    expect((await starter.api("/api/compliance/settings", { method: "PUT", body: { salesTaxFrequency: "annual" } })).status).toBe(403);
    expect((await starter.api("/api/compliance/remittance?from=2026-07-01&to=2026-09-30")).status).toBe(403);
  });
});
