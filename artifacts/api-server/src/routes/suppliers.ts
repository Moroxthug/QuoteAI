import { Router, type Response } from "express";
import { z } from "zod";
import { and, asc, desc, eq, gte, inArray, isNull, or } from "drizzle-orm";
import {
  db,
  businessProfilesTable,
  costEntriesTable,
  hasFeature,
  inventoryItemsTable,
  priceCatalogItemsTable,
  projectsTable,
  quotesTable,
  suppliersTable,
  supplierOrdersTable,
  SUPPLIER_ORDER_STATUSES,
  type Supplier,
} from "@workspace/db";
import { requireAuth, getUserId, getActorRole } from "../middlewares/authMiddleware.js";
import { requirePermission, roleCan } from "../middlewares/requirePermission.js";
import { kindOf, itemKey } from "../materials/priceBook.js";
import { normVendor, priceHistory, priceSeries, sameItem, stockLevel, vendorMatches, type ReceiptLines } from "../materials/suppliers.js";

// ── Pocket 127.6: Suppliers and Supplier ────────────────────────────────────────
// The stores the company buys from. Spend, price history and receipts are read from the cost entries (the receipts the AI read): a receipt
// belongs to a supplier when its supplier is set or its vendor's name matches. The order list is the supplier_orders rows; Inventory adds to it.

const router = Router();

const fail = (res: Response, err: unknown, log: { error: (o: object, m: string) => void }, what: string) => {
  log.error({ err }, what);
  res.status(500).json({ error: "Internal server error" });
};

const canEditOf = (res: Response) => roleCan(getActorRole(res), "jobs", "edit");

type CostRow = { id: string; supplierId: string | null; vendor: string; date: Date; totalCents: number; description: string; projectId: string | null; lines: ReceiptLines["lines"] };

const startOfMonthUtc = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
const startOfYearUtc = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

/** The company's confirmed or pending purchases from the start of last year's window (a year and the six months of prices), newest first. */
async function loadCosts(userId: string, now: Date): Promise<CostRow[]> {
  const since = new Date(Math.min(startOfYearUtc(now).getTime(), now.getTime() - 190 * 86_400_000));
  const rows = await db
    .select({
      id: costEntriesTable.id, supplierId: costEntriesTable.supplierId, vendor: costEntriesTable.vendor, date: costEntriesTable.date,
      totalCents: costEntriesTable.totalCents, description: costEntriesTable.description, projectId: costEntriesTable.projectId, ai: costEntriesTable.aiExtraction,
    })
    .from(costEntriesTable)
    .where(and(eq(costEntriesTable.userId, userId), gte(costEntriesTable.date, since), or(eq(costEntriesTable.category, "materials"), eq(costEntriesTable.category, "equipment"), eq(costEntriesTable.category, "misc"))))
    .orderBy(desc(costEntriesTable.date))
    .limit(3000);
  return rows.map((r) => ({
    id: r.id, supplierId: r.supplierId, vendor: r.vendor, date: r.date, totalCents: r.totalCents, description: r.description, projectId: r.projectId,
    lines: Array.isArray(r.ai?.lines) ? r.ai!.lines.map((l) => ({ description: String(l.description ?? ""), unitPrice: typeof l.unitPrice === "number" ? l.unitPrice : null })) : [],
  }));
}

const belongs = (c: CostRow, s: Pick<Supplier, "id" | "name">): boolean => c.supplierId === s.id || (!c.supplierId && vendorMatches(c.vendor, s.name));

const asNum = (v: string | number | null | undefined): number | null => (v == null ? null : Number(v));

function serializeSupplier(s: Supplier) {
  return {
    id: s.id, name: s.name, category: s.category, repName: s.repName ?? "", repRole: s.repRole ?? "", kind: s.kind, accountNo: s.accountNo ?? "", terms: s.terms ?? "",
    proDiscountPct: asNum(s.proDiscountPct), phone: s.phone ?? "", email: s.email ?? "", address: s.address ?? "", delivers: s.delivers ?? "", hours: s.hours ?? "", notes: s.notes ?? "",
  };
}

