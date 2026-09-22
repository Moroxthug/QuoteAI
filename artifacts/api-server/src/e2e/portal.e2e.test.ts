// Phase 76 — the client portal end to end: the contractor's portal link +
// invitation, the code gate (email OTP → session), the overview built from
// a real quote → contract → job → invoice chain, the message thread in both
// directions (emails + notification + unread counts), PDFs, the invoice
// actions, "sign now" for a pending contract, the "see everything" link on
// the /i, /sign and /p payloads, and the tenant/visibility boundaries.

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, quotesTable, contractsTable, contractSignersTable, projectsTable, milestonesTable, invoicesTable, clientsTable, jobPhotosTable, notificationsTable, auditLogTable, clientMessagesTable } from "@workspace/db";
import "../automations/index.js";
import { raiseAutomation } from "../lib/automation.js";
import { linkQuoteToClient } from "../lib/clients.js";
import { logContractEvent, finalizeContract, sendContractToCustomer } from "../contracts/service.js";
import { sendInvoice, invoiceToken } from "../invoices/service.js";
import { TINY_PNG_DATA_URL } from "../lib/pngDataUrl.js";
import { startServer, stopServer, createOrg, cleanupAll, seedQuote, api, type TestUser } from "./harness.js";
import { emailsTo, sentEmails } from "./mailbox.js";

const CLIENT_EMAIL = "portal-client@e2e-test.invalid";

async function raiseOrThrow(params: Parameters<typeof raiseAutomation>[0]) {
  const run = await raiseAutomation(params);
  if (!run) return;
  const { automationRunsTable } = await import("@workspace/db");
  const [row] = await db.select().from(automationRunsTable).where(eq(automationRunsTable.id, run.id));
  if (row?.status !== "succeeded") throw new Error(`automation ${params.event} → ${row?.status} ${row?.lastError ?? ""}`);
}

