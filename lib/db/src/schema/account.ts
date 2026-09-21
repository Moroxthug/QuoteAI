import { pgTable, uuid, text, timestamp, integer, boolean, index } from "drizzle-orm/pg-core";

// ── Phase 72: account export + deletion (PIPEDA / Law 25) ────────────────────
// One row per "Export my data" request. The ZIP is built by the
// `account.export_requested` automation, stored in the private bucket and
// emailed as a signed link; rows and files expire after EXPORT_TTL_DAYS.

export const ACCOUNT_EXPORT_STATUSES = ["pending", "ready", "failed"] as const;
export type AccountExportStatus = (typeof ACCOUNT_EXPORT_STATUSES)[number];

export const accountExportsTable = pgTable(
  "account_exports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** The org whose data is exported (business_profiles.userId). */
    userId: text("user_id").notNull(),
    requestedByUserId: text("requested_by_user_id").notNull(),
    /** Where the link is sent. */
    email: text("email").notNull(),
    language: text("language").$type<"en" | "fr">().notNull().default("en"),
    status: text("status", { enum: ACCOUNT_EXPORT_STATUSES }).notNull().default("pending"),
    storagePath: text("storage_path"),
    sizeBytes: integer("size_bytes"),
    /** Table names + file count that went into the ZIP, for the UI and the audit trail. */
    tableCount: integer("table_count"),
    fileCount: integer("file_count"),
    error: text("error"),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("account_exports_user_idx").on(t.userId, t.createdAt)],
);

export type AccountExport = typeof accountExportsTable.$inferSelect;

// One row per deletion request. `scheduledFor` is the end of the grace
// period; the cron purges the account then and sets `purgedAt`. Signed
// contracts and issued invoices survive the purge under the tombstone id
// (`tombstone:<deletion id>`) until `retainUntil` (7 years, CRA), when the
// cron removes those too and the row becomes the only trace.

export const accountDeletionsTable = pgTable(
  "account_deletions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** auth_user.id being deleted (= the org id when they own a business profile). */
    userId: text("user_id").notNull(),
    /** Cleared at purge time — only the hash stays, to answer "was this address ever deleted?". */
    email: text("email"),
    emailHash: text("email_hash").notNull(),
    language: text("language").$type<"en" | "fr">().notNull().default("en"),
    /** Company identity kept with the retained records (the "tombstone company"). */
    companyName: text("company_name"),
    province: text("province"),
    gstHstNumber: text("gst_hst_number"),
    qstNumber: text("qst_number"),
    ownsProfile: boolean("owns_profile").notNull().default(false),
    cancelTokenHash: text("cancel_token_hash"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    purgedAt: timestamp("purged_at", { withTimezone: true }),
    retainUntil: timestamp("retain_until", { withTimezone: true }),
    retainedContracts: integer("retained_contracts"),
    retainedInvoices: integer("retained_invoices"),
    /** Set once the 7-year retention is over and the tombstone rows/PDFs are gone. */
    retentionPurgedAt: timestamp("retention_purged_at", { withTimezone: true }),
    stripeSubscriptionCancelled: boolean("stripe_subscription_cancelled").notNull().default(false),
    ip: text("ip"),
    userAgent: text("user_agent"),
    error: text("error"),
  },
  (t) => [index("account_deletions_user_idx").on(t.userId), index("account_deletions_scheduled_idx").on(t.scheduledFor)],
);

export type AccountDeletion = typeof accountDeletionsTable.$inferSelect;

/** Days a requester has to change their mind before the cron purges the account. */
export const ACCOUNT_DELETION_GRACE_DAYS = 7;
/** CRA: books and records must be kept 6 years from the end of the last tax year they relate to — 7 covers every year-end. */
export const ACCOUNT_RETENTION_YEARS = 7;
/** Export ZIPs and their signed links live this long. */
export const ACCOUNT_EXPORT_TTL_DAYS = 7;

export function tombstoneUserId(deletionId: string): string {
  return `tombstone:${deletionId}`;
}
