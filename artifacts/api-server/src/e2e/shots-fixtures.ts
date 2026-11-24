// Renders a sample invoice and contract with the product's own renderers, in
// English (Ottawa, HST, 10% Construction Act holdback) and French (Gatineau,
// TPS/TVQ, RBQ licence), and writes them to the web app's dev screenshot data
// (artifacts/quote-ai/src/dev/shots-fixtures.json, read by shots-data.ts), so
// the feature-page screenshots show exactly what a client receives. No
// database is touched (the URL below is never connected to). Every name and
// amount is invented.
//
//   cd artifacts/api-server && npx tsx src/e2e/shots-fixtures.ts
process.env.DATABASE_URL ??= "postgres://shots:shots@127.0.0.1:9/none";

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ContractVariables, Invoice, InvoicePayment, ContractSigner } from "@workspace/db";

const { renderInvoiceHtml, INVOICE_CSS } = await import("../invoices/render.js");
const { buildContractDocument } = await import("../contracts/templates.js");
const { renderContractHtml, CONTRACT_CSS } = await import("../contracts/render.js");

type Lang = "en" | "fr";
const r2 = (n: number) => Math.round(n * 100) / 100;

function build(lang: Lang) {
  const fr = lang === "fr";
  const L = (en: string, frText: string) => (fr ? frText : en);
  const contractor = fr
    ? { name: "Construction Boréal inc.", address: "155, boul. Saint-Joseph", city: "Gatineau", province: "QC", postalCode: "J8Y 3W9", email: "bureau@example.invalid", phone: "819-555-0142", gstHstNumber: "123456789 RT0001", qstNumber: "1234567890 TQ0001", licenceNumber: "5678-1234-01" }
    : { name: "Northline Renovations Ltd.", address: "220 Bank St", city: "Ottawa", province: "ON", postalCode: "K2P 1X4", email: "office@example.invalid", phone: "613-555-0142", gstHstNumber: "123456789 RT0001" };
  const customer = fr
    ? { name: "Mathieu Bélanger", address: "48, rue des Érables", city: "Gatineau", province: "QC", postalCode: "J9H 4K2", email: "client@example.invalid" }
    : { name: "Daniel Okafor", address: "48 Linden Ave", city: "Ottawa", province: "ON", postalCode: "K1S 3H9", email: "client@example.invalid" };
  const site = `${customer.address}, ${customer.city} ${customer.province} ${customer.postalCode}`;
  const title = L("Cedar deck, 14 x 16", "Terrasse en cèdre 14 x 16");

  // ── Invoice: the progress invoice on the accepted deck job ────────────────
  const subtotal = 473_600;
  const holdback = fr ? 0 : Math.round(subtotal * 0.1); // Québec has no statutory lien holdback
  const taxLines = fr
    ? [{ code: "GST", label: "TPS", rate: 5, amountCents: Math.round(subtotal * 0.05), registrationNumber: contractor.gstHstNumber }, { code: "QST", label: "TVQ", rate: 9.975, amountCents: Math.round(subtotal * 0.09975), registrationNumber: contractor.qstNumber }]
    : [{ code: "HST", label: "HST", rate: 13, amountCents: Math.round(subtotal * 0.13), registrationNumber: contractor.gstHstNumber }];
  const tax = taxLines.reduce((s, t) => s + t.amountCents, 0);
  const total = subtotal + tax - holdback;
  const issue = new Date("2026-11-18T15:00:00Z");
  const invoice = {
    id: "inv_deck_2", userId: "u_shots", number: "INV-2026-041", type: "progress", status: "viewed", source: "manual", language: lang, province: contractor.province,
    title, projectId: "j_deck", clientId: "c_q_deck", contractId: "ct_deck", milestoneId: null, paymentTermId: "t2", paymentTermLabel: L("40% when framing is complete", "40 % à la fin de la charpente"),
    creditNoteForId: null, issueDate: issue, dueDate: new Date("2026-12-03T15:00:00Z"), scheduledFor: null,
    contractor, customer, siteAddress: site,
    lines: [{ description: L("Progress billing: framing, joists and ledger complete (40% of contract)", "Facturation progressive : charpente, solives et lambourde terminées (40 % du contrat)"), quantity: 1, unitCents: subtotal, amountCents: subtotal }],
    subtotalCents: subtotal, holdbackPercent: fr ? 0 : 10, holdbackCents: holdback, taxableCents: subtotal,
    taxLines, taxCents: tax, totalCents: total, paidCents: 0,
    notes: L("10% holdback retained under Ontario's Construction Act, released after the lien period.", "Paiement par Virement Interac à l'adresse ci-dessous."),
    paymentInstructions: { etransferEmail: "pay@example.invalid", chequePayableTo: contractor.name, note: null },
    pdfUrl: null, sentAt: issue, viewedAt: new Date("2026-11-19T01:12:00Z"), paidAt: null, voidedAt: null, voidReason: null, autoSendAt: null,
    reminderCount: 0, lastReminderAt: null, createdAt: issue, updatedAt: issue, archivedAt: null,
  } as unknown as Invoice;
  const invoiceHtml = renderInvoiceHtml(invoice, [] as InvoicePayment[], { embedded: true });

  // ── Contract: the same deck job, signed by both parties ───────────────────
  const sub = 11_840;
  const cTax = fr
    ? [{ code: "GST", label: "TPS", rate: 5, amount: r2(sub * 0.05) }, { code: "QST", label: "TVQ", rate: 9.975, amount: r2(sub * 0.09975) }]
    : [{ code: "HST", label: "HST", rate: 13, amount: r2(sub * 0.13) }];
  const cTaxTotal = r2(cTax.reduce((s, t) => s + t.amount, 0));
  const variables: ContractVariables = {
    contractNumber: "C-2026-027", quoteNumber: "Q-2026-114",
    contractor: { name: contractor.name, address: contractor.address, city: contractor.city, province: contractor.province, postalCode: contractor.postalCode, email: contractor.email, phone: contractor.phone, businessNumber: contractor.gstHstNumber, ...(fr ? { licenceNumber: contractor.licenceNumber } : {}) },
    customer: { name: customer.name, address: customer.address, city: customer.city, province: customer.province, postalCode: customer.postalCode, email: customer.email },
    siteAddress: site, province: contractor.province, projectTitle: title,
    priceLines: [{ label: L("Footings, framing and ledger", "Fondations, charpente et lambourde"), amount: 4_980 }, { label: L("Cedar decking, railings and stairs", "Planchers de cèdre, garde-corps et escalier"), amount: 6_860 }],
    discount: null, subtotal: sub, taxLines: cTax, taxTotal: cTaxTotal, total: r2(sub + cTaxTotal),
    paymentSchedule: {
      currency: "CAD", derived: false, holdback: { enabled: !fr, percent: 10 },
      terms: [
        { id: "t1", type: "deposit", label: L("Deposit on signing", "Acompte à la signature"), trigger: "on_signing", amountType: "percent", value: 20, dueDays: 7 },
        { id: "t2", type: "milestone", label: L("When framing is complete", "À la fin de la charpente"), trigger: "milestone", milestoneKey: "framing", amountType: "percent", value: 40, dueDays: 15 },
        { id: "t3", type: "completion", label: L("On completion and walkthrough", "À la fin des travaux et après la visite finale"), trigger: "on_completion", amountType: "percent", value: 40, dueDays: 15 },
      ],
    },
    startDate: "2026-11-24", estimatedDurationWeeks: 2, warrantyMonths: 24, englishRequestedInQuebec: false, directAgreement: false,
  };
  const scopeBody = fr
    ? [
        "Construction d'une terrasse de 14 x 16 pi au niveau du sol, à l'arrière de la maison, fixée à la maison par une lambourde avec solin.",
        "- Six fondations de béton sous la ligne de gel, solives de 2x8 traité à 16 po c/c",
        "- Planches de cèdre rouge 5/4 x 6 avec attaches invisibles",
        "- Garde-corps en cèdre sur trois côtés et un escalier de 4 marches",
        "Les plans et le permis de la Ville de Gatineau sont inclus. La teinture n'est pas incluse.",
      ].join("\n")
    : [
        "Build a 14 x 16 ft ground-level deck at the rear of the house, attached to the house with a flashed ledger board.",
        "- Six concrete footings below frost depth, pressure-treated 2x8 joists at 16 in. on centre",
        "- 5/4 x 6 western red cedar decking with hidden fasteners",
        "- Cedar railing on three sides and one 4-step stair to grade",
        "Permit drawings and the City of Ottawa building permit are included. Staining is not included.",
      ].join("\n");
  const scheduleBody = L("Work starts on or about November 24, 2026 and takes about two weeks, weather permitting.", "Les travaux commencent vers le 24 novembre 2026 et durent environ deux semaines, selon la météo.");
  const document = buildContractDocument({ templateKey: fr ? "QC" : "ON", language: lang, variables, scopeBody, scheduleBody });
  const signedAt = new Date("2026-11-08T19:40:00Z");
  const owner = L("Alex Martin", "Alexandre Martin");
  const signers = [
    { id: "s1", contractId: "ct_deck", role: "contractor", name: owner, email: contractor.email, status: "signed", signatureType: "typed", signatureData: owner, signedAt, viewedAt: signedAt, declinedAt: null, declineReason: null, ipAddress: null, userAgent: null, createdAt: signedAt, updatedAt: signedAt },
    { id: "s2", contractId: "ct_deck", role: "customer", name: customer.name, email: customer.email, status: "signed", signatureType: "typed", signatureData: customer.name, signedAt: new Date("2026-11-09T14:05:00Z"), viewedAt: new Date("2026-11-09T13:58:00Z"), declinedAt: null, declineReason: null, ipAddress: null, userAgent: null, createdAt: signedAt, updatedAt: signedAt },
  ] as unknown as ContractSigner[];
  const contractHtml = renderContractHtml({ document, variables, signers, status: "signed", createdAt: new Date("2026-11-07T16:00:00Z"), embedded: true });

  // The API answers for GET /api/invoices/:id and GET /api/contracts/:id (the
  // serializers in routes/invoices.ts and routes/contracts.ts, by hand).
  const invoiceDto = { ...JSON.parse(JSON.stringify(invoice)), projectName: title, clientName: customer.name, balanceCents: total, hasPdf: true };
  delete invoiceDto.pdfUrl;
  const contractDto = {
    id: "ct_deck", quoteId: "q_deck", clientId: "c_q_deck", projectId: "j_deck", kind: "contract", parentContractId: null, changeOrderId: null,
    contractNumber: variables.contractNumber, status: "signed", province: contractor.province, language: lang, templateKey: fr ? "QC" : "ON", document, variables,
    contractValueCents: Math.round(variables.total * 100), holdbackEnabled: !fr, holdbackPercent: fr ? 0 : 10, hasSignedPdf: true, signedPdfHash: "9f2c41d07ab3e5c8", unsignedPdfHash: "51b0e9a7c3d2f146",
    sentAt: "2026-11-07T16:20:00.000Z", expiresAt: "2026-12-07T16:20:00.000Z", signedAt: "2026-11-09T14:05:00.000Z", voidedAt: null, voidReason: null, reminderCount: 0,
    createdAt: "2026-11-07T16:00:00.000Z", updatedAt: "2026-11-09T14:05:00.000Z", archivedAt: null,
    signers: JSON.parse(JSON.stringify(signers)).map((x: Record<string, unknown>) => ({ id: x.id, role: x.role, name: x.name, email: x.email, status: x.status, signatureType: x.signatureType, signedAt: x.signedAt, viewedAt: x.viewedAt, declinedAt: null, declineReason: null, signatureData: x.signatureData })),
    events: [
      { id: "e1", type: "sent", actor: "contractor", detail: null, createdAt: "2026-11-07T16:20:00.000Z" },
      { id: "e2", type: "viewed", actor: "customer", detail: null, createdAt: "2026-11-09T13:58:00.000Z" },
      { id: "e3", type: "signed", actor: "customer", detail: null, createdAt: "2026-11-09T14:05:00.000Z" },
    ],
  };
  return {
    invoice: { invoice: invoiceDto, payments: [], events: [{ id: "ie1", type: "sent", actor: "contractor", detail: null, createdAt: "2026-11-18T15:00:00.000Z" }, { id: "ie2", type: "viewed", actor: "customer", detail: null, createdAt: "2026-11-19T01:12:00.000Z" }], html: invoiceHtml, css: INVOICE_CSS, publicUrl: "https://quoteai.ca/i/sample", reminderDays: [3, 7, 14] },
    contract: { contract: contractDto, html: contractHtml, css: CONTRACT_CSS },
  };
}

const out = resolve(import.meta.dirname, "../../../quote-ai/src/dev/shots-fixtures.json");
writeFileSync(out, JSON.stringify({ en: build("en"), fr: build("fr") }, null, 1));
console.log("wrote", out);
