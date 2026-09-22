import { pgTable, text, uuid, timestamp, index } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";
import { projectsTable } from "./crm";

// ── Phase 76: client portal (docs/PILOT-LAUNCH-PLAN.md) ─────────────────────
// One place for a customer to see everything a contractor sent them: quotes,
// contracts, invoices (and pay them), job progress with photos, and a message
// thread. Addressed by /portal/:token (token hash on the clients row); the
// mailbox is proven with an emailed code and the browser then holds a
// session token — hashed here, sent as the X-Portal-Session header.

export const clientPortalSessionsTable = pgTable(
  "client_portal_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** The contractor company (business_profiles.user_id) — keeps tenant sweeps and exports uniform. */
    userId: text("user_id").notNull(),
    clientId: uuid("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
    /** SHA-256 of the raw session token the browser holds. */
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("client_portal_sessions_token_idx").on(t.tokenHash), index("client_portal_sessions_client_idx").on(t.clientId)],
);

export const CLIENT_MESSAGE_SENDERS = ["contractor", "client"] as const;
export type ClientMessageSender = (typeof CLIENT_MESSAGE_SENDERS)[number];

/**
 * The message thread between a company and one of its clients. One thread per
 * client; a message may point at a job for context ("re: Basement finish").
 * Contractor messages are emailed to the client (with the portal link), client
 * replies raise a dashboard notification and an email to the company.
 */
export const clientMessagesTable = pgTable(
  "client_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    clientId: uuid("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projectsTable.id, { onDelete: "set null" }),
    sender: text("sender", { enum: CLIENT_MESSAGE_SENDERS }).notNull(),
    /** Display name at send time (team member or the client). */
    senderName: text("sender_name").notNull().default(""),
    body: text("body").notNull(),
    /** Set when the *other* side has seen it (contractor opened the thread / client loaded the portal). */
    readAt: timestamp("read_at", { withTimezone: true }),
    /** When the email copy went out (null = not sent: no address, not configured, or failed — the message still exists in the thread/portal). */
    emailedAt: timestamp("emailed_at", { withTimezone: true }),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("client_messages_client_idx").on(t.clientId, t.createdAt), index("client_messages_unread_idx").on(t.userId, t.sender, t.readAt), index("client_messages_project_idx").on(t.projectId)],
);

export type ClientPortalSession = typeof clientPortalSessionsTable.$inferSelect;
export type ClientMessage = typeof clientMessagesTable.$inferSelect;
