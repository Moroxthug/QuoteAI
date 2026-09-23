import { pgTable, text, uuid, timestamp, jsonb, index, uniqueIndex, primaryKey } from "drizzle-orm/pg-core";

// ── Phase 88: accounting, both directions ────────────────────────────────────
// Until now QuickBooks and Wave only ever received, and the only memory of
// what was sent was an append-only log. Two-way needs to know "this QuoteAI
// thing IS that QuickBooks thing" — in both directions — so a customer is
// never created twice, a payment we pushed is never pulled back as a second
// payment, and a payment pulled from QuickBooks is never pushed back to it.

export const ACCOUNTING_PROVIDERS = ["quickbooks", "wave"] as const;
export type AccountingProvider = (typeof ACCOUNTING_PROVIDERS)[number];

/**
 * - client: a QuoteAI client (by id) ↔ a QBO/Wave customer
 * - customer_name: an invoice with no client row, keyed by its normalized name
 * - supplier / vendor_name: the same for cost entries and QBO vendors
 * - invoice / invoice_payment: documents that exist on both sides
 */
export const ACCOUNTING_LINK_TYPES = ["client", "customer_name", "supplier", "vendor_name", "invoice", "invoice_payment"] as const;
export type AccountingLinkType = (typeof ACCOUNTING_LINK_TYPES)[number];

export const accountingLinksTable = pgTable(
  "accounting_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    provider: text("provider", { enum: ACCOUNTING_PROVIDERS }).notNull(),
    entityType: text("entity_type", { enum: ACCOUNTING_LINK_TYPES }).notNull(),
    /** Our id (uuid as text) or the normalized name for the *_name types. */
    entityId: text("entity_id").notNull(),
    externalId: text("external_id").notNull(),
    /** Customer | Vendor | Invoice | Payment … */
    externalType: text("external_type").notNull(),
    /** "quoteai" = we created it over there; "external" = it came from there (a pulled payment). */
    origin: text("origin", { enum: ["quoteai", "external"] }).notNull().default("quoteai"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("accounting_links_entity_idx").on(t.userId, t.provider, t.entityType, t.entityId),
    index("accounting_links_external_idx").on(t.userId, t.provider, t.externalType, t.externalId),
  ],
);

export type AccountingLink = typeof accountingLinksTable.$inferSelect;

/** What the month-end checklist counted when someone closed the month — so "changed since" can be shown. */
export type BooksCloseSnapshot = Record<string, { count: number; cents: number }>;

/** A month someone marked as closed. Reopening deletes the row. */
export const booksClosesTable = pgTable(
  "books_closes",
  {
    userId: text("user_id").notNull(),
    /** YYYY-MM, in the company's own time zone. */
    month: text("month").notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }).notNull().defaultNow(),
    closedByName: text("closed_by_name"),
    note: text("note").notNull().default(""),
    snapshot: jsonb("snapshot").$type<BooksCloseSnapshot>().notNull().default({}),
  },
  (t) => [primaryKey({ columns: [t.userId, t.month] })],
);

export type BooksClose = typeof booksClosesTable.$inferSelect;
