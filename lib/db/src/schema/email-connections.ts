import { pgTable, text, timestamp, boolean, primaryKey } from "drizzle-orm/pg-core";
import { authUsersTable } from "./auth";

// ── Phase 20: connected email sending ────────────────────────────────────────
// Per-company, send-only Gmail connection used to send customer-facing emails
// (quotes/contracts/invoices/lead follow-ups) from the contractor's own inbox
// instead of no-reply@quoteai.ca, so replies land somewhere real. Deliberately
// send-only (gmail.send, not gmail.readonly/modify) — no inbox reading, no
// CASA security assessment required. Same encrypted-token shape as Phase 12's
// calendar_connections (lib/crypto.ts).

export const EMAIL_PROVIDERS = ["google"] as const;
export type EmailProvider = (typeof EMAIL_PROVIDERS)[number];

export const emailConnectionsTable = pgTable(
  "email_connections",
  {
    userId: text("user_id").notNull().references(() => authUsersTable.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: EMAIL_PROVIDERS }).notNull(),
    accountEmail: text("account_email").notNull().default(""),
    /** AES-256-GCM ciphertext (lib/crypto.ts), never stored in plaintext. */
    accessTokenEnc: text("access_token_enc").notNull(),
    refreshTokenEnc: text("refresh_token_enc").notNull(),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }).notNull(),
    isEnabled: boolean("is_enabled").notNull().default(true),
    connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
    lastSendAt: timestamp("last_send_at", { withTimezone: true }),
    lastSendError: text("last_send_error"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.provider] })],
);

export type EmailConnection = typeof emailConnectionsTable.$inferSelect;
