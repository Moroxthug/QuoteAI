import { pgTable, text, uuid, timestamp, integer, index, uniqueIndex } from "drizzle-orm/pg-core";

// ── Phase 87: compliance and filings ─────────────────────────────────────────
// QuoteAI prepares and reminds; it never files and never advises. The filing
// calendar itself is derived (compliance/deadlines.ts) from the company's
// registrations and `business_profiles.compliance_settings`; these tables only
// hold what cannot be derived: which periods someone marked as filed, the
// reminders a company sets for itself (WCB, licences, insurance), and the
// permits on each job.

/** How the company files, set once on the Compliance page. All optional — nothing is guessed. */
export type ComplianceSettings = {
  /** GST/HST (GST/QST in Québec) reporting period assigned by CRA / Revenu Québec. */
  salesTaxFrequency?: "monthly" | "quarterly" | "annual" | null;
  /** Fiscal year end as MM-DD (month end), default 12-31. */
  fiscalYearEnd?: string | null;
  /** Sole proprietors with a Dec 31 year end pay by April 30 and file by June 15. */
  structure?: "sole_proprietor" | "partnership" | "corporation" | null;
  /** Annual filers whose net tax last year was $3,000 or more pay quarterly instalments. */
  instalments?: boolean;
  /** BC PST / SK PST / MB RST reporting period, when registered. */
  pstFrequency?: "monthly" | "quarterly" | "semiannual" | "annual" | null;
  /** Pays subcontractors for construction services → T5018 each calendar year. */
  t5018?: boolean;
  /**
   * The day filing setup was first saved (YYYY-MM-DD). Deadlines that fell
   * due well before it were presumably handled outside QuoteAI, so they are
   * never shown as late.
   */
  configuredAt?: string;
};

export const FILING_KINDS = ["sales_tax", "sales_tax_payment", "gst_instalment", "pst", "t5018"] as const;
export type FilingKind = (typeof FILING_KINDS)[number];

/** A derived deadline someone marked as done ("filed on …"). Also remembers that the reminder went out. */
export const complianceFilingsTable = pgTable(
  "compliance_filings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    kind: text("kind", { enum: FILING_KINDS }).notNull(),
    /** e.g. 2026-Q3, 2026-07, FY2026, 2026 — stable across recomputation. */
    periodKey: text("period_key").notNull(),
    filedAt: timestamp("filed_at", { withTimezone: true }),
    filedByName: text("filed_by_name"),
    note: text("note").notNull().default(""),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("compliance_filings_period_idx").on(t.userId, t.kind, t.periodKey)],
);

export const REMINDER_KINDS = ["workers_comp", "licence", "insurance", "other"] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];
export const REMINDER_RECURRENCES = ["none", "monthly", "quarterly", "annual"] as const;
export type ReminderRecurrence = (typeof REMINDER_RECURRENCES)[number];

/** A deadline the company tracks itself: a WCB report, an RBQ renewal, an insurance certificate. */
export const complianceRemindersTable = pgTable(
  "compliance_reminders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    kind: text("kind", { enum: REMINDER_KINDS }).notNull().default("other"),
    /** Preset it was created from (e.g. "wsib", "rbq"), for the icon and the link. */
    preset: text("preset"),
    title: text("title").notNull(),
    authority: text("authority").notNull().default(""),
    reference: text("reference").notNull().default(""),
    url: text("url"),
    /** Date only (stored at UTC midnight). */
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
    recurrence: text("recurrence", { enum: REMINDER_RECURRENCES }).notNull().default("annual"),
    remindDaysBefore: integer("remind_days_before").notNull().default(30),
    notes: text("notes").notNull().default(""),
    lastDoneAt: timestamp("last_done_at", { withTimezone: true }),
    /** The due date the last reminder notification was sent for (one per occurrence). */
    notifiedForDue: timestamp("notified_for_due", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [index("compliance_reminders_user_idx").on(t.userId, t.dueDate)],
);

export const PERMIT_KINDS = ["building", "demolition", "electrical", "plumbing", "gas", "hvac", "other"] as const;
export type PermitKind = (typeof PERMIT_KINDS)[number];
export const PERMIT_STATUSES = ["needed", "applied", "issued", "closed", "not_required"] as const;
export type PermitStatus = (typeof PERMIT_STATUSES)[number];
/** A permit in one of these states keeps the job from being marked complete. */
export const OPEN_PERMIT_STATUSES: readonly PermitStatus[] = ["needed", "applied", "issued"];

export const jobPermitsTable = pgTable(
  "job_permits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    /** Plain uuid (the SQL migration adds the FK, cascade). */
    projectId: uuid("project_id").notNull(),
    kind: text("kind", { enum: PERMIT_KINDS }).notNull().default("building"),
    title: text("title").notNull(),
    authority: text("authority").notNull().default(""),
    referenceNumber: text("reference_number").notNull().default(""),
    url: text("url"),
    status: text("status", { enum: PERMIT_STATUSES }).notNull().default("needed"),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    /** Next inspection booked — shows on the dashboard calendar. */
    inspectionAt: timestamp("inspection_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("job_permits_project_idx").on(t.projectId),
    index("job_permits_user_inspection_idx").on(t.userId, t.inspectionAt),
  ],
);

export type ComplianceFiling = typeof complianceFilingsTable.$inferSelect;
export type ComplianceReminder = typeof complianceRemindersTable.$inferSelect;
export type JobPermit = typeof jobPermitsTable.$inferSelect;
