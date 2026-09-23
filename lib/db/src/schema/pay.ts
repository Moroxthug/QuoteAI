import { sql } from "drizzle-orm";
import { pgTable, text, uuid, timestamp, jsonb, index, uniqueIndex, integer, numeric, boolean, date } from "drizzle-orm/pg-core";
import { collaboratorsTable, projectsTable } from "./crm";
import { costEntriesTable, timeEntriesTable } from "./costs";

// ── Phase 89: time to pay (no payroll engine) ────────────────────────────────
// Everything *before* payroll: overtime by province, statutory holiday pay,
// travel and per-diem lines, and an export in the shape a payroll provider
// takes. Source deductions, T4s and remittances stay with the provider.

export const PAY_FREQUENCIES = ["weekly", "biweekly", "semimonthly", "monthly"] as const;
export type PayFrequency = (typeof PAY_FREQUENCIES)[number];

export type OvertimeRules = {
  /** Hours in a day after which overtime starts; null = no daily overtime (ON, QC…). */
  dailyHours: number | null;
  /** Hours in a day after which double time starts; null = none. */
  dailyDoubleHours: number | null;
  /** Hours in a week after which overtime starts; null = none. */
  weeklyHours: number | null;
  multiplier: number;
  doubleMultiplier: number;
};
// No "daily or weekly, whichever is greater" switch (AB): counting daily overtime
// first and then weekly overtime on the straight-time hours left gives the same
// total — daily + max(0, straight − weekly) = max(daily, total − weekly).

/**
 * - div20_4w: wages in the four weeks before ÷ 20 (ON, QC, SK, MB's 5 %)
 * - avg_day_30d: wages in the 30 days before ÷ days worked (BC)
 * - avg_day_28d: wages in the four weeks before ÷ days worked (AB; the "regular day's pay" elsewhere)
 * - pct_of_wages: a percentage of each pay period's wages in lieu of holiday pay (ON construction's 7.7 %);
 *   hours worked on a holiday are then ordinary hours
 * - none: the company pays it another way (a collective agreement, the CCQ indemnity…)
 */
export const HOLIDAY_PAY_METHODS = ["div20_4w", "avg_day_30d", "avg_day_28d", "pct_of_wages", "none"] as const;
export type HolidayPayMethod = (typeof HOLIDAY_PAY_METHODS)[number];

export type HolidayRules = {
  method: HolidayPayMethod;
  /** Multiplier on hours worked on the holiday itself (on top of the holiday pay). */
  workedMultiplier: number;
  /** Days worked in the 30 days before the holiday to qualify (BC, NS: 15). */
  minDaysWorked: number;
  /** Days since the first recorded day of work to qualify (AB, BC: 30). */
  minEmployedDays: number;
  /** Phase 89b — pct_of_wages only: the percentage (7.7 for ON construction). */
  percent: number;
  /** Phase 89b — overtime wages count in the base holiday pay is worked out from. */
  includeOvertime: boolean;
  /** Phase 89b — vacation pay paid on each cheque counts in that base (ON, AB, BC). Needs vacationPayPercent. */
  includeVacationPay: boolean;
  /** Phase 89b — a holiday on a Saturday or Sunday is taken on the next weekday that is not already one. */
  substituteWeekend: boolean;
};

export const PAY_EXPORT_FORMATS = ["generic", "wagepoint", "payworks", "qbo_payroll"] as const;
export type PayExportFormat = (typeof PAY_EXPORT_FORMATS)[number];

export const EARNING_KINDS = ["regular", "overtime", "double", "holiday", "holiday_worked", "mileage", "per_diem", "other"] as const;
export type EarningKind = (typeof EARNING_KINDS)[number];

