import { createHash, createHmac } from "node:crypto";
import {
  db,
  invoicesTable,
  invoicePaymentsTable,
  invoiceEventsTable,
  invoiceSequencesTable,
  projectsTable,
  contractsTable,
  clientsTable,
  changeOrdersTable,
  businessProfilesTable,
  quickbooksConnectionsTable,
  normalizeProvince,
  getTaxProfile,
  DEFAULT_AUTOMATION_SETTINGS,
  type Invoice,
  type InvoicePayment,
  type InvoiceEvent,
  type InvoiceLine,
  type InvoiceParty,
  type InvoiceType,
  type PaymentMethod,
  type PaymentInstructions,
  type Contract,
  type Milestone,
  type Project,
  type AutomationSettings,
  type BusinessProfile,
  type Client,
  type AccountingProvider,
  type InternalAutomationEvent,
} from "@workspace/db";
import { and, asc, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { ObjectStorageService } from "../lib/objectStorage.js";
import { companyLogoDataUri } from "../lib/companyLogo.js";
import { getBaseUrl } from "../lib/baseUrl.js";
import { writeAudit, createNotification } from "../lib/notifications.js";
import { sendInvoiceEmail, sendPaymentReceiptEmail } from "../lib/emailInvoices.js";
import { raiseAutomation } from "../lib/automation.js";
import { getLink, putLink } from "../books/links.js";
import { computeInvoiceAmounts, termSubtotalCents, finalInvoiceSubtotalCents, lienPeriodDays, addDays, statusAfterPayment, balanceCents, lineFrom } from "./math.js";
import { buildInvoicePdf } from "./pdf.js";
import { ti, invoiceTitle, type Lang, type IKey } from "./render.js";
import { currentActorId } from "../lib/requestContext.js";

const storage = new ObjectStorageService();

/**
 * Phase 88: queues a push to the connected accounting package (QuickBooks).
 * Only raised for companies with an enabled connection, so the automation
 * table is not filled with no-op rows for everyone else.
 */
async function raiseAccounting(event: InternalAutomationEvent, userId: string, entityType: string, entityId: string): Promise<void> {
  const [conn] = await db.select({ isEnabled: quickbooksConnectionsTable.isEnabled }).from(quickbooksConnectionsTable).where(eq(quickbooksConnectionsTable.userId, userId));
  if (!conn?.isEnabled) return;
  await raiseAutomation({ event, userId, entityType, entityId });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Public-link token. Deterministic (HMAC of the invoice id with the server
 * secret) so the link in the first email keeps working after reminders and
 * receipts, while the DB only ever stores its hash for lookup.
 */
export function invoiceToken(inv: Pick<Invoice, "id" | "userId">): string {
  const secret = process.env.INVOICE_LINK_SECRET ?? process.env.BETTER_AUTH_SECRET ?? process.env.SESSION_SECRET;
  if (!secret) throw new Error("No server secret configured for invoice links (set INVOICE_LINK_SECRET)");
  return createHmac("sha256", secret).update(`invoice:${inv.userId}:${inv.id}`).digest("base64url");
}

/** Sequential per company × year × kind: INV-2026-0042, CN-2026-0003. */
export async function nextInvoiceNumber(userId: string, kind: "INV" | "CN" = "INV", now = new Date()): Promise<string> {
  const year = now.getFullYear();
  const [row] = await db
    .insert(invoiceSequencesTable)
    .values({ userId, year, kind, next: 2 })
    .onConflictDoUpdate({ target: [invoiceSequencesTable.userId, invoiceSequencesTable.year, invoiceSequencesTable.kind], set: { next: sql`${invoiceSequencesTable.next} + 1` } })
    .returning({ next: invoiceSequencesTable.next });
  const n = (row?.next ?? 2) - 1;
  return `${kind}-${year}-${String(n).padStart(4, "0")}`;
}

export async function logInvoiceEvent(params: { invoiceId: string; type: string; actor: "contractor" | "customer" | "system"; detail?: Record<string, unknown> | null; ip?: string | null; userAgent?: string | null }): Promise<void> {
  await db.insert(invoiceEventsTable).values({ invoiceId: params.invoiceId, type: params.type, actor: params.actor, detail: params.detail ?? null, ip: params.ip ?? null, userAgent: params.userAgent ?? null });
}

export type LoadedInvoice = { invoice: Invoice; payments: InvoicePayment[]; events: InvoiceEvent[] };

export async function loadInvoice(id: string): Promise<LoadedInvoice | null> {
  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  if (!invoice) return null;
  const [payments, events] = await Promise.all([
    db.select().from(invoicePaymentsTable).where(eq(invoicePaymentsTable.invoiceId, id)).orderBy(asc(invoicePaymentsTable.date), asc(invoicePaymentsTable.createdAt)),
    db.select().from(invoiceEventsTable).where(eq(invoiceEventsTable.invoiceId, id)).orderBy(asc(invoiceEventsTable.createdAt)),
  ]);
  return { invoice, payments, events };
}

export function automationSettings(profile: BusinessProfile | undefined | null): AutomationSettings {
  return { ...DEFAULT_AUTOMATION_SETTINGS, ...(profile?.automationSettings ?? {}) };
}

// ── Parties & context ────────────────────────────────────────────────────────

export type InvoiceContext = {
  profile: BusinessProfile | undefined;
  project: Project | null;
  contract: Contract | null;
  client: Client | null;
  contractor: InvoiceParty;
  customer: InvoiceParty;
  siteAddress: string;
  province: string;
  language: Lang;
  paymentInstructions: PaymentInstructions;
  /** Pre-tax and incl.-tax contract amounts in cents (0 when there is no contract). */
  contractSubtotalCents: number;
  contractTotalCents: number;
  holdbackPercent: number;
};

export async function buildInvoiceContext(params: { userId: string; projectId?: string | null; clientId?: string | null; contractId?: string | null; language?: Lang | null; province?: string | null }): Promise<InvoiceContext> {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, params.userId));
  const project = params.projectId ? ((await db.select().from(projectsTable).where(and(eq(projectsTable.id, params.projectId), eq(projectsTable.userId, params.userId))))[0] ?? null) : null;
  const contractId = params.contractId ?? project?.contractId ?? null;
  const contract = contractId ? ((await db.select().from(contractsTable).where(eq(contractsTable.id, contractId)))[0] ?? null) : null;
  const clientId = params.clientId ?? project?.clientId ?? contract?.clientId ?? null;
  const client = clientId ? ((await db.select().from(clientsTable).where(eq(clientsTable.id, clientId)))[0] ?? null) : null;

  const v = contract?.variables ?? null;
  const province = normalizeProvince(params.province) ?? normalizeProvince(contract?.province) ?? normalizeProvince(project?.province) ?? normalizeProvince(client?.province) ?? normalizeProvince(profile?.province) ?? "ON";
  const language: Lang = params.language ?? (contract?.language as Lang | undefined) ?? (client?.preferredLanguage as Lang | undefined) ?? (province === "QC" ? "fr" : "en");

  const contractor: InvoiceParty = {
    name: v?.contractor.name || profile?.companyName || "",
    address: v?.contractor.address ?? profile?.address ?? null,
    province: normalizeProvince(profile?.province) ?? null,
    email: v?.contractor.email ?? profile?.email ?? null,
    phone: v?.contractor.phone ?? profile?.phone ?? null,
    gstHstNumber: profile?.gstHstNumber ?? v?.contractor.businessNumber ?? profile?.vatNumber ?? null,
    qstNumber: profile?.qstNumber ?? null,
    pstNumber: profile?.pstNumber ?? null,
    licenceNumber: profile?.licenceNumber ?? null,
  };
  const customer: InvoiceParty = {
    name: client?.name || v?.customer.name || "",
    address: client?.address ?? v?.customer.address ?? null,
    city: client?.city ?? v?.customer.city ?? null,
    province: client?.province ?? v?.customer.province ?? null,
    postalCode: client?.postalCode ?? v?.customer.postalCode ?? null,
    email: client?.email ?? v?.customer.email ?? null,
    phone: client?.phone ?? v?.customer.phone ?? null,
    businessNumber: client?.businessNumber ?? v?.customer.businessNumber ?? null,
  };
  const siteAddress = v?.siteAddress || project?.address || "";
  const paymentInstructions: PaymentInstructions = {
    etransferEmail: profile?.etransferEmail ?? null,
    chequePayableTo: profile?.companyName || null,
  };
  return {
    profile,
    project,
    contract,
    client,
    contractor,
    customer,
    siteAddress,
    province,
    language,
    paymentInstructions,
    contractSubtotalCents: v ? Math.round(v.subtotal * 100) : 0,
    contractTotalCents: v ? Math.round(v.total * 100) : 0,
    holdbackPercent: contract?.holdbackEnabled ? contract.holdbackPercent : 0,
  };
}

