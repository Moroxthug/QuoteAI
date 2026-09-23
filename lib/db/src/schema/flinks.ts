import { pgTable, text, uuid, timestamp, boolean, integer, jsonb, index } from "drizzle-orm/pg-core";
import { authUsersTable } from "./auth";
import { costEntriesTable } from "./costs";

// ── Phase 27: bank feed reconciliation via Flinks ───────────────────────────
// Flinks access is a managed accreditation process (not self-serve signup),
// the same partner-gate shape as Phase 16's Financeit — see
// docs/EDGE-FEATURES-PLAN.md §14. Built now against Flinks's documented
// Connect + BankingServices flow so it's ready the moment accreditation is
// granted; FLINKS_CUSTOMER_ID/FLINKS_INSTANCE unset just means calls fail
// until then. A Flinks LoginId is a bearer credential for the connected bank
// account (unlike Financeit's plaintext dealer id), so it's encrypted at
// rest the same way Wave's OAuth tokens are (lib/crypto.ts).

export type FlinksAccountRef = { id: string; name: string; institution: string; last4: string | null };

export const flinksConnectionsTable = pgTable("flinks_connections", {
  userId: text("user_id").primaryKey().references(() => authUsersTable.id, { onDelete: "cascade" }),
  /** AES-256-GCM ciphertext (lib/crypto.ts) — never stored in plaintext. */
  loginIdEnc: text("login_id_enc").notNull(),
  institutionName: text("institution_name").notNull().default(""),
  /** The one account (of possibly several at that institution) reconciliation runs against. */
  selectedAccount: jsonb("selected_account").$type<FlinksAccountRef | null>(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
});

export const FLINKS_MATCH_STATUSES = ["unmatched", "matched", "ignored"] as const;
export type FlinksMatchStatus = (typeof FLINKS_MATCH_STATUSES)[number];

/** One row per bank transaction Flinks returned for the connected account. */
export const flinksTransactionsTable = pgTable(
  "flinks_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    /** Flinks's own transaction id, so a re-sync never duplicates a row. */
    flinksTransactionId: text("flinks_transaction_id").notNull(),
    date: timestamp("date", { withTimezone: true }).notNull(),
    description: text("description").notNull().default(""),
    /** Signed: negative = money out (a possible expense match), positive = money in. */
    amountCents: integer("amount_cents").notNull(),
    balanceCents: integer("balance_cents"),
    matchStatus: text("match_status", { enum: FLINKS_MATCH_STATUSES }).notNull().default("unmatched"),
    matchedCostEntryId: uuid("matched_cost_entry_id").references(() => costEntriesTable.id, { onDelete: "set null" }),
    /** Phase 88: a deposit matched to the invoice payment it is (plain uuid; the SQL adds the FK). */
    matchedInvoicePaymentId: uuid("matched_invoice_payment_id"),
    /** true when matchedCostEntryId was set by the auto-matcher rather than a manual click, for the review UI. */
    autoMatched: boolean("auto_matched").notNull().default(false),
    raw: jsonb("raw").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("flinks_transactions_user_date_idx").on(t.userId, t.date),
    index("flinks_transactions_user_status_idx").on(t.userId, t.matchStatus),
    index("flinks_transactions_flinks_id_idx").on(t.userId, t.flinksTransactionId),
  ],
);

export type FlinksConnection = typeof flinksConnectionsTable.$inferSelect;
export type FlinksTransaction = typeof flinksTransactionsTable.$inferSelect;