/** Accepted quote (linked to a client) → signed contract → confirmed job with a completed milestone → sent progress invoice; plus a second contract sent but unsigned. */
async function seedClientChain(org: TestUser & { province: "ON" | "QC" }) {
  const { userId, province } = org;
  const quote = await seedQuote(userId, { province, clientName: "Portal Client", clientEmail: CLIENT_EMAIL });
  await linkQuoteToClient({ id: quote.id, userId, clientData: quote.clientData, province: quote.province }, province, { applyDefaultTerms: false });
  await db.update(quotesTable).set({ status: "accepted", acceptedAt: new Date(), acceptedByName: "Portal Client" }).where(eq(quotesTable.id, quote.id));
  await raiseOrThrow({ event: "quote.accepted", userId, entityType: "quote", entityId: quote.id, payload: { acceptedByName: "Portal Client" } });
  const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.quoteId, quote.id));
  const signers = await db.select().from(contractSignersTable).where(eq(contractSignersTable.contractId, contract!.id));
  for (const s of signers) {
    await db.update(contractSignersTable).set({ status: "signed", name: s.role === "contractor" ? "E2E Test Co" : "Portal Client", signatureType: "typed", signatureData: "x", consentText: "test consent", signedAt: new Date() }).where(eq(contractSignersTable.id, s.id));
    await logContractEvent({ contractId: contract!.id, type: s.role === "contractor" ? "contractor_signed" : "signed", actor: s.role === "contractor" ? "contractor" : "customer", signerId: s.id });
  }
  await finalizeContract(contract!.id);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.contractId, contract!.id));
  await db.update(projectsTable).set({ setupStatus: "confirmed", setupConfirmedAt: new Date(), status: "active", address: "45 Rue Laurier, Gatineau" }).where(eq(projectsTable.id, project!.id));
  const milestones = await db.select().from(milestonesTable).where(eq(milestonesTable.projectId, project!.id));
  const release = milestones.find((m) => m.paymentTermId && m.paymentAmountCents)!;
  await db.update(milestonesTable).set({ status: "completed", actualStart: new Date(), actualEnd: new Date() }).where(eq(milestonesTable.id, release.id));
  await raiseOrThrow({ event: "milestone.completed", userId, entityType: "milestone", entityId: release.id, payload: { projectId: project!.id } });
  const [progressInvoice] = (await db.select().from(invoicesTable).where(and(eq(invoicesTable.projectId, project!.id), eq(invoicesTable.paymentTermId, release.paymentTermId!)))).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const { invoice: sent } = await sendInvoice({ invoiceId: progressInvoice!.id, userId, actor: "contractor" });

  // A second accepted quote, same client → contract sent but not signed.
  const pending = await seedQuote(userId, { province, clientName: "Portal Client", clientEmail: CLIENT_EMAIL, status: "accepted" });
  await linkQuoteToClient({ id: pending.id, userId, clientData: pending.clientData, province: pending.province }, province, { applyDefaultTerms: false });
  await db.update(quotesTable).set({ acceptedAt: new Date(), acceptedByName: "Portal Client" }).where(eq(quotesTable.id, pending.id));
  await raiseOrThrow({ event: "quote.accepted", userId, entityType: "quote", entityId: pending.id, payload: { acceptedByName: "Portal Client" } });
  const [pendingContract] = await db.select().from(contractsTable).where(eq(contractsTable.quoteId, pending.id));
  const [pc] = await db.select().from(contractSignersTable).where(and(eq(contractSignersTable.contractId, pendingContract!.id), eq(contractSignersTable.role, "contractor")));
  await db.update(contractSignersTable).set({ status: "signed", name: "E2E Test Co", signatureType: "typed", signatureData: "x", consentText: "test consent", signedAt: new Date() }).where(eq(contractSignersTable.id, pc!.id));
  await logContractEvent({ contractId: pendingContract!.id, type: "contractor_signed", actor: "contractor", signerId: pc!.id });
  await sendContractToCustomer({ contractId: pendingContract!.id, userId, toEmail: CLIENT_EMAIL });

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, project!.clientId!));
  const [photo] = await db.insert(jobPhotosTable).values({ userId, projectId: project!.id, fileName: "before.png", fileSize: 100, mimeType: "image/png", fileUrl: `/objects/job-photos/${userId}/${project!.id}/missing.png` }).returning();
  return { quote, contract: contract!, pendingContract: pendingContract!, project: project!, invoice: sent, client: client!, photo: photo!, milestones };
}

const otpFrom = (subject: string) => subject.match(/^(\d{6}) /)?.[1] ?? null;