export type PaySettings = {
  frequency?: PayFrequency;
  /** First day of any one pay period (weekly / biweekly count from it). YYYY-MM-DD. */
  anchorDate?: string;
  /** 0 = Sunday … 6 = Saturday — the start of the week overtime is counted over. */
  weekStartsOn?: number;
  /** Null/absent = the province's employment-standards default. */
  overtime?: OvertimeRules | null;
  /** An averaging agreement: the weekly threshold applies to the average over `weeks` weeks, blocks counted from `startDate`. */
  averaging?: { weeks: number; startDate: string } | null;
  holidays?: Partial<HolidayRules> & { added?: { date: string; name: string }[]; removed?: string[] };
  allowances?: { kmRateCents?: number; perDiemCents?: number };
  exportFormat?: PayExportFormat;
  earningCodes?: Partial<Record<EarningKind, string>>;
  /** Phase 89b — vacation pay paid out on every cheque, in % (4, 6, 10…). Null = taken as time off. Only feeds the holiday pay base: vacation pay itself stays the provider's. */
  vacationPayPercent?: number | null;
  /** Phase 89b — the trade preset the rules were filled from, if any (the page says when they were changed since). */
  preset?: string | null;
};

export const ALLOWANCE_KINDS = ["mileage", "per_diem", "other"] as const;
export type AllowanceKind = (typeof ALLOWANCE_KINDS)[number];

/** Phase 89b: the office's lines are approved as entered; the crew's wait for the office. */
export const ALLOWANCE_STATUSES = ["submitted", "approved", "rejected"] as const;
export type AllowanceStatus = (typeof ALLOWANCE_STATUSES)[number];

/** Travel and per-diem lines — paid with the hours, charged to the job when there is one. */
export const payAllowancesTable = pgTable(
  "pay_allowances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    workerId: uuid("worker_id").notNull().references(() => collaboratorsTable.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projectsTable.id, { onDelete: "set null" }),
    timeEntryId: uuid("time_entry_id").references(() => timeEntriesTable.id, { onDelete: "set null" }),
    date: date("date").notNull(),
    kind: text("kind", { enum: ALLOWANCE_KINDS }).notNull(),
    /** km for mileage, days for per diem, 1 for other. */
    quantity: numeric("quantity", { precision: 8, scale: 2 }).notNull(),
    rateCents: integer("rate_cents").notNull(),
    amountCents: integer("amount_cents").notNull(),
    /** A reasonable per-km allowance is not income; a flat "other" line usually is. The provider decides — this only labels it. */
    taxable: boolean("taxable").notNull().default(false),
    note: text("note").notNull().default(""),
    costEntryId: uuid("cost_entry_id").references(() => costEntriesTable.id, { onDelete: "set null" }),
    createdByUserId: text("created_by_user_id"),
    status: text("status", { enum: ALLOWANCE_STATUSES }).notNull().default("approved"),
    enteredBy: text("entered_by", { enum: ["office", "worker"] }).notNull().default("office"),
    /** The crew page's offline outbox op id — a replay returns the row it made. */
    clientRef: uuid("client_ref"),
    rejectedReason: text("rejected_reason"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedByName: text("reviewed_by_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("pay_allowances_user_date_idx").on(t.userId, t.date),
    index("pay_allowances_worker_idx").on(t.workerId, t.date),
    index("pay_allowances_pending_idx").on(t.userId, t.status).where(sql`status = 'submitted'`),
    uniqueIndex("pay_allowances_client_ref_idx").on(t.workerId, t.clientRef).where(sql`client_ref is not null`),
  ],
);

export type PayAllowance = typeof payAllowancesTable.$inferSelect;

/** Per worker: gross by earning kind, so "changed since export" can say what moved. */
export type PayExportSnapshot = Record<string, { name: string; grossCents: number; hours: number }>;

/** A pay period someone exported. Nothing is locked — hours that change afterwards are flagged, not refused. */
export const payExportsTable = pgTable(
  "pay_exports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    format: text("format", { enum: PAY_EXPORT_FORMATS }).notNull(),
    exportedByName: text("exported_by_name"),
    exportedAt: timestamp("exported_at", { withTimezone: true }).notNull().defaultNow(),
    snapshot: jsonb("snapshot").$type<PayExportSnapshot>().notNull().default({}),
  },
  (t) => [index("pay_exports_period_idx").on(t.userId, t.periodStart)],
);

export type PayExport = typeof payExportsTable.$inferSelect;
