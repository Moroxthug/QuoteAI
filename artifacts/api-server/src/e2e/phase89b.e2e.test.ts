// Phase 89b — what Phase 89 left open.
//  1. The crew logs km from the magic link; the line waits for the office, is
//     paid and charged to the job once approved, and a rejected one tells the
//     crew why. Offline replays are idempotent; subcontractors are refused.
//  2. A shift across midnight counts toward the day each part was worked on.
//  3. Holiday pay: vacation pay paid on each cheque in the base (ON); a weekend
//     holiday taken on the next weekday; ON construction's 7.7 % in lieu, with
//     hours on the holiday counted as ordinary hours.
//  4. Reviewing is the office's; other companies see nothing.

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, costEntriesTable, payAllowancesTable, projectsTable, timeEntriesTable } from "@workspace/db";
import { startServer, stopServer, createOrg, createUser, cleanupAll, api, type TestUser } from "./harness.js";

async function member(owner: TestUser, role: "foreman" | "office"): Promise<TestUser> {
  const email = `e2e-p89b-${role}-${owner.userId}@example.invalid`;
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
  await db.update(projectsTable).set({ status: "active" }).where(eq(projectsTable.id, r.body.job.id));
  return r.body.job.id;
}

async function hours(org: TestUser, jobId: string, workerId: string, date: string, h: number): Promise<string> {
  const r = await org.api(`/api/jobs/${jobId}/time-entries`, { body: { workerId, date, hours: h, approve: true } });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body.entry.id;
}

async function entry(id: string) {
  const [e] = await db.select().from(timeEntriesTable).where(eq(timeEntriesTable.id, id));
  return { overtime: Number(e!.overtimeHours), double: Number(e!.doubleHours), holiday: Number(e!.holidayHours), premium: e!.premiumCents };
}

const linkFor = async (org: TestUser, workerId: string) => (await org.api(`/api/team/workers/${workerId}/invite`, { body: {} })).body.url.split("/t/")[1] as string;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