const orderDto = (o: typeof supplierOrdersTable.$inferSelect) => ({
  id: o.id, supplierId: o.supplierId, inventoryItemId: o.inventoryItemId, itemName: o.itemName, unit: o.unit, qty: Number(o.qty), unitPriceCents: o.unitPriceCents,
  destination: o.destination, status: o.status, orderedAt: o.orderedAt ? o.orderedAt.toISOString() : null, createdAt: o.createdAt.toISOString(),
});

// GET /api/suppliers/overview — the list and the three numbers
router.get("/suppliers/overview", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const now = new Date();
    const [suppliers, costs, orders, profile] = await Promise.all([
      db.select().from(suppliersTable).where(and(eq(suppliersTable.userId, userId), isNull(suppliersTable.archivedAt))).orderBy(asc(suppliersTable.name)),
      loadCosts(userId, now),
      db.select().from(supplierOrdersTable).where(eq(supplierOrdersTable.userId, userId)),
      db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId)).then((r) => r[0]),
    ]);
    const month = startOfMonthUtc(now);
    const year = startOfYearUtc(now);
    let spendMonth = 0;
    let purchasesMonth = 0;
    let spendYear = 0;
    let priceChanges = 0;
    let priceUps = 0;
    const items = suppliers.map((s) => {
      const mine = costs.filter((c) => belongs(c, s));
      const monthCents = mine.filter((c) => c.date >= month).reduce((n, c) => n + c.totalCents, 0);
      spendMonth += monthCents;
      purchasesMonth += mine.filter((c) => c.date >= month).length;
      spendYear += mine.filter((c) => c.date >= year).reduce((n, c) => n + c.totalCents, 0);
      const moved = priceHistory(priceSeries(mine.map((c) => ({ at: c.date, lines: c.lines }))), now, 6, 50).filter((p) => p.when);
      priceChanges += moved.length;
      priceUps += moved.filter((p) => p.changePct > 0).length;
      const lastCost = mine[0]?.date ?? null;
      const lastOrder = orders.filter((o) => o.supplierId === s.id && o.orderedAt).sort((a, b) => b.orderedAt!.getTime() - a.orderedAt!.getTime())[0]?.orderedAt ?? null;
      const last = [lastCost, lastOrder].filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
      return { ...serializeSupplier(s), spendMonthCents: monthCents, lastOrderAt: last ? last.toISOString() : null };
    });
    let low: number | null = null;
    if (hasFeature(profile, "inventory")) {
      const stock = await db.select().from(inventoryItemsTable).where(eq(inventoryItemsTable.userId, userId));
      low = stock.filter((i) => stockLevel({ shopQty: Number(i.shopQty), truckQty: Number(i.truckQty), sites: i.sites ?? [], reserved: i.reserved ?? [], par: Number(i.par) }) !== "ok").length;
    }
    res.json({ canEdit: canEditOf(res), items, spendMonthCents: spendMonth, purchasesMonth, spendYearCents: spendYear, priceChanges, priceUps, lowCount: low });
  } catch (err) {
    fail(res, err, req.log, "Error loading suppliers");
  }
});

const supplierBody = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().max(60).optional(),
  repName: z.string().trim().max(120).optional(),
  repRole: z.string().trim().max(120).optional(),
  kind: z.enum(["account", "counter"]).optional(),
  accountNo: z.string().trim().max(80).optional(),
  terms: z.string().trim().max(80).optional(),
  proDiscountPct: z.number().min(0).max(100).nullable().optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().max(200).optional(),
  address: z.string().trim().max(300).optional(),
  delivers: z.string().trim().max(200).optional(),
  hours: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(4000).optional(),
});

