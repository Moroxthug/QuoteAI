import { pgTable, text, uuid, timestamp, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { authUsersTable } from "./auth";

// ── Phase 16: point-of-sale financing via Financeit ─────────────────────────
// Financeit's API access is a partner-onboarding process, not self-serve —
// this is built now against their documented hosted `direct_invites/send`
// flow so it's ready the moment QuoteAI's partner access is granted (see
// docs/EDGE-FEATURES-PLAN.md §3). FINANCEIT_APP_ID/FINANCEIT_APP_SECRET being
// unset just means calls fail until then, same shape as Phase 15's Stripe
// Connect webhook secret. A dealer id isn't a bearer credential (unlike the
// QuickBooks OAuth tokens), so it's stored in plaintext like Stripe Connect's
// account id.

export const financeitConnectionsTable = pgTable("financeit_connections", {
  userId: text("user_id").primaryKey().references(() => authUsersTable.id, { onDelete: "cascade" }),
  dealerId: text("dealer_id").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  lastAppliedAt: timestamp("last_applied_at", { withTimezone: true }),
});

export const FINANCEIT_APPLICATION_STATUSES = ["sent", "in_progress", "approved", "declined", "funded"] as const;
export type FinanceitApplicationStatus = (typeof FINANCEIT_APPLICATION_STATUSES)[number];

/** One row per "Apply for financing" click — links Financeit's hosted application back to the quote that started it. */
export const financeitApplicationsTable = pgTable(
  "financeit_applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    quoteId: uuid("quote_id").notNull(),
    dealerId: text("dealer_id").notNull(),
    financeitApplicationId: text("financeit_application_id"),
    applicationLink: text("application_link").notNull(),
    status: text("status", { enum: FINANCEIT_APPLICATION_STATUSES }).notNull().default("sent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("financeit_applications_user_idx").on(t.userId, t.createdAt),
    index("financeit_applications_quote_idx").on(t.quoteId),
    index("financeit_applications_financeit_id_idx").on(t.financeitApplicationId),
  ],
);

export const FINANCEIT_LOAN_EVENT_TYPES = ["loan_state_event", "funds_released"] as const;
export type FinanceitLoanEventType = (typeof FINANCEIT_LOAN_EVENT_TYPES)[number];

/** Append-only log of webhook events from Financeit (best-effort delivery, no auto-retry per their docs). */
export const financeitLoanEventsTable = pgTable(
  "financeit_loan_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    applicationId: uuid("application_id").notNull().references(() => financeitApplicationsTable.id, { onDelete: "cascade" }),
    eventType: text("event_type", { enum: FINANCEIT_LOAN_EVENT_TYPES }).notNull(),
    loanState: text("loan_state"),
    raw: jsonb("raw").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("financeit_loan_events_application_idx").on(t.applicationId, t.createdAt)],
);

export type FinanceitConnection = typeof financeitConnectionsTable.$inferSelect;
export type FinanceitApplication = typeof financeitApplicationsTable.$inferSelect;
export type FinanceitLoanEvent = typeof financeitLoanEventsTable.$inferSelect;
