// Phase 67 — a "showcase" account with one of everything, so a browser sweep
// (visual-a11y.ts) and the PDF matrix (pdf-matrix.ts) can open every
// dashboard route and every public page with real data behind it.
//
// The quote → contract → job → invoices chain mirrors lifecycle.e2e.test.ts
// step for step (that file keeps the assertions; this one only throws when a
// row it needs is missing). Everything is owned by the org's user, so
// `cleanupAll()` from the harness removes it.

import { db, quotesTable, contractsTable, contractSignersTable, projectsTable, milestonesTable, costEntriesTable, invoicesTable, clientsTable, priceCatalogItemsTable, businessProfilesTable, getTaxProfile } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import "../automations/index.js";
import { raiseAutomation } from "../lib/automation.js";
import { logContractEvent, finalizeContract, sendContractToCustomer } from "../contracts/service.js";
import { buildInvoiceContext, createInvoice, sendInvoice, recordPayment, invoiceToken } from "../invoices/service.js";
import { TINY_PNG_DATA_URL } from "../lib/pngDataUrl.js";
import { seedQuote, type TestUser } from "./harness.js";

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
  }
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
    signToken, workerToken, teamInviteToken, clientId,
  };
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