const blank = (v: string | undefined) => (v === undefined ? undefined : v === "" ? null : v);
function fields(d: Partial<z.infer<typeof supplierBody>>) {
  const out: Partial<typeof suppliersTable.$inferInsert> = {};
  if (d.name !== undefined) out.name = d.name;
  if (d.category !== undefined) out.category = d.category;
  if (d.repName !== undefined) out.repName = blank(d.repName);
  if (d.repRole !== undefined) out.repRole = blank(d.repRole);
  if (d.kind !== undefined) out.kind = d.kind;
  if (d.accountNo !== undefined) out.accountNo = blank(d.accountNo);
  if (d.terms !== undefined) out.terms = blank(d.terms);
  if (d.proDiscountPct !== undefined) out.proDiscountPct = d.proDiscountPct === null ? null : String(d.proDiscountPct);
  if (d.phone !== undefined) out.phone = blank(d.phone);
  if (d.email !== undefined) out.email = blank(d.email);
  if (d.address !== undefined) out.address = blank(d.address);
  if (d.delivers !== undefined) out.delivers = blank(d.delivers);
  if (d.hours !== undefined) out.hours = blank(d.hours);
  if (d.notes !== undefined) out.notes = blank(d.notes);
  return out;
}

// POST /api/suppliers — add one
router.post("/suppliers", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const body = supplierBody.safeParse(req.body ?? {});
    if (!body.success) { res.status(400).json({ error: "Invalid parameters", details: body.error }); return; }
    const [created] = await db.insert(suppliersTable).values({ userId, name: body.data.name, ...fields(body.data) }).returning();
    res.status(201).json({ supplier: serializeSupplier(created!) });
  } catch (err) {
    fail(res, err, req.log, "Error adding a supplier");
  }
});

// POST /api/suppliers/from-receipts — one counter supplier for each store a receipt names that is not a supplier yet
router.post("/suppliers/from-receipts", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const now = new Date();
    const [have, costs] = await Promise.all([
      db.select({ name: suppliersTable.name }).from(suppliersTable).where(eq(suppliersTable.userId, userId)),
      loadCosts(userId, now),
    ]);
    const stores = new Map<string, { name: string; cents: number }>();
    for (const c of costs) {
      const name = c.vendor.replace(/#\s*\d+/g, "").replace(/\s+/g, " ").trim();
      if (!name || have.some((h) => vendorMatches(name, h.name))) continue;
      const k = normVendor(name);
      const cur = stores.get(k) ?? { name, cents: 0 };
      cur.cents += c.totalCents;
      stores.set(k, cur);
    }
    const top = [...stores.values()].sort((a, b) => b.cents - a.cents).slice(0, 20);
    if (top.length) await db.insert(suppliersTable).values(top.map((s) => ({ userId, name: s.name, kind: "counter" as const })));
    res.json({ created: top.length });
  } catch (err) {
    fail(res, err, req.log, "Error finding suppliers in receipts");
  }
});

// GET /api/suppliers/orders — the order list (every listed order), with the supplier's name
router.get("/suppliers/orders", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const rows = await db
      .select({ o: supplierOrdersTable, supplierName: suppliersTable.name })
      .from(supplierOrdersTable)
      .innerJoin(suppliersTable, eq(suppliersTable.id, supplierOrdersTable.supplierId))
      .where(and(eq(supplierOrdersTable.userId, userId), eq(supplierOrdersTable.status, "listed")))
      .orderBy(desc(supplierOrdersTable.createdAt));
    res.json({ items: rows.map((r) => ({ ...orderDto(r.o), supplierName: r.supplierName })) });
  } catch (err) {
    fail(res, err, req.log, "Error loading the order list");
  }
});

const orderBody = z.object({
  inventoryItemId: z.string().uuid().nullable().optional(),
  itemName: z.string().trim().min(1).max(300),
  unit: z.string().trim().min(1).max(40).optional(),
  qty: z.number().positive().max(1_000_000),
  unitPriceCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
  destination: z.string().trim().max(120).optional(),
});

// POST /api/suppliers/:id/orders — add to the order list
router.post("/suppliers/:id/orders", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const [s] = await db.select({ id: suppliersTable.id }).from(suppliersTable).where(and(eq(suppliersTable.id, req.params.id as string), eq(suppliersTable.userId, userId)));
    if (!s) { res.status(404).json({ error: "Not found" }); return; }
    const body = orderBody.safeParse(req.body ?? {});
    if (!body.success) { res.status(400).json({ error: "Invalid parameters", details: body.error }); return; }
    const d = body.data;
    let itemId: string | null = null;
    if (d.inventoryItemId) {
      const [it] = await db.select({ id: inventoryItemsTable.id }).from(inventoryItemsTable).where(and(eq(inventoryItemsTable.id, d.inventoryItemId), eq(inventoryItemsTable.userId, userId)));
      itemId = it?.id ?? null;
    }
    const [created] = await db.insert(supplierOrdersTable).values({
      userId, supplierId: s.id, inventoryItemId: itemId, itemName: d.itemName, unit: d.unit ?? "each", qty: String(d.qty), unitPriceCents: d.unitPriceCents ?? null, destination: d.destination ?? "", status: "listed",
    }).returning();
    res.status(201).json({ order: orderDto(created!) });
  } catch (err) {
    fail(res, err, req.log, "Error adding to the order list");
  }
});

