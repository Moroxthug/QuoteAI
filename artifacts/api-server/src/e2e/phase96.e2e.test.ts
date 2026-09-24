// Phase 96 — integrations, one level deeper.
//  1. QuickBooks: an invoice with three lines and a holdback goes over line by
//     line, pre-tax, each line with the mapped tax code and the holdback as a
//     negative line; QuickBooks' own total (the fake adds 13 %) matches ours,
//     so no drift note. A cost on a Québec job goes over pre-tax with the
//     GST/QST code its receipt implies; unmapped, tax-included as before.
//  2. Calendar: the account's calendars are listed (Google calendarList,
//     Graph /me/calendars), picking one moves the upcoming events — deleted
//     from the old calendar, posted into the new — and status shows it. A
//     Google connection made before the calendar-list scope is told to
//     reconnect instead of shown an empty list.
//  3. Photos: an office upload gets a ≤480 px JPEG thumbnail; a photo from
//     before this phase gets one the first time it is asked for; a tiny file
//     is served as itself; deleting a photo removes both objects.

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, clientsTable, calendarConnectionsTable, calendarSyncedEventsTable, jobPhotosTable, quickbooksConnectionsTable, quickbooksSyncLogTable } from "@workspace/db";
import { startServer, stopServer, createOrg, cleanupAll, daysFromNow, type TestUser } from "./harness.js";
import { stubHost, unstubHost, requestsTo, resetRecorded, json, type StubbedRequest } from "./vendorStub.js";
import { encryptSecret } from "../lib/crypto.js";
import { ObjectStorageService } from "../lib/objectStorage.js";
import { THUMB_EDGE } from "../jobs/thumbnails.js";

const QBO = "https://sandbox-quickbooks.api.intuit.com/";
const GCAL = "https://www.googleapis.com/";
const GRAPH = "https://graph.microsoft.com/";