describe("Client portal (Phase 76)", () => {
  let org: Awaited<ReturnType<typeof createOrg>>;
  let other: Awaited<ReturnType<typeof createOrg>>;
  let chain: Awaited<ReturnType<typeof seedClientChain>>;
  let token = "";
  let session = "";
  const sess = () => ({ "X-Portal-Session": session });

  beforeAll(async () => {
    await startServer();
    org = await createOrg({ province: "ON" });
    other = await createOrg({ province: "ON", companyName: "Other Co" });
    chain = await seedClientChain(org);
  }, 120_000);
  afterAll(async () => {
    await cleanupAll();
    await stopServer();
  });

  test("contractor: the portal link is issued on first read, needs an email, and the invitation goes out", async () => {
    const status = await org.api(`/api/clients/${chain.client.id}/portal`);
    expect(status.status, JSON.stringify(status.body)).toBe(200);
    expect(status.body).toMatchObject({ hasEmail: true, email: CLIENT_EMAIL, invitedAt: null, lastSeenAt: null, unread: 0 });
    expect(status.body.url).toMatch(/\/portal\/[A-Za-z0-9_-]{40,}$/);
    token = String(status.body.url).split("/portal/")[1]!;
    // Deterministic: a second read is the same link.
    expect((await org.api(`/api/clients/${chain.client.id}/portal`)).body.url).toBe(status.body.url);

    const [noEmail] = await db.insert(clientsTable).values({ userId: org.userId, name: "No Email", dedupKey: `noemail-${org.userId}` }).returning();
    expect((await org.api(`/api/clients/${noEmail!.id}/portal`)).body).toMatchObject({ url: null, hasEmail: false });
    expect((await org.api(`/api/clients/${noEmail!.id}/portal/invite`, { body: {} })).status).toBe(409);
    // Another org cannot read this client's link.
    expect((await other.api(`/api/clients/${chain.client.id}/portal`)).status).toBe(404);

    const invite = await org.api(`/api/clients/${chain.client.id}/portal/invite`, { body: {} });
    expect(invite.status, JSON.stringify(invite.body)).toBe(200);
    const mail = emailsTo(CLIENT_EMAIL).find((m) => m.subject.includes("your client portal"));
    expect(mail, "invite email").toBeTruthy();
    expect(mail!.html).toContain(status.body.url);
    expect((await org.api(`/api/clients/${chain.client.id}/portal`)).body.invitedAt).not.toBeNull();
  });

  test("gate: the token alone shows only the company + masked email; a session needs the emailed code", async () => {
    const head = await api(`/api/portal/${token}`);
    expect(head.status).toBe(200);
    expect(head.body).toMatchObject({ company: { name: "E2E ON Co" }, client: { name: "Portal Client", emailMasked: "po•••@e2e-test.invalid", language: "en" }, authenticated: false });
    expect((await api(`/api/portal/${token}/overview`)).status).toBe(401);
    expect((await api(`/api/portal/${token}/overview`, { headers: { "X-Portal-Session": "not-a-real-session-token-at-all" } })).status).toBe(401);
    expect((await api(`/api/portal/${"x".repeat(43)}`)).status).toBe(404);

    const before = sentEmails.length;
    expect((await api(`/api/portal/${token}/otp`, { body: {} })).status).toBe(200);
    const otpMail = sentEmails.slice(before).find((m) => m.to.includes(CLIENT_EMAIL) && /access code/.test(m.subject));
    expect(otpMail, "otp email").toBeTruthy();
    const code = otpFrom(otpMail!.subject)!;
    expect(code).toMatch(/^\d{6}$/);
    expect(otpMail!.html).toContain(code);

    const wrong = await api(`/api/portal/${token}/verify`, { body: { code: code === "000000" ? "000001" : "000000" } });
    expect(wrong.status).toBe(400);
    expect(wrong.body).toMatchObject({ error: "invalid_code", attemptsLeft: 4 });
    expect((await api(`/api/portal/${token}/verify`, { body: { code: "12" } })).status).toBe(400);

    const ok = await api(`/api/portal/${token}/verify`, { body: { code } });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.session).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    session = ok.body.session;
    // The code is single-use.
    expect((await api(`/api/portal/${token}/verify`, { body: { code } })).status).toBe(400);
    expect((await api(`/api/portal/${token}`, { headers: sess() })).body.authenticated).toBe(true);
    expect((await org.api(`/api/clients/${chain.client.id}/portal`)).body.lastSeenAt).not.toBeNull();
  });

  test("overview: quotes, both contracts, the sent invoice, the job with milestones + photo — and nothing that is a draft", async () => {
    const r = await api(`/api/portal/${token}/overview`, { headers: sess() });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const { quotes, contracts, invoices, jobs, messages, client, company } = r.body;
    expect(company.name).toBe("E2E ON Co");
    expect(client).toMatchObject({ name: "Portal Client", email: CLIENT_EMAIL });
    expect(quotes.map((q: { id: string; status: string }) => [q.id, q.status]).sort()).toEqual([[chain.quote.id, "accepted"], [chain.pendingContract.quoteId, "accepted"]].sort());
    expect(quotes[0].url).toMatch(/\/p\/[0-9a-f-]{36}$/);

    const signed = contracts.find((c: { id: string }) => c.id === chain.contract.id);
    const pending = contracts.find((c: { id: string }) => c.id === chain.pendingContract.id);
    expect(signed).toMatchObject({ status: "signed", canSign: false, jobId: chain.project.id });
    expect(pending).toMatchObject({ status: "sent", canSign: true });

    // The progress invoice was sent; the deposit invoice drafted at signing must not show.
    const drafts = await db.select().from(invoicesTable).where(and(eq(invoicesTable.clientId, chain.client.id), eq(invoicesTable.status, "draft")));
    expect(drafts.length).toBeGreaterThan(0);
    expect(invoices.map((i: { id: string }) => i.id)).toEqual([chain.invoice.id]);
    expect(invoices[0]).toMatchObject({ number: chain.invoice.number, status: "sent", balanceCents: chain.invoice.totalCents, canPayByCard: false, jobId: chain.project.id, etransferEmail: "payments@e2e-test.invalid" });
    expect(invoices[0].url).toContain(`/i/${invoiceToken(chain.invoice)}`);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ id: chain.project.id, address: "45 Rue Laurier, Gatineau", status: "active" });
    expect(jobs[0].milestones.length).toBe(chain.milestones.length);
    expect(jobs[0].milestones.some((m: { status: string }) => m.status === "completed")).toBe(true);
    expect(jobs[0].photos).toEqual([expect.objectContaining({ id: chain.photo.id })]);
    expect(messages).toEqual([]);
  });

  test("thread: contractor → client is emailed with the portal link; client → contractor raises a notification + email and the unread badge", async () => {
    const before = sentEmails.length;
    const bad = await org.api(`/api/clients/${chain.client.id}/messages`, { body: { body: "x", jobId: "00000000-0000-0000-0000-000000000000" } });
    expect(bad.status).toBe(404);
    const posted = await org.api(`/api/clients/${chain.client.id}/messages`, { body: { body: "Tile arrives Thursday — we start the backsplash Friday.", jobId: chain.project.id } });
    expect(posted.status, JSON.stringify(posted.body)).toBe(201);
    expect(posted.body.emailed).toBe(true);
    expect(posted.body.message).toMatchObject({ sender: "contractor", jobId: chain.project.id, jobName: chain.project.name, readAt: null });
    const mail = sentEmails.slice(before).find((m) => m.to.includes(CLIENT_EMAIL) && m.subject.includes("new message"));
    expect(mail, "client message email").toBeTruthy();
    expect(mail!.html).toContain("Tile arrives Thursday");
    expect(mail!.html).toContain(`/portal/${token}`);

    // Loading the portal marks it read; the thread carries it with the job name.
    const ov = await api(`/api/portal/${token}/overview`, { headers: sess() });
    expect(ov.body.messages).toHaveLength(1);
    expect(ov.body.messages[0]).toMatchObject({ sender: "contractor", body: "Tile arrives Thursday — we start the backsplash Friday.", jobName: chain.project.name });
    const [row] = await db.select().from(clientMessagesTable).where(eq(clientMessagesTable.id, ov.body.messages[0].id));
    expect(row!.readAt).not.toBeNull();
    expect(row!.emailedAt).not.toBeNull();

    // The client replies from the portal.
    const notBefore = (await db.select().from(notificationsTable).where(eq(notificationsTable.userId, org.userId))).length;
    const mailsBefore = sentEmails.length;
    expect((await api(`/api/portal/${token}/messages`, { body: { body: "x", jobId: "00000000-0000-0000-0000-000000000000" }, headers: sess() })).status).toBe(404);
    expect((await api(`/api/portal/${token}/messages`, { body: { body: "   " }, headers: sess() })).status).toBe(400);
    expect((await api(`/api/portal/${token}/messages`, { body: { body: "hi" } })).status).toBe(401);
    const reply = await api(`/api/portal/${token}/messages`, { body: { body: "Friday works. Gate code is 4471.", jobId: chain.project.id }, headers: sess() });
    expect(reply.status, JSON.stringify(reply.body)).toBe(201);
    expect(reply.body.message).toMatchObject({ sender: "client", senderName: "Portal Client", jobId: chain.project.id });

    const notes = await db.select().from(notificationsTable).where(eq(notificationsTable.userId, org.userId));
    expect(notes.length).toBe(notBefore + 1);
    expect(notes.find((n) => n.type === "client_message")).toMatchObject({ title: `Portal Client replied about ${chain.project.name}`, link: `/dashboard/jobs/${chain.project.id}?tab=messages` });
    const ownerMail = sentEmails.slice(mailsBefore).find((m) => m.to.includes(`owner-${org.userId}@example.invalid`));
    expect(ownerMail, "owner reply email").toBeTruthy();
    expect(ownerMail!.subject).toContain("new reply");
    expect(ownerMail!.html).toContain("Gate code is 4471");

    expect((await org.api(`/api/clients/${chain.client.id}/portal`)).body.unread).toBe(1);
    const thread = await org.api(`/api/clients/${chain.client.id}/messages`);
    expect(thread.status).toBe(200);
    expect(thread.body.messages.map((m: { sender: string }) => m.sender)).toEqual(["contractor", "client"]);
    expect(thread.body.client).toMatchObject({ name: "Portal Client", email: CLIENT_EMAIL });
    // Opening the thread marked the reply read.
    expect((await org.api(`/api/clients/${chain.client.id}/portal`)).body.unread).toBe(0);
    expect((await other.api(`/api/clients/${chain.client.id}/messages`)).status).toBe(404);
    const audits = await db.select().from(auditLogTable).where(and(eq(auditLogTable.userId, org.userId), eq(auditLogTable.entityId, chain.client.id)));
    expect(audits.map((a) => a.action)).toEqual(expect.arrayContaining(["portal_invited", "portal_otp_sent", "portal_signed_in", "message_sent", "message_received"]));
  });

  test("documents + actions: PDFs need the session and the client's own rows; card payment is honest about Connect; e-Transfer self-report flows", async () => {
    const pdf = await api(`/api/portal/${token}/invoices/${chain.invoice.id}/pdf`, { headers: sess() });
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("content-type")).toContain("application/pdf");
    expect((await api(`/api/portal/${token}/invoices/${chain.invoice.id}/pdf`)).status).toBe(401);
    const cpdf = await api(`/api/portal/${token}/contracts/${chain.contract.id}/pdf`, { headers: sess() });
    expect(cpdf.status).toBe(200);
    expect(cpdf.headers.get("content-type")).toContain("application/pdf");

    // A draft invoice of the same client, and another org's invoice, are both 404 through the portal.
    const [draft] = await db.select().from(invoicesTable).where(and(eq(invoicesTable.clientId, chain.client.id), eq(invoicesTable.status, "draft")));
    expect((await api(`/api/portal/${token}/invoices/${draft!.id}/pdf`, { headers: sess() })).status).toBe(404);
    const otherChain = await seedQuote(other.userId, { province: "ON" });
    expect((await api(`/api/portal/${token}/contracts/${otherChain.id}/pdf`, { headers: sess() })).status).toBe(404);

    // No Connect account → 403 NOT_AVAILABLE, never a Stripe call.
    const pay = await api(`/api/portal/${token}/invoices/${chain.invoice.id}/pay-link`, { body: {}, headers: sess() });
    expect(pay.status).toBe(403);
    expect(pay.body).toMatchObject({ error: "NOT_AVAILABLE" });

    const sent = await api(`/api/portal/${token}/invoices/${chain.invoice.id}/mark-sent`, { body: {}, headers: sess() });
    expect(sent.status, JSON.stringify(sent.body)).toBe(200);
    expect(sent.body.status).toBe("pending_confirmation");
    expect((await api(`/api/portal/${token}/invoices/${chain.invoice.id}/mark-sent`, { body: {}, headers: sess() })).status).toBe(400);
    const ov = await api(`/api/portal/${token}/overview`, { headers: sess() });
    expect(ov.body.invoices[0].status).toBe("pending_confirmation");

    // Photos: the row is the client's job but the object is not in storage → 404 (not 500); a foreign photo → 404; no session → 401.
    expect((await api(`/api/portal/${token}/photos/${chain.photo.id}/file`, { headers: sess() })).status).toBe(404);
    expect((await api(`/api/portal/${token}/photos/${chain.photo.id}/file`)).status).toBe(401);
    const [foreignProject] = await db.insert(projectsTable).values({ userId: other.userId, name: "Foreign", status: "active" }).returning();
    const [foreignPhoto] = await db.insert(jobPhotosTable).values({ userId: other.userId, projectId: foreignProject!.id, fileName: "x.png", fileSize: 1, mimeType: "image/png", fileUrl: `/objects/job-photos/${other.userId}/x.png` }).returning();
    expect((await api(`/api/portal/${token}/photos/${foreignPhoto!.id}/file`, { headers: sess() })).status).toBe(404);
  });

  test("sign now: a fresh signing link whose signer is already verified; the signed contract is not signable", async () => {
    expect((await api(`/api/portal/${token}/contracts/${chain.contract.id}/sign-link`, { body: {}, headers: sess() })).status).toBe(409);
    const link = await api(`/api/portal/${token}/contracts/${chain.pendingContract.id}/sign-link`, { body: {}, headers: sess() });
    expect(link.status, JSON.stringify(link.body)).toBe(200);
    const signToken = String(link.body.url).split("/sign/")[1]!;
    const page = await api(`/api/sign/${signToken}`);
    expect(page.status).toBe(200);
    expect(page.body.signer.otpVerified).toBe(true);
    expect(page.body.contract.portalUrl).toContain(`/portal/${token}`);
    // The signer can complete straight away (no OTP step).
    const done = await api(`/api/sign/${signToken}/complete`, { body: { name: "Portal Client", signatureType: "drawn", signatureData: TINY_PNG_DATA_URL, consent: true } });
    expect(done.status, JSON.stringify(done.body)).toBe(200);
    expect(done.body.status).toBe("signed");
    const ov = await api(`/api/portal/${token}/overview`, { headers: sess() });
    expect(ov.body.contracts.find((c: { id: string }) => c.id === chain.pendingContract.id)).toMatchObject({ status: "signed", canSign: false });
  });

  test("'see everything': the /i and /p payloads carry the portal link; a client without email gets none", async () => {
    const inv = await api(`/api/i/${invoiceToken(chain.invoice)}`);
    expect(inv.status).toBe(200);
    expect(inv.body.invoice.portalUrl).toContain(`/portal/${token}`);
    const quote = await api(`/api/public/quotes/${chain.quote.id}`);
    expect(quote.status).toBe(200);
    expect(quote.body.portalUrl).toContain(`/portal/${token}`);

    const unlinked = await seedQuote(org.userId, { province: "ON", clientName: "Nobody Linked" });
    expect((await api(`/api/public/quotes/${unlinked.id}`)).body.portalUrl).toBeNull();
  });

  test("sign out revokes the session; an archived client's link stops working", async () => {
    expect((await api(`/api/portal/${token}/logout`, { body: {}, headers: sess() })).status).toBe(200);
    expect((await api(`/api/portal/${token}/overview`, { headers: sess() })).status).toBe(401);
    expect((await api(`/api/portal/${token}`)).body.authenticated).toBe(false);

    await db.update(clientsTable).set({ archivedAt: new Date() }).where(eq(clientsTable.id, chain.client.id));
    expect((await api(`/api/portal/${token}`)).status).toBe(404);
    expect((await api(`/api/i/${invoiceToken(chain.invoice)}`)).body.invoice.portalUrl).toBeNull();
    await db.update(clientsTable).set({ archivedAt: null }).where(eq(clientsTable.id, chain.client.id));
  });
});