// ── Create ───────────────────────────────────────────────────────────────────

export type CreateInvoiceInput = {
  userId: string;
  ctx: InvoiceContext;
  type: InvoiceType;
  source: "automation" | "manual";
  lines: InvoiceLine[];
  holdbackPercent?: number;
  dueDays: number;
  title?: string;
  notes?: string;
  milestoneId?: string | null;
  changeOrderId?: string | null;
  paymentTermId?: string | null;
  paymentTermLabel?: string | null;
  creditNoteForId?: string | null;
  scheduledFor?: Date | null;
  issueDate?: Date;
  actor: "contractor" | "system";
};

export async function createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
  const { ctx } = input;
  const now = new Date();
  const issueDate = input.issueDate ?? input.scheduledFor ?? now;
  const amounts = computeInvoiceAmounts({
    lines: input.lines,
    province: ctx.province,
    holdbackPercent: input.holdbackPercent ?? 0,
    registration: { gstHstNumber: ctx.contractor.gstHstNumber, qstNumber: ctx.contractor.qstNumber, pstNumber: ctx.contractor.pstNumber },
  });
  const number = await nextInvoiceNumber(input.userId, input.type === "credit_note" ? "CN" : "INV", now);
  const [invoice] = await db
    .insert(invoicesTable)
    .values({
      userId: input.userId,
      createdByUserId: currentActorId(),
      projectId: ctx.project?.id ?? null,
      clientId: ctx.client?.id ?? null,
      contractId: ctx.contract?.id ?? null,
      milestoneId: input.milestoneId ?? null,
      changeOrderId: input.changeOrderId ?? null,
      paymentTermId: input.paymentTermId ?? null,
      paymentTermLabel: input.paymentTermLabel ?? null,
      creditNoteForId: input.creditNoteForId ?? null,
      number,
      type: input.type,
      status: "draft",
      source: input.source,
      language: ctx.language,
      province: ctx.province,
      title: input.title ?? "",
      issueDate,
      dueDate: addDays(issueDate, Math.max(0, input.dueDays)),
      scheduledFor: input.scheduledFor ?? null,
      contractor: ctx.contractor,
      customer: ctx.customer,
      siteAddress: ctx.siteAddress,
      lines: input.lines,
      ...amounts,
      notes: input.notes ?? "",
      paymentInstructions: ctx.paymentInstructions,
    })
    .returning();
  await logInvoiceEvent({ invoiceId: invoice!.id, type: "created", actor: input.actor, detail: { type: input.type, source: input.source, totalCents: amounts.totalCents } });
  await writeAudit({ userId: input.userId, actorType: input.actor === "system" ? "system" : "user", actorId: input.actor === "system" ? null : input.userId, entityType: "invoice", entityId: invoice!.id, action: "created", diff: { number, type: input.type, totalCents: amounts.totalCents } });
  return invoice!;
}

