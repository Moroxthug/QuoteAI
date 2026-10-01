import { Router, type Response } from "express";
import { z } from "zod";
import { and, asc, desc, eq, gte, ne, or } from "drizzle-orm";
import {
  db,
  businessProfilesTable,
  costEntriesTable,
  hasFeature,
  inventoryItemsTable,
  minimumPlanFor,
  suppliersTable,
  supplierOrdersTable,
} from "@workspace/db";
import { requireAuth, getUserId, getActorRole } from "../middlewares/authMiddleware.js";
import { requirePermission, roleCan } from "../middlewares/requirePermission.js";
import { latestPrice, priceSeries, sameItem, stockLevel, suggestedQty, totalOf, type ReceiptLines } from "../materials/suppliers.js";
import { vendorMatches } from "../materials/suppliers.js";

// ── Pocket 127.6: Inventory ("Materials") ───────────────────────────────────────
// What the company keeps in the shop, the truck and on site, what is running low, and a reorder from a supplier that goes onto the order list
// (supplier_orders, see routes/suppliers.ts). Counts are kept by hand ("Count stock"); there is no usage history, so the suggested quantity
// brings the stock back to twice the reorder level. The plan that includes it is Business ("inventory").

const router = Router();

const fail = (res: Response, err: unknown, log: { error: (o: object, m: string) => void }, what: string) => {
  log.error({ err }, what);
  res.status(500).json({ error: "Internal server error" });
};

async function enabled(userId: string): Promise<boolean> {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  return hasFeature(profile, "inventory");
}

const dto = (i: typeof inventoryItemsTable.$inferSelect) => {
  const stock = { shopQty: Number(i.shopQty), truckQty: Number(i.truckQty), sites: i.sites ?? [], reserved: i.reserved ?? [], par: Number(i.par) };
  return { id: i.id, name: i.name, unit: i.unit, par: stock.par, shopQty: stock.shopQty, truckQty: stock.truckQty, sites: stock.sites, reserved: stock.reserved, unitCostCents: i.unitCostCents, total: totalOf(stock), level: stockLevel(stock), suggested: suggestedQty(stock) };
};

// GET /api/inventory/overview — the stock, the order list and, for each item, what the suppliers charge
router.get("/inventory/overview", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    if (!(await enabled(userId))) { res.json({ enabled: false, requiredPlan: minimumPlanFor("inventory") }); return; }
    const now = new Date();
    const [items, suppliers, orders, costs] = await Promise.all([
      db.select().from(inventoryItemsTable).where(eq(inventoryItemsTable.userId, userId)).orderBy(asc(inventoryItemsTable.name)),
      db.select().from(suppliersTable).where(eq(suppliersTable.userId, userId)).orderBy(asc(suppliersTable.name)),
      db.select().from(supplierOrdersTable).where(and(eq(supplierOrdersTable.userId, userId), ne(supplierOrdersTable.status, "delivered"), ne(supplierOrdersTable.status, "picked_up"))).orderBy(desc(supplierOrdersTable.createdAt)),
      db.select({ supplierId: costEntriesTable.supplierId, vendor: costEntriesTable.vendor, date: costEntriesTable.date, ai: costEntriesTable.aiExtraction })
        .from(costEntriesTable)
        .where(and(eq(costEntriesTable.userId, userId), gte(costEntriesTable.date, new Date(now.getTime() - 190 * 86_400_000)), or(eq(costEntriesTable.category, "materials"), eq(costEntriesTable.category, "equipment"), eq(costEntriesTable.category, "misc"))))
        .orderBy(desc(costEntriesTable.date)).limit(3000),
    ]);
    const live = suppliers.filter((s) => !s.archivedAt);
    // What each supplier charged for each item, from the receipts' lines.
    const seriesBySupplier = live.map((s) => {
      const mine: ReceiptLines[] = costs
        .filter((c) => c.supplierId === s.id || (!c.supplierId && vendorMatches(c.vendor, s.name)))
        .map((c) => ({ at: c.date, lines: Array.isArray(c.ai?.lines) ? c.ai!.lines.map((l) => ({ description: String(l.description ?? ""), unitPrice: typeof l.unitPrice === "number" ? l.unitPrice : null })) : [] }));
      return { supplier: s, series: priceSeries(mine) };
    });
    const withOptions = items.map((i) => {
      const options = seriesBySupplier.map(({ supplier, series }) => {
        const p = latestPrice(series, i.name);
        return { supplierId: supplier.id, name: supplier.name, terms: supplier.terms ?? "", delivers: supplier.delivers ?? "", kind: supplier.kind, priceCents: p ? Math.round(p.price * 100) : null, beforeCents: p?.before != null ? Math.round(p.before * 100) : null };
      }).sort((a, b) => (a.priceCents ?? Infinity) - (b.priceCents ?? Infinity) || a.name.localeCompare(b.name));
      return { ...dto(i), options };
    });
    const names = new Map(suppliers.map((s) => [s.id, s.name]));
    res.json({
      enabled: true,
      canEdit: roleCan(getActorRole(res), "jobs", "edit"),
      items: withOptions,
      orders: orders.map((o) => ({ id: o.id, supplierId: o.supplierId, supplierName: names.get(o.supplierId) ?? "", inventoryItemId: o.inventoryItemId, itemName: o.itemName, unit: o.unit, qty: Number(o.qty), unitPriceCents: o.unitPriceCents, destination: o.destination, status: o.status })),
      sites: [...new Set(items.flatMap((i) => (i.sites ?? []).map((s) => s.name)).filter(Boolean))],
    });
  } catch (err) {
    fail(res, err, req.log, "Error loading inventory");
  }
});

