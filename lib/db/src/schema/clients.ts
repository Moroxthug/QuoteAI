import { pgTable, text, uuid, timestamp, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { randomUUID } from "crypto";

// First-class client records. Until Phase 0 clients were derived on the fly
// from quotes.client_data; contracts and invoices need a stable party to
// point at, so quotes now link to a row here (quotes.client_id).
export const clientsTable = pgTable(
  "clients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    type: text("type", { enum: ["individual", "business"] }).notNull().default("individual"),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    city: text("city"),
    province: text("province"), // ISO-ish 2-letter code (ON, QC, ...)
    postalCode: text("postal_code"),
    businessNumber: text("business_number"), // CRA BN / GST-HST number for business clients
    preferredLanguage: text("preferred_language", { enum: ["en", "fr"] }).notNull().default("en"),
    notes: text("notes").notNull().default(""),
    /** Stable dedup key: lower(name)|lower(email)|phone — same recipe used by the legacy derived clients list. */
    dedupKey: text("dedup_key").notNull(),
    // ── Phase 10: CASL opt-out for marketing-type sends (review requests, shared photos) ──
    // Never gates transactional messages (quotes/contracts/invoices) — only automated reachout.
    marketingUnsubscribeToken: text("marketing_unsubscribe_token").notNull().$defaultFn(() => randomUUID()),
    marketingUnsubscribedAt: timestamp("marketing_unsubscribed_at", { withTimezone: true }),
    /** Phase 47: soft-archive. Set when moved to the Archive view; excluded from list endpoints while set. */
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    archivedByName: text("archived_by_name"),
    // ── Phase 76: client portal (/portal/:token) ──
    // The link token is deterministic (HMAC of the client id, like invoice
    // links) so every document page can rebuild it; only its hash is stored
    // and it is null until the first link is issued. The token alone shows
    // nothing — the client proves the mailbox with a 6-digit code (same OTP
    // shape as contract signing) and gets a session (client_portal_sessions).
    portalTokenHash: text("portal_token_hash"),
    portalOtpHash: text("portal_otp_hash"),
    portalOtpExpiresAt: timestamp("portal_otp_expires_at", { withTimezone: true }),
    portalOtpAttempts: integer("portal_otp_attempts").notNull().default(0),
    /** When the contractor last emailed the portal invitation. */
    portalInvitedAt: timestamp("portal_invited_at", { withTimezone: true }),
    /** Last authenticated portal request. */
    portalLastSeenAt: timestamp("portal_last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("clients_user_id_idx").on(t.userId),
    uniqueIndex("clients_user_dedup_idx").on(t.userId, t.dedupKey),
    uniqueIndex("clients_marketing_unsubscribe_token_idx").on(t.marketingUnsubscribeToken),
    index("clients_archived_idx").on(t.userId, t.archivedAt),
    uniqueIndex("clients_portal_token_idx").on(t.portalTokenHash),
  ],
);

export const insertClientSchema = createInsertSchema(clientsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clientsTable.$inferSelect;

/** Same recipe as the legacy md5 grouping in routes/clients.ts (minus the hash). */
export function clientDedupKey(input: { name?: string | null; email?: string | null; phone?: string | null }): string {
  const name = (input.name ?? "").trim().toLowerCase();
  const email = (input.email ?? "").trim().toLowerCase();
  const phone = (input.phone ?? "").trim().toLowerCase();
  return `${name}|${email}|${phone}`;
}