/** Re-prices a draft after its lines / holdback changed. */
export function repriceDraft(inv: Invoice, edits: { lines?: InvoiceLine[]; holdbackPercent?: number }) {
  const lines = edits.lines ?? inv.lines;
  return computeInvoiceAmounts({
    lines,
    province: inv.province,
    holdbackPercent: edits.holdbackPercent ?? inv.holdbackPercent,
    registration: { gstHstNumber: inv.contractor.gstHstNumber, qstNumber: inv.contractor.qstNumber, pstNumber: inv.contractor.pstNumber },
  });
}

// ── Automation drafts ────────────────────────────────────────────────────────
// Each is idempotent: it returns the existing live invoice when one already
// bills the same term / kind for the job (partial unique indexes back this).

async function liveInvoiceForTerm(projectId: string, paymentTermId: string): Promise<Invoice | null> {
  const [row] = await db.select().from(invoicesTable).where(and(eq(invoicesTable.projectId, projectId), eq(invoicesTable.paymentTermId, paymentTermId), ne(invoicesTable.status, "void"))).limit(1);
  return row ?? null;
}

async function liveInvoiceOfType(projectId: string, type: InvoiceType): Promise<Invoice | null> {
  const [row] = await db.select().from(invoicesTable).where(and(eq(invoicesTable.projectId, projectId), eq(invoicesTable.type, type), ne(invoicesTable.status, "void"))).limit(1);
  return row ?? null;
}

/** Pre-tax subtotal already billed on a job (non-void, excluding credit notes and holdback releases). */
async function invoicedSubtotalCents(projectId: string): Promise<number> {
  const rows = await db
    .select({ s: sql<number>`coalesce(sum(${invoicesTable.subtotalCents}), 0)` })
    .from(invoicesTable)
    .where(and(eq(invoicesTable.projectId, projectId), ne(invoicesTable.status, "void"), sql`${invoicesTable.type} NOT IN ('holdback_release','credit_note')`));
  return Number(rows[0]?.s ?? 0);
}

/** Pre-tax value of the job: contract subtotal + signed change orders. */
export async function jobSubtotalCents(project: Project, ctx: InvoiceContext): Promise<number> {
  // Manual jobs store an incl.-tax value; back the province tax out of it.
  const base = ctx.contract ? ctx.contractSubtotalCents : Math.round(project.contractValueCents / (1 + getTaxProfile(ctx.province).totalRate / 100));
  const cos = await db.select({ s: changeOrdersTable.subtotalCents }).from(changeOrdersTable).where(and(eq(changeOrdersTable.projectId, project.id), eq(changeOrdersTable.status, "signed")));
  return base + cos.reduce((s, c) => s + c.s, 0);
}

export async function draftDepositInvoice(params: { contract: Contract; projectId: string; source?: "automation" | "manual"; actor?: "contractor" | "system" }): Promise<{ invoice: Invoice; created: boolean } | null> {
  const { contract } = params;
  const deposit = contract.variables.paymentSchedule.terms.find((t) => t.trigger === "on_signing");
  if (!deposit) return null;
  const existing = await liveInvoiceForTerm(params.projectId, deposit.id);
  if (existing) return { invoice: existing, created: false };
  const ctx = await buildInvoiceContext({ userId: contract.userId, projectId: params.projectId, contractId: contract.id });
  const subtotal = termSubtotalCents(deposit, { subtotalCents: ctx.contractSubtotalCents, totalCents: ctx.contractTotalCents });
  if (subtotal <= 0) return null;
  const lang = ctx.language;
  const invoice = await createInvoice({
    userId: contract.userId,
    ctx,
    type: "deposit",
    source: params.source ?? "automation",
    actor: params.actor ?? "system",
    lines: [lineFrom(`${deposit.label} — ${ti("contract", lang)} ${contract.contractNumber}`, subtotal)],
    holdbackPercent: 0,
    dueDays: deposit.dueDays,
    paymentTermId: deposit.id,
    paymentTermLabel: deposit.label,
  });
  return { invoice, created: true };
}

export async function draftMilestoneInvoice(params: { milestone: Milestone; source?: "automation" | "manual"; actor?: "contractor" | "system" }): Promise<{ invoice: Invoice; created: boolean } | null> {
  const m = params.milestone;
  if (!m.paymentTermId) return null;
  const existing = await liveInvoiceForTerm(m.projectId, m.paymentTermId);
  if (existing) return { invoice: existing, created: false };
  const ctx = await buildInvoiceContext({ userId: m.userId, projectId: m.projectId });
  if (!ctx.contract || !ctx.project) return null;
  const term = ctx.contract.variables.paymentSchedule.terms.find((t) => t.id === m.paymentTermId);
  if (!term) return null;
  if (term.type === "completion") {
    // A completion term linked to the last milestone IS the final invoice.
    return draftFinalInvoice({ project: ctx.project, source: params.source, actor: params.actor, milestoneId: m.id, term });
  }
  const subtotal = termSubtotalCents(term, { subtotalCents: ctx.contractSubtotalCents, totalCents: ctx.contractTotalCents });
  if (subtotal <= 0) return null;
  const invoice = await createInvoice({
    userId: m.userId,
    ctx,
    type: "progress",
    source: params.source ?? "automation",
    actor: params.actor ?? "system",
    lines: [lineFrom(`${term.label} — ${m.title}`, subtotal)],
    holdbackPercent: ctx.holdbackPercent,
    dueDays: term.dueDays,
    milestoneId: m.id,
    paymentTermId: term.id,
    paymentTermLabel: term.label,
  });
  return { invoice, created: true };
}

