// Phase 89 — time to pay (no payroll engine).
//  1. Approved hours split into straight time, overtime and double time by the
//     province's rules, the hours that crossed a threshold carrying the premium
//     — on the job they were worked on — and the split follows every edit,
//     move and deletion of an entry in the same week.
//  2. The pay period worksheet: regular/overtime/holiday-worked lines, statutory
//     holiday pay (or the reason there is none), subcontractors kept out.
//  3. Travel and per diem: paid with the hours, charged to the job.
//  4. The export files, and "changed since it was exported".
//  5. Settings re-split open periods; an employee turned subcontractor stops
//     earning overtime.
//  6. Wages are the office's: foremen are refused the worksheet and the old
//     payroll CSV; Pro has no pay page; other companies see nothing.

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, costEntriesTable, payExportsTable, timeEntriesTable } from "@workspace/db";
import { startServer, stopServer, createOrg, createUser, cleanupAll, type TestUser } from "./harness.js";

async function member(owner: TestUser, role: "foreman" | "office"): Promise<TestUser> {
  const email = `e2e-p89-${role}-${owner.userId}@example.invalid`;
  const invite = await owner.api("/api/team/members/invite", { body: { email, role } });
  expect(invite.status, JSON.stringify(invite.body)).toBe(201);
  const token = invite.body.url.split("/team-invite/")[1];
  const user = await createUser({ email, name: `${role} person` });
  expect((await user.api(`/api/team/invite/${token}/accept`, { method: "POST" })).status).toBe(200);
  return user;
}

async function worker(org: TestUser, name: string, extra: Record<string, unknown> = {}): Promise<string> {
  const r = await org.api("/api/team/workers", { body: { name, hourlyRateCents: 4000, burdenPercent: 10, workerType: "employee", ...extra } });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body.worker.id;
}

async function job(org: TestUser, name: string): Promise<string> {
  const r = await org.api("/api/jobs", { body: { name, address: "1 Main St" } });
  expect(r.body?.job?.id, JSON.stringify(r.body)).toBeTruthy();
  return r.body.job.id;
}

async function hours(org: TestUser, jobId: string, workerId: string, date: string, h: number): Promise<string> {
  const r = await org.api(`/api/jobs/${jobId}/time-entries`, { body: { workerId, date, hours: h, approve: true } });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body.entry.id;
}

async function entry(id: string) {
  const [e] = await db.select().from(timeEntriesTable).where(eq(timeEntriesTable.id, id));
  return { overtime: Number(e!.overtimeHours), double: Number(e!.doubleHours), holiday: Number(e!.holidayHours), premium: e!.premiumCents, costEntryId: e!.costEntryId };
}

const ago = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

