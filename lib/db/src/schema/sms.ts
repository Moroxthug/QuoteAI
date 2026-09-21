import { pgTable, uuid, timestamp, text, integer, index, uniqueIndex } from "drizzle-orm/pg-core";

// ── SMS channel (Phase 74, docs/PILOT-LAUNCH-PLAN.md) ────────────────────────
// Every text message QuoteAI sends or receives through the platform's Twilio
// number lands in sms_messages — the audit trail CASL expects (who, what,
// when, on what consent basis) and the source of the Settings → SMS log.
// Opt-outs are keyed by phone number, not by contractor: a customer who
// replies STOP to the shared number is opted out of every contractor's
// messages (that is also how Twilio and the carriers treat it).

export const SMS_DIRECTIONS = ["outbound", "inbound"] as const;
export type SmsDirection = (typeof SMS_DIRECTIONS)[number];

export const SMS_STATUSES = ["sent", "failed", "skipped", "received"] as const;
export type SmsStatus = (typeof SMS_STATUSES)[number];

/** What triggered the message — drives the copy and the `sms_enabled` / `sms_reminders` gates. */
export const SMS_PURPOSES = [
  "lead_followup",
  "quote_followup",
  "contract_reminder",
  "invoice_reminder",
  "on_my_way",
  "appointment_reminder",
  "test",
  "reply",
  "opt_out",
  "opt_in",
] as const;
export type SmsPurpose = (typeof SMS_PURPOSES)[number];

export const smsMessagesTable = pgTable(
  "sms_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** The contractor account (business_profiles.user_id). Null for an inbound message we could not attribute. */
    userId: text("user_id"),
    direction: text("direction", { enum: SMS_DIRECTIONS }).notNull(),
    purpose: text("purpose", { enum: SMS_PURPOSES }).notNull(),
    status: text("status", { enum: SMS_STATUSES }).notNull(),
    /** E.164 (+1…) — the customer's number for both directions. */
    phone: text("phone").notNull(),
    /** The full text as sent (identity line + STOP footer included) or as received. */
    body: text("body").notNull(),
    /** GSM-7 / UCS-2 segments billed by the carrier — what usage_events counts. */
    segments: integer("segments").notNull().default(1),
    language: text("language", { enum: ["en", "fr"] }).notNull().default("en"),
    relatedEntityType: text("related_entity_type"),
    relatedEntityId: text("related_entity_id"),
    /** Twilio message SID, when the send reached Twilio. */
    providerSid: text("provider_sid"),
    /** Why a send failed or was skipped (not_configured, opted_out, allowance_exceeded, invalid_phone, provider error…). */
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("sms_messages_user_created_idx").on(t.userId, t.createdAt),
    index("sms_messages_phone_created_idx").on(t.phone, t.createdAt),
  ],
);

export type SmsMessage = typeof smsMessagesTable.$inferSelect;

export const SMS_OPT_OUT_SOURCES = ["stop_keyword", "manual"] as const;
export type SmsOptOutSource = (typeof SMS_OPT_OUT_SOURCES)[number];

export const smsOptOutsTable = pgTable(
  "sms_opt_outs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    phone: text("phone").notNull(),
    source: text("source", { enum: SMS_OPT_OUT_SOURCES }).notNull().default("stop_keyword"),
    /** The keyword the customer sent, kept verbatim for the audit trail. */
    keyword: text("keyword"),
    /** Contractor whose message was last sent to that number, when known — so their leads/clients can be marked unsubscribed. */
    userId: text("user_id"),
    optedOutAt: timestamp("opted_out_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("sms_opt_outs_phone_idx").on(t.phone)],
);

export type SmsOptOut = typeof smsOptOutsTable.$inferSelect;