/** Bills whatever is still unbilled on the job (contract + change orders − invoiced). */
export async function draftFinalInvoice(params: { project: Project; source?: "automation" | "manual"; actor?: "contractor" | "system"; milestoneId?: string | null; term?: { id: string; label: string; dueDays: number } | null }): Promise<{ invoice: Invoice; created: boolean } | null> {
  const { project } = params;
  const existing = await liveInvoiceOfType(project.id, "final");
  if (existing) return { invoice: existing, created: false };
  const ctx = await buildInvoiceContext({ userId: project.userId, projectId: project.id });
  const term = params.term ?? ctx.contract?.variables.paymentSchedule.terms.find((t) => t.trigger === "on_completion") ?? null;
  const jobSubtotal = await jobSubtotalCents(project, ctx);
  const billed = await invoicedSubtotalCents(project.id);
  const subtotal = finalInvoiceSubtotalCents({ jobSubtotalCents: jobSubtotal, invoicedSubtotalCents: billed });
  if (subtotal <= 0) return null;
  const lang = ctx.language;
  const lines: InvoiceLine[] = [lineFrom(term?.label ?? (lang === "fr" ? "Solde final des travaux" : "Final balance of the work"), subtotal)];
  const invoice = await createInvoice({
    userId: project.userId,
    ctx,
    type: "final",
    source: params.source ?? "automation",
    actor: params.actor ?? "system",
    lines,
    holdbackPercent: ctx.holdbackPercent,
    dueDays: term?.dueDays ?? 15,
    milestoneId: params.milestoneId ?? null,
    paymentTermId: term?.id ?? null,
    paymentTermLabel: term?.label ?? null,
    notes: lang === "fr" ? "Facture finale : solde du contrat et des ordres de changement signés, moins les montants déjà facturés." : "Final invoice: balance of the contract and signed change orders, less amounts already invoiced.",
  });
  return { invoice, created: true };
}

/** Sums the holdback withheld on the job's invoices into one release invoice, scheduled after the lien period. */
export async function draftHoldbackReleaseInvoice(params: { project: Project; source?: "automation" | "manual"; actor?: "contractor" | "system" }): Promise<{ invoice: Invoice; created: boolean } | null> {
  const { project } = params;
  const existing = await liveInvoiceOfType(project.id, "holdback_release");
  if (existing) return { invoice: existing, created: false };
  const withheld = await db
    .select({ number: invoicesTable.number, holdbackCents: invoicesTable.holdbackCents })
    .from(invoicesTable)
    .where(and(eq(invoicesTable.projectId, project.id), ne(invoicesTable.status, "void"), sql`${invoicesTable.holdbackCents} > 0`))
    .orderBy(asc(invoicesTable.issueDate));
  const total = withheld.reduce((s, w) => s + w.holdbackCents, 0);
  if (total <= 0) return null;
  const ctx = await buildInvoiceContext({ userId: project.userId, projectId: project.id });
  const lang = ctx.language;
  const term = ctx.contract?.variables.paymentSchedule.terms.find((t) => t.trigger === "holdback_release") ?? null;
  const completedAt = project.completedAt ?? new Date();
  const scheduledFor = addDays(completedAt, lienPeriodDays(ctx.province));
  const invoice = await createInvoice({
    userId: project.userId,
    ctx,
    type: "holdback_release",
    source: params.source ?? "automation",
    actor: params.actor ?? "system",
    lines: withheld.map((w) => lineFrom(`${lang === "fr" ? "Retenue légale sur la facture" : "Statutory holdback withheld on invoice"} ${w.number}`, w.holdbackCents)),
    holdbackPercent: 0,
    dueDays: term?.dueDays ?? 15,
    paymentTermId: term?.id ?? null,
    paymentTermLabel: term?.label ?? null,
    scheduledFor,
    notes: lang === "fr"
      ? `Libération de la retenue légale à l'expiration du délai de privilège (${lienPeriodDays(ctx.province)} jours après l'achèvement des travaux).`
      : `Release of the statutory holdback at the end of the lien period (${lienPeriodDays(ctx.province)} days after completion of the work).`,
  });
  return { invoice, created: true };
}

// ── After an automation drafts an invoice ────────────────────────────────────

export type DraftOutcome = { invoice: Invoice; action: "sent" | "scheduled_auto_send" | "draft" | "scheduled_release"; sendError?: string };

/**
 * Applies the company's automation preference: send now, arm the
 * review-then-auto-send timer, or leave a draft. Holdback releases are
 * never sent before their lien date. Optionally notifies the company.
 */