async function waitFor<T>(probe: () => Promise<T | null | undefined | false>, label: string, timeoutMs = 10_000): Promise<T> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const v = await probe();
    if (v) return v;
    if (Date.now() > until) throw new Error(`timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 150));
  }
}

async function seedClient(org: TestUser, name: string) {
  const [client] = await db
    .insert(clientsTable)
    .values({ userId: org.userId, name, email: `e2e-p96-${Math.random().toString(36).slice(2)}@example.invalid`, preferredLanguage: "en", dedupKey: `p96-${Math.random().toString(36).slice(2)}-${org.userId}` })
    .returning();
  return client!;
}

describe("Phase 96 — QuickBooks lines, the calendar picker, photo thumbnails", () => {
  let baseUrl = "";

  beforeAll(async () => {
    baseUrl = await startServer();
  });

  afterAll(async () => {
    unstubHost(QBO);
    unstubHost(GCAL);
    unstubHost(GRAPH);
    await cleanupAll();
    await stopServer();
  });

  // ── 1. QuickBooks ──────────────────────────────────────────────────────────

  describe("QuickBooks", () => {
    const realmId = "9130000000000096";
    /** Tax codes the fake knows: 7 = HST ON 13 %, 9 = GST/QST QC 14.975 %. */
    const RATE: Record<string, number> = { "7": 0.13, "9": 0.14975 };

    function fakeQuickbooks() {
      let n = 0;
      stubHost(QBO, (req: StubbedRequest) => {
        const u = new URL(req.url);
        expect(u.pathname.startsWith(`/v3/company/${realmId}/`)).toBe(true);
        const body = req.json as Record<string, unknown>;
        if (u.pathname.endsWith("/query")) {
          const q = u.searchParams.get("query") ?? "";
          if (q.includes("from Item")) return json(200, { QueryResponse: { Item: [{ Id: "17", Name: "QuoteAI Job Revenue" }] } });
          if (q.includes("from Vendor")) return json(200, { QueryResponse: { Vendor: [{ Id: "V-9", DisplayName: "Rona" }] } });
          return json(200, { QueryResponse: {} });
        }
        if (u.pathname.endsWith("/customer")) return json(200, { Customer: { Id: `C-${++n}`, DisplayName: body.DisplayName } });
        // The fake does what QuickBooks does: sums the lines, and adds the tax of each line's code when told TaxExcluded.
        const total = (lines: { Amount: number; SalesItemLineDetail?: { TaxCodeRef?: { value: string } }; AccountBasedExpenseLineDetail?: { TaxCodeRef?: { value: string } } }[]) => {
          const cents = lines.reduce((s, l) => {
            const code = (l.SalesItemLineDetail ?? l.AccountBasedExpenseLineDetail)?.TaxCodeRef?.value;
            const rate = body.GlobalTaxCalculation === "TaxExcluded" && code ? (RATE[code] ?? 0) : 0;
            return s + Math.round(l.Amount * 100) * (1 + rate);
          }, 0);
          return Math.round(cents) / 100;
        };
        if (u.pathname.endsWith("/invoice")) {
          const t = total(body.Line as never);
          return json(200, { Invoice: { Id: `QI-${++n}`, DocNumber: body.DocNumber, SyncToken: "0", TotalAmt: t, Balance: t } });
        }
        if (u.pathname.endsWith("/purchase")) return json(200, { Purchase: { Id: `QX-${++n}`, TotalAmt: total(body.Line as never) } });
        return json(404, { Fault: { Error: [{ Message: `unscripted ${u.pathname}` }] } });
      });
    }

    async function connect(org: TestUser, taxCodeMap: Record<string, { id: string; name: string }>) {
      await db.insert(quickbooksConnectionsTable).values({
        userId: org.userId,
        realmId,
        environment: "sandbox",
        companyName: "Lines Sandbox",
        accessTokenEnc: encryptSecret("qbo-access"),
        refreshTokenEnc: encryptSecret("qbo-refresh"),
        tokenExpiresAt: daysFromNow(1),
        paymentAccount: { id: "35", name: "Chequing" },
        categoryMap: { materials: { id: "64", name: "Job Materials" } },
        incomeAccount: { id: "79", name: "Renovation revenue" },
        taxCodeMap,
        connectedAt: new Date(Date.now() - 60_000),
      });
      fakeQuickbooks();
    }

    test("a sent invoice goes over line by line, pre-tax, with the mapped code and the holdback negative; QuickBooks' total matches", async () => {
      const org = await createOrg({ companyName: "Lines ON Co", province: "ON" });
      await connect(org, { "HST 13%": { id: "7", name: "HST ON" } });
      const client = await seedClient(org, "Line Client");
      const created = await org.api("/api/invoices", {
        body: {
          clientId: client.id,
          lines: [
            { description: "Deck boards", quantity: 10, unitCents: 4_250 },
            { description: "Labour", quantity: 12.5, unitCents: 8_000 },
            { description: "Discount", quantity: 1, unitCents: -2_500 },
          ],
          holdbackPercent: 10,
          dueDays: 15,
        },
      });
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      const id = created.body.invoice.id as string;
      resetRecorded();
      expect((await org.api(`/api/invoices/${id}/send`, { body: {} })).status).toBe(200);
      const call = await waitFor(async () => requestsTo(QBO).find((r) => r.url.endsWith("/invoice")), "Invoice POST");
      const lines = (call.json as { Line: { Amount: number; Description: string; SalesItemLineDetail: Record<string, unknown> }[] }).Line;
      expect(call.json).toMatchObject({ GlobalTaxCalculation: "TaxExcluded" });
      expect(lines.map((l) => [l.Description, l.Amount])).toEqual([
        ["Deck boards", 425],
        ["Labour", 1000],
        ["Discount", -25],
        [expect.stringContaining("Holdback withheld (10%)"), -140],
      ]);
      for (const l of lines) expect(l.SalesItemLineDetail).toMatchObject({ ItemRef: { value: "17" }, TaxCodeRef: { value: "7" } });
      expect(lines[0]!.SalesItemLineDetail).toMatchObject({ Qty: 10, UnitPrice: 42.5 });
      // 1,260.00 taxable + 13 % = 1,423.80, what QuoteAI has too: no drift note in the log.
      const [log] = await db.select().from(quickbooksSyncLogTable).where(and(eq(quickbooksSyncLogTable.userId, org.userId), eq(quickbooksSyncLogTable.entityId, id)));
      expect(log).toMatchObject({ status: "synced", qboType: "Invoice", error: null });
    });

    test("a cost on a Québec job: pre-tax with the GST/QST code when that set is mapped, tax-included when not", async () => {
      const org = await createOrg({ companyName: "Lines QC Co", province: "QC" });
      await connect(org, { "GST 5% + QST 9.975%": { id: "9", name: "GST/QST QC" } });
      const job = await org.api("/api/jobs", { body: { name: "Chalet" } });
      expect(job.status).toBe(201);
      const jobId = job.body.job.id as string;

      resetRecorded();
      const cost = await org.api(`/api/jobs/${jobId}/costs`, { body: { category: "materials", vendor: "Rona", description: "Lumber", totalCents: 114_975, taxBreakdown: { GST: 5_000, QST: 9_975 } } });
      expect(cost.status, JSON.stringify(cost.body)).toBe(201);
      const purchase = await waitFor(async () => requestsTo(QBO).find((r) => r.url.endsWith("/purchase")), "Purchase POST");
      expect(purchase.json).toMatchObject({
        GlobalTaxCalculation: "TaxExcluded",
        Line: [{ Amount: 1000, DetailType: "AccountBasedExpenseLineDetail", AccountBasedExpenseLineDetail: { AccountRef: { value: "64" }, TaxCodeRef: { value: "9" } } }],
      });
      const [log] = await db.select().from(quickbooksSyncLogTable).where(and(eq(quickbooksSyncLogTable.userId, org.userId), eq(quickbooksSyncLogTable.entityId, cost.body.entry.id as string)));
      expect(log).toMatchObject({ status: "synced", qboType: "Purchase", error: null });

      // A GST-only receipt: "GST 5%" is not mapped, so it goes over tax-included, as before Phase 96.
      resetRecorded();
      const gstOnly = await org.api(`/api/jobs/${jobId}/costs`, { body: { category: "materials", vendor: "Rona", description: "Books", totalCents: 10_500, taxBreakdown: { GST: 500 } } });
      expect(gstOnly.status, JSON.stringify(gstOnly.body)).toBe(201);
      const plain = await waitFor(async () => requestsTo(QBO).find((r) => r.url.endsWith("/purchase")), "Purchase POST (unmapped)");
      expect(plain.json).toMatchObject({ GlobalTaxCalculation: "NotApplicable", Line: [{ Amount: 105 }] });
      expect((plain.json as { Line: { AccountBasedExpenseLineDetail: Record<string, unknown> }[] }).Line[0]!.AccountBasedExpenseLineDetail.TaxCodeRef).toBeUndefined();
    });
  });

  // ── 2. Which calendar ──────────────────────────────────────────────────────

  describe("calendar picker", () => {
    test("Google: the writable calendars are listed, picking one moves the upcoming events, and a pre-scope connection is told to reconnect", async () => {
      const org = await createOrg({ companyName: "Picker Co" });
      await db.insert(calendarConnectionsTable).values({
        userId: org.userId,
        provider: "google",
        accountEmail: "cal@gmail.example",
        accessTokenEnc: encryptSecret("ya29.p96"),
        refreshTokenEnc: encryptSecret("1//p96"),
        tokenExpiresAt: daysFromNow(1),
      });
      let nextId = 0;
      let listStatus = 200;
      stubHost(GCAL, (req) => {
        if (req.url.includes("/calendar/v3/users/me/calendarList")) {
          if (listStatus !== 200) return json(listStatus, { error: { message: "Insufficient Permission" } });
          return json(200, {
            items: [
              { id: "cal@gmail.example", summary: "cal@gmail.example", primary: true, accessRole: "owner" },
              { id: "crew@group.calendar.google.com", summary: "Crew", accessRole: "writer" },
              { id: "holidays@group.v.calendar.google.com", summary: "Holidays", accessRole: "reader" },
            ],
          });
        }
        if (req.method === "POST") return json(200, { id: `gevt_${++nextId}` });
        if (req.method === "PATCH") return json(200, { id: req.url.split("/events/")[1]!.split("?")[0] });
        if (req.method === "DELETE") return new Response(null, { status: 204 });
        return json(404, {});
      });

      // A future milestone lands in the primary calendar first.
      const job = await org.api("/api/jobs", { body: { name: "Garage" } });
      expect(job.status).toBe(201);
      const jobId = job.body.job.id as string;
      const ms = await org.api(`/api/jobs/${jobId}/milestones`, { body: { title: "Slab", plannedStart: "2031-05-04", plannedEnd: "2031-05-05" } });
      expect(ms.status, JSON.stringify(ms.body)).toBe(201);
      const milestoneId = ms.body.milestone.id as string;
      const first = await waitFor(async () => (await db.select().from(calendarSyncedEventsTable).where(eq(calendarSyncedEventsTable.milestoneId, milestoneId)))[0], "first sync");
      expect(first.externalEventId).toBe("gevt_1");
      expect(requestsTo(GCAL).find((r) => r.method === "POST")!.url).toContain("/calendars/primary/events");

      // The list: primary first (as "primary"), the writable one, never the read-only one.
      const list = await org.api("/api/calendar/google/calendars");
      expect(list.status, JSON.stringify(list.body)).toBe(200);
      expect(list.body).toMatchObject({ current: { id: "primary", name: null }, needsReconnect: false });
      expect(list.body.calendars).toEqual([
        { id: "primary", name: "cal@gmail.example", isPrimary: true, canWrite: true },
        { id: "crew@group.calendar.google.com", name: "Crew", isPrimary: false, canWrite: true },
      ]);

      // Picking "Crew": the event is deleted from primary and posted into Crew; the row points at the new event.
      resetRecorded();
      const pick = await org.api("/api/calendar/google/calendar", { method: "PUT", body: { calendarId: "crew@group.calendar.google.com", calendarName: "Crew" } });
      expect(pick.status, JSON.stringify(pick.body)).toBe(200);
      expect(pick.body).toMatchObject({ success: true, calendarId: "crew@group.calendar.google.com", calendarName: "Crew", removed: 1, pushed: 1, failed: 0 });
      const del = requestsTo(GCAL).find((r) => r.method === "DELETE")!;
      expect(del.url).toContain("/calendars/primary/events/gevt_1");
      const post = requestsTo(GCAL).find((r) => r.method === "POST")!;
      expect(post.url).toContain("/calendars/crew%40group.calendar.google.com/events");
      expect(post.json).toMatchObject({ summary: expect.stringContaining("Slab"), start: { date: "2031-05-04" } });
      const [moved] = await db.select().from(calendarSyncedEventsTable).where(eq(calendarSyncedEventsTable.milestoneId, milestoneId));
      expect(moved).toMatchObject({ externalEventId: "gevt_2", status: "synced" });
      const status = await org.api("/api/calendar/status");
      expect(status.body.connections).toEqual([expect.objectContaining({ provider: "google", calendarId: "crew@group.calendar.google.com", calendarName: "Crew" })]);

      // From now on edits go to Crew too.
      resetRecorded();
      expect((await org.api(`/api/jobs/${jobId}/milestones/${milestoneId}`, { method: "PUT", body: { plannedStart: "2031-05-06", plannedEnd: "2031-05-06" } })).status).toBe(200);
      const patch = await waitFor(async () => requestsTo(GCAL).find((r) => r.method === "PATCH"), "PATCH after the move");
      expect(patch.url).toContain("/calendars/crew%40group.calendar.google.com/events/gevt_2");

      // Same calendar again: nothing moves, the name is just kept.
      resetRecorded();
      const same = await org.api("/api/calendar/google/calendar", { method: "PUT", body: { calendarId: "crew@group.calendar.google.com", calendarName: "Crew (renamed)" } });
      expect(same.body).toMatchObject({ removed: 0, pushed: 0 });
      expect(requestsTo(GCAL)).toHaveLength(0);

      // Back to primary: the name clears.
      const back = await org.api("/api/calendar/google/calendar", { method: "PUT", body: { calendarId: "primary" } });
      expect(back.body).toMatchObject({ calendarId: "primary", calendarName: null, removed: 1, pushed: 1 });

      // A token from before the calendar-list scope: Google answers 403, the person is told to reconnect.
      listStatus = 403;
      const stale = await org.api("/api/calendar/google/calendars");
      expect(stale.status).toBe(200);
      expect(stale.body).toMatchObject({ calendars: [], needsReconnect: true });

      // Nothing connected → 404, not a vendor call.
      expect((await org.api("/api/calendar/outlook/calendars")).status).toBe(404);
      unstubHost(GCAL);
    });

    test("Outlook: the mailbox's calendars, the default one as \"primary\", and new events go to the picked one", async () => {
      const org = await createOrg({ companyName: "Picker Outlook Co" });
      await db.insert(calendarConnectionsTable).values({
        userId: org.userId,
        provider: "outlook",
        accountEmail: "cal@outlook.example",
        accessTokenEnc: encryptSecret("eyJ-p96"),
        refreshTokenEnc: encryptSecret("0.p96"),
        tokenExpiresAt: daysFromNow(1),
      });
      let nextId = 0;
      stubHost(GRAPH, (req) => {
        if (req.url.includes("/v1.0/me/calendars?")) {
          return json(200, { value: [{ id: "AAMk-default", name: "Calendar", isDefaultCalendar: true, canEdit: true }, { id: "AAMk-jobs", name: "Jobs", isDefaultCalendar: false, canEdit: true }, { id: "AAMk-shared", name: "Shared (read)", canEdit: false }] });
        }
        if (req.method === "POST") return json(201, { id: `oevt_${++nextId}` });
        if (req.method === "PATCH") return json(200, { id: req.url.split("/events/")[1]! });
        if (req.method === "DELETE") return new Response(null, { status: 204 });
        return json(404, {});
      });
      const list = await org.api("/api/calendar/outlook/calendars");
      expect(list.status, JSON.stringify(list.body)).toBe(200);
      expect(list.body.calendars).toEqual([
        { id: "primary", name: "Calendar", isPrimary: true, canWrite: true },
        { id: "AAMk-jobs", name: "Jobs", isPrimary: false, canWrite: true },
      ]);
      const pick = await org.api("/api/calendar/outlook/calendar", { method: "PUT", body: { calendarId: "AAMk-jobs", calendarName: "Jobs" } });
      expect(pick.status, JSON.stringify(pick.body)).toBe(200);
      expect(pick.body).toMatchObject({ removed: 0, pushed: 0 });

      resetRecorded();
      const job = await org.api("/api/jobs", { body: { name: "Porch" } });
      const ms = await org.api(`/api/jobs/${job.body.job.id}/milestones`, { body: { title: "Footings", plannedStart: "2031-06-01" } });
      expect(ms.status, JSON.stringify(ms.body)).toBe(201);
      const post = await waitFor(async () => requestsTo(GRAPH).find((r) => r.method === "POST"), "Graph POST");
      expect(post.url).toContain("/v1.0/me/calendars/AAMk-jobs/events");
      expect(post.json).toMatchObject({ subject: expect.stringContaining("Footings"), isAllDay: true });
      unstubHost(GRAPH);
    });
  });

  // ── 3. Photo thumbnails ────────────────────────────────────────────────────

  describe("photo thumbnails", () => {
    const storage = new ObjectStorageService();
    const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

    async function upload(org: TestUser, jobId: string, bytes: Buffer, name: string, type: string) {
      const fd = new FormData();
      fd.append("file", new Blob([new Uint8Array(bytes)], { type }), name);
      const res = await org.api(`/api/jobs/${jobId}/photos`, { method: "POST", form: fd });
      expect(res.status, JSON.stringify(res.body)).toBe(201);
      return res.body.photo as { id: string; hasThumb: boolean };
    }
    async function fetchThumb(org: TestUser, jobId: string, photoId: string) {
      const res = await fetch(`${baseUrl}/api/jobs/${jobId}/photos/${photoId}/file?size=thumb`, { headers: { authorization: `Bearer ${org.token}` } });
      return { status: res.status, type: res.headers.get("content-type") ?? "", bytes: Buffer.from(await res.arrayBuffer()) };
    }
    async function dims(bytes: Buffer) {
      const sharp = (await import("sharp")).default;
      const m = await sharp(bytes).metadata();
      return { width: m.width!, height: m.height!, format: m.format };
    }

    test("an office upload gets a small JPEG; an older photo gets one on first request; a tiny file is served as itself; delete removes both", async () => {
      const org = await createOrg({ companyName: "Thumb Co" });
      const job = await org.api("/api/jobs", { body: { name: "Roof" } });
      const jobId = job.body.job.id as string;
      const sharp = (await import("sharp")).default;
      // A phone-sized photo, portrait via EXIF orientation 6 (the thumbnail must come out upright).
      const big = await sharp({ create: { width: 2400, height: 1600, channels: 3, background: { r: 40, g: 90, b: 160 }, noise: { type: "gaussian", mean: 128, sigma: 40 } } })
        .jpeg({ quality: 90 })
        .withMetadata({ orientation: 6 })
        .toBuffer();
      expect(big.length).toBeGreaterThan(40 * 1024 - 1);

      const photo = await upload(org, jobId, big, "roof.jpg", "image/jpeg");
      expect(photo.hasThumb).toBe(true);
      const [row] = await db.select().from(jobPhotosTable).where(eq(jobPhotosTable.id, photo.id));
      expect(row!.thumbUrl).toBe(`${row!.fileUrl}.thumb.jpg`);
      const thumb = await fetchThumb(org, jobId, photo.id);
      expect(thumb.status).toBe(200);
      expect(thumb.type).toContain("image/jpeg");
      expect(thumb.bytes.length).toBeLessThan(big.length / 10);
      const d = await dims(thumb.bytes);
      expect(Math.max(d.width, d.height)).toBe(THUMB_EDGE);
      expect(d.height, "rotated upright from the EXIF orientation").toBeGreaterThan(d.width);
      // The original is untouched.
      const full = await fetch(`${baseUrl}/api/jobs/${jobId}/photos/${photo.id}/file`, { headers: { authorization: `Bearer ${org.token}` } });
      expect((await full.arrayBuffer()).byteLength).toBe(big.length);

      // A photo from before this phase: no thumb_url, no object. The first thumbnail request makes and stores one.
      await db.update(jobPhotosTable).set({ thumbUrl: null }).where(eq(jobPhotosTable.id, photo.id));
      await storage.deleteObjectBuffer(row!.thumbUrl!.replace(/^\/objects\//, ""));
      const lazy = await fetchThumb(org, jobId, photo.id);
      expect(lazy.status).toBe(200);
      expect(lazy.type).toContain("image/jpeg");
      expect(Math.max((await dims(lazy.bytes)).width, (await dims(lazy.bytes)).height)).toBe(THUMB_EDGE);
      const [after] = await db.select().from(jobPhotosTable).where(eq(jobPhotosTable.id, photo.id));
      expect(after!.thumbUrl).toBe(`${row!.fileUrl}.thumb.jpg`);
      expect((await storage.downloadPrivateObjectBuffer(after!.thumbUrl!.replace(/^\/objects\//, ""))).length).toBe(lazy.bytes.length);
      const list = await org.api(`/api/jobs/${jobId}/photos`);
      expect(list.body.photos.find((p: { id: string }) => p.id === photo.id)).toMatchObject({ hasThumb: true });

      // A 1 px PNG: nothing to shrink, served as itself under ?size=thumb.
      const tiny = await upload(org, jobId, PNG_1PX, "dot.png", "image/png");
      expect(tiny.hasThumb).toBe(false);
      const asIs = await fetchThumb(org, jobId, tiny.id);
      expect(asIs.status).toBe(200);
      expect(asIs.type).toContain("image/png");
      expect(asIs.bytes.equals(PNG_1PX)).toBe(true);

      // Delete: original and thumbnail both gone from storage. Checked through the
      // listing — a download of a just-removed object can still answer from
      // Supabase's cache for a while.
      const originalPath = row!.fileUrl.replace(/^\/objects\//, "");
      const thumbPath = after!.thumbUrl!.replace(/^\/objects\//, "");
      const folder = originalPath.replace(/\/[^/]+$/, "");
      expect((await storage.listPrivateObjects(folder)).map((o) => o.path)).toEqual(expect.arrayContaining([originalPath, thumbPath]));
      expect((await org.api(`/api/jobs/${jobId}/photos/${photo.id}`, { method: "DELETE" })).status).toBe(200);
      const left = (await storage.listPrivateObjects(folder)).map((o) => o.path);
      expect(left).not.toContain(originalPath);
      expect(left).not.toContain(thumbPath);
    });
  });
});
