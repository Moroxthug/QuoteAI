import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import type { PaymentSchedule } from "./payment-schedule";
import type { ComplianceSettings } from "./compliance";

export type FeatureFlags = Record<string, boolean>;

/** Automation preferences a company can tune. All default to the conservative option. */
export type AutomationSettings = {
  /** Email the company when a customer accepts a quote. */
  notifyOnQuoteAccepted: boolean;
  /** Phase 1: auto-draft a contract when a quote is accepted. */
  autoDraftContract: boolean;
  /** Phase 4: send automation-drafted invoices (deposit / progress / final) to the customer immediately, without review. */
  autoSendInvoices: boolean;
  /**
   * Phase 4, review mode only: send an automation-drafted invoice on its own
   * if nobody has touched it after this many hours (0 = never). The daily
   * cron performs the send, so the effective delay is "the next tick after".
   */
  invoiceAutoSendAfterHours: number;
  /** Phase 4: email overdue reminders to the customer (3 / 7 / 14 days past due). */
  invoiceReminders: boolean;
  /**
   * Phase 74: send automated lead follow-ups by SMS to leads whose preferred
   * channel is SMS (email otherwise). Manual sends ("on my way", test) do not
   * depend on this — they are explicit actions by the contractor.
   */
  smsEnabled: boolean;
  /** Phase 74: also text quote / contract / invoice reminders (with the link) when the customer's phone is known. */
  smsReminders: boolean;
  /**
   * Phase 80: the lead follow-up sequence — days after the previous touch for
   * each message (stage 0 counts from lead creation). Empty = no automatic
   * follow-ups. Was the constant [1, 3, 7] before.
   */
  leadFollowupDays: number[];
  /** Phase 80: same for quotes that were sent and not answered (was [2, 5, 10]). */
  quoteFollowupDays: number[];
  /** Phase 80: days after a job is completed before the review request goes out (was 3). */
  reviewRequestDelayDays: number;
  /**
   * Phase 75: text (or email, when the worker has no phone) each crew member
   * the evening before a scheduled block — "Tomorrow 8:00–16:00: Basement
   * finish, 45 Rue Laurier". Turn off for boards kept purely for the office.
   */
  scheduleReminders: boolean;
};

export const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = {
  notifyOnQuoteAccepted: true,
  autoDraftContract: true,
  autoSendInvoices: false,
  invoiceAutoSendAfterHours: 0,
  invoiceReminders: true,
  smsEnabled: false,
  smsReminders: false,
  scheduleReminders: true,
  leadFollowupDays: [1, 3, 7],
  quoteFollowupDays: [2, 5, 10],
  reviewRequestDelayDays: 3,
};

export const businessProfilesTable = pgTable("business_profiles", {
  userId: text("user_id").primaryKey(),
  companyName: text("company_name").notNull().default(""),
  vatNumber: text("vat_number"),
  address: text("address"),
  logoUrl: text("logo_url"),
  phone: text("phone"),
  email: text("email"),
  stripeCustomerId: text("stripe_customer_id"),
  subscriptionPlan: text("subscription_plan"),
  subscriptionStatus: text("subscription_status"),
  subscriptionInterval: text("subscription_interval"), // Phase 73: "month" | "year" — the tier stays in subscription_plan
  subscriptionPeriodEnd: timestamp("subscription_period_end", { withTimezone: true }),
  trialStartedAt: timestamp("trial_started_at", { withTimezone: true }),
  trialDownloadsUsed: integer("trial_downloads_used").notNull().default(0),
  apiKey: text("api_key"),
  // ── Canadian business identity (Phase 0) ─────────────────────────────────
  province: text("province"), // home province, drives default tax profile + contract template
  gstHstNumber: text("gst_hst_number"), // e.g. 123456789RT0001 — printed on invoices
  qstNumber: text("qst_number"), // Quebec only
  pstNumber: text("pst_number"), // BC / SK / MB
  licenceNumber: text("licence_number"), // RBQ (QC), HCRA (ON builders), municipal licence, etc.
  etransferEmail: text("etransfer_email"), // where customers send Interac e-Transfers
  defaultPaymentSchedule: jsonb("default_payment_schedule").$type<PaymentSchedule | null>(),
  // ── Phase 10: review requests ────────────────────────────────────────────
  googleReviewUrl: text("google_review_url"), // Google Business Profile "write a review" link, set once in Settings
  // ── Phase 26: HomeStars link (no public partner API exists, so this is just a second manual review link) ──
  homeStarsProfileUrl: text("homestars_profile_url"),
  sendReviewRequests: boolean("send_review_requests").notNull().default(true),
  automationSettings: jsonb("automation_settings").$type<Partial<AutomationSettings>>().notNull().default({}),
  // ── Phase 87: how the company files (reporting periods, year end) — drives the filing calendar ──
  complianceSettings: jsonb("compliance_settings").$type<ComplianceSettings>().notNull().default({}),
  featureFlags: jsonb("feature_flags").$type<FeatureFlags>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBusinessProfileSchema = createInsertSchema(businessProfilesTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertBusinessProfile = z.infer<typeof insertBusinessProfileSchema>;
export type BusinessProfile = typeof businessProfilesTable.$inferSelect;