describe("Phase 89b — the pay leftovers", () => {
  let on: TestUser;
  let bc: TestUser;
  let other: TestUser;
  let foreman: TestUser;

  beforeAll(async () => {
    await startServer();
    on = await createOrg({ companyName: "Pay 89b ON Co", plan: "monthly_elite" });
    bc = await createOrg({ companyName: "Pay 89b BC Co", plan: "monthly_elite", profile: { province: "BC" } });
    other = await createOrg({ companyName: "Other 89b Co", plan: "monthly_elite" });
    foreman = await member(on, "foreman");
  }, 180_000);

  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });

  describe("travel from the site", () => {
    let dee: string;
    let token: string;
    let site: string;
    let approvedId: string;
    let today: string;

    beforeAll(async () => {
      dee = await worker(on, "Dee");
      site = await job(on, "Basement");
      token = await linkFor(on, dee);
    });

    test("the worker page offers km (the company has a rate) and not per diem (it has none), and shows no money", async () => {
      const r = await api(`/api/t/${token}`);
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body.travel).toEqual({ km: true, perDiem: false });
      expect(r.body.allowances).toEqual([]);
      today = r.body.today;
      const sub = await worker(on, "Sub Sid", { workerType: "subcontractor", burdenPercent: 0 });
      const subToken = await linkFor(on, sub);
      expect((await api(`/api/t/${subToken}`)).body.travel).toBeNull();
      expect((await api(`/api/t/${subToken}/allowances`, { body: { kind: "mileage", quantity: 10, date: today } })).status).toBe(403);
    });

    test("42 km on the job: waits for the office, and a replay of the same offline op makes no second line", async () => {
      const clientRef = randomUUID();
      const first = await api(`/api/t/${token}/allowances`, { body: { kind: "mileage", quantity: 42, date: today, projectId: site, note: "Yard to site", clientRef } });
      expect(first.status, JSON.stringify(first.body)).toBe(201);
      expect(first.body.allowance.status).toBe("submitted");
      approvedId = first.body.allowance.id;
      const again = await api(`/api/t/${token}/allowances`, { body: { kind: "mileage", quantity: 42, date: today, projectId: site, clientRef } });
      expect(again.status).toBe(200);
      expect(again.body).toMatchObject({ replayed: true, allowance: { id: approvedId } });
      expect((await db.select().from(payAllowancesTable).where(eq(payAllowancesTable.workerId, dee))).length).toBe(1);
      expect((await api(`/api/t/${token}/allowances`, { body: { kind: "per_diem", quantity: 1, date: today } })).body.error).toBe("NO_RATE");
      expect((await api(`/api/t/${token}/allowances`, { body: { kind: "mileage", quantity: 5, date: "2020-01-01" } })).body.error).toBe("DATE_RANGE");
      const page = await api(`/api/t/${token}`);
      expect(page.body.allowances).toEqual([expect.objectContaining({ id: approvedId, kind: "mileage", quantity: 42, status: "submitted", projectName: "Basement" })]);
      expect(JSON.stringify(page.body.allowances)).not.toMatch(/Cents/);
    });

    test("not paid or costed before the office approves it; then both", async () => {
      const before = await on.api(`/api/pay/period?date=${today}`);
      expect(before.body.pendingAllowances).toEqual([expect.objectContaining({ id: approvedId, workerName: "Dee", quantity: 42, amountCents: 42 * 72, projectName: "Basement" })]);
      expect(before.body.employees.some((p: { name: string }) => p.name === "Dee")).toBe(false);
      expect((await db.select().from(costEntriesTable).where(eq(costEntriesTable.projectId, site))).length).toBe(0);

      expect((await foreman.api(`/api/pay/allowances/${approvedId}/review`, { body: { decision: "approved" } })).status).toBe(403);
      expect((await other.api(`/api/pay/allowances/${approvedId}/review`, { body: { decision: "approved" } })).status).toBe(404);
      const ok = await on.api(`/api/pay/allowances/${approvedId}/review`, { body: { decision: "approved" } });
      expect(ok.status, JSON.stringify(ok.body)).toBe(200);
      expect((await on.api(`/api/pay/allowances/${approvedId}/review`, { body: { decision: "rejected" } })).status).toBe(409);

      const after = await on.api(`/api/pay/period?date=${today}`);
      expect(after.body.pendingAllowances).toEqual([]);
      const d = after.body.employees.find((p: { name: string }) => p.name === "Dee");
      expect(d.lines.find((l: { kind: string }) => l.kind === "mileage")).toMatchObject({ quantity: 42, amountCents: 3024 });
      const [cost] = await db.select().from(costEntriesTable).where(eq(costEntriesTable.projectId, site));
      expect(cost).toMatchObject({ source: "allowance", totalCents: 3024, status: "confirmed" });
      // Reviewed, so the crew can no longer take it back.
      expect((await api(`/api/t/${token}/allowances/${approvedId}`, { method: "DELETE" })).status).toBe(409);
    });

    test("a rejected line says why and is never paid; one still waiting can be taken back", async () => {
      const wrong = await api(`/api/t/${token}/allowances`, { body: { kind: "mileage", quantity: 900, date: today } });
      const r = await on.api(`/api/pay/allowances/${wrong.body.allowance.id}/review`, { body: { decision: "rejected", reason: "That was the company truck" } });
      expect(r.status).toBe(200);
      const page = await api(`/api/t/${token}`);
      expect(page.body.allowances.find((a: { id: string }) => a.id === wrong.body.allowance.id)).toMatchObject({ status: "rejected", rejectedReason: "That was the company truck" });
      const period = await on.api(`/api/pay/period?date=${today}`);
      expect(period.body.employees.find((p: { name: string }) => p.name === "Dee").lines.find((l: { kind: string }) => l.kind === "mileage").quantity).toBe(42);

      const oops = await api(`/api/t/${token}/allowances`, { body: { kind: "mileage", quantity: 7, date: today } });
      expect((await api(`/api/t/${token}/allowances/${oops.body.allowance.id}`, { method: "DELETE" })).status).toBe(200);
      const otherToken = await linkFor(other, await worker(other, "Olga"));
      expect((await api(`/api/t/${otherToken}/allowances/${approvedId}`, { method: "DELETE" })).status).toBe(404);
    });
  });

  describe("across midnight (BC: 8 a day)", () => {
    test("a 22:00–08:00 shift is 2 h on one day and 8 on the next — no overtime — and 4 more hours the next day are all overtime", async () => {
      const night = await worker(bc, "Nia");
      const bridge = await job(bc, "Bridge deck");
      const token = await linkFor(bc, night);
      // 22:00 Pacific three days ago (05:00 UTC the day after) → 08:00 Pacific.
      const start = new Date(Date.now() - 3 * 86_400_000);
      const day = isoDay(start);
      const next = isoDay(new Date(start.getTime() + 86_400_000));
      const inAt = new Date(`${next}T05:00:00Z`);
      const outAt = new Date(`${next}T15:00:00Z`);
      const ci = await api(`/api/t/${token}/clock-in`, { body: { projectId: bridge, at: inAt.toISOString() } });
      expect(ci.status, JSON.stringify(ci.body)).toBe(201);
      expect(ci.body.entry.date).toBe(day);
      expect((await api(`/api/t/${token}/clock-out`, { body: { at: outAt.toISOString() } })).status).toBe(200);
      const id = ci.body.entry.id as string;
      expect((await bc.api(`/api/team/time-entries/${id}`, { method: "PUT", body: { status: "approved" } })).status).toBe(200);
      expect(await entry(id)).toMatchObject({ overtime: 0, double: 0, premium: 0 });

      const morning = await hours(bc, bridge, night, next, 4);
      expect(await entry(morning)).toMatchObject({ overtime: 4, premium: 4 * 2000 });
      // Taking the night shift away gives the next day its first 8 hours back.
      expect((await bc.api(`/api/team/time-entries/${id}`, { method: "DELETE" })).status).toBe(200);
      expect(await entry(morning)).toMatchObject({ overtime: 0, premium: 0 });
    });
  });

  describe("holiday pay (ON)", () => {
    let al: string;
    let bo: string;
    let hall: string;
    let labourDay: string;
    let lastDay: string;

    beforeAll(async () => {
      al = await worker(on, "Al");
      bo = await worker(on, "Bo");
      hall = await job(on, "Hall");
      // Al: 5 × 8 h the week before Labour Day's four-week window closes.
      for (const d of ["2026-08-24", "2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28"]) await hours(on, hall, al, d, 8);
      // Bo works Labour Day and then 4 × 10 h.
      labourDay = await hours(on, hall, bo, "2026-09-07", 8);
      for (const d of ["2026-09-08", "2026-09-09", "2026-09-10"]) await hours(on, hall, bo, d, 10);
      lastDay = await hours(on, hall, bo, "2026-09-11", 10);
    });

    const al4Labour = async () => {
      const r = await on.api("/api/pay/period?date=2026-09-07");
      return r.body.employees.find((p: { name: string }) => p.name === "Al").holidays[0];
    };

    test("vacation pay on each cheque counts in the Ontario base; without it, it can't", async () => {
      expect(await al4Labour()).toMatchObject({ key: "labour_day", cents: 8000 });
      expect((await on.api("/api/pay/settings", { method: "PUT", body: { vacationPayPercent: 4 } })).status).toBe(200);
      expect(await al4Labour()).toMatchObject({ cents: 8320 });
      expect((await on.api("/api/pay/settings", { method: "PUT", body: { vacationPayPercent: 4, holidays: { includeVacationPay: false } } })).status).toBe(200);
      expect(await al4Labour()).toMatchObject({ cents: 8000 });
    });

    test("a weekend holiday taken on the next weekday", async () => {
      const put = await on.api("/api/pay/settings", { method: "PUT", body: { holidays: { substituteWeekend: true } } });
      expect(put.status, JSON.stringify(put.body)).toBe(200);
      const xmas = put.body.holidays.filter((h: { key: string; date: string }) => (h.key === "christmas" || h.key === "boxing_day") && h.date.startsWith("2027"));
      expect(xmas).toEqual([expect.objectContaining({ key: "christmas", date: "2027-12-27", observedFrom: "2027-12-25" }), expect.objectContaining({ key: "boxing_day", date: "2027-12-28", observedFrom: "2027-12-26" })]);
      // 2026: Boxing Day is a Saturday, so it moves to Monday the 28th; Christmas (a Friday) stays.
      expect(put.body.holidays.find((h: { key: string; date: string }) => h.key === "boxing_day" && h.date.startsWith("2026"))).toMatchObject({ date: "2026-12-28", observedFrom: "2026-12-26" });
      const period = await on.api("/api/pay/period?date=2027-12-27");
      expect(period.body.holidays.map((h: { date: string }) => h.date)).toEqual(expect.arrayContaining(["2027-12-27", "2027-12-28"]));
      expect(period.body.holidays.some((h: { date: string }) => h.date === "2027-12-25")).toBe(false);
    });

    test("ON construction preset: 7.7 % of wages in lieu, and Labour Day is an ordinary day that counts toward the 44", async () => {
      expect(await entry(labourDay)).toMatchObject({ holiday: 8, overtime: 0 });
      const settings = await on.api("/api/pay/settings");
      expect(settings.body.presets.map((p: { key: string }) => p.key)).toEqual(["on_construction", "on_sewer_watermain", "on_road_building"]);
      const preset = settings.body.presets[0];
      const put = await on.api("/api/pay/settings", { method: "PUT", body: { preset: "on_construction", overtime: preset.overtime, holidays: preset.holidays } });
      expect(put.status, JSON.stringify(put.body)).toBe(200);
      expect(put.body.effective).toMatchObject({ preset: "on_construction", holidays: { method: "pct_of_wages", percent: 7.7, workedMultiplier: 1 } });
      expect(await entry(labourDay)).toMatchObject({ holiday: 0, overtime: 0 });
      expect(await entry(lastDay)).toMatchObject({ overtime: 4, premium: 4 * 2000 });

      const r = await on.api("/api/pay/period?date=2026-09-07");
      const b = r.body.employees.find((p: { name: string }) => p.name === "Bo");
      // 44 straight + 4 at 1.5, overtime counted in: 7.7 % of 200 000.
      expect(b.lines.find((l: { kind: string }) => l.kind === "holiday")).toMatchObject({ amountCents: 15_400, note: "7.7%" });
      expect(b.lines.some((l: { kind: string }) => l.kind === "holiday_worked")).toBe(false);
      expect(b.holidays).toEqual([]);
      // Al worked nothing this period: nothing in lieu, and no per-holiday pay either.
      expect(r.body.employees.find((p: { name: string }) => p.name === "Al")).toBeUndefined();
    });

    test("back to the general rules: the holiday is a holiday again", async () => {
      expect((await on.api("/api/pay/settings", { method: "PUT", body: {} })).status).toBe(200);
      expect(await entry(labourDay)).toMatchObject({ holiday: 8, overtime: 0 });
      expect(await entry(lastDay)).toMatchObject({ overtime: 0 });
      expect((await on.api("/api/pay/settings", { method: "PUT", body: { preset: "qc_construction_residential" } })).status).toBe(200);
      expect((await on.api("/api/pay/settings", { method: "PUT", body: { preset: "made_up" } })).status).toBe(400);
      expect((await on.api("/api/pay/settings", { method: "PUT", body: {} })).status).toBe(200);
    });
  });
});