describe("Phase 89 — time to pay", () => {
  let bc: TestUser;
  let on: TestUser;
  let other: TestUser;
  let pro: TestUser;
  let foreman: TestUser;
  let office: TestUser;

  beforeAll(async () => {
    await startServer();
    bc = await createOrg({ companyName: "Pay BC Co", plan: "monthly_elite", profile: { province: "BC" } });
    on = await createOrg({ companyName: "Pay ON Co", plan: "monthly_elite" });
    other = await createOrg({ companyName: "Other Pay Co", plan: "monthly_elite" });
    pro = await createOrg({ companyName: "Pro Pay Co", plan: "monthly_pro" });
    foreman = await member(on, "foreman");
    office = await member(on, "office");
  }, 180_000);

  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });

  describe("overtime follows the week (BC: daily 8, double after 12)", () => {
    let ana: string;
    let deck: string;
    let fence: string;
    let morning: string;
    let afternoon: string;

    beforeAll(async () => {
      ana = await worker(bc, "Ana");
      deck = await job(bc, "Deck");
      fence = await job(bc, "Fence");
    });

    test("two jobs in a day: the afternoon job carries the hours past 8, at time and a half, in its cost", async () => {
      morning = await hours(bc, deck, ana, "2026-08-31", 6);
      afternoon = await hours(bc, fence, ana, "2026-08-31", 4.5);
      expect(await entry(morning)).toMatchObject({ overtime: 0, premium: 0 });
      const pm = await entry(afternoon);
      expect(pm).toMatchObject({ overtime: 2.5, premium: 2.5 * 2000 });
      const [cost] = await db.select().from(costEntriesTable).where(eq(costEntriesTable.id, pm.costEntryId!));
      expect(cost).toMatchObject({ subtotalCents: 4.5 * 4000 + 5000, totalCents: Math.round((4.5 * 4000 + 5000) * 1.1), projectId: fence });
      expect(cost!.description).toContain("2.50 h overtime");
    });

    test("a 13-hour day: 4 at time and a half, 1 at double", async () => {
      const long = await hours(bc, deck, ana, "2026-09-01", 13);
      expect(await entry(long)).toMatchObject({ overtime: 4, double: 1, premium: 4 * 2000 + 4000 });
    });

    test("editing the morning moves the afternoon's overtime; moving it to another day and deleting it take it away", async () => {
      // 8 + 4.5 = 12.5: past 12 is double time in BC.
      expect((await bc.api(`/api/team/time-entries/${morning}`, { method: "PUT", body: { hours: 8 } })).status).toBe(200);
      expect(await entry(afternoon)).toMatchObject({ overtime: 4, double: 0.5, premium: 4 * 2000 + 0.5 * 4000 });
      expect((await bc.api(`/api/team/time-entries/${morning}`, { method: "PUT", body: { date: "2026-09-02" } })).status).toBe(200);
      expect(await entry(afternoon)).toMatchObject({ overtime: 0, premium: 0 });
      expect((await bc.api(`/api/team/time-entries/${morning}`, { method: "PUT", body: { date: "2026-08-31" } })).status).toBe(200);
      expect(await entry(afternoon)).toMatchObject({ overtime: 4, double: 0.5 });
      expect((await bc.api(`/api/team/time-entries/${morning}`, { method: "DELETE" })).status).toBe(200);
      const pm = await entry(afternoon);
      expect(pm).toMatchObject({ overtime: 0, premium: 0 });
      const [cost] = await db.select().from(costEntriesTable).where(eq(costEntriesTable.id, pm.costEntryId!));
      expect(cost!.subtotalCents).toBe(4.5 * 4000);
    });

    test("hours logged later in the day carry its overtime; rejecting them takes the premium away", async () => {
      const extra = await hours(bc, deck, ana, "2026-08-31", 6);
      expect(await entry(afternoon)).toMatchObject({ overtime: 0 });
      expect(await entry(extra)).toMatchObject({ overtime: 2.5 });
      expect((await bc.api(`/api/team/time-entries/${extra}`, { method: "PUT", body: { status: "rejected", rejectedReason: "wrong day" } })).status).toBe(200);
      expect(await entry(extra)).toMatchObject({ overtime: 0, premium: 0, costEntryId: null });
    });

    test("BC holiday pay needs 30 days on the payroll — Labour Day says why Ana, a week in, gets none", async () => {
      const r = await bc.api("/api/pay/period?date=2026-09-01");
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      const a = r.body.employees.find((p: { name: string }) => p.name === "Ana");
      expect(a.holidays).toEqual([expect.objectContaining({ date: "2026-09-07", key: "labour_day", cents: null, reason: "not_employed_long_enough" })]);
      expect(a.lines.some((l: { kind: string }) => l.kind === "holiday")).toBe(false);
    });

    test("an employee turned subcontractor stops earning overtime in the open periods, and back", async () => {
      const day = ago(4);
      const id = await hours(bc, deck, ana, day, 10);
      expect(await entry(id)).toMatchObject({ overtime: 2 });
      expect((await bc.api(`/api/team/workers/${ana}`, { method: "PUT", body: { workerType: "subcontractor" } })).status).toBe(200);
      expect(await entry(id)).toMatchObject({ overtime: 0, premium: 0 });
      expect((await bc.api(`/api/team/workers/${ana}`, { method: "PUT", body: { workerType: "employee" } })).status).toBe(200);
      expect(await entry(id)).toMatchObject({ overtime: 2 });
    });
  });

  describe("the pay period (ON: 44 a week, holiday pay = four weeks ÷ 20)", () => {
    let ben: string;
    let sub: string;
    let kitchen: string;
    let friday: string;
    let allowanceId: string;

    beforeAll(async () => {
      ben = await worker(on, "Ben", { payrollId: "E-201" });
      sub = await worker(on, "Sam Subtrades", { workerType: "subcontractor", burdenPercent: 0 });
      kitchen = await job(on, "Kitchen");
      for (const d of ["2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03"]) await hours(on, kitchen, ben, d, 10);
      friday = await hours(on, kitchen, ben, "2026-09-04", 10);
      for (const d of ["2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"]) await hours(on, kitchen, sub, d, 10);
    });

    test("the hours that cross 44 are overtime; a subcontractor's never are", async () => {
      expect(await entry(friday)).toMatchObject({ overtime: 6, premium: 6 * 2000 });
      const subRows = await db.select().from(timeEntriesTable).where(eq(timeEntriesTable.workerId, sub));
      expect(subRows.every((r) => Number(r.overtimeHours) === 0 && r.premiumCents === 0)).toBe(true);
    });

    test("the worksheet: 44 regular, 6 overtime, Labour Day pay from the four weeks before; the subcontractor listed apart", async () => {
      const r = await on.api("/api/pay/period?date=2026-09-01");
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body.period).toEqual({ start: "2026-08-30", end: "2026-09-12" });
      expect(r.body.holidays.map((h: { key: string }) => h.key)).toEqual(["labour_day"]);
      const b = r.body.employees.find((p: { name: string }) => p.name === "Ben");
      const line = (k: string) => b.lines.find((l: { kind: string }) => l.kind === k);
      expect(line("regular")).toMatchObject({ code: "REG", hours: 44, rateCents: 4000, amountCents: 176_000 });
      expect(line("overtime")).toMatchObject({ code: "OT", hours: 6, rateCents: 6000, amountCents: 36_000 });
      expect(line("holiday")).toMatchObject({ code: "STAT", hours: 2.2, amountCents: 8800 });
      expect(b.grossCents).toBe(176_000 + 36_000 + 8800);
      expect(r.body.employees.some((p: { name: string }) => p.name === "Sam Subtrades")).toBe(false);
      expect(r.body.subcontractors).toEqual([expect.objectContaining({ name: "Sam Subtrades", hours: 50, amountCents: 200_000 })]);
      const k = r.body.jobs.find((j: { projectId: string }) => j.projectId === kitchen);
      expect(k).toMatchObject({ hours: 100, overtimeHours: 6, premiumCents: 12_000 });
    });

    test("travel on the job: paid with the hours, a labour cost on the job the cost screens can't edit", async () => {
      const r = await on.api("/api/pay/allowances", { body: { workerId: ben, date: "2026-09-02", kind: "mileage", quantity: 100, projectId: kitchen } });
      expect(r.status, JSON.stringify(r.body)).toBe(201);
      expect(r.body.allowance.amountCents).toBe(7200);
      allowanceId = r.body.allowance.id;
      const [cost] = await db.select().from(costEntriesTable).where(and(eq(costEntriesTable.projectId, kitchen), eq(costEntriesTable.source, "allowance")));
      expect(cost).toMatchObject({ category: "labour", totalCents: 7200, status: "confirmed" });
      expect((await on.api(`/api/jobs/${kitchen}/costs/${cost!.id}`, { method: "DELETE" })).status).toBe(409);
      const period = await on.api("/api/pay/period?date=2026-09-01");
      const b = period.body.employees.find((p: { name: string }) => p.name === "Ben");
      expect(b.lines.find((l: { kind: string }) => l.kind === "mileage")).toMatchObject({ code: "KM", quantity: 100, rateCents: 72, amountCents: 7200, taxable: false });
      expect(period.body.jobs.find((j: { projectId: string }) => j.projectId === kitchen).allowanceCents).toBe(7200);
      // A subcontractor bills their own travel.
      expect((await on.api("/api/pay/allowances", { body: { workerId: sub, date: "2026-09-02", kind: "mileage", quantity: 10 } })).status).toBe(400);
      // "Other" needs an amount.
      expect((await on.api("/api/pay/allowances", { body: { workerId: ben, date: "2026-09-02", kind: "other", quantity: 1 } })).status).toBe(400);
    });

    test("the files: generic, Payworks by employee number, QuickBooks timesheets per day split by pay item", async () => {
      const generic = await on.api("/api/pay/export.csv?date=2026-09-01&format=generic");
      expect(generic.status).toBe(200);
      const text = generic.body as string;
      expect(text).toContain("E-201,Ben,2026-08-30,2026-09-12,regular,REG,44.00,,40.00,1760.00,yes,Kitchen");
      expect(text).toContain("E-201,Ben,2026-08-30,2026-09-12,overtime,OT,6.00,,60.00,360.00,yes,Kitchen");
      expect(text).not.toContain("Sam Subtrades");

      const payworks = (await on.api("/api/pay/export.csv?date=2026-09-01&format=payworks")).body as string;
      expect(payworks.split("\r\n")[0]).toBe("Employee Number,Earning Code,Hours,Rate,Amount");
      expect(payworks).toContain("E-201,REG,44.00,40.00,1760.00");
      expect(payworks).toContain("E-201,KM,100.00,0.72,72.00");

      const qbo = (await on.api("/api/pay/export.csv?date=2026-09-01&format=qbo_payroll")).body as string;
      expect(qbo).toContain("2026-09-04,Ben,Kitchen,REG,4.00,");
      expect(qbo).toContain("2026-09-04,Ben,Kitchen,OT,6.00,");
      expect(qbo).not.toContain("STAT,");

      const logged = await db.select().from(payExportsTable).where(eq(payExportsTable.userId, on.userId));
      expect(logged.map((x) => x.format).sort()).toEqual(["generic", "payworks", "qbo_payroll"]);
      const period = await on.api("/api/pay/period?date=2026-09-01");
      expect(period.body.exports).toHaveLength(3);
      expect(period.body.changedSinceExport).toEqual([]);
    });

    test("working the holiday: time and a half on top, outside the week's 44 — and the export notices", async () => {
      const labourDay = await hours(on, kitchen, ben, "2026-09-07", 8);
      expect(await entry(labourDay)).toMatchObject({ holiday: 8, overtime: 0, premium: 8 * 2000 });
      const r = await on.api("/api/pay/period?date=2026-09-01");
      const b = r.body.employees.find((p: { name: string }) => p.name === "Ben");
      expect(b.lines.find((l: { kind: string }) => l.kind === "holiday_worked")).toMatchObject({ code: "STATW", hours: 8, rateCents: 6000, amountCents: 48_000 });
      expect(r.body.changedSinceExport).toEqual(["Ben"]);
    });

    test("removing the travel line removes its cost", async () => {
      expect((await on.api(`/api/pay/allowances/${allowanceId}`, { method: "DELETE" })).status).toBe(200);
      const rows = await db.select().from(costEntriesTable).where(and(eq(costEntriesTable.projectId, kitchen), eq(costEntriesTable.source, "allowance")));
      expect(rows).toHaveLength(0);
    });
  });

  describe("settings", () => {
    test("province defaults until the company changes them; a change re-splits the open periods, and undoing it puts them back", async () => {
      const s = await on.api("/api/pay/settings");
      expect(s.status).toBe(200);
      expect(s.body.effective).toMatchObject({ province: "ON", frequency: "biweekly", overtimeIsDefault: true, overtime: { dailyHours: null, weeklyHours: 44 }, holidays: { method: "div20_4w" } });
      expect(s.body.holidays.some((h: { key: string }) => h.key === "boxing_day")).toBe(true);

      const dee = await worker(on, "Dee");
      const kitchen2 = await job(on, "Bathroom");
      const id = await hours(on, kitchen2, dee, ago(4), 10);
      const old = await hours(on, kitchen2, dee, "2026-01-06", 10);
      expect(await entry(id)).toMatchObject({ overtime: 0 });

      const put = await on.api("/api/pay/settings", { method: "PUT", body: { overtime: { dailyHours: 8, dailyDoubleHours: null, weeklyHours: 40, multiplier: 1.5, doubleMultiplier: 2 } } });
      expect(put.status, JSON.stringify(put.body)).toBe(200);
      expect(put.body.effective.overtimeIsDefault).toBe(false);
      expect(await entry(id)).toMatchObject({ overtime: 2, premium: 2 * 2000 });
      // January was paid under the old rules: neither the save nor opening that period re-splits it.
      expect(await entry(old)).toMatchObject({ overtime: 0, premium: 0 });
      expect((await on.api("/api/pay/period?date=2026-01-06")).status).toBe(200);
      expect(await entry(old)).toMatchObject({ overtime: 0, premium: 0 });

      expect((await on.api("/api/pay/settings", { method: "PUT", body: {} })).status).toBe(200);
      expect(await entry(id)).toMatchObject({ overtime: 0, premium: 0 });

      const bad = await on.api("/api/pay/settings", { method: "PUT", body: { overtime: { dailyHours: 10, dailyDoubleHours: 8, weeklyHours: 40, multiplier: 1.5, doubleMultiplier: 2 } } });
      expect(bad.status).toBe(400);
    });

    test("a holiday the company adds is one; one it removes isn't", async () => {
      const put = await on.api("/api/pay/settings", { method: "PUT", body: { holidays: { added: [{ date: "2026-08-03", name: "Civic Holiday" }], removed: ["2026-12-26"] } } });
      expect(put.status).toBe(200);
      const keys = put.body.holidays.map((h: { date: string }) => h.date);
      expect(keys).toContain("2026-08-03");
      expect(keys).not.toContain("2026-12-26");
      expect((await on.api("/api/pay/settings", { method: "PUT", body: {} })).status).toBe(200);
    });
  });

  describe("who sees wages", () => {
    test("the office runs pay; a foreman is refused the worksheet and the old payroll CSV", async () => {
      expect((await office.api("/api/pay/period?date=2026-09-01")).status).toBe(200);
      expect((await office.api("/api/team/payroll-summary.csv?from=2026-08-30&to=2026-09-12")).status).toBe(200);
      expect((await foreman.api("/api/pay/period?date=2026-09-01")).status).toBe(403);
      expect((await foreman.api("/api/pay/export.csv?date=2026-09-01")).status).toBe(403);
      expect((await foreman.api("/api/team/payroll-summary.csv?from=2026-08-30&to=2026-09-12")).status).toBe(403);
      expect((await foreman.api("/api/pay/settings", { method: "PUT", body: {} })).status).toBe(403);
    });

    test("the payroll CSV now shows the overtime and what it cost", async () => {
      const csv = (await on.api("/api/team/payroll-summary.csv?from=2026-08-30&to=2026-09-12")).body as string;
      expect(csv).toContain("Overtime h");
      expect(csv).toMatch(/"Ben",.*"2026-09-04","10\.00","6\.00","0\.00","40\.00","120\.00","520\.00"/);
    });

    test("Pro has no pay page; other companies see nothing of this one", async () => {
      expect((await pro.api("/api/pay/settings")).body).toMatchObject({ enabled: false, requiredPlan: "monthly_elite" });
      expect((await pro.api("/api/pay/period")).status).toBe(403);
      expect((await pro.api("/api/team/payroll-summary.csv?from=2026-08-30&to=2026-09-12")).status).toBe(403);
      const theirs = await other.api("/api/pay/period?date=2026-09-01");
      expect(theirs.status).toBe(200);
      expect(theirs.body.employees).toEqual([]);
      const onWorkers = await on.api("/api/pay/workers");
      const ben = onWorkers.body.workers.find((w: { name: string }) => w.name === "Ben");
      expect(ben.payrollId).toBe("E-201");
      expect((await other.api("/api/pay/allowances", { body: { workerId: ben.id, date: "2026-09-02", kind: "mileage", quantity: 5 } })).status).toBe(404);
    });
  });
});
