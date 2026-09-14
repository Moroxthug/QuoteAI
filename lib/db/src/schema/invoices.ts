import {
  pgTable,
  text,
  uuid,
  timestamp,
  jsonb,
  integer,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { projectsTable } from "./crm";
import { clientsTable } from "./clients";

// ── Phase 4: invoicing ───────────────────────────────────────────────────────
// Invoices are drafted by the automations (deposit on signing, progress on
// milestone completion, final + holdback release on job completion) or by
// hand, numbered per company and year, and frozen once sent: a sent invoice
// is never edited — it is voided and reissued, or corrected with a credit
// note. All money is in integer cents with an explicit tax breakdown and the
// province on every row (CRA invoice requirements).

export const INVOICE_TYPES = ["deposit", "progress", "final", "holdback_release", "change_order", "manual", "credit_note"] as const;
export type InvoiceType = (typeof INVOICE_TYPES)[number];

// "pending_confirmation": the customer self-reported an e-Transfer as sent
// (public invoice page) but the contractor hasn't confirmed receipt yet —
// see Phase 15. Never set by the payment math itself, only by the explicit
// self-report / confirm / reject actions.
export const INVOICE_STATUSES = ["draft", "sent", "viewed", "pending_confirmation", "partially_paid", "paid", "overdue", "void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/** Statuses that count towards accounts receivable. */
export const OPEN_INVOICE_STATUSES: readonly InvoiceStatus[] = ["sent", "viewed", "pending_confirmation", "partially_paid", "overdue"];

export const PAYMENT_METHODS = ["etransfer", "cheque", "cash", "card", "bank_transfer", "credit_note", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const invoiceLineSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().min(0).default(1),
  /** Unit price in cents (pre-tax). */
  unitCents: z.number().int(),
  /** Line amount in cents (pre-tax) = quantity × unitCents, rounded. */
  amountCents: z.number().int(),
});
export type InvoiceLine = z.infer<typeof invoiceLineSchema>;

export type InvoiceTaxLine = { code: string; label: string; rate: number; amountCents: number; registrationNumber?: string | null };

/** Snapshot of how the customer can pay, taken when the invoice is created. */
export type PaymentInstructions = {
  etransferEmail?: string | null;
  chequePayableTo?: string | null;
  note?: string | null;
};

/** Snapshot of the two parties as printed on the invoice. */
export type InvoiceParty = {
  name: string;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  email?: string | null;
  phone?: string | null;
  gstHstNumber?: string | null;
  qstNumber?: string | null;
  pstNumber?: string | null;
  licenceNumber?: string | null;
  businessNumber?: string | null;
};

export const invoicesTable = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    projectId: uuid("project_id").references(() => projectsTable.id, { onDelete: "set null" }),
    clientId: uuid("client_id").references(() => clientsTable.id, { onDelete: "set null" }),
    /** Plain uuids (no drizzle FK) to avoid schema cycles; FKs live in SQL. */
    contractId: uuid("contract_id"),
    milestoneId: uuid("milestone_id"),
    changeOrderId: uuid("change_order_id"),
    /** Payment term (from the contract's schedule) this invoice bills, if any. */
    paymentTermId: text("payment_term_id"),
    paymentTermLabel: text("payment_term_label"),
    /** For credit notes: the invoice being corrected. */
    creditNoteForId: uuid("credit_note_for_id"),
    number: text("number").notNull(), // INV-2026-0042 / CN-2026-0003
    type: text("type", { enum: INVOICE_TYPES }).notNull().default("manual"),
    status: text("status", { enum: INVOICE_STATUSES }).notNull().default("draft"),
    source: text("source", { enum: ["automation", "manual"] }).notNull().default("manual"),
    language: text("language", { enum: ["en", "fr"] }).notNull().default("en"),
    province: text("province").notNull(),
    title: text("title").notNull().default(""),
    issueDate: timestamp("issue_date", { withTimezone: true }).notNull().defaultNow(),
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
    /** Holdback-release invoices are drafted at completion but only sendable after the lien period. */
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    /** Set once the company was told the lien period is over and the release can go out. */
    scheduledNotifiedAt: timestamp("scheduled_notified_at", { withTimezone: true }),
    contractor: jsonb("contractor").$type<InvoiceParty>().notNull(),
    customer: jsonb("customer").$type<InvoiceParty>().notNull(),
    siteAddress: text("site_address").notNull().default(""),
    lines: jsonb("lines").$type<InvoiceLine[]>().notNull().default([]),
    /** Sum of the lines, pre-tax (cents). */
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    holdbackPercent: integer("holdback_percent").notNull().default(0),
    /** Statutory holdback withheld on this invoice (pre-tax cents). */
    holdbackCents: integer("holdback_cents").notNull().default(0),
    /** subtotal − holdback: what tax is charged on. */
    taxableCents: integer("taxable_cents").notNull().default(0),
    taxLines: jsonb("tax_lines").$type<InvoiceTaxLine[]>().notNull().default([]),
    taxCents: integer("tax_cents").notNull().default(0),
    /** Amount due on this invoice = taxable + tax (cents). Negative for credit notes. */
    totalCents: integer("total_cents").notNull().default(0),
    paidCents: integer("paid_cents").notNull().default(0),
    notes: text("notes").notNull().default(""),
    paymentInstructions: jsonb("payment_instructions").$type<PaymentInstructions>().notNull().default({}),
    /** SHA-256 of the raw token in the customer's public link. */
    publicTokenHash: text("public_token_hash"),
    pdfUrl: text("pdf_url"),
    pdfHash: text("pdf_hash"),
    /** Set when the customer clicks "I've sent the e-Transfer" on the public invoice page. */
    etransferSelfReportedAt: timestamp("etransfer_self_reported_at", { withTimezone: true }),
    /** Latest Stripe Checkout Session created for online card payment (idempotency for the webhook). */
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidReason: text("void_reason"),
    /** Review-then-auto-send: the cron sends untouched drafts once this passes. */
    autoSendAt: timestamp("auto_send_at", { withTimezone: true }),
    reminderCount: integer("reminder_count").notNull().default(0),
    lastReminderAt: timestamp("last_reminder_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("invoices_user_idx").on(t.userId, t.issueDate),
    index("invoices_project_idx").on(t.projectId),
    index("invoices_status_due_idx").on(t.status, t.dueDate),
    uniqueIndex("invoices_user_number_idx").on(t.userId, t.number),
    uniqueIndex("invoices_public_token_idx").on(t.publicTokenHash),
  ],
);

