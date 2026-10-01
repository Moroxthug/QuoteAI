import {
  pgTable,
  text,
  uuid,
  timestamp,
  numeric,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const PRICE_ITEM_KINDS = ["labour", "material", "assembly"] as const;
export type PriceItemKind = (typeof PRICE_ITEM_KINDS)[number];
export type PriceItemPart = { name: string; amount: number };

export const priceCatalogItemsTable = pgTable("price_catalog_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  nome: text("nome").notNull(),
  categoria: text("categoria"),
  um: text("um").notNull().default("cad"),
  prezzoUnitario: numeric("prezzo_unitario", { precision: 10, scale: 2 }).notNull().default("0"),
  note: text("note"),
  /** Pocket 127.6 (PriceBook): labour, a material or an assembly of parts. Null on rows made before it; the API infers one from the unit. */
  kind: text("kind", { enum: PRICE_ITEM_KINDS }),
  /** What the item costs the company (the margin is price less this). */
  unitCost: numeric("unit_cost", { precision: 10, scale: 2 }),
  /** The price before the last change, and when it changed (the "Price changed" and "Up 8%" marks). */
  previousPrice: numeric("previous_price", { precision: 10, scale: 2 }),
  priceChangedAt: timestamp("price_changed_at", { withTimezone: true }),
  /** An assembly's parts: name and what each costs. */
  parts: jsonb("parts").$type<PriceItemPart[] | null>(),
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
