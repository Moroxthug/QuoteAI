import { pgTable, text, uuid, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("clients_user_id_idx").on(t.userId),
    uniqueIndex("clients_user_dedup_idx").on(t.userId, t.dedupKey),
    uniqueIndex("clients_marketing_unsubscribe_token_idx").on(t.marketingUnsubscribeToken),
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