export async function applyAutoSendPolicy(invoice: Invoice, profile: BusinessProfile | undefined, opts: { notify: boolean; notificationTitle?: string } = { notify: true }): Promise<DraftOutcome> {
  const settings = automationSettings(profile);
  const lang = invoice.language as Lang;
  const cad = (c: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(c / 100);
  let outcome: DraftOutcome = { invoice, action: "draft" };

  if (invoice.status !== "draft") return { invoice, action: "draft" };

  if (invoice.scheduledFor && invoice.scheduledFor > new Date()) {
    outcome = { invoice, action: "scheduled_release" };
  } else if (settings.autoSendInvoices) {
    try {
      const sent = await sendInvoice({ invoiceId: invoice.id, actor: "system" });
      outcome = { invoice: sent.invoice, action: "sent" };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn({ err, invoiceId: invoice.id }, "Auto-send failed — leaving the invoice as a draft");
      outcome = { invoice, action: "draft", sendError: message };
    }
  } else if (settings.invoiceAutoSendAfterHours > 0) {
    const autoSendAt = new Date(Date.now() + settings.invoiceAutoSendAfterHours * 3_600_000);
    const [updated] = await db.update(invoicesTable).set({ autoSendAt }).where(eq(invoicesTable.id, invoice.id)).returning();
    outcome = { invoice: updated ?? invoice, action: "scheduled_auto_send" };
  }

  if (opts.notify) {
    const typeLabel = ti(`type_${invoice.type}` as IKey, lang);
    const body =
      outcome.action === "sent" ? `${typeLabel} ${invoice.number} (${cad(invoice.totalCents)}) was emailed to ${invoice.customer.name || "the customer"}.`
      : outcome.action === "scheduled_auto_send" ? `${typeLabel} ${invoice.number} (${cad(invoice.totalCents)}) is ready. It will be sent automatically in ${settings.invoiceAutoSendAfterHours} h unless you edit or send it first.`
      : outcome.action === "scheduled_release" ? `${typeLabel} ${invoice.number} (${cad(invoice.totalCents)}) is drafted and will become sendable on ${invoice.scheduledFor!.toLocaleDateString("en-CA", { dateStyle: "long" })}, when the lien period ends.`
      : `${typeLabel} ${invoice.number} (${cad(invoice.totalCents)}) is ready to review and send.${outcome.sendError ? ` Auto-send failed: ${outcome.sendError}.` : ""}`;
    await createNotification({
      userId: invoice.userId,
      type: outcome.action === "sent" ? "invoice_sent" : "invoice_drafted",
      title: opts.notificationTitle ?? (outcome.action === "sent" ? `${typeLabel} ${invoice.number} sent` : `${typeLabel} ${invoice.number} ready to send`),
      body,
      link: `/dashboard/invoices/${invoice.id}`,
      entityType: "invoice",
      entityId: invoice.id,
    });
  }
  return outcome;
}

// ── PDF & storage ────────────────────────────────────────────────────────────

async function renderAndStore(loaded: LoadedInvoice): Promise<{ url: string; sha256: string; buffer: Buffer }> {
  const { buffer, sha256 } = await buildInvoicePdf(loaded.invoice, loaded.payments, { logo: await companyLogoDataUri(loaded.invoice.userId) });
  const url = await storage.uploadObjectBuffer({
    subPath: `invoices/${loaded.invoice.userId}/${loaded.invoice.id}/${loaded.invoice.number}-${sha256.slice(0, 12)}.pdf`,
    buffer,
    contentType: "application/pdf",
  });
  return { url, sha256, buffer };
}

/** Current PDF: rendered fresh (drafts, and after payments change the balance) — the stored copy is the "as sent" archive. */
export async function invoicePdfBuffer(invoiceId: string): Promise<{ buffer: Buffer; filename: string }> {
  const loaded = await loadInvoice(invoiceId);
  if (!loaded) throw new Error("Invoice not found");
  const { buffer } = await buildInvoicePdf(loaded.invoice, loaded.payments, { logo: await companyLogoDataUri(loaded.invoice.userId) });
  return { buffer, filename: `${loaded.invoice.number}${loaded.invoice.status === "draft" ? "-draft" : ""}.pdf` };
}

export function publicInvoiceUrl(rawToken: string): string {
  return `${getBaseUrl()}/i/${rawToken}`;
}

// ── Send ─────────────────────────────────────────────────────────────────────

export async function sendInvoice(params: { invoiceId: string; userId?: string; actor: "contractor" | "system"; message?: string; ip?: string | null; userAgent?: string | null }): Promise<{ invoice: Invoice; resend: boolean }> {
  const loaded = await loadInvoice(params.invoiceId);
  if (!loaded || (params.userId && loaded.invoice.userId !== params.userId)) throw new Error("Invoice not found");
  const inv = loaded.invoice;
  if (inv.status === "void") throw new Error("Cannot send a voided invoice");
  if (inv.status === "paid") throw new Error("Invoice already paid");
  const toEmail = (inv.customer.email ?? "").trim();
  if (!toEmail.includes("@")) throw new Error("CUSTOMER_EMAIL_MISSING");
  if (inv.lines.length === 0 || inv.totalCents === 0) throw new Error("Invoice has no amount");

  const resend = inv.status !== "draft";
  const now = new Date();
  // A draft that sat around is dated when it actually goes out; the net terms shift with it.
  const dueDays = Math.max(0, Math.round((inv.dueDate.getTime() - inv.issueDate.getTime()) / 86_400_000));
  const issueDate = resend ? inv.issueDate : now;
  const dueDate = resend ? inv.dueDate : addDays(now, dueDays);

  const rawToken = invoiceToken(inv);
  await db.update(invoicesTable).set({ issueDate, dueDate, publicTokenHash: hashToken(rawToken), status: resend ? inv.status : "sent", sentAt: inv.sentAt ?? now, autoSendAt: null, scheduledFor: inv.scheduledFor && inv.scheduledFor > now ? now : inv.scheduledFor }).where(eq(invoicesTable.id, inv.id));
  const fresh = (await loadInvoice(inv.id))!;
  const stored = await renderAndStore(fresh);
  const [updated] = await db.update(invoicesTable).set({ pdfUrl: stored.url, pdfHash: stored.sha256 }).where(eq(invoicesTable.id, inv.id)).returning();

  const lang = inv.language as Lang;
  const [senderProfile] = await db.select({ email: businessProfilesTable.email }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, inv.userId));
  await sendInvoiceEmail({
    toEmail,
    userId: inv.userId,
    customerName: inv.customer.name,
    companyName: inv.contractor.name,
    number: inv.number,
    totalCents: inv.totalCents,
    balanceCents: balanceCents(inv),
    dueDate,
    publicUrl: publicInvoiceUrl(rawToken),
    language: lang,
    etransferEmail: inv.paymentInstructions.etransferEmail ?? null,
    pdfBuffer: stored.buffer,
    message: params.message,
    isCreditNote: inv.type === "credit_note",
    typeLabel: invoiceTitle(inv, lang),
    replyTo: senderProfile?.email ?? null,
  });

  await logInvoiceEvent({ invoiceId: inv.id, type: params.actor === "system" ? "auto_sent" : resend ? "resent" : "sent", actor: params.actor, detail: { to: toEmail }, ip: params.ip, userAgent: params.userAgent });
  await writeAudit({ userId: inv.userId, actorType: params.actor === "system" ? "system" : "user", actorId: params.userId ?? null, entityType: "invoice", entityId: inv.id, action: resend ? "resent" : "sent", diff: { to: toEmail, pdfHash: stored.sha256 }, ip: params.ip, userAgent: params.userAgent });
  if (!resend && inv.type !== "credit_note") await raiseAccounting("accounting.invoice_sent", inv.userId, "invoice", inv.id);
  return { invoice: updated!, resend };
}