const qty = z.number().min(0).max(1_000_000);
const itemBody = z.object({
  name: z.string().trim().min(1).max(300),
  unit: z.string().trim().min(1).max(40),
  par: qty,
  shopQty: qty,
  truckQty: qty,
  sites: z.array(z.object({ name: z.string().trim().min(1).max(120), qty })).max(30),
  reserved: z.array(z.object({ job: z.string().trim().min(1).max(200), qty: z.number().positive().max(1_000_000) })).max(30),
  unitCostCents: z.number().int().min(0).max(100_000_000).nullable(),
});

// POST /api/inventory/items — track something
router.post("/inventory/items", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    if (!(await enabled(userId))) { res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: minimumPlanFor("inventory") }); return; }
    const body = itemBody.partial({ unit: true, par: true, shopQty: true, truckQty: true, sites: true, reserved: true, unitCostCents: true }).safeParse(req.body ?? {});
    if (!body.success) { res.status(400).json({ error: "Invalid parameters", details: body.error }); return; }
    const d = body.data;
    const [created] = await db.insert(inventoryItemsTable).values({
      userId, name: d.name, unit: d.unit ?? "each", par: String(d.par ?? 0), shopQty: String(d.shopQty ?? 0), truckQty: String(d.truckQty ?? 0), sites: d.sites ?? [], reserved: d.reserved ?? [], unitCostCents: d.unitCostCents ?? null,
    }).returning();
    res.status(201).json({ item: dto(created!) });
  } catch (err) {
    fail(res, err, req.log, "Error adding to inventory");
  }
});

// PUT /api/inventory/items/:id — count it again, or change its reorder level
router.put("/inventory/items/:id", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    if (!(await enabled(userId))) { res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: minimumPlanFor("inventory") }); return; }
    const body = itemBody.partial().safeParse(req.body ?? {});
    if (!body.success || Object.keys(body.data).length === 0) { res.status(400).json({ error: "Invalid parameters" }); return; }
    const d = body.data;
    const set: Partial<typeof inventoryItemsTable.$inferInsert> = {};
    if (d.name !== undefined) set.name = d.name;
    if (d.unit !== undefined) set.unit = d.unit;
    if (d.par !== undefined) set.par = String(d.par);
    if (d.shopQty !== undefined) set.shopQty = String(d.shopQty);
    if (d.truckQty !== undefined) set.truckQty = String(d.truckQty);
    if (d.sites !== undefined) set.sites = d.sites;
    if (d.reserved !== undefined) set.reserved = d.reserved;
    if (d.unitCostCents !== undefined) set.unitCostCents = d.unitCostCents;
    const [updated] = await db.update(inventoryItemsTable).set(set).where(and(eq(inventoryItemsTable.id, req.params.id as string), eq(inventoryItemsTable.userId, userId))).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ item: dto(updated) });
  } catch (err) {
    fail(res, err, req.log, "Error counting stock");
  }
});

// POST /api/inventory/from-receipts — start the list from what the receipts show was bought: the most bought lines, each counted at what the last receipt had
router.post("/inventory/from-receipts", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    if (!(await enabled(userId))) { res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: minimumPlanFor("inventory") }); return; }
    const now = new Date();
    const [have, costs] = await Promise.all([
      db.select({ name: inventoryItemsTable.name }).from(inventoryItemsTable).where(eq(inventoryItemsTable.userId, userId)),
      db.select({ date: costEntriesTable.date, ai: costEntriesTable.aiExtraction }).from(costEntriesTable)
        .where(and(eq(costEntriesTable.userId, userId), eq(costEntriesTable.category, "materials"), gte(costEntriesTable.date, new Date(now.getTime() - 190 * 86_400_000))))
        .orderBy(desc(costEntriesTable.date)).limit(500),
    ]);
    const seen: { name: string; times: number; last: number; cents: number | null }[] = [];
    for (const c of costs) {
      for (const l of Array.isArray(c.ai?.lines) ? c.ai!.lines : []) {
        const name = String(l.description ?? "").trim();
        if (!name || have.some((h) => sameItem(h.name, name))) continue;
        const cur = seen.find((s) => sameItem(s.name, name));
        if (cur) { cur.times++; continue; }
        seen.push({ name, times: 1, last: Math.max(0, Math.round(Number(l.quantity) || 0)), cents: typeof l.unitPrice === "number" ? Math.round(l.unitPrice * 100) : null });
      }
    }
    const top = seen.sort((a, b) => b.times - a.times).slice(0, 25);
    if (top.length) await db.insert(inventoryItemsTable).values(top.map((s) => ({ userId, name: s.name, unit: "each", par: "0", shopQty: String(s.last), truckQty: "0", unitCostCents: s.cents })));
    res.json({ created: top.length });
  } catch (err) {
    fail(res, err, req.log, "Error starting inventory from receipts");
  }
});

// DELETE /api/inventory/items/:id — stop tracking it
router.delete("/inventory/items/:id", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const rows = await db.delete(inventoryItemsTable).where(and(eq(inventoryItemsTable.id, req.params.id as string), eq(inventoryItemsTable.userId, userId))).returning({ id: inventoryItemsTable.id });
    if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ deleted: true });
  } catch (err) {
    fail(res, err, req.log, "Error removing from inventory");
  }
});

export default router;
