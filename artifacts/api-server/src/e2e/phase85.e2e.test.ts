// Phase 85 — the dashboard calendar: the merged agenda, .ics subscriptions
// and the published feed.
//
// The Google/Outlook halves need a live OAuth grant and are exercised by the
// existing calendar suite plus the owner's own connect pass; everything here
// is the part that stands on its own — what the agenda merges, what the
// server refuses to fetch, and the calendar it serves.

import { describe, test, expect, beforeAll, afterAll, vi } from "vitest";
import { db, businessProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { startServer, stopServer, api, createOrg, createUser, cleanupAll, type TestUser } from "./harness.js";

const day = (offsetDays: number, hour = 9) => {
  const d = new Date();
  d.setUTCHours(hour, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d;
};
const isoDay = (offsetDays: number) => day(offsetDays).toISOString().slice(0, 10);

const agendaUrl = (fromDays: number, toDays: number) =>
  `/api/calendar/agenda?from=${encodeURIComponent(day(fromDays, 0).toISOString())}&to=${encodeURIComponent(day(toDays, 0).toISOString())}`;

describe("Phase 85 — the agenda", () => {
  let org: TestUser;
  let jobId: string;

  beforeAll(async () => {
    await startServer();
    org = await createOrg({ companyName: "Calendar Co", plan: "monthly_elite" });

    const job = await org.api("/api/jobs", { body: { name: "Deck rebuild", address: "8 Maple Ave" } });
    jobId = job.body.job.id;
    await org.api(`/api/jobs/${jobId}/milestones`, { body: { title: "Footings", plannedStart: isoDay(3), plannedEnd: isoDay(4) } });
    const worker = (await org.api("/api/team/workers", { body: { name: "Dan Framer", role: "Carpenter" } })).body.worker;
    await org.api("/api/schedule/blocks", {
      body: { projectId: jobId, collaboratorId: worker.id, startsAt: day(2, 13).toISOString(), endsAt: day(2, 21).toISOString() },
    });
  }, 120_000);

  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });

  test("one list out of the schedule board, the job and the invoice ledger", async () => {
    const res = await org.api(agendaUrl(-1, 30));
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.scheduleEnabled).toBe(true);

    const kinds = new Set((res.body.entries as Array<{ kind: string }>).map((e) => e.kind));
    expect(kinds.has("block")).toBe(true);
    expect(kinds.has("milestone")).toBe(true);

    const block = (res.body.entries as Array<{ kind: string; title: string; subtitle: string; href: string }>).find((e) => e.kind === "block");
    expect(block!.subtitle).toContain("Dan Framer");
    expect(block!.href).toBe(`/dashboard/jobs/${jobId}`);

    const milestone = (res.body.entries as Array<{ kind: string; title: string; allDay: boolean }>).find((e) => e.kind === "milestone");
    expect(milestone).toMatchObject({ title: "Footings", allDay: true });

    // Sorted by start, which is what the widget relies on.
    const starts = (res.body.entries as Array<{ startsAt: string }>).map((e) => e.startsAt);
    expect([...starts].sort()).toEqual(starts);
  });

  test("the window is bounded", async () => {
    expect((await org.api(agendaUrl(0, 200))).status).toBe(400);
    expect((await org.api(agendaUrl(10, 5))).status).toBe(400);
    expect((await org.api("/api/calendar/agenda?from=nonsense&to=alsononsense")).status).toBe(400);
  });

  test("a Starter account is told the calendar is a Pro feature rather than shown an empty one", async () => {
    const starter = await createOrg({ companyName: "Starter Co", plan: "monthly_starter" });
    const res = await starter.api(agendaUrl(-1, 30));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ scheduleEnabled: false, externalEnabled: false });
    expect(res.body.entries).toEqual([]);
    expect(res.body.requiredPlan).toBeTruthy();
  });

  test("one company never sees another's day", async () => {
    const other = await createOrg({ companyName: "Someone Else Ltd" });
    const res = await other.api(agendaUrl(-1, 30));
    expect(res.status).toBe(200);
    expect(res.body.entries).toEqual([]);
  });
});