// ── Payments ─────────────────────────────────────────────────────────────────

/** Recomputes paid_cents + status from the payments table. */
export async function refreshInvoiceStatus(invoiceId: string, now = new Date()): Promise<Invoice> {
  const loaded = await loadInvoice(invoiceId);
  if (!loaded) throw new Error("Invoice not found");
  const inv = loaded.invoice;
  const paidCents = loaded.payments.reduce((s, p) => s + p.amountCents, 0);
  const status = statusAfterPayment({ status: inv.status, totalCents: inv.totalCents, paidCents, dueDate: inv.dueDate, now });
  const paidAt = status === "paid" ? (inv.paidAt ?? loaded.payments.at(-1)?.date ?? now) : null;
  const [updated] = await db.update(invoicesTable).set({ paidCents, status, paidAt }).where(eq(invoicesTable.id, invoiceId)).returning();
  if (status === "paid" && inv.status !== "paid") {
    await logInvoiceEvent({ invoiceId, type: "paid", actor: "system", detail: { paidCents } });
    await raiseAutomation({ event: "invoice.paid", userId: inv.userId, entityType: "invoice", entityId: invoiceId });
  }
  return updated!;
}

/**
 * `external` (Phase 88): the payment was recorded in the accounting package
 * and is being brought back — linked before anything else runs, so it is never
 * pushed back to where it came from.
 */
export async function recordPayment(params: {
  invoiceId: string;
  userId: string;
  amountCents: number;
  method: PaymentMethod;
  date?: Date;
  reference?: string;
  note?: string;
  sendReceipt?: boolean;
  ip?: string | null;
  external?: { provider: AccountingProvider; externalType: string; externalId: string };
}): Promise<{ invoice: Invoice; payment: InvoicePayment }> {
  const loaded = await loadInvoice(params.invoiceId);
  if (!loaded || loaded.invoice.userId !== params.userId) throw new Error("Invoice not found");
  const inv = loaded.invoice;
  if (inv.status === "draft") throw new Error("Send the invoice before recording a payment");
  if (inv.status === "void") throw new Error("Invoice is void");
  if (inv.type === "credit_note") throw new Error("Credit notes do not take payments");
  if (params.amountCents <= 0) throw new Error("Amount must be positive");

  const date = params.date ?? new Date();
  const [payment] = await db
    .insert(invoicePaymentsTable)
    .values({ invoiceId: inv.id, userId: params.userId, date, amountCents: params.amountCents, method: params.method, reference: params.reference ?? "", note: params.note ?? "" })
    .returning();
  const ext = params.external;
  if (ext) await putLink({ userId: params.userId, provider: ext.provider, entityType: "invoice_payment", entityId: payment!.id, externalId: ext.externalId, externalType: ext.externalType, origin: "external" });
  await logInvoiceEvent({ invoiceId: inv.id, type: "payment_recorded", actor: ext ? "system" : "contractor", detail: { amountCents: params.amountCents, method: params.method, reference: params.reference ?? "", ...(ext ? { from: ext.provider } : {}) }, ip: params.ip });
  const updated = await refreshInvoiceStatus(inv.id);
  await writeAudit({ userId: params.userId, actorType: ext ? "system" : "user", actorId: ext ? null : params.userId, entityType: "invoice", entityId: inv.id, action: "payment_recorded", diff: { amountCents: params.amountCents, method: params.method, ...(ext ? { from: ext.provider } : {}) }, ip: params.ip });
  if (!ext) await raiseAccounting("accounting.payment_recorded", params.userId, "invoice_payment", payment!.id);

  const toEmail = (inv.customer.email ?? "").trim();
  if (params.sendReceipt !== false && toEmail.includes("@") && inv.publicTokenHash) {
    try {
      const [senderProfile] = await db.select({ email: businessProfilesTable.email }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, inv.userId));
      await sendPaymentReceiptEmail({
        toEmail,
        userId: inv.userId,
        customerName: inv.customer.name,
        companyName: inv.contractor.name,
        number: inv.number,
        totalCents: inv.totalCents,
        balanceCents: balanceCents(updated),
        dueDate: inv.dueDate,
        publicUrl: publicInvoiceUrl(invoiceToken(inv)),
        language: inv.language as Lang,
        etransferEmail: inv.paymentInstructions.etransferEmail ?? null,
        paidCents: params.amountCents,
        paidOn: date,
        replyTo: senderProfile?.email ?? null,
      });
      await logInvoiceEvent({ invoiceId: inv.id, type: "receipt_sent", actor: "system", detail: { to: toEmail } });
    } catch (err) {
      logger.warn({ err, invoiceId: inv.id }, "Payment receipt email failed");
    }
  }
  return { invoice: updated, payment: payment! };
}

