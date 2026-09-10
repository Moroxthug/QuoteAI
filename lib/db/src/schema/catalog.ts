import {
  pgTable,
  text,
  uuid,
  timestamp,
  numeric,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const priceCatalogItemsTable = pgTable("price_catalog_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  nome: text("nome").notNull(),
  categoria: text("categoria"),
  um: text("um").notNull().default("cad"),
  prezzoUnitario: numeric("prezzo_unitario", { precision: 10, scale: 2 }).notNull().default("0"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPriceCatalogItemSchema = createInsertSchema(priceCatalogItemsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPriceCatalogItem = z.infer<typeof insertPriceCatalogItemSchema>;
export type PriceCatalogItem = typeof priceCatalogItemsTable.$inferSelect;