const orderPatch = z.object({
  supplierId: z.string().uuid().optional(),
  qty: z.number().positive().max(1_000_000).optional(),
  unitPriceCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
  destination: z.string().trim().max(120).optional(),
  status: z.enum(SUPPLIER_ORDER_STATUSES).optional(),
});

// PUT /api/suppliers/orders/:oid — change what is on the list (the quantity, the supplier, where it goes)
router.put("/suppliers/orders/:oid", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const body = orderPatch.safeParse(req.body ?? {});
    if (!body.success || Object.keys(body.data).length === 0) { res.status(400).json({ error: "Invalid parameters" }); return; }
    const d = body.data;
    const set: Partial<typeof supplierOrdersTable.$inferInsert> = {};
    if (d.supplierId) {
      const [s] = await db.select({ id: suppliersTable.id }).from(suppliersTable).where(and(eq(suppliersTable.id, d.supplierId), eq(suppliersTable.userId, userId)));
      if (!s) { res.status(400).json({ error: "Invalid supplier" }); return; }
      set.supplierId = s.id;
    }
    if (d.qty !== undefined) set.qty = String(d.qty);
    if (d.unitPriceCents !== undefined) set.unitPriceCents = d.unitPriceCents;
    if (d.destination !== undefined) set.destination = d.destination;
    if (d.status !== undefined) { set.status = d.status; if (d.status !== "listed") set.orderedAt = new Date(); }
    const [updated] = await db.update(supplierOrdersTable).set(set).where(and(eq(supplierOrdersTable.id, req.params.oid as string), eq(supplierOrdersTable.userId, userId))).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ order: orderDto(updated) });
  } catch (err) {
    fail(res, err, req.log, "Error changing an order");
  }
});

// POST /api/suppliers/:id/orders/sent — the list went to the supplier: what was on it is now ordered
router.post("/suppliers/:id/orders/sent", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const rows = await db.update(supplierOrdersTable).set({ status: "ordered", orderedAt: new Date() })
      .where(and(eq(supplierOrdersTable.userId, userId), eq(supplierOrdersTable.supplierId, req.params.id as string), eq(supplierOrdersTable.status, "listed"))).returning({ id: supplierOrdersTable.id });
    res.json({ ordered: rows.length });
  } catch (err) {
    fail(res, err, req.log, "Error marking the order list as sent");
  }
});

