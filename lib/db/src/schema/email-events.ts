import {
  pgTable,
  text,
  uuid,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Persistenza degli eventi ricevuti dal webhook Resend (delivery/bounce/complaint
// ecc.), altrimenti visibili solo nei log del server. Permette all'admin di capire
// quando l'email di un partner rimbalza e le notifiche lead smettono di arrivare.
export const emailEventsTable = pgTable("email_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: text("type").notNull(), // es. 'email.bounced', 'email.delivered', 'email.complained'
  emailId: text("email_id"), // id Resend del messaggio (event.data.email_id)
  to: jsonb("to").$type<string[]>(),
  from: text("from"),
  subject: text("subject"),
  payload: jsonb("payload").$type<Record<string, unknown>>(), // corpo completo dell'evento per diagnosi
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEmailEventSchema = createInsertSchema(emailEventsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertEmailEvent = z.infer<typeof insertEmailEventSchema>;
export type EmailEvent = typeof emailEventsTable.$inferSelect;