// ── e-Transfer self-report / confirm / reject (Phase 15) ────────────────────
// Interac e-Transfer needs no payment-processor integration — it's a
// confirmation workflow: the customer tells us they sent it, the contractor
// confirms receipt (one click) before the invoice becomes paid.

export async function reportEtransferSent(params: { invoiceId: string; ip?: string | null; userAgent?: string | null }): Promise<Invoice> {
  const loaded = await loadInvoice(params.invoiceId);
  if (!loaded) throw new Error("Invoice not found");
  const inv = loaded.invoice;
  if (!["sent", "viewed", "overdue"].includes(inv.status)) throw new Error("NOT_OPEN");
  const [updated] = await db.update(invoicesTable).set({ status: "pending_confirmation", etransferSelfReportedAt: new Date() }).where(eq(invoicesTable.id, inv.id)).returning();
  await logInvoiceEvent({ invoiceId: inv.id, type: "etransfer_reported", actor: "customer", ip: params.ip, userAgent: params.userAgent });
  await createNotification({
    userId: inv.userId,
    type: "invoice_payment_reported",
    title: `${inv.number}: customer says they paid`,
    body: `${inv.customer.name || "The customer"} marked ${inv.number} (${(inv.totalCents / 100).toLocaleString("en-CA", { style: "currency", currency: "CAD" })}) as sent by e-Transfer. Confirm receipt to mark it paid.`,
    link: `/dashboard/invoices/${inv.id}`,
    entityType: "invoice",
    entityId: inv.id,
  });
  return updated!;
}

export async function confirmEtransferReceived(params: { invoiceId: string; userId: string; ip?: string | null }): Promise<Invoice> {
  const loaded = await loadInvoice(params.invoiceId);
  if (!loaded || loaded.invoice.userId !== params.userId) throw new Error("Invoice not found");
  const inv = loaded.invoice;
  const amountCents = balanceCents(inv);
  if (amountCents <= 0) throw new Error("Nothing owing on this invoice");
  const { invoice } = await recordPayment({ invoiceId: inv.id, userId: params.userId, amountCents, method: "etransfer", note: "Confirmed from the customer's e-Transfer self-report", sendReceipt: true, ip: params.ip });
  return invoice;
}

export async function rejectEtransferReport(params: { invoiceId: string; userId: string; ip?: string | null }): Promise<Invoice> {
  const loaded = await loadInvoice(params.invoiceId);
  if (!loaded || loaded.invoice.userId !== params.userId) throw new Error("Invoice not found");
  const inv = loaded.invoice;
  if (inv.status !== "pending_confirmation") throw new Error("Invoice is not awaiting confirmation");
  const [updated] = await db.update(invoicesTable).set({ status: statusAfterPayment({ status: "sent", totalCents: inv.totalCents, paidCents: inv.paidCents, dueDate: inv.dueDate }), etransferSelfReportedAt: null }).where(eq(invoicesTable.id, inv.id)).returning();
  await logInvoiceEvent({ invoiceId: inv.id, type: "etransfer_rejected", actor: "contractor", ip: params.ip });
  return updated!;
}

export async function removePayment(params: { invoiceId: string; paymentId: string; userId: string }): Promise<Invoice> {
  const [payment] = await db.select().from(invoicePaymentsTable).where(and(eq(invoicePaymentsTable.id, params.paymentId), eq(invoicePaymentsTable.invoiceId, params.invoiceId), eq(invoicePaymentsTable.userId, params.userId)));
  if (!payment) throw new Error("Payment not found");
  if (payment.creditNoteId) throw new Error("Void the credit note instead");
  // Phase 88: a payment already in QuickBooks is deleted there too (its id travels in the payload — the row is gone by then).
  const qbo = await getLink(params.userId, "quickbooks", "invoice_payment", payment.id);
  await db.delete(invoicePaymentsTable).where(eq(invoicePaymentsTable.id, payment.id));
  if (qbo && qbo.origin === "quoteai") {
    const [conn] = await db.select({ isEnabled: quickbooksConnectionsTable.isEnabled }).from(quickbooksConnectionsTable).where(eq(quickbooksConnectionsTable.userId, params.userId));
    if (conn?.isEnabled) await raiseAutomation({ event: "accounting.payment_removed", userId: params.userId, entityType: "invoice_payment", entityId: payment.id, payload: { qboPaymentId: qbo.externalId } });
  }
  await logInvoiceEvent({ invoiceId: params.invoiceId, type: "payment_removed", actor: "contractor", detail: { amountCents: payment.amountCents } });
  return refreshInvoiceStatus(params.invoiceId);
}

// ── Void & credit notes ──────────────────────────────────────────────────────

