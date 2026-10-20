import { pgTable, text, timestamp, jsonb, integer, bigint, date, uuid, index, uniqueIndex } from "drizzle-orm/pg-core";

// Growth and owner analytics (docs/GROWTH-PLAN.md, Phase 131). Money is integer cents with a currency; times are UTC.

/** Where each company came from, written once at sign-up (web and app). */
export const signupAttributionTable = pgTable("signup_attribution", {
  userId: text("user_id").primaryKey(),
  source: text("source").notNull().default("direct"), // google, facebook, referral, play_store, outreach, direct...
  medium: text("medium"),
  campaign: text("campaign"),
  referrer: text("referrer"),
  landingPath: text("landing_path"),
  platform: text("platform", { enum: ["web", "android", "ios"] }).notNull().default("web"),
  referralCode: text("referral_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Funnel and product events that the other tables cannot tell: visits, installs, paywall views, checkout starts... `anonId` ties pre-sign-up visits to the account later. */
export const growthEventsTable = pgTable("growth_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  event: text("event").notNull(),
  userId: text("user_id"),
  anonId: text("anon_id"),
  source: text("source"),
  platform: text("platform"),
  props: jsonb("props").$type<Record<string, unknown>>().notNull().default({}),
}, (t) => [index("growth_events_event_at_idx").on(t.event, t.at), index("growth_events_user_idx").on(t.userId)]);

export const BILLING_EVENT_TYPES = ["payment", "refund", "dispute", "subscription_started", "subscription_changed", "subscription_canceled"] as const;
export type BillingEventType = (typeof BILLING_EVENT_TYPES)[number];

/** Real money and subscription changes from Stripe (and later Google Play), one row per provider event so a replayed webhook is harmless. */
export const billingEventsTable = pgTable("billing_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: text("provider", { enum: ["stripe", "play"] }).notNull().default("stripe"),
  providerEventId: text("provider_event_id").notNull(),
  type: text("type", { enum: BILLING_EVENT_TYPES }).notNull(),
  userId: text("user_id"),
  customerId: text("customer_id"),
  plan: text("plan"),
  interval: text("interval"),
  amountCents: bigint("amount_cents", { mode: "number" }).notNull().default(0), // gross paid (positive), refunded (positive on a refund row)
  taxCents: bigint("tax_cents", { mode: "number" }).notNull().default(0),
  feeCents: bigint("fee_cents", { mode: "number" }).notNull().default(0), // processor or store fee when known
  currency: text("currency").notNull().default("cad"),
  founding: integer("founding").notNull().default(0), // 1 when the subscription is at the founding launch price
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  raw: jsonb("raw").$type<Record<string, unknown>>(),
}, (t) => [uniqueIndex("billing_events_provider_event_uq").on(t.provider, t.providerEventId), index("billing_events_at_idx").on(t.at), index("billing_events_user_idx").on(t.userId)]);

export const EXPENSE_CATEGORIES = ["infrastructure", "ai", "messaging", "email", "software", "marketing", "payment_fees", "legal_accounting", "payroll", "tax", "other"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export const EXPENSE_CADENCES = ["one_off", "monthly", "yearly"] as const;

/** The owner's own costs that no usage meter sees (hosting, domains, tools, accountant). Recurring ones count every period between starts_on and ends_on. */
export const ownerExpensesTable = pgTable("owner_expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  category: text("category", { enum: EXPENSE_CATEGORIES }).notNull().default("other"),
  amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
  currency: text("currency").notNull().default("cad"),
  cadence: text("cadence", { enum: EXPENSE_CADENCES }).notNull().default("monthly"),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** What was spent to get customers, per channel and day, so the cost of a customer (CAC) can be worked out. */
export const marketingSpendTable = pgTable("marketing_spend", {
  id: uuid("id").primaryKey().defaultRandom(),
  channel: text("channel").notNull(), // matches signup_attribution.source: google, facebook, outreach...
  campaign: text("campaign"),
  spentOn: date("spent_on").notNull(),
  amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
  currency: text("currency").notNull().default("cad"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("marketing_spend_on_idx").on(t.spentOn)]);

/** Owner-level numbers that are settings, not events (cash in the bank, launch price threshold...). One row per key. */
export const ownerSettingsTable = pgTable("owner_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type SignupAttribution = typeof signupAttributionTable.$inferSelect;
export type GrowthEvent = typeof growthEventsTable.$inferSelect;
export type BillingEvent = typeof billingEventsTable.$inferSelect;
export type OwnerExpense = typeof ownerExpensesTable.$inferSelect;
export type MarketingSpend = typeof marketingSpendTable.$inferSelect;