// GET /api/suppliers/:id — one supplier: terms, price history, orders and receipts
router.get("/suppliers/:id", requireAuth, async (req, res) => {
  try {
    const userId = getUserId(res);
    const now = new Date();
    const [s] = await db.select().from(suppliersTable).where(and(eq(suppliersTable.id, req.params.id as string), eq(suppliersTable.userId, userId)));
    if (!s) { res.status(404).json({ error: "Not found" }); return; }
    const [costs, orders, book] = await Promise.all([
      loadCosts(userId, now),
      db.select().from(supplierOrdersTable).where(and(eq(supplierOrdersTable.userId, userId), eq(supplierOrdersTable.supplierId, s.id))).orderBy(desc(supplierOrdersTable.createdAt)).limit(30),
      db.select().from(priceCatalogItemsTable).where(eq(priceCatalogItemsTable.userId, userId)),
    ]);
    const mine = costs.filter((c) => belongs(c, s));
    const month = startOfMonthUtc(now);
    const year = startOfYearUtc(now);
    const prices = priceHistory(priceSeries(mine.map((c) => ({ at: c.date, lines: c.lines }))), now);

    // A price that went up at this supplier while the price book still has the old one: offer to bring the book up to date.
    let nudge: null | { itemId: string; itemName: string; supplierPrice: number; bookPrice: number; newPrice: number; newCost: number | null; changePct: number; quoteId: string | null; openQuotes: number } = null;
    for (const p of prices) {
      if (!p.when || p.changePct <= 0.05) continue;
      const item = book.find((b) => kindOf(b.kind, b.um) === "material" && sameItem(b.nome, p.name) && Number(b.prezzoUnitario) < p.to - 0.004);
      if (!item) continue;
      const cost = asNum(item.unitCost);
      const bookPrice = Number(item.prezzoUnitario);
      // Keep the margin in dollars when the book knows what the item costs.
      const newPrice = cost == null ? p.to : Math.round((bookPrice + (p.to - cost)) * 100) / 100;
      const key = itemKey(item.nome);
      // The quotes still open (not accepted or declined) that have a line like it: the price check of the newest one is what "See quotes" opens.
      const recent = await db.select({ id: quotesTable.id, capitoli: quotesTable.capitoli }).from(quotesTable)
        .where(and(eq(quotesTable.userId, userId), isNull(quotesTable.archivedAt), isNull(quotesTable.declinedAt), isNull(quotesTable.acceptedAt))).orderBy(desc(quotesTable.createdAt)).limit(200);
      const open = recent.filter((q) => (q.capitoli ?? []).some((ch) => (ch.voci ?? []).some((v) => v?.descrizione && itemKey(v.descrizione) === key)));
      nudge = { itemId: item.id, itemName: item.nome, supplierPrice: p.to, bookPrice, newPrice, newCost: cost == null ? null : p.to, changePct: p.changePct, quoteId: open[0]?.id ?? null, openQuotes: open.length };
      break;
    }

    const projectIds = [...new Set(mine.map((c) => c.projectId).filter((x): x is string => !!x))];
    const names = projectIds.length ? new Map((await db.select({ id: projectsTable.id, name: projectsTable.name }).from(projectsTable).where(inArray(projectsTable.id, projectIds))).map((p) => [p.id, p.name])) : new Map<string, string>();
    const receipts = mine.slice(0, 6).map((c) => ({ id: c.id, date: c.date.toISOString(), description: c.description || c.vendor, totalCents: c.totalCents, projectId: c.projectId, projectName: c.projectId ? names.get(c.projectId) ?? null : null }));
    res.json({
      canEdit: canEditOf(res),
      canMatch: roleCan(getActorRole(res), "costs", "edit"),
      supplier: serializeSupplier(s),
      spendYearCents: mine.filter((c) => c.date >= year).reduce((n, c) => n + c.totalCents, 0),
      spendMonthCents: mine.filter((c) => c.date >= month).reduce((n, c) => n + c.totalCents, 0),
      prices: prices.map((p) => ({ ...p })),
      nudge,
      orders: orders.map(orderDto),
      receipts,
      receiptsMatched: mine.filter((c) => c.projectId).length,
      receiptsTotal: mine.length,
    });
  } catch (err) {
    fail(res, err, req.log, "Error loading a supplier");
  }
});

// PUT /api/suppliers/:id — edit
router.put("/suppliers/:id", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const body = supplierBody.partial().safeParse(req.body ?? {});
    const set = body.success ? fields(body.data) : {};
    if (!body.success || Object.keys(set).length === 0) { res.status(400).json({ error: "Invalid parameters" }); return; }
    const [updated] = await db.update(suppliersTable).set(set).where(and(eq(suppliersTable.id, req.params.id as string), eq(suppliersTable.userId, userId))).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ supplier: serializeSupplier(updated) });
  } catch (err) {
    fail(res, err, req.log, "Error editing a supplier");
  }
});

// POST /api/suppliers/:id/archive — out of the list; past orders and receipts stay
router.post("/suppliers/:id/archive", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const [updated] = await db.update(suppliersTable).set({ archivedAt: new Date() }).where(and(eq(suppliersTable.id, req.params.id as string), eq(suppliersTable.userId, userId))).returning({ id: suppliersTable.id });
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ archived: true });
  } catch (err) {
    fail(res, err, req.log, "Error archiving a supplier");
  }
});

export default router;
