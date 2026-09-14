import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { authUsersTable } from "./auth";

// ── Phase 15: invoice card payments via Stripe Connect ──────────────────────
// Each company that opts in (Elite tier) gets its own Stripe Connect Express
// account. Checkout Sessions for invoice payments run directly against that
// connected account (the `stripeAccount` request option), so customer money
// lands straight in the contractor's bank account — QuoteAI never touches
// customer funds or PCI scope. Nothing here is a secret (a Connect account id
// is not sensitive like an OAuth token), so no encryption is needed.

export const stripeConnectAccountsTable = pgTable("stripe_connect_accounts", {
  userId: text("user_id").primaryKey().references(() => authUsersTable.id, { onDelete: "cascade" }),
  stripeAccountId: text("stripe_account_id").notNull(),
  chargesEnabled: boolean("charges_enabled").notNull().default(false),
  payoutsEnabled: boolean("payouts_enabled").notNull().default(false),
  detailsSubmitted: boolean("details_submitted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type StripeConnectAccount = typeof stripeConnectAccountsTable.$inferSelect;
