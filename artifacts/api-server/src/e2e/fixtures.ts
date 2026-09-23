// Phase 67 — a "showcase" account with one of everything, so a browser sweep
// (visual-a11y.ts) and the PDF matrix (pdf-matrix.ts) can open every
// dashboard route and every public page with real data behind it.
//
// The quote → contract → job → invoices chain mirrors lifecycle.e2e.test.ts
// step for step (that file keeps the assertions; this one only throws when a
// row it needs is missing). Everything is owned by the org's user, so
// `cleanupAll()` from the harness removes it.

import { db, collaboratorsTable, quotesTable, contractsTable, contractSignersTable, projectsTable, milestonesTable, costEntriesTable, invoicesTable, clientsTable, priceCatalogItemsTable, businessProfilesTable, getTaxProfile, fieldReportsTable, flinksConnectionsTable, flinksTransactionsTable, quickbooksConnectionsTable, uploadedDocumentsTable } from "@workspace/db";
import { encryptSecret } from "../lib/crypto.js";
import { and, eq } from "drizzle-orm";
import "../automations/index.js";
import { raiseAutomation } from "../lib/automation.js";
import { logContractEvent, finalizeContract, sendContractToCustomer } from "../contracts/service.js";
import { buildInvoiceContext, createInvoice, sendInvoice, recordPayment, invoiceToken } from "../invoices/service.js";
import { TINY_PNG_DATA_URL } from "../lib/pngDataUrl.js";
import { api, createOrg, seedQuote, type TestUser } from "./harness.js";

export type Showcase = {
  province: "ON" | "QC";
  language: "en" | "fr";
  /** Accepted, signed, job running. */
  quoteId: string;
  /** Unlocked, 4 chapters / 30 lines — page-break material. */
  longQuoteId: string;
  /** Accepted, contract sent but unsigned — its `/sign/:token` page is live. */
  pendingQuoteId: string;
  contractId: string;
  pendingContractId: string;
  jobId: string;
  invoiceId: string;
  /** Raw token of a sent manual invoice — `/i/:token`. */
  invoiceToken: string;
  /** Raw token of the pending contract's customer signer — `/sign/:token`. */
  signToken: string | null;
  /** Worker magic link — `/t/:token`. */
  workerToken: string | null;
  /** Team member invite — `/team-invite/:token`. */
  teamInviteToken: string | null;
  clientId: string | null;
  /** Phase 91: an unused access code — `/join?code=…`. */
  joinCode: string | null;
};

function need<T>(v: T | null | undefined, what: string): T {
  if (v === null || v === undefined) throw new Error(`fixture: ${what} is missing`);
  return v;
}

async function raiseOrThrow(params: Parameters<typeof raiseAutomation>[0]) {
  const run = await raiseAutomation(params);
  if (!run) return;
  const { automationRunsTable } = await import("@workspace/db");
  const [row] = await db.select().from(automationRunsTable).where(eq(automationRunsTable.id, run.id));
  if (row?.status !== "succeeded") throw new Error(`fixture: automation ${params.event} → ${row?.status} ${row?.lastError ?? ""}`);
}

/** A long quote: 4 chapters, 30 line items, a discount, so PDFs have to break pages. */
async function seedLongQuote(userId: string, province: "ON" | "QC") {
  const chapters = ["Demolition and site prep", "Rough-in (plumbing, electrical)", "Cabinets, counters and tile", "Finishing and clean-up"];
  const capitoli = chapters.map((titolo, ci) => {
    const voci = Array.from({ length: ci === 3 ? 6 : 8 }, (_, i) => {
      const prezzo = 150 + ((ci * 8 + i) % 7) * 85;
      const quantita = 1 + (i % 4);
      return {
        descrizione: `${titolo.split(" ")[0]} item ${i + 1} — ${i % 3 === 0 ? "supply and install, including all fasteners, sealants and manufacturer-specified accessories; haul-away of packaging" : "labour"}`,
        quantita,
        um: i % 2 ? "h" : "ea",
        prezzoUnitario: prezzo,
        totale: prezzo * quantita,
      };
    });
    return { lettera: String.fromCharCode(65 + ci), titolo, voci, subtotale: voci.reduce((s, v) => s + v.totale, 0) };
  });
  const subtotale = capitoli.reduce((s, c) => s + c.subtotale, 0);
  const [quote] = await db
    .insert(quotesTable)
    .values({
      userId,
      province,
      clientData: { nome: "Morgan Longlist", indirizzo: "789 Longlist Rd", city: province === "QC" ? "Laval" : "Kanata", province, postalCode: "K2K 1A1", email: "longlist@e2e-test.invalid", phone: "6135550199" },
      descrizioneGenerale: "Full kitchen and powder-room renovation, two floors, including permit drawings and a temporary kitchen set-up in the garage for the duration of the works.",
      capitoli,
      condizioniPagamento: ["30% deposit upon signing", "40% at start of work", "30% upon completion"],
      sconto: { percentuale: 5, importoScontato: Math.round(subtotale * 0.95 * 100) / 100 },
      subtotale: String(subtotale),
      // Phase 71: real province taxes on the long quote so the PDF matrix shows
      // the GST + QST split (and the discount as the taxable base).
      ivaPercentuale: String(getTaxProfile(province).totalRate),
      ivaValore: String(Math.round(Math.round(subtotale * 0.95 * 100) / 100 * getTaxProfile(province).totalRate) / 100),
      totale: String(Math.round((Math.round(subtotale * 0.95 * 100) / 100) * (1 + getTaxProfile(province).totalRate / 100) * 100) / 100),
      status: "unlocked",
    })
    .returning();
  return quote!;
}