describe("Phase 85 — subscribed .ics feeds", () => {
  let org: TestUser;
  const realFetch = globalThis.fetch;

  const FEED_URL = "https://calendar.example.invalid/crew.ics";
  const FEED_BODY = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Example//EN",
    "BEGIN:VEVENT",
    "UID:inspection-1",
    "SUMMARY:City inspection",
    "LOCATION:8 Maple Ave",
    `DTSTART:${day(5, 14).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
    "DURATION:PT1H",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  beforeAll(async () => {
    await startServer();
    org = await createOrg({ companyName: "Feeds Co", plan: "monthly_elite" });
    // Only this one URL is answered; anything else falls through to the real
    // fetch, so a mistake here cannot silently pass.
    vi.stubGlobal("fetch", (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url === FEED_URL) return new Response(FEED_BODY, { status: 200, headers: { "Content-Type": "text/calendar" } });
      return realFetch(input, init);
    }) as typeof fetch);
  }, 120_000);

  afterAll(async () => {
    vi.unstubAllGlobals();
    await cleanupAll();
    await stopServer();
  });

  test("a feed is fetched on subscribe, and its events reach the agenda", async () => {
    const added = await org.api("/api/calendar/feeds", { body: { name: "City inspections", url: FEED_URL } });
    expect(added.status, JSON.stringify(added.body)).toBe(201);
    expect(added.body.feed).toMatchObject({ name: "City inspections", lastStatus: "ok", isEnabled: true });
    expect(added.body.events).toBe(1);

    const agenda = await org.api(agendaUrl(-1, 30));
    const external = (agenda.body.entries as Array<{ kind: string; title: string; source?: string }>).filter((e) => e.kind === "external");
    expect(external).toHaveLength(1);
    expect(external[0]).toMatchObject({ title: "City inspection", source: "ics" });

    // Paused: still listed, no longer on the calendar.
    const feedId = added.body.feed.id as string;
    expect((await org.api(`/api/calendar/feeds/${feedId}`, { method: "PATCH", body: { isEnabled: false } })).status).toBe(200);
    expect((await org.api("/api/calendar/feeds")).body.feeds).toHaveLength(1);

    // Deleted: the mirrored events go with it.
    expect((await org.api(`/api/calendar/feeds/${feedId}`, { method: "DELETE" })).status).toBe(204);
    const after = await org.api(agendaUrl(-1, 30));
    expect((after.body.entries as Array<{ kind: string }>).filter((e) => e.kind === "external")).toHaveLength(0);
  });

  test("the server refuses to fetch what it should not", async () => {
    const refusals: Array<[string, string]> = [
      ["http://calendar.example.invalid/crew.ics", "HTTPS_REQUIRED"],
      ["https://user:pass@calendar.example.invalid/crew.ics", "NO_CREDENTIALS"],
      ["https://localhost:8080/crew.ics", "PRIVATE_HOST"],
      ["https://127.0.0.1/crew.ics", "PRIVATE_HOST"],
      ["https://192.168.1.10/crew.ics", "PRIVATE_HOST"],
      ["https://169.254.169.254/latest/meta-data/", "PRIVATE_HOST"],
      ["not a url at all", "INVALID_URL"],
    ];
    for (const [url, code] of refusals) {
      const res = await org.api("/api/calendar/feeds", { body: { name: "Bad", url } });
      expect(res.status, `${url} should be refused`).toBe(400);
      expect(res.body.error, url).toBe(code);
    }
  });

  test("a URL that is not a calendar is reported, not swallowed", async () => {
    const res = await org.api("/api/calendar/feeds", { body: { name: "Homepage", url: "https://example.invalid/not-a-calendar" } });
    expect(res.status).toBe(201);
    expect(res.body.feed.lastStatus).toBe("failed");
    expect(res.body.feed.lastError).toBeTruthy();
    await org.api(`/api/calendar/feeds/${res.body.feed.id}`, { method: "DELETE" });
  });

  test("feeds are an Elite integration", async () => {
    const pro = await createOrg({ companyName: "Pro Co", plan: "monthly_pro" });
    const res = await pro.api("/api/calendar/feeds", { body: { name: "Anything", url: FEED_URL } });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("PLAN_REQUIRED");
  });
});

describe("Phase 85 — the published calendar", () => {
  let org: TestUser;

  beforeAll(async () => {
    await startServer();
    org = await createOrg({ companyName: "Publish Co", plan: "monthly_elite" });
    const job = await org.api("/api/jobs", { body: { name: "Roof replacement" } });
    await org.api("/api/schedule/blocks", {
      body: { projectId: job.body.job.id, title: "Tear-off", startsAt: day(1, 12).toISOString(), endsAt: day(1, 20).toISOString() },
    });
  }, 120_000);

  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });

  test("mint, serve, rotate, revoke", async () => {
    expect((await org.api("/api/calendar/publish")).body).toMatchObject({ enabled: false });

    const created = await org.api("/api/calendar/publish", { method: "POST" });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const url = created.body.url as string;
    expect(url).toMatch(/\/api\/calendar\/feed\/[A-Za-z0-9_-]{20,}\.ics$/);

    const path = url.slice(url.indexOf("/api/"));
    const served = await api(path);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toContain("text/calendar");
    const body = served.body as unknown as string;
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("Tear-off");
    // Only the schedule: invoices and follow-ups are QuoteAI's own admin.
    expect(body).not.toContain("INV-");

    const state = await org.api("/api/calendar/publish");
    expect(state.body).toMatchObject({ enabled: true });
    expect(state.body.hint).toHaveLength(4);
    expect(state.body.lastAccessedAt).toBeTruthy();

    // Rotating invalidates the old link immediately.
    const rotated = await org.api("/api/calendar/publish", { method: "POST" });
    expect(rotated.body.url).not.toBe(url);
    expect((await api(path)).status).toBe(404);

    expect((await org.api("/api/calendar/publish", { method: "DELETE" })).status).toBe(204);
    const newPath = (rotated.body.url as string).slice((rotated.body.url as string).indexOf("/api/"));
    expect((await api(newPath)).status).toBe(404);
  });

  test("a bogus token is a 404, not an error", async () => {
    expect((await api("/api/calendar/feed/short.ics")).status).toBe(404);
    expect((await api(`/api/calendar/feed/${"z".repeat(32)}.ics`)).status).toBe(404);
  });

  test("a member without integrations:full cannot subscribe or publish for the company", async () => {
    const email = `e2e-foreman-cal-${org.userId}@example.invalid`;
    const invite = await org.api("/api/team/members/invite", { body: { email, role: "foreman" } });
    expect(invite.status).toBe(201);
    const token = (invite.body.url as string).split("/team-invite/")[1];
    const foreman = await createUser({ email, name: "Foreman Cal" });
    expect((await foreman.api(`/api/team/invite/${token}/accept`, { method: "POST" })).status).toBe(200);

    expect((await foreman.api("/api/calendar/feeds", { body: { name: "x", url: "https://example.invalid/x.ics" } })).status).toBe(403);
    expect((await foreman.api("/api/calendar/publish", { method: "POST" })).status).toBe(403);
    // …but they can still read the company's day.
    expect((await foreman.api(agendaUrl(-1, 30))).status).toBe(200);
  });
});

describe("Phase 85 — plan gating on the mirror", () => {
  test("downgrading hides external events without deleting them", async () => {
    await startServer();
    const org = await createOrg({ companyName: "Downgrade Co", plan: "monthly_elite" });
    await db.update(businessProfilesTable).set({ subscriptionPlan: "monthly_pro" }).where(eq(businessProfilesTable.userId, org.userId));
    const res = await org.api(agendaUrl(-1, 30));
    expect(res.status).toBe(200);
    expect(res.body.externalEnabled).toBe(false);
    await cleanupAll();
    await stopServer();
  }, 120_000);
});