export const invoicePaymentsTable = pgTable(
  "invoice_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceId: uuid("invoice_id").notNull().references(() => invoicesTable.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    date: timestamp("date", { withTimezone: true }).notNull().defaultNow(),
    amountCents: integer("amount_cents").notNull(),
    method: text("method", { enum: PAYMENT_METHODS }).notNull().default("etransfer"),
    reference: text("reference").notNull().default(""),
    note: text("note").notNull().default(""),
    /** Set when the "payment" is a credit note applied to this invoice. */
    creditNoteId: uuid("credit_note_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("invoice_payments_invoice_idx").on(t.invoiceId, t.date)],
);

export const invoiceEventsTable = pgTable(
  "invoice_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceId: uuid("invoice_id").notNull().references(() => invoicesTable.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // created | edited | sent | viewed | reminder_sent | payment_recorded | payment_removed | paid | overdue | voided | credit_note_issued | auto_sent
    actor: text("actor").notNull(), // contractor | customer | system
    detail: jsonb("detail").$type<Record<string, unknown> | null>(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("invoice_events_invoice_idx").on(t.invoiceId, t.createdAt)],
);

/** Sequential, non-reusable numbers per company and calendar year. */
export const invoiceSequencesTable = pgTable(
  "invoice_sequences",
  {
    userId: text("user_id").notNull(),
    year: integer("year").notNull(),
    /** "INV" for invoices, "CN" for credit notes. */
    kind: text("kind").notNull().default("INV"),
    next: integer("next").notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.userId, t.year, t.kind] })],
);

export type Invoice = typeof invoicesTable.$inferSelect;
export type InvoicePayment = typeof invoicePaymentsTable.$inferSelect;
export type InvoiceEvent = typeof invoiceEventsTable.$inferSelect;
