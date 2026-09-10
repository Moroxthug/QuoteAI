import {
  pgTable,
  pgEnum,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { authUsersTable } from "./auth";

export const whatsappConnectionsTable = pgTable("whatsapp_connections", {
  userId: text("user_id").primaryKey().references(() => authUsersTable.id, { onDelete: "cascade" }),
  phoneNumber: text("phone_number").notNull().unique(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  /** Persistent user preferences (default template, client, IVA, …) */
  preferences: jsonb("preferences").default({}),
});

export const whatsappOtpTable = pgTable("whatsapp_otp", {
  phoneNumber: text("phone_number").primaryKey(),
  otp: text("otp").notNull(),
  userId: text("user_id").notNull().references(() => authUsersTable.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const whatsappSessionStateEnum = pgEnum("whatsapp_session_state", [
  "awaiting_template_selection",
  "awaiting_client_choice",
  "awaiting_job_input",
  "awaiting_confirmation",
  "awaiting_client_data",
  "menu_main",
  "menu_clients",
  "menu_template",
  "menu_iva",
]);

export const whatsappSessionsTable = pgTable("whatsapp_sessions", {
  phoneNumber: text("phone_number").primaryKey(),
  userId: text("user_id").notNull(),
  state: whatsappSessionStateEnum("state").notNull(),
  pendingQuoteData: jsonb("pending_quote_data").notNull(),
  iterationCount: integer("iteration_count").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertWhatsappConnectionSchema = createInsertSchema(whatsappConnectionsTable).omit({
  connectedAt: true,
});
export const insertWhatsappOtpSchema = createInsertSchema(whatsappOtpTable).omit({
  createdAt: true,
});

export type WhatsappConnection = typeof whatsappConnectionsTable.$inferSelect;
export type WhatsappOtp = typeof whatsappOtpTable.$inferSelect;
export type WhatsappSession = typeof whatsappSessionsTable.$inferSelect;
export type InsertWhatsappConnection = z.infer<typeof insertWhatsappConnectionSchema>;

export type WhatsappPreferences = {
  defaultTemplate?: string;   // "standard" | "mariagrazia" | "arosio"
  defaultClient?: { nome: string; indirizzo: string } | null;
  defaultIva?: number;        // 4 | 5 | 10 | 22
};
