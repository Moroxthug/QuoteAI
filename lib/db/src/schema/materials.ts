import { pgTable, text, uuid, timestamp, numeric, integer, jsonb, index } from "drizzle-orm/pg-core";
import { suppliersTable } from "./crm";

// Pocket 127.6 (Inventory, Supplier): the stock the company keeps (shop, truck, sites) and the orders it puts to its suppliers.

export type StockSite = { name: string; qty: number };
export type StockReservation = { qty: number; job: string };

export const inventoryItemsTable = pgTable(
  "inventory_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** The company (business_profiles.user_id). */
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    /** Plural, as the board writes it: sheets, pails, rolls. */
    unit: text("unit").notNull().default("each"),
    /** Reorder when the total falls below this. */
    par: numeric("par", { precision: 10, scale: 2 }).notNull().default("0"),
    shopQty: numeric("shop_qty", { precision: 10, scale: 2 }).notNull().default("0"),
    truckQty: numeric("truck_qty", { precision: 10, scale: 2 }).notNull().default("0"),
    /** What is on each job site. */
    sites: jsonb("sites").$type<StockSite[]>().notNull().default([]),
    /** What is set aside for a job. */
    reserved: jsonb("reserved").$type<StockReservation[]>().notNull().default([]),
    /** What one unit cost last, in cents (the value of what is reserved). */
    unitCostCents: integer("unit_cost_cents"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [index("inventory_items_user_idx").on(t.userId)],
);

export const SUPPLIER_ORDER_STATUSES = ["listed", "ordered", "ready", "delivered", "picked_up", "backordered"] as const;
export type SupplierOrderStatus = (typeof SUPPLIER_ORDER_STATUSES)[number];

export const supplierOrdersTable = pgTable(
  "supplier_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    supplierId: uuid("supplier_id").notNull().references(() => suppliersTable.id, { onDelete: "cascade" }),
    inventoryItemId: uuid("inventory_item_id").references(() => inventoryItemsTable.id, { onDelete: "set null" }),
    itemName: text("item_name").notNull(),
    unit: text("unit").notNull().default("each"),
    qty: numeric("qty", { precision: 10, scale: 2 }).notNull().default("1"),
    /** Null when the supplier's price isn't known. */
    unitPriceCents: integer("unit_price_cents"),
    /** Where it goes: "Shop", a site, "Pick up". */
    destination: text("destination").notNull().default(""),
    /** "listed" is on the order list, not yet ordered. */
    status: text("status", { enum: SUPPLIER_ORDER_STATUSES }).notNull().default("listed"),
    orderedAt: timestamp("ordered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [index("supplier_orders_user_supplier_idx").on(t.userId, t.supplierId, t.createdAt)],
);

export type InventoryItem = typeof inventoryItemsTable.$inferSelect;
export type SupplierOrder = typeof supplierOrdersTable.$inferSelect;
