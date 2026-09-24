// Phase 97 — the paths that had no end-to-end test.
//  1. Change orders over real HTTP: draft → edit → a second draft deleted →
//     contractor signs → sent (from the contractor's Gmail) → locked → the
//     client verifies by code and signs → the job value, the schedule, the
//     calendar events and the final invoice follow; the final invoice goes to
//     QuickBooks after one failed attempt and a retry from the sync log.
//  2. Job photos: upload (a replayed offline upload is the same row), edit,
//     share by email with inline thumbnails, by WhatsApp, WhatsApp falling
//     back to email, every refusal (no client, unsubscribed, foreign photo),
//     delete.
//  3. The job assistant chat with a scripted model: a read tool feeds the
//     next model turn, proposals write nothing until confirmed, confirm /
//     dismiss / twice, a refused proposal goes back to the model as an error,
//     draft → send → pay through three cards, history, start over, failures.

import { randomUUID } from "node:crypto";
import { describe, test, expect, beforeAll, afterAll, afterEach } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  db,
  quotesTable,
  contractsTable,
  contractSignersTable,
  projectsTable,
  milestonesTable,
  changeOrdersTable,
  clientsTable,
  invoicesTable,
  jobPhotosTable,
  projectTasksTable,
  notificationsTable,
  auditLogTable,
  emailConnectionsTable,
  calendarConnectionsTable,
  calendarSyncedEventsTable,
  quickbooksConnectionsTable,
  quickbooksSyncLogTable,
  whatsappConnectionsTable,
} from "@workspace/db";
import "../automations/index.js";
import { raiseAutomation } from "../lib/automation.js";
import { logContractEvent, finalizeContract } from "../contracts/service.js";
import { applySignedChangeOrder } from "../jobs/changeOrders.js";
import { encryptSecret } from "../lib/crypto.js";
import { TINY_PNG_DATA_URL } from "../lib/pngDataUrl.js";
import { startServer, stopServer, createOrg, cleanupAll, seedQuote, api, daysFromNow } from "./harness.js";
import { installVendorStubs, stubHost, unstubHost, requestsTo, resetRecorded, json, type StubbedRequest } from "./vendorStub.js";
import { emailsTo } from "./mailbox.js";

const GMAIL = "https://gmail.googleapis.com/";
const GCAL = "https://www.googleapis.com/";
const QBO = "https://sandbox-quickbooks.api.intuit.com/";
const GRAPH = "https://graph.facebook.com/";
const AI = "http://127.0.0.1:9/";

type Org = Awaited<ReturnType<typeof createOrg>>;

const uniq = () => Math.random().toString(36).slice(2, 10);