export async function seedShowcase(org: TestUser & { province: "ON" | "QC" }, opts: { withLogo?: boolean } = {}): Promise<Showcase> {
  const { userId, province } = org;
  const language = province === "QC" ? "fr" : "en";

  if (opts.withLogo) {
    await db.update(businessProfilesTable).set({ logoUrl: TINY_PNG_DATA_URL }).where(eq(businessProfilesTable.userId, userId));
  }

  // ── Main chain: accepted quote → signed contract → active job → invoices ──
  const quote = await seedQuote(userId, { province, holdback: province === "ON" });
  await db.update(quotesTable).set({ status: "accepted", acceptedAt: new Date(), acceptedByName: "Jordan Client" }).where(eq(quotesTable.id, quote.id));
  await raiseOrThrow({ event: "quote.accepted", userId, entityType: "quote", entityId: quote.id, payload: { acceptedByName: "Jordan Client" } });
  const contract = need((await db.select().from(contractsTable).where(eq(contractsTable.quoteId, quote.id)))[0], "auto-drafted contract");

  const signers = await db.select().from(contractSignersTable).where(eq(contractSignersTable.contractId, contract.id));
  const contractorSigner = need(signers.find((x) => x.role === "contractor"), "contractor signer");
  const customerSigner = need(signers.find((x) => x.role === "customer"), "customer signer");
  await db.update(contractSignersTable).set({ status: "signed", name: "E2E Test Co", signatureType: "typed", signatureData: "E2E Test Co", consentText: "test consent", signedAt: new Date() }).where(eq(contractSignersTable.id, contractorSigner.id));
  await logContractEvent({ contractId: contract.id, type: "contractor_signed", actor: "contractor", signerId: contractorSigner.id });
  await db.update(contractSignersTable).set({ status: "signed", name: "Jordan Client", signatureType: "drawn", signatureData: TINY_PNG_DATA_URL, consentText: "test consent", signedAt: new Date() }).where(eq(contractSignersTable.id, customerSigner.id));
  await logContractEvent({ contractId: contract.id, type: "signed", actor: "customer", signerId: customerSigner.id });
  await finalizeContract(contract.id);

  const project = need((await db.select().from(projectsTable).where(eq(projectsTable.contractId, contract.id)))[0], "job from contract.signed");
  const milestones = await db.select().from(milestonesTable).where(eq(milestonesTable.projectId, project.id));
  await db.update(projectsTable).set({ setupStatus: "confirmed", setupConfirmedAt: new Date(), status: "active", latitude: "45.423600", longitude: "-75.700900", geofenceRadiusMeters: 200 }).where(eq(projectsTable.id, project.id));
  await db.insert(costEntriesTable).values({ userId, projectId: project.id, category: "materials", vendor: "ACME Supply", description: "Cabinet hardware", subtotalCents: 50000, taxCents: 6500, totalCents: 56500, status: "confirmed", source: "manual", createdBy: "user", confirmedAt: new Date() });
  await db.insert(costEntriesTable).values({ userId, projectId: project.id, category: "subcontractor", vendor: "Tile Pros", description: "Subcontracted tiling", subtotalCents: 120000, taxCents: 0, totalCents: 120000, status: "pending_review", source: "manual", createdBy: "user" });
  const releaseMilestone = need(milestones.find((m) => m.paymentTermId && m.paymentAmountCents), "milestone linked to a payment term");
  await db.update(milestonesTable).set({ status: "completed", actualStart: new Date(), actualEnd: new Date() }).where(eq(milestonesTable.id, releaseMilestone.id));
  await raiseOrThrow({ event: "milestone.completed", userId, entityType: "milestone", entityId: releaseMilestone.id, payload: { projectId: project.id } });
  const progressInvoice = need(
    (await db.select().from(invoicesTable).where(eq(invoicesTable.paymentTermId, releaseMilestone.paymentTermId!))).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0],
    "progress invoice",
  );
  const { invoice: sent } = await sendInvoice({ invoiceId: progressInvoice.id, userId, actor: "contractor" });
  await recordPayment({ invoiceId: sent.id, userId, amountCents: Math.round(sent.totalCents / 2), method: "etransfer" });

  // ── A second accepted quote whose contract is sent but not signed (/sign/:token) ──
  const pending = await seedQuote(userId, { province, clientName: "Casey Pending", clientEmail: "pending@e2e-test.invalid", status: "accepted" });
  await db.update(quotesTable).set({ acceptedAt: new Date(), acceptedByName: "Casey Pending" }).where(eq(quotesTable.id, pending.id));
  await raiseOrThrow({ event: "quote.accepted", userId, entityType: "quote", entityId: pending.id, payload: { acceptedByName: "Casey Pending" } });
  const pendingContract = need((await db.select().from(contractsTable).where(eq(contractsTable.quoteId, pending.id)))[0], "pending contract");
  const pendingSigners = await db.select().from(contractSignersTable).where(eq(contractSignersTable.contractId, pendingContract.id));
  const pendingContractor = need(pendingSigners.find((x) => x.role === "contractor"), "pending contractor signer");
  await db.update(contractSignersTable).set({ status: "signed", name: "E2E Test Co", signatureType: "typed", signatureData: "E2E Test Co", consentText: "test consent", signedAt: new Date() }).where(eq(contractSignersTable.id, pendingContractor.id));
  await logContractEvent({ contractId: pendingContract.id, type: "contractor_signed", actor: "contractor", signerId: pendingContractor.id });
  await sendContractToCustomer({ contractId: pendingContract.id, userId, toEmail: "pending@e2e-test.invalid" });
  const signToken = captureSignToken?.() ?? null;

  // ── A sent manual invoice with a public link (/i/:token) ──
  const [client] = await db.insert(clientsTable).values({ userId, name: "Pay Client", email: "pay@e2e-test.invalid", phone: "6135550150", city: province === "QC" ? "Québec" : "Ottawa", province, preferredLanguage: language, dedupKey: `pay-${userId}` }).returning();
  const ctx = await buildInvoiceContext({ userId, clientId: client!.id });
  const manual = await createInvoice({
    userId, ctx, type: "manual", source: "manual", actor: "contractor", dueDays: 15,
    lines: [
      { description: "Site visit and measurements", quantity: 1, unitCents: 25_000, amountCents: 25_000 },
      { description: "Permit drawings (2 sheets)", quantity: 2, unitCents: 45_000, amountCents: 90_000 },
    ],
  });
  const { invoice: manualSent } = await sendInvoice({ invoiceId: manual.id, userId, actor: "contractor" });

  // ── Long quote, catalog, team ──
  const longQuote = await seedLongQuote(userId, province);
  await db.insert(priceCatalogItemsTable).values([
    { userId, nome: "Interior painting (2 coats)", categoria: "Painting", um: "m²", prezzoUnitario: "4.50" },
    { userId, nome: "Electrician (licensed)", categoria: "Labour", um: "h", prezzoUnitario: "95" },
    { userId, nome: "Drywall 1/2\" sheet", categoria: "Materials", um: "ea", prezzoUnitario: "18.75" },
  ]);

  let workerToken: string | null = null;
  const worker = await org.api("/api/team/workers", { body: { name: "Pat Worker", email: `worker-${userId}@example.invalid`, hourlyRateCents: 3500 } });
  if (worker.status === 201) {
    const invite = await org.api(`/api/team/workers/${worker.body.worker.id}/invite`, { body: {} });
    if (invite.status === 200) workerToken = String(invite.body.url).split("/t/")[1] ?? null;
    // Phase 86: booked on the showcase job today, with a task and two reports
    // from the field, so the sweep renders the worker's day, the job's "From
    // the field" card and the crew card on the dashboard rather than their
    // empty states.
    const now = Date.now();
    await org.api("/api/schedule/blocks", { body: { projectId: project.id, collaboratorId: worker.body.worker.id, startsAt: new Date(now - 3_600_000).toISOString(), endsAt: new Date(now + 4 * 3_600_000).toISOString(), notes: language === "fr" ? "Code de la barrière 4471" : "Gate code 4471" } });
    await org.api(`/api/jobs/${project.id}/tasks`, { body: { title: language === "fr" ? "Retirer les anciennes armoires" : "Strip the old cabinets" } });
    if (workerToken) {
      for (const [kind, body] of [["blocker", language === "fr" ? "Pas de courant sur le chantier" : "No power on site"], ["note", language === "fr" ? "Dégât d'eau derrière l'évier" : "Water damage behind the sink"]] as const) {
        const fd = new FormData();
        fd.append("projectId", project.id);
        fd.append("kind", kind);
        fd.append("body", body);
        await api(`/api/t/${workerToken}/reports`, { method: "POST", form: fd });
      }
      // Phase 86b: a crew lead who may add tasks, who last looked an hour ago —
      // so the sweep renders "Since you last looked" (today's shift and the new
      // task land after that) and the add-a-task form, not their empty states.
      await org.api(`/api/team/workers/${worker.body.worker.id}`, { method: "PUT", body: { canAddTasks: true } });
      await db.update(collaboratorsTable).set({ crewSeenAt: new Date(now - 3_600_000) }).where(eq(collaboratorsTable.id, worker.body.worker.id));
    }
    // Phase 89: a long week in the last pay period (five 10-hour days — overtime
    // past 44), a payroll number and a travel line, so the Pay page renders its
    // lines, the job table and the export notices rather than empty states.
    const period = await org.api("/api/pay/period");
    if (period.status === 200) {
      const start = String(period.body.period.start);
      await org.api(`/api/team/workers/${worker.body.worker.id}`, { method: "PUT", body: { payrollId: "1042" } });
      for (let i = 1; i <= 5; i++) {
        const date = new Date(Date.parse(`${start}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10);
        await org.api(`/api/jobs/${project.id}/time-entries`, { body: { workerId: worker.body.worker.id, date, hours: 10, approve: true } });
      }
      await org.api("/api/pay/allowances", { body: { workerId: worker.body.worker.id, date: start, kind: "mileage", quantity: 84, projectId: project.id } });
      // Phase 89b: km the crew logged from the site, still waiting — so the
      // period shows "From the crew" and the worker page its travel list.
      if (workerToken) {
        const date = new Date(Date.parse(`${start}T00:00:00Z`) + 2 * 86_400_000).toISOString().slice(0, 10);
        await api(`/api/t/${workerToken}/allowances`, { body: { kind: "mileage", quantity: 36, date, projectId: project.id, note: language === "fr" ? "Entrepôt au chantier" : "Yard to site" } });
      }
    }
  }
  // Phase 87: a filing setup, a reminder and two permits (one with an
  // inspection this week) so the Compliance page, the job's Permits card and
  // the calendar's new kinds render with content.
  await org.api("/api/compliance/settings", { method: "PUT", body: { salesTaxFrequency: "quarterly", fiscalYearEnd: "12-31", t5018: true } });
  await org.api("/api/compliance/reminders", { body: { kind: "licence", title: language === "fr" ? "Renouvellement de licence" : "Licence renewal", authority: province === "QC" ? "RBQ" : "HCRA", dueDate: new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10), recurrence: "annual" } });
  await org.api(`/api/jobs/${project.id}/permits`, {
    body: {
      permits: [
        { kind: "building", title: language === "fr" ? "Permis de construction" : "Building permit", authority: language === "fr" ? "Municipalité" : "Municipality", status: "issued", referenceNumber: "BP-2026-0412", inspectionAt: new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10) },
        { kind: "electrical", title: language === "fr" ? "Permis d'électricité" : "Electrical permit", status: "needed" },
      ],
    },
  });

  await seedBooks(userId, project.id, language);
  await seedGroup(org, project.id, worker.status === 201 ? String(worker.body.worker.id) : null, language);

  // Phase 91: the owner's own profile, the sign-up answers, and an access code waiting to be used.
  await org.api("/api/me", { method: "PUT", body: { jobTitle: language === "fr" ? "Propriétaire" : "Owner", phone: "613-555-0142", bio: language === "fr" ? "Rénovations résidentielles depuis 2011." : "Residential renovations since 2011.", complete: true } });
  await org.api("/api/company-setup", { method: "PUT", body: { trades: ["renovation", "painting"], teamSize: 9, seatsWanted: 4, fieldCrew: true } });
  const codes = await org.api("/api/team/members/codes", { body: { count: 1, role: "office" } });
  const joinCode: string | null = codes.status === 201 ? String(codes.body.codes[0].code) : null;

  let teamInviteToken: string | null = null;
  const member = await org.api("/api/team/members/invite", { body: { email: `member-${userId}@example.invalid`, role: "foreman", send: false } });
  if (member.status === 201) teamInviteToken = String(member.body.url).split("/team-invite/")[1] ?? null;

  const clients = await org.api("/api/clients");
  const clientId: string | null = clients.status === 200 && Array.isArray(clients.body) && clients.body[0]?.id ? String(clients.body[0].id) : null;

  return {
    province, language,
    quoteId: quote.id, longQuoteId: longQuote.id, pendingQuoteId: pending.id,
    contractId: contract.id, pendingContractId: pendingContract.id,
    jobId: project.id, invoiceId: sent.id, invoiceToken: invoiceToken(manualSent),
    signToken, workerToken, teamInviteToken, clientId, joinCode,
  };
}

/**
 * Phase 88: a bank feed with a matched, an unmatched and an ignored line and a
 * deposit waiting for its invoice; a crew materials claim with a receipt that
 * proves it; and a QuickBooks connection answered from a stub — so Books and
 * the QuickBooks settings render with content, not their empty states. Seeded
 * last, so nothing earlier in the showcase is pushed to the stubbed books.
 */
/**
 * Phase 90: a sister company the showcase owner also administers, grouped with
 * this one — the catalog shared from here, the same worker on both crews with
 * last week split between them, and work billed between the two — so the
 * Group page, the catalog's shared rows and the worker page's company switch
 * render with content. Best effort: the sweep still runs if any of it fails.
 */
async function seedGroup(org: TestUser & { province: "ON" | "QC" }, projectId: string, workerId: string | null, language: "en" | "fr"): Promise<void> {
  try {
    const sisterName = language === "fr" ? "Rénovations Laval Inc." : "Northside Framing Ltd.";
    const sister = await createOrg({ companyName: sisterName, province: org.province, profile: { gstHstNumber: "555666777RT0001" } });
    const invite = await sister.api("/api/team/members/invite", { body: { email: org.email, role: "admin", send: false } });
    const token = String(invite.body?.url ?? "").split("/team-invite/")[1];
    if (!token || (await org.api(`/api/team/invite/${token}/accept`, { method: "POST" })).status !== 200) throw new Error("sister admin");
    const created = await org.api("/api/group", { body: { name: language === "fr" ? "Groupe Showcase" : "Showcase group" } });
    if (created.status !== 201) throw new Error(`group ${created.status}`);
    await org.api("/api/group/companies", { body: { orgId: sister.userId } });
    await sister.api("/api/group/accept", { method: "POST" });
    await org.api("/api/group", { method: "PUT", body: { catalogOrgId: org.userId } });
    await sister.api("/api/catalog", { body: { nome: language === "fr" ? "Charpente murale" : "Wall framing", categoria: language === "fr" ? "Charpente" : "Framing", um: "m", prezzoUnitario: 42 } });

    const [me] = await db.select({ companyName: businessProfilesTable.companyName }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, org.userId));
    const sisterJob = await sister.api("/api/jobs", { body: { name: language === "fr" ? "Agrandissement Laval" : "Garage addition", address: "88 Rue Principale" } });
    const sisterProject = sisterJob.body?.job?.id as string | undefined;
    if (sisterProject) await db.update(projectsTable).set({ status: "active" }).where(eq(projectsTable.id, sisterProject));
    const day = (n: number) => new Date(Date.now() - n * 86_400_000);
    const contractor = { name: me?.companyName ?? "" };
    await db.insert(invoicesTable).values([
      { userId: org.userId, projectId, number: "INV-GRP-0001", type: "manual", status: "sent", province: org.province, issueDate: day(6), dueDate: day(-24), contractor, customer: { name: sisterName, gstHstNumber: "555666777RT0001" }, lines: [], subtotalCents: 240_000, taxableCents: 240_000, taxCents: 31_200, totalCents: 271_200, sentAt: day(6) },
      ...(sisterProject ? [{ userId: sister.userId, projectId: sisterProject, number: "INV-GRP-0002", type: "manual" as const, status: "sent" as const, province: org.province, issueDate: day(4), dueDate: day(-26), contractor: { name: sisterName }, customer: { name: "Morgan Client" }, lines: [], subtotalCents: 1_150_000, taxableCents: 1_150_000, taxCents: 149_500, totalCents: 1_299_500, sentAt: day(4) }] : []),
    ]);
    if (sisterProject) {
      await db.insert(costEntriesTable).values([
        { userId: sister.userId, projectId: sisterProject, category: "subcontractor", vendor: me?.companyName ?? "", description: language === "fr" ? "Équipe de finition" : "Finishing crew", date: day(5), subtotalCents: 240_000, taxCents: 31_200, totalCents: 271_200, status: "confirmed", source: "manual", createdBy: "user", confirmedAt: new Date() },
        { userId: sister.userId, projectId: sisterProject, category: "materials", vendor: "Home Hardware", description: language === "fr" ? "Bois d'œuvre" : "Lumber", date: day(5), subtotalCents: 380_000, taxCents: 49_400, totalCents: 429_400, status: "confirmed", source: "manual", createdBy: "user", confirmedAt: new Date() },
      ]);
    }

    if (workerId && sisterProject) {
      const sisterWorker = await sister.api("/api/team/workers", { body: { name: "Pat Worker", hourlyRateCents: 3800, workerType: "employee" } });
      if (sisterWorker.status === 201) {
        await org.api("/api/group/crew/link", { body: { workerIds: [workerId, sisterWorker.body.worker.id] } });
        // Two 9-hour days at the sister company this week, so the crew tab shows hours on both sides.
        const monday = new Date();
        monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
        for (let i = 0; i < 2 && monday.getTime() + i * 86_400_000 <= Date.now(); i++) {
          const date = new Date(monday.getTime() + i * 86_400_000).toISOString().slice(0, 10);
          await sister.api(`/api/jobs/${sisterProject}/time-entries`, { body: { workerId: sisterWorker.body.worker.id, date, hours: 9, approve: true } });
        }
      }
    }
  } catch (err) {
    console.warn("[showcase] group not seeded:", (err as Error).message);
  }
}

async function seedBooks(userId: string, projectId: string, language: "en" | "fr"): Promise<void> {
  // Late last month, so the close (which opens on last month) has something on it.
  const now = new Date();
  const day = (n: number) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 15) - n * 86_400_000);
  await db.insert(flinksConnectionsTable).values({ userId, loginIdEnc: encryptSecret("showcase-login"), institutionName: "Desjardins", selectedAccount: { id: "acc-1", name: language === "fr" ? "Compte courant" : "Chequing", institution: "Desjardins", last4: "4821" }, lastSyncedAt: new Date() });
  const [acme] = await db.select({ id: costEntriesTable.id }).from(costEntriesTable).where(and(eq(costEntriesTable.userId, userId), eq(costEntriesTable.vendor, "ACME Supply")));
  await db.insert(flinksTransactionsTable).values([
    { userId, flinksTransactionId: "showcase-1", date: day(3), description: "ACME SUPPLY #0412", amountCents: -56_500, matchStatus: "matched", matchedCostEntryId: acme?.id ?? null, autoMatched: true },
    { userId, flinksTransactionId: "showcase-2", date: day(5), description: "HOME DEPOT 7031 OTTAWA", amountCents: -21_437 },
    { userId, flinksTransactionId: "showcase-3", date: day(6), description: language === "fr" ? "VIREMENT INTERAC J. CLIENT" : "E-TRANSFER J CLIENT", amountCents: 129_950 },
    { userId, flinksTransactionId: "showcase-4", date: day(8), description: "MONTHLY ACCOUNT FEE", amountCents: -1_695, matchStatus: "ignored" },
  ]);

  const [claim] = await db.insert(costEntriesTable).values({ userId, projectId, category: "materials", description: language === "fr" ? "Vis à gypse, 2 boîtes (Pat Worker)" : "Drywall screws, 2 boxes (Pat Worker)", date: day(4), subtotalCents: 4_800, totalCents: 4_800, status: "pending_review", source: "manual", createdBy: "user" }).returning();
  await db.insert(fieldReportsTable).values({ userId, projectId, authorName: "Pat Worker", kind: "materials", body: language === "fr" ? "Vis à gypse, 2 boîtes" : "Drywall screws, 2 boxes", materialsCents: 4_800, costEntryId: claim!.id });
  const [doc] = await db.insert(uploadedDocumentsTable).values({ userId, fileName: "receipt-home-hardware.jpg", mimeType: "image/jpeg", fileUrl: `/objects/receipts/${userId}/showcase.jpg` } as typeof uploadedDocumentsTable.$inferInsert).returning();
  await db.insert(costEntriesTable).values({ userId, projectId: null, category: "materials", vendor: "Home Hardware", description: "Drywall screws", date: day(4), subtotalCents: 4_420, taxCents: 575, taxBreakdown: { HST: 575 }, totalCents: 4_995, status: "confirmed", source: "receipt", createdBy: "ai", sourceDocumentId: doc!.id, confirmedAt: new Date() });

  await db.insert(quickbooksConnectionsTable).values({
    userId,
    realmId: "9130000000000067",
    environment: "sandbox",
    companyName: "Northside Renovations (QuickBooks)",
    accessTokenEnc: encryptSecret("showcase-qbo"),
    refreshTokenEnc: encryptSecret("showcase-qbo-refresh"),
    tokenExpiresAt: new Date(Date.now() + 30 * 86_400_000),
    paymentAccount: { id: "35", name: "Chequing" },
    categoryMap: { materials: { id: "64", name: "Job Materials" } },
    incomeAccount: { id: "79", name: "Renovation revenue" },
    taxCodeMap: { "HST 13%": { id: "7", name: "HST ON" } },
    paymentsPulledAt: new Date(Date.now() - 6 * 3_600_000),
  });
  const { stubHost, json } = await import("./vendorStub.js");
  const accounts = (names: [string, string][]) => names.map(([Id, Name]) => ({ Id, Name }));
  const qbo = (req: { url: string }) => {
    const q = new URL(req.url).searchParams.get("query") ?? "";
    if (q.includes("from TaxCode")) return json(200, { QueryResponse: { TaxCode: accounts([["7", "HST ON"], ["3", "GST"], ["9", "Exempt"], ["10", "Out of scope"]]) } });
    if (q.includes("'Income'")) return json(200, { QueryResponse: { Account: accounts([["79", "Renovation revenue"], ["80", "Service income"]]) } });
    if (q.includes("'Other Current Asset'")) return json(200, { QueryResponse: { Account: accounts([["35", "Chequing"], ["4", "Undeposited Funds"]]) } });
    if (q.includes("'Credit Card'")) return json(200, { QueryResponse: { Account: accounts([["35", "Chequing"], ["41", "Visa"]]) } });
    if (q.includes("'Expense'")) return json(200, { QueryResponse: { Account: accounts([["64", "Job Materials"], ["65", "Subcontractors"], ["66", "Equipment rental"]]) } });
    return json(200, { QueryResponse: {} });
  };
  stubHost("https://sandbox-quickbooks.api.intuit.com/", qbo);
  stubHost("https://quickbooks.api.intuit.com/", qbo);
}

/**
 * `sendContractToCustomer` only ever emails the raw signing token, so the
 * caller that captures outbound mail registers a getter here that returns the
 * `/sign/:token` link of the most recent message.
 */
let captureSignToken: (() => string | null) | null = null;
export function setSignTokenCapture(fn: () => string | null): void {
  captureSignToken = fn;
}

/** The rows the PDF matrix needs, reloaded fresh. */
export async function loadShowcaseRows(s: Showcase) {
  const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.id, s.quoteId));
  const [longQuote] = await db.select().from(quotesTable).where(eq(quotesTable.id, s.longQuoteId));
  const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.id, s.contractId));
  const signers = await db.select().from(contractSignersTable).where(eq(contractSignersTable.contractId, s.contractId));
  const [invoice] = await db.select().from(invoicesTable).where(and(eq(invoicesTable.id, s.invoiceId)));
  return { quote: quote!, longQuote: longQuote!, contract: contract!, signers, invoice: invoice! };
}