export async function voidInvoice(params: { invoiceId: string; userId: string; reason?: string; ip?: string | null }): Promise<Invoice> {
  const loaded = await loadInvoice(params.invoiceId);
  if (!loaded || loaded.invoice.userId !== params.userId) throw new Error("Invoice not found");
  const inv = loaded.invoice;
  if (inv.status === "void") return inv;
  if (loaded.payments.some((p) => !p.creditNoteId)) throw new Error("PAYMENTS_EXIST");
  if (inv.type === "credit_note" && inv.creditNoteForId) {
    // Undo the credit applied to the original invoice.
    await db.delete(invoicePaymentsTable).where(eq(invoicePaymentsTable.creditNoteId, inv.id));
    await refreshInvoiceStatus(inv.creditNoteForId);
  }
  const [updated] = await db.update(invoicesTable).set({ status: "void", voidedAt: new Date(), voidReason: params.reason ?? null, autoSendAt: null }).where(eq(invoicesTable.id, inv.id)).returning();
  await logInvoiceEvent({ invoiceId: inv.id, type: "voided", actor: "contractor", detail: { reason: params.reason ?? null }, ip: params.ip });
  await writeAudit({ userId: params.userId, actorType: "user", actorId: params.userId, entityType: "invoice", entityId: inv.id, action: "voided", diff: { reason: params.reason ?? null }, ip: params.ip });
  await raiseAccounting("accounting.invoice_voided", params.userId, "invoice", inv.id);
  return updated!;
}

/**
 * Issues a credit note against a sent invoice: a negative invoice document
 * that is applied to the original as a "credit_note" payment, so the
 * original's balance and status follow the normal payment logic.
 */
export async function createCreditNote(params: { invoiceId: string; userId: string; amountCents: number; description: string; reason?: string; send?: boolean; ip?: string | null }): Promise<{ creditNote: Invoice; original: Invoice }> {
  const loaded = await loadInvoice(params.invoiceId);
  if (!loaded || loaded.invoice.userId !== params.userId) throw new Error("Invoice not found");
  const inv = loaded.invoice;
  if (inv.status === "draft") throw new Error("Edit the draft instead of issuing a credit note");
  if (inv.status === "void" || inv.type === "credit_note") throw new Error("Cannot credit this document");
  if (params.amountCents <= 0) throw new Error("Amount must be positive");
  if (params.amountCents > inv.taxableCents) throw new Error("Credit exceeds the invoice amount");

  const ctx = await buildInvoiceContext({ userId: inv.userId, projectId: inv.projectId, clientId: inv.clientId, contractId: inv.contractId, language: inv.language as Lang, province: inv.province });
  const lang = ctx.language;
  const creditNote = await createInvoice({
    userId: inv.userId,
    ctx,
    type: "credit_note",
    source: "manual",
    actor: "contractor",
    lines: [lineFrom(`${params.description} (${ti("refersTo", lang)} ${inv.number})`, -params.amountCents)],
    holdbackPercent: 0,
    dueDays: 0,
    creditNoteForId: inv.id,
    notes: params.reason ?? "",
  });
  // Apply the credit (incl. tax) to the original, capped at its balance.
  const credit = Math.min(-creditNote.totalCents, Math.max(0, inv.totalCents - inv.paidCents));
  if (credit > 0) {
    await db.insert(invoicePaymentsTable).values({ invoiceId: inv.id, userId: inv.userId, date: new Date(), amountCents: credit, method: "credit_note", reference: creditNote.number, creditNoteId: creditNote.id });
  }
  await logInvoiceEvent({ invoiceId: inv.id, type: "credit_note_issued", actor: "contractor", detail: { creditNoteId: creditNote.id, number: creditNote.number, amountCents: creditNote.totalCents }, ip: params.ip });
  const original = await refreshInvoiceStatus(inv.id);

  // A credit note is a final document the moment it exists: mark it sent (emailed when possible).
  let cn = creditNote;
  if (params.send !== false && (inv.customer.email ?? "").includes("@")) {
    try {
      cn = (await sendInvoice({ invoiceId: creditNote.id, userId: params.userId, actor: "contractor", ip: params.ip })).invoice;
    } catch (err) {
      logger.warn({ err, creditNoteId: creditNote.id }, "Credit note email failed");
    }
  }
  if (cn.status === "draft") {
    const [marked] = await db.update(invoicesTable).set({ status: "paid", sentAt: new Date(), paidAt: new Date() }).where(eq(invoicesTable.id, cn.id)).returning();
    cn = marked!;
  } else {
    cn = await refreshInvoiceStatus(cn.id);
  }
  return { creditNote: cn, original };
}

// ── Queries for the UI ───────────────────────────────────────────────────────

export async function invoicesForProject(projectId: string): Promise<Invoice[]> {
  return db.select().from(invoicesTable).where(and(eq(invoicesTable.projectId, projectId), isNull(invoicesTable.archivedAt))).orderBy(asc(invoicesTable.issueDate), asc(invoicesTable.createdAt));
}

export async function invoicesForUser(userId: string, limit = 500): Promise<Invoice[]> {
  return db.select().from(invoicesTable).where(and(eq(invoicesTable.userId, userId), isNull(invoicesTable.archivedAt))).orderBy(desc(invoicesTable.issueDate), desc(invoicesTable.createdAt)).limit(limit);
}

/** Totals used by the job KPI strip: invoiced (excl. drafts/void/credit) and collected. */
export function projectInvoiceTotals(invoices: Invoice[]): { invoicedCents: number; collectedCents: number; outstandingCents: number; overdueCents: number; draftCount: number } {
  let invoicedCents = 0, collectedCents = 0, outstandingCents = 0, overdueCents = 0, draftCount = 0;
  for (const inv of invoices) {
    if (inv.status === "void") continue;
    if (inv.status === "draft") { draftCount++; continue; }
    invoicedCents += inv.totalCents;
    collectedCents += Math.min(inv.paidCents, Math.max(inv.totalCents, 0));
    const bal = balanceCents(inv);
    outstandingCents += bal;
    if (inv.status === "overdue") overdueCents += bal;
  }
  return { invoicedCents, collectedCents, outstandingCents, overdueCents, draftCount };
}