async function waitFor<T>(probe: () => Promise<T | null | undefined | false>, label: string, timeoutMs = 10_000): Promise<T> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const v = await probe();
    if (v) return v;
    if (Date.now() > until) throw new Error(`timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 150));
  }
}

const isoDay = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const plusDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** The HTML part of a Gmail API `raw` message (base64url RFC 2822, base64 parts). */
function gmailHtml(req: StubbedRequest): { headers: string; html: string } {
  const raw = Buffer.from((req.json as { raw: string }).raw, "base64url").toString("utf8");
  const headers = raw.split("\r\n\r\n")[0]!;
  const m = /Content-Type: text\/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n([A-Za-z0-9+/=\r\n]+?)\r\n--/.exec(raw);
  return { headers, html: m ? Buffer.from(m[1]!.replace(/\r\n/g, ""), "base64").toString("utf8") : "" };
}

/**
 * Accepted quote → contract signed by both sides → job set up (the
 * showcase chain, without the milestone completion), for a client whose
 * email is unique to this test.
 */
async function signedJob(org: Org, clientEmail: string) {
  const quote = await seedQuote(org.userId, { province: "ON", clientEmail, clientName: "Robin Client" });
  await db.update(quotesTable).set({ status: "accepted", acceptedAt: new Date(), acceptedByName: "Robin Client" }).where(eq(quotesTable.id, quote.id));
  await raiseAutomation({ event: "quote.accepted", userId: org.userId, entityType: "quote", entityId: quote.id, payload: { acceptedByName: "Robin Client" } });
  const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.quoteId, quote.id));
  expect(contract, "contract drafted on acceptance").toBeDefined();
  const signers = await db.select().from(contractSignersTable).where(eq(contractSignersTable.contractId, contract!.id));
  for (const s of signers) {
    await db.update(contractSignersTable).set({ status: "signed", name: s.role === "contractor" ? "E2E Test Co" : "Robin Client", signatureType: "typed", signatureData: "signed", consentText: "test consent", signedAt: new Date() }).where(eq(contractSignersTable.id, s.id));
    await logContractEvent({ contractId: contract!.id, type: s.role === "contractor" ? "contractor_signed" : "signed", actor: s.role === "contractor" ? "contractor" : "customer", signerId: s.id });
  }
  await finalizeContract(contract!.id);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.contractId, contract!.id));
  expect(project, "job set up by contract.signed").toBeDefined();
  await db.update(projectsTable).set({ setupStatus: "confirmed", setupConfirmedAt: new Date(), status: "active" }).where(eq(projectsTable.id, project!.id));
  return { quote, contract: contract!, project: project! };
}

describe("Phase 97 — change orders, job photos, the job assistant", () => {
  let baseUrl = "";

  beforeAll(async () => {
    baseUrl = await startServer();
    installVendorStubs();
  });

  afterEach(() => {
    for (const h of [GMAIL, GCAL, QBO, GRAPH, AI]) unstubHost(h);
    resetRecorded();
  });

  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });

  // ── 1. Change orders ───────────────────────────────────────────────────────

  test("change order: draft → edit → sign → sent from Gmail → locked → client signs → value, schedule, calendar, final invoice, QuickBooks", async () => {
    const org = await createOrg({ companyName: "Change Order Co" });
    const clientEmail = `co-client-${uniq()}@example.invalid`;
    const gmailAccount = `owner-${uniq()}@gmail.example`;
    await db.insert(emailConnectionsTable).values({ userId: org.userId, provider: "google", accountEmail: gmailAccount, accessTokenEnc: encryptSecret("ya29.p97-mail"), refreshTokenEnc: encryptSecret("1//p97-mail"), tokenExpiresAt: daysFromNow(1) });
    stubHost(GMAIL, () => json(200, { id: "msg_p97", threadId: "thr_p97" }));

    const { contract, project } = await signedJob(org, clientEmail);
    const jobId = project.id;

    // A dated, not-yet-started milestone on the calendar, so the schedule shift has something to move.
    await db.insert(calendarConnectionsTable).values({ userId: org.userId, provider: "google", accountEmail: gmailAccount, accessTokenEnc: encryptSecret("ya29.p97-cal"), refreshTokenEnc: encryptSecret("1//p97-cal"), tokenExpiresAt: daysFromNow(1) });
    let gcalIds = 0;
    stubHost(GCAL, (req) => {
      if (req.method === "POST") return json(200, { id: `p97evt_${++gcalIds}` });
      if (req.method === "PATCH") return json(200, { id: req.url.split("/events/")[1]!.split("?")[0] });
      if (req.method === "DELETE") return new Response(null, { status: 204 });
      return json(404, {});
    });
    const [milestone] = await db.select().from(milestonesTable).where(and(eq(milestonesTable.projectId, jobId), eq(milestonesTable.status, "planned")));
    expect(milestone, "a planned milestone from the contract").toBeDefined();
    const dated = await org.api(`/api/jobs/${jobId}/milestones/${milestone!.id}`, { method: "PUT", body: { plannedStart: "2031-05-05", plannedEnd: "2031-05-09" } });
    expect(dated.status, JSON.stringify(dated.body)).toBe(200);
    const event = await waitFor(async () => (await db.select().from(calendarSyncedEventsTable).where(and(eq(calendarSyncedEventsTable.milestoneId, milestone!.id), eq(calendarSyncedEventsTable.status, "synced"))))[0], "milestone on the calendar");
    await db.update(projectsTable).set({ plannedEnd: new Date("2031-06-30T00:00:00Z") }).where(eq(projectsTable.id, jobId));
    const [before] = await db.select().from(projectsTable).where(eq(projectsTable.id, jobId));
    resetRecorded();

    // Draft. A body without items is refused.
    expect((await org.api(`/api/jobs/${jobId}/change-orders`, { body: { title: "Nothing", items: [] } })).status).toBe(400);
    const created = await org.api(`/api/jobs/${jobId}/change-orders`, {
      body: {
        title: "Pot lights in the hallway",
        description: "Client added four pot lights in the upstairs hallway.",
        items: [
          { descrizione: "Pot light, supply and install", um: "ea", quantita: 4, prezzoUnitario: 200, totale: 800 },
          { descrizione: "Dimmer switch", um: "ea", quantita: 1, prezzoUnitario: 400, totale: 400 },
        ],
        scheduleDeltaDays: 3,
      },
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const coId = created.body.changeOrder.id as string;
    const docId = created.body.documentContractId as string;
    expect(created.body.changeOrder).toMatchObject({ number: "CO-01", status: "draft" });
    let [co] = await db.select().from(changeOrdersTable).where(eq(changeOrdersTable.id, coId));
    expect({ sub: co!.subtotalCents, tax: co!.taxCents, total: co!.totalCents }).toEqual({ sub: 120_000, tax: 15_600, total: 135_600 });

    // A second draft is numbered CO-02 and can be deleted with its document.
    const second = await org.api(`/api/jobs/${jobId}/change-orders`, { body: { title: "Scrap", items: [{ descrizione: "x", prezzoUnitario: 10, totale: 10 }] } });
    expect(second.status).toBe(201);
    expect(second.body.changeOrder.number).toBe("CO-02");
    expect((await org.api(`/api/jobs/${jobId}/change-orders/${second.body.changeOrder.id}`, { method: "DELETE" })).status).toBe(200);
    expect(await db.select().from(contractsTable).where(eq(contractsTable.id, second.body.documentContractId))).toHaveLength(0);

    // Edit the draft: price and schedule change, the document follows.
    const edited = await org.api(`/api/jobs/${jobId}/change-orders/${coId}`, {
      method: "PUT",
      body: { items: [{ descrizione: "Pot light, supply and install", um: "ea", quantita: 5, prezzoUnitario: 200, totale: 1000 }, { descrizione: "Dimmer switch", um: "ea", quantita: 1, prezzoUnitario: 500, totale: 500 }], scheduleDeltaDays: 7 },
    });
    expect(edited.status, JSON.stringify(edited.body)).toBe(200);
    [co] = await db.select().from(changeOrdersTable).where(eq(changeOrdersTable.id, coId));
    expect({ sub: co!.subtotalCents, total: co!.totalCents, delta: co!.scheduleDeltaDays }).toEqual({ sub: 150_000, total: 169_500, delta: 7 });
    const [doc] = await db.select().from(contractsTable).where(eq(contractsTable.id, docId));
    expect(doc!).toMatchObject({ kind: "change_order", parentContractId: contract.id, contractValueCents: 169_500, contractNumber: `${contract.contractNumber}-CO-01` });
    expect(JSON.stringify(doc!.document)).toContain("7 calendar days");

    // Sending before signing is refused; the contractor signs, then it goes out from their Gmail.
    expect((await org.api(`/api/contracts/${docId}/send`, { body: {} })).status).toBe(409);
    const signed = await org.api(`/api/contracts/${docId}/sign`, { body: { name: "Owner Person", signatureType: "typed", signatureData: "Owner Person", consent: true } });
    expect(signed.status, JSON.stringify(signed.body)).toBe(200);
    const sent = await org.api(`/api/contracts/${docId}/send`, { body: {} });
    expect(sent.status, JSON.stringify(sent.body)).toBe(200);
    const mails = requestsTo(GMAIL);
    expect(mails, "the signing link went out through Gmail").toHaveLength(1);
    const { headers, html } = gmailHtml(mails[0]!);
    expect(headers).toMatch(new RegExp(`^To: .*${clientEmail.replace(/\./g, "\\.")}`, "m"));
    expect(headers).toMatch(new RegExp(`^From: .*<${gmailAccount.replace(/\./g, "\\.")}>`, "m"));
    const signToken = /\/sign\/([A-Za-z0-9_-]+)/.exec(html)?.[1];
    expect(signToken, "a /sign/ link in the email").toBeTruthy();

    // Once sent it is locked; the job page shows it as sent and the value has not moved.
    expect((await org.api(`/api/jobs/${jobId}/change-orders/${coId}`, { method: "PUT", body: { title: "Too late" } })).status).toBe(409);
    expect((await org.api(`/api/jobs/${jobId}/change-orders/${coId}`, { method: "DELETE" })).status).toBe(409);
    const detail = await org.api(`/api/jobs/${jobId}`);
    expect(detail.body.changeOrders.find((c: { id: string }) => c.id === coId)).toMatchObject({ status: "sent" });
    expect((await db.select().from(projectsTable).where(eq(projectsTable.id, jobId)))[0]!.changeOrdersCents).toBe(before!.changeOrdersCents);

    // The client: page → sign without a code is refused → code by email → verify → sign.
    const page = await api(`/api/sign/${signToken}`);
    expect(page.status).toBe(200);
    expect((await api(`/api/sign/${signToken}/complete`, { body: { name: "Robin Client", signatureType: "drawn", signatureData: TINY_PNG_DATA_URL, consent: true } })).status).toBe(403);
    expect((await api(`/api/sign/${signToken}/otp`, { body: {} })).status).toBe(200);
    const codeMail = emailsTo(clientEmail).at(-1);
    const code = /^(\d{6}) /.exec(codeMail?.subject ?? "")?.[1];
    expect(code, `code in "${codeMail?.subject}"`).toBeTruthy();
    expect((await api(`/api/sign/${signToken}/verify`, { body: { code: code === "000000" ? "111111" : "000000" } })).status).toBe(400);
    expect((await api(`/api/sign/${signToken}/verify`, { body: { code } })).status).toBe(200);
    const done = await api(`/api/sign/${signToken}/complete`, { body: { name: "Robin Client", signatureType: "drawn", signatureData: TINY_PNG_DATA_URL, consent: true } });
    expect(done.status, JSON.stringify(done.body)).toBe(200);
    expect(done.body.status).toBe("signed");

    // Applied: status, value, budget, end date, the open milestone and its calendar event, one notification.
    [co] = await db.select().from(changeOrdersTable).where(eq(changeOrdersTable.id, coId));
    expect(co!.status).toBe("signed");
    expect(co!.appliedAt).not.toBeNull();
    const [after] = await db.select().from(projectsTable).where(eq(projectsTable.id, jobId));
    expect(after!.changeOrdersCents - before!.changeOrdersCents).toBe(169_500);
    expect(after!.budget - before!.budget).toBe(169_500);
    expect(isoDay(after!.plannedEnd)).toBe("2031-07-07");
    const [moved] = await db.select().from(milestonesTable).where(eq(milestonesTable.id, milestone!.id));
    expect({ start: isoDay(moved!.plannedStart), end: isoDay(moved!.plannedEnd) }).toEqual({ start: "2031-05-12", end: "2031-05-16" });
    const patch = await waitFor(async () => requestsTo(GCAL).find((r) => r.method === "PATCH" && r.url.includes(`/events/${event.externalEventId}`)), "calendar PATCH for the shifted milestone");
    expect(patch.json).toMatchObject({ start: { date: "2031-05-12" }, end: { date: plusDays("2031-05-16", 1) } });
    // The same event moves (other open milestones, never pushed before the calendar was connected, are added now).
    const rows = await db.select().from(calendarSyncedEventsTable).where(eq(calendarSyncedEventsTable.milestoneId, milestone!.id));
    expect(rows.map((r) => r.externalEventId)).toEqual([event.externalEventId]);
    const notes = await db.select().from(notificationsTable).where(and(eq(notificationsTable.userId, org.userId), eq(notificationsTable.type, "change_order_signed")));
    expect(notes).toHaveLength(1);
    expect(notes[0]!.title).toContain("CO-01");
    expect((await org.api(`/api/jobs/${jobId}`)).body.changeOrders.find((c: { id: string }) => c.id === coId)).toMatchObject({ status: "signed" });

    // A second run of the automation (a retry) does not add the amount twice.
    const [signedDoc] = await db.select().from(contractsTable).where(eq(contractsTable.id, docId));
    expect((await applySignedChangeOrder(signedDoc!)).applied).toBe(false);
    expect((await db.select().from(projectsTable).where(eq(projectsTable.id, jobId)))[0]!.changeOrdersCents).toBe(after!.changeOrdersCents);

    // The final invoice bills the contract plus the change order, less what is already billed.
    const billedBefore = (await db.select().from(invoicesTable).where(eq(invoicesTable.projectId, jobId))).reduce((s, i) => s + i.subtotalCents, 0);
    const final = await org.api(`/api/jobs/${jobId}/invoices`, { body: { kind: "final" } });
    expect(final.status, JSON.stringify(final.body)).toBe(201);
    const [finalRow] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, final.body.invoice.id));
    expect(finalRow!.subtotalCents).toBe(1_000_000 + 150_000 - billedBefore);

    // QuickBooks: down on the send → the sync log shows the failure; back up → retry posts the invoice once, total matching.
    await db.insert(quickbooksConnectionsTable).values({
      userId: org.userId, realmId: "9130000000000097", environment: "sandbox", companyName: "P97 Sandbox",
      accessTokenEnc: encryptSecret("qbo-access"), refreshTokenEnc: encryptSecret("qbo-refresh"), tokenExpiresAt: daysFromNow(1),
      paymentAccount: { id: "35", name: "Chequing" }, categoryMap: {}, incomeAccount: { id: "79", name: "Renovation revenue" }, connectedAt: new Date(Date.now() - 60_000),
    });
    stubHost(QBO, () => json(503, { Fault: { Error: [{ Message: "Service unavailable" }] } }));
    expect((await org.api(`/api/invoices/${finalRow!.id}/send`, { body: {} })).status).toBe(200);
    const failed = await waitFor(async () => (await db.select().from(quickbooksSyncLogTable).where(and(eq(quickbooksSyncLogTable.userId, org.userId), eq(quickbooksSyncLogTable.entityId, finalRow!.id), eq(quickbooksSyncLogTable.status, "failed"))))[0], "failed sync-log row");
    expect(failed.error).toMatch(/503|unavailable/i);
    const log = await org.api("/api/quickbooks/sync-log");
    expect(log.status).toBe(200);
    expect(JSON.stringify(log.body)).toContain(finalRow!.id);

    let posted: Record<string, unknown> | null = null;
    stubHost(QBO, (req) => {
      const u = new URL(req.url);
      const body = req.json as Record<string, unknown>;
      if (u.pathname.endsWith("/query")) {
        const q = u.searchParams.get("query") ?? "";
        if (q.includes("from Item")) return json(200, { QueryResponse: { Item: [{ Id: "17", Name: "QuoteAI Job Revenue" }] } });
        return json(200, { QueryResponse: {} });
      }
      if (u.pathname.endsWith("/customer")) return json(200, { Customer: { Id: "C-97", DisplayName: body.DisplayName } });
      if (u.pathname.endsWith("/invoice")) {
        posted = body;
        const t = (body.Line as { Amount: number }[]).reduce((s, l) => s + Math.round(l.Amount * 100), 0) / 100;
        return json(200, { Invoice: { Id: "QI-97", DocNumber: body.DocNumber, SyncToken: "0", TotalAmt: t, Balance: t } });
      }
      return json(404, { Fault: { Error: [{ Message: `unscripted ${u.pathname}` }] } });
    });
    resetRecorded();
    const retry = await org.api("/api/quickbooks/sync-log/retry", { body: { entityType: "invoice", entityId: finalRow!.id } });
    expect(retry.status, JSON.stringify(retry.body)).toBe(200);
    await waitFor(async () => (await db.select().from(quickbooksSyncLogTable).where(and(eq(quickbooksSyncLogTable.entityId, finalRow!.id), eq(quickbooksSyncLogTable.status, "synced"))))[0], "synced sync-log row");
    expect(posted, "QuickBooks received the invoice").not.toBeNull();
    const [sentFinal] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, finalRow!.id));
    expect(posted!.DocNumber).toBe(sentFinal!.number);
    const qboTotal = ((posted!.Line as { Amount: number }[]) ?? []).reduce((s, l) => s + Math.round(l.Amount * 100), 0);
    expect(qboTotal, "lines + tax lines add up to our total").toBe(sentFinal!.totalCents);
    expect(requestsTo(QBO).filter((r) => r.method === "POST" && r.url.includes("/invoice")), "posted once").toHaveLength(1);
  });

  test("change orders: plan gate, no signed contract, someone else's job", async () => {
    const free = await createOrg({ plan: "free" });
    const [freeJob] = await db.insert(projectsTable).values({ userId: free.userId, name: "Free job", status: "active" }).returning();
    const item = { descrizione: "x", prezzoUnitario: 10, totale: 10 };
    expect((await free.api(`/api/jobs/${freeJob!.id}/change-orders`, { body: { title: "X", items: [item] } })).status).toBe(403);

    const org = await createOrg();
    const [bare] = await db.insert(projectsTable).values({ userId: org.userId, name: "No contract", status: "active" }).returning();
    const noContract = await org.api(`/api/jobs/${bare!.id}/change-orders`, { body: { title: "X", items: [item] } });
    expect(noContract.status).toBe(409);
    expect(noContract.body.error).toBe("NO_CONTRACT");

    const other = await createOrg();
    expect((await other.api(`/api/jobs/${bare!.id}/change-orders`, { body: { title: "X", items: [item] } })).status).toBe(404);
  });

  // ── 2. Job photos ──────────────────────────────────────────────────────────

  test("photos: upload, replay, edit, share by email with thumbnails, by WhatsApp and its fallback, the refusals, delete", async () => {
    const org = await createOrg({ companyName: "Photo Share Co" });
    const clientEmail = `photos-${uniq()}@example.invalid`;
    const [client] = await db.insert(clientsTable).values({ userId: org.userId, name: "Sam Photos", email: clientEmail, phone: "+16135550197", preferredLanguage: "en", dedupKey: `p97-${uniq()}-${org.userId}` }).returning();
    const job = await org.api("/api/jobs", { body: { name: "Deck rebuild", clientId: client!.id } });
    expect(job.status, JSON.stringify(job.body)).toBe(201);
    const jobId = job.body.job.id as string;

    const sharp = (await import("sharp")).default;
    // Noise, so the JPEG is phone-sized (a flat colour compresses below the "serve it as itself" size).
    const noise = Buffer.from(Array.from({ length: 1600 * 1200 * 3 }, () => Math.floor(Math.random() * 256)));
    const jpeg = await sharp(noise, { raw: { width: 1600, height: 1200, channels: 3 } }).jpeg({ quality: 80 }).toBuffer();
    const upload = async (bytes: Buffer, name: string, type: string, extra: Record<string, string> = {}) => {
      const fd = new FormData();
      fd.append("file", new Blob([new Uint8Array(bytes)], { type }), name);
      for (const [k, v] of Object.entries(extra)) fd.append(k, v);
      return org.api(`/api/jobs/${jobId}/photos`, { method: "POST", form: fd });
    };

    const first = await upload(jpeg, "deck-before.jpg", "image/jpeg", { caption: "Before", clientRef: randomUUID() });
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    const offlineRef = randomUUID();
    const second = await upload(jpeg, "deck-framing.jpg", "image/jpeg", { clientRef: offlineRef });
    expect(second.status).toBe(201);
    const replay = await upload(jpeg, "deck-framing.jpg", "image/jpeg", { clientRef: offlineRef });
    expect(replay.status, "the offline outbox re-posting is answered, not duplicated").toBe(200);
    expect(replay.body).toMatchObject({ replayed: true, photo: { id: second.body.photo.id } });
    expect((await upload(Buffer.from("%PDF-1.4"), "doc.pdf", "application/pdf")).status).toBe(400);
    expect((await upload(jpeg, "x.jpg", "image/jpeg", { milestoneId: "00000000-0000-4000-8000-000000000000" })).status).toBe(404);

    const list = await org.api(`/api/jobs/${jobId}/photos`);
    expect(list.body.photos).toHaveLength(2);
    const ids = list.body.photos.map((p: { id: string }) => p.id) as string[];
    const renamed = await org.api(`/api/jobs/${jobId}/photos/${ids[1]}`, { method: "PUT", body: { caption: "Framing done", sortOrder: 0 } });
    expect(renamed.status).toBe(200);
    expect(renamed.body.photo.caption).toBe("Framing done");

    // The original comes back byte for byte; the thumbnail is a small JPEG.
    const orig = await fetch(`${baseUrl}/api/jobs/${jobId}/photos/${ids[0]}/file`, { headers: { authorization: `Bearer ${org.token}` } });
    expect(orig.status).toBe(200);
    expect(Buffer.from(await orig.arrayBuffer()).equals(jpeg)).toBe(true);
    const thumb = await fetch(`${baseUrl}/api/jobs/${jobId}/photos/${ids[0]}/file?size=thumb`, { headers: { authorization: `Bearer ${org.token}` } });
    const thumbBytes = Buffer.from(await thumb.arrayBuffer());
    expect(thumbBytes.length).toBeLessThan(jpeg.length);
    expect(Math.max((await sharp(thumbBytes).metadata()).width!, (await sharp(thumbBytes).metadata()).height!)).toBeLessThanOrEqual(480);

    // Refusals: nothing selected, a photo from someone else's job, a job with no client, another org.
    expect((await org.api(`/api/jobs/${jobId}/photos/share`, { body: { photoIds: [] } })).status).toBe(400);
    const other = await createOrg();
    const [otherJob] = await db.insert(projectsTable).values({ userId: other.userId, name: "Theirs", status: "active" }).returning();
    const [foreign] = await db.insert(jobPhotosTable).values({ userId: other.userId, projectId: otherJob!.id, fileName: "x.jpg", fileSize: 1, mimeType: "image/jpeg", fileUrl: `/objects/job-photos/${other.userId}/x.jpg` }).returning();
    expect((await org.api(`/api/jobs/${jobId}/photos/share`, { body: { photoIds: [foreign!.id] } })).status).toBe(404);
    const lonely = await org.api("/api/jobs", { body: { name: "No client" } });
    expect((await org.api(`/api/jobs/${lonely.body.job.id}/photos/share`, { body: { photoIds: ids } })).status).toBe(409);
    expect((await other.api(`/api/jobs/${jobId}/photos`)).status).toBe(404);
    expect((await other.api(`/api/jobs/${jobId}/photos/share`, { body: { photoIds: ids } })).status).toBe(404);

    // Email: one message, one inline thumbnail per photo, each linking to its original.
    const shared = await org.api(`/api/jobs/${jobId}/photos/share`, { body: { photoIds: ids } });
    expect(shared.status, JSON.stringify(shared.body)).toBe(200);
    expect(shared.body).toMatchObject({ success: true, channel: "email", count: 2 });
    const mail = emailsTo(clientEmail).at(-1)!;
    expect(mail).toBeDefined();
    expect((mail.html.match(/<img src="[^"]+"/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(mail.html).toMatch(/<a href="https?:\/\/[^"]+"[^>]*><img /);
    const afterShare = await db.select().from(jobPhotosTable).where(eq(jobPhotosTable.projectId, jobId));
    expect(afterShare.every((p) => p.sharedAt !== null)).toBe(true);
    const audit = await db.select().from(auditLogTable).where(and(eq(auditLogTable.entityId, jobId), eq(auditLogTable.action, "photos_shared")));
    expect(audit[0]!.diff).toMatchObject({ channel: "email" });

    // WhatsApp connected: the approved template goes out, no email.
    await db.insert(whatsappConnectionsTable).values({ userId: org.userId, phoneNumber: `+1613555${String(Date.now()).slice(-4)}`, isEnabled: true });
    stubHost(GRAPH, () => json(200, { messaging_product: "whatsapp", messages: [{ id: "wamid.p97" }] }));
    const mailsBefore = emailsTo(clientEmail).length;
    const wa = await org.api(`/api/jobs/${jobId}/photos/share`, { body: { photoIds: [ids[0]] } });
    expect(wa.status, JSON.stringify(wa.body)).toBe(200);
    expect(wa.body.channel).toBe("whatsapp");
    const waCall = requestsTo(GRAPH)[0]!;
    expect(waCall.json).toMatchObject({ to: "+16135550197", type: "template", template: { name: process.env.WHATSAPP_PHOTO_SHARE_TEMPLATE } });
    expect(JSON.stringify(waCall.json)).toContain("Sam Photos");
    expect(emailsTo(clientEmail).length).toBe(mailsBefore);

    // Template refused by Meta → falls back to email.
    stubHost(GRAPH, () => json(400, { error: { message: "(#132001) Template name does not exist", code: 132001 } }));
    const fallback = await org.api(`/api/jobs/${jobId}/photos/share`, { body: { photoIds: [ids[0]] } });
    expect(fallback.status).toBe(200);
    expect(fallback.body.channel).toBe("email");
    expect(emailsTo(clientEmail).length).toBe(mailsBefore + 1);

    // Unsubscribed client → refused, nothing sent.
    await db.update(clientsTable).set({ marketingUnsubscribedAt: new Date() }).where(eq(clientsTable.id, client!.id));
    const unsub = await org.api(`/api/jobs/${jobId}/photos/share`, { body: { photoIds: ids } });
    expect(unsub.status).toBe(409);
    expect(unsub.body.error).toBe("UNSUBSCRIBED");
    expect(emailsTo(clientEmail).length).toBe(mailsBefore + 1);

    // Delete: gone from the list and from storage.
    expect((await org.api(`/api/jobs/${jobId}/photos/${ids[0]}`, { method: "DELETE" })).status).toBe(200);
    expect((await org.api(`/api/jobs/${jobId}/photos`)).body.photos).toHaveLength(1);
    const gone = await fetch(`${baseUrl}/api/jobs/${jobId}/photos/${ids[0]}/file`, { headers: { authorization: `Bearer ${org.token}` } });
    expect(gone.status).toBe(404);
  });

  // ── 3. The job assistant ───────────────────────────────────────────────────

  describe("job assistant chat", () => {
    type ToolCall = { name: string; args: Record<string, unknown> };
    type Turn = { tools: ToolCall[] } | { text: string } | { status: number };
    type ChatBody = { messages: { role: string; content: unknown; tool_call_id?: string }[]; tools?: { function: { name: string } }[] };

    /** Answers each chat completion with the next scripted turn. */
    function scriptModel(turns: Turn[]) {
      const queue = [...turns];
      stubHost(AI, () => {
        const t = queue.shift();
        if (!t) return json(599, { error: "p97: model called more often than scripted" });
        if ("status" in t) return json(t.status, { error: { message: "upstream exploded" } });
        if ("text" in t) return json(200, { id: "chatcmpl-p97", object: "chat.completion", choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: t.text } }] });
        return json(200, {
          id: "chatcmpl-p97",
          object: "chat.completion",
          choices: [{ index: 0, finish_reason: "tool_calls", message: { role: "assistant", content: null, tool_calls: t.tools.map((c, i) => ({ id: `call_${uniq()}_${i}`, type: "function", function: { name: c.name, arguments: JSON.stringify(c.args) } })) } }],
        });
      });
    }
    const chatBodies = () => requestsTo(AI).filter((r) => r.url.endsWith("/chat/completions")).map((r) => r.json as ChatBody);

    let org: Org;
    let jobId: string;
    let jobName: string;
    let clientEmail: string;
    let convId: string;

    beforeAll(async () => {
      org = await createOrg({ companyName: "Assistant Co" });
      clientEmail = `assist-${uniq()}@example.invalid`;
      const { project } = await signedJob(org, clientEmail);
      jobId = project.id;
      jobName = project.name;
    });

    test("the job's conversation; the plan gate; someone else's job", async () => {
      const conv = await org.api(`/api/assistant/conversation?projectId=${jobId}`);
      expect(conv.status, JSON.stringify(conv.body)).toBe(200);
      expect(conv.body.conversation.projectId).toBe(jobId);
      expect(conv.body.messages).toEqual([]);
      convId = conv.body.conversation.id;
      expect((await org.api(`/api/assistant/conversation?projectId=${jobId}`)).body.conversation.id, "same conversation the second time").toBe(convId);

      const pro = await createOrg({ plan: "monthly_pro" });
      const gated = await pro.api("/api/assistant/conversation");
      expect(gated.status).toBe(403);
      expect(gated.body.error).toBe("PLAN_REQUIRED");

      const other = await createOrg();
      expect((await other.api(`/api/assistant/conversation?projectId=${jobId}`)).status).toBe(404);
      expect((await other.api(`/api/assistant/conversations/${convId}/messages`, { body: { content: "hi" } })).status).toBe(404);
    });

    test("a read tool feeds the next turn; two cards write nothing until confirmed; confirm, dismiss, twice", async () => {
      const [milestone] = await db.select().from(milestonesTable).where(eq(milestonesTable.projectId, jobId));
      const tasksBefore = (await db.select().from(projectTasksTable).where(eq(projectTasksTable.projectId, jobId))).length;
      scriptModel([
        { tools: [{ name: "get_job_summary", args: { job_id: jobId } }] },
        { tools: [{ name: "propose_task", args: { job_id: jobId, title: "Order the pot lights", due_date: "2031-05-01" } }, { name: "propose_milestone_update", args: { job_id: jobId, milestone_id: milestone!.id, title: "Renamed by the assistant" } }] },
        { text: "Two cards: a task and a rename. Confirm the ones you want." },
      ]);
      const res = await org.api(`/api/assistant/conversations/${convId}/messages`, { body: { content: "What's left on this job? Add a task to order the pot lights.", language: "en" } });
      expect(res.status, JSON.stringify(res.body)).toBe(200);

      const bodies = chatBodies();
      expect(bodies).toHaveLength(3);
      expect(bodies[0]!.tools?.map((t) => t.function.name)).toEqual(expect.arrayContaining(["get_job_summary", "propose_task", "propose_invoice"]));
      const toolResult = bodies[1]!.messages.at(-1)!;
      expect(toolResult.role).toBe("tool");
      expect(String(toolResult.content), "the job summary went back to the model").toContain(jobName);

      expect(res.body.proposals).toHaveLength(2);
      const task = res.body.proposals.find((p: { kind: string }) => p.kind === "task");
      const rename = res.body.proposals.find((p: { kind: string }) => p.kind === "milestone_update");
      expect(task.status).toBe("pending");
      expect(res.body.messages.at(-1)).toMatchObject({ role: "assistant", content: expect.stringContaining("Two cards") });
      expect(await db.select().from(projectTasksTable).where(eq(projectTasksTable.projectId, jobId)), "nothing written before confirmation").toHaveLength(tasksBefore);

      const confirmed = await org.api(`/api/assistant/proposals/${task.id}/confirm`, { body: {} });
      expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(200);
      expect(confirmed.body.proposal).toMatchObject({ status: "confirmed", resultEntityType: "task" });
      expect(confirmed.body.link).toBe(`/dashboard/jobs/${jobId}?tab=schedule`);
      const tasks = await db.select().from(projectTasksTable).where(eq(projectTasksTable.projectId, jobId));
      expect(tasks).toHaveLength(tasksBefore + 1);
      const added = tasks.find((t) => t.id === confirmed.body.proposal.resultEntityId);
      expect(added).toMatchObject({ title: "Order the pot lights", status: "todo" });
      expect(isoDay(added!.dueDate)).toBe("2031-05-01");
      expect((await org.api(`/api/assistant/proposals/${task.id}/confirm`, { body: {} })).status).toBe(409);

      const dismissed = await org.api(`/api/assistant/proposals/${rename.id}/dismiss`, { body: {} });
      expect(dismissed.status).toBe(200);
      expect(dismissed.body.proposal.status).toBe("dismissed");
      expect((await db.select().from(milestonesTable).where(eq(milestonesTable.id, milestone!.id)))[0]!.title, "dismissed = untouched").toBe(milestone!.title);
      expect((await org.api(`/api/assistant/proposals/${rename.id}/confirm`, { body: {} })).status).toBe(409);
      expect((await org.api(`/api/assistant/proposals/${rename.id}/dismiss`, { body: {} })).status).toBe(409);

      const other = await createOrg();
      expect((await other.api(`/api/assistant/proposals/${rename.id}/dismiss`, { body: {} })).status).toBe(404);
    });

    test("deposit: a payment on a draft is refused back to the model; send card → email; payment card → paid; history carries over", async () => {
      const [deposit] = await db.select().from(invoicesTable).where(and(eq(invoicesTable.projectId, jobId), eq(invoicesTable.type, "deposit")));
      expect(deposit, "deposit drafted when the contract was signed").toBeDefined();
      expect(deposit!.status).toBe("draft");

      // Recording a payment on a draft → the tool answers with an error, the model retries with a send card.
      scriptModel([
        { tools: [{ name: "propose_record_payment", args: { invoice_id: deposit!.id } }] },
        { tools: [{ name: "propose_send_invoice", args: { invoice_id: deposit!.id, message: "Deposit as agreed." } }] },
        { text: "It was still a draft, so: send it first." },
      ]);
      const turn = await org.api(`/api/assistant/conversations/${convId}/messages`, { body: { content: "The client paid the deposit." } });
      expect(turn.status, JSON.stringify(turn.body)).toBe(200);
      const bodies = chatBodies();
      expect(String(bodies[1]!.messages.at(-1)!.content)).toMatch(/still a draft/);
      // The earlier exchange is in the context of this one.
      expect(JSON.stringify(bodies[0]!.messages)).toContain("order the pot lights");
      expect(turn.body.proposals).toHaveLength(1);
      const send = turn.body.proposals[0];
      expect(send.kind).toBe("send_invoice");
      expect(send.summary).toContain(clientEmail);

      const before = emailsTo(clientEmail).length;
      expect((await org.api(`/api/assistant/proposals/${send.id}/confirm`, { body: {} })).status).toBe(200);
      const [sentInv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, deposit!.id));
      expect(sentInv!.status).toBe("sent");
      expect(emailsTo(clientEmail).length).toBe(before + 1);
      expect(emailsTo(clientEmail).at(-1)!.html).toContain("Deposit as agreed.");

      resetRecorded();
      scriptModel([{ tools: [{ name: "propose_record_payment", args: { invoice_id: deposit!.id, method: "etransfer", reference: "INTERAC-97" } }] }, { text: "Card ready." }]);
      const pay = await org.api(`/api/assistant/conversations/${convId}/messages`, { body: { content: "They e-transferred it." } });
      expect(pay.status).toBe(200);
      const payment = pay.body.proposals[0];
      expect(payment.kind).toBe("record_payment");
      expect(payment.payload.amountCents).toBe(sentInv!.totalCents);
      expect((await org.api(`/api/assistant/proposals/${payment.id}/confirm`, { body: {} })).status).toBe(200);
      expect((await db.select().from(invoicesTable).where(eq(invoicesTable.id, deposit!.id)))[0]!.status).toBe("paid");

      // History: every turn and every card is there on reload.
      const history = await org.api(`/api/assistant/conversation?projectId=${jobId}`);
      expect(history.body.messages.filter((m: { role: string }) => m.role === "user")).toHaveLength(3);
      expect(history.body.proposals.map((p: { status: string }) => p.status).sort()).toEqual(["confirmed", "confirmed", "confirmed", "dismissed"]);
    });

    test("a model failure is a 502 and saves no card; start over clears the thread", async () => {
      scriptModel([{ status: 500 }, { status: 500 }, { status: 500 }]);
      const failed = await org.api(`/api/assistant/conversations/${convId}/messages`, { body: { content: "Anything?" } });
      expect(failed.status).toBe(502);
      expect(failed.body.error).toBe("ASSISTANT_FAILED");
      const reload = await org.api(`/api/assistant/conversation?projectId=${jobId}`);
      expect(reload.body.proposals).toHaveLength(4);

      expect((await org.api(`/api/assistant/conversations/${convId}/messages`, { body: { content: "" } })).status).toBe(400);
      const other = await createOrg();
      expect((await other.api(`/api/assistant/conversations/${convId}`, { method: "DELETE" })).status).toBe(404);
      expect((await org.api(`/api/assistant/conversations/${convId}`, { method: "DELETE" })).status).toBe(200);
      const fresh = await org.api(`/api/assistant/conversation?projectId=${jobId}`);
      expect(fresh.body.messages).toEqual([]);
      expect(fresh.body.proposals).toEqual([]);
    });
  });
});

