import { Router } from "express";
import { z } from "zod";
import { db, clientsTable, clientDedupKey, normalizeProvince } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { requireApiKey, publicApiLimiter } from "../../middlewares/apiKeyAuth.js";
import { requirePermission } from "../../middlewares/requirePermission.js";
import { getUserId } from "../../middlewares/authMiddleware.js";

const router = Router();

function serializeClient(c: typeof clientsTable.$inferSelect) {
  return {
    id: c.id,
    type: c.type,
    name: c.name,
    email: c.email,
    phone: c.phone,
    address: c.address,
    city: c.city,
    province: c.province,
    postalCode: c.postalCode,
    businessNumber: c.businessNumber,
    preferredLanguage: c.preferredLanguage,
    notes: c.notes,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

// GET /api/v1/public/clients — reads the first-class client records (the same
// table quotes/jobs/invoices link to), not the legacy quote-derived list the
// in-app UI still shows.
router.get("/clients", requireApiKey, publicApiLimiter, requirePermission("leads", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const clients = await db.select().from(clientsTable).where(eq(clientsTable.userId, userId)).orderBy(desc(clientsTable.createdAt)).limit(limit);
    res.json({ items: clients.map(serializeClient) });
  } catch (err) {
    req.log.error({ err }, "Public API: error listing clients");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/clients/:id", requireApiKey, publicApiLimiter, requirePermission("leads", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const [client] = await db.select().from(clientsTable).where(and(eq(clientsTable.id, req.params.id as string), eq(clientsTable.userId, userId)));
    if (!client) { res.status(404).json({ error: "Not found" }); return; }
    res.json(serializeClient(client));
  } catch (err) {
    req.log.error({ err }, "Public API: error fetching client");
    res.status(500).json({ error: "Internal server error" });
  }
});

const createSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(["individual", "business"]).optional(),
  email: z.string().email().max(200).optional(),
  phone: z.string().max(40).optional(),
  address: z.string().max(300).optional(),
  city: z.string().max(120).optional(),
  province: z.string().max(2).optional(),
  postalCode: z.string().max(20).optional(),
  businessNumber: z.string().max(60).optional(),
  preferredLanguage: z.enum(["en", "fr"]).optional(),
  notes: z.string().max(2000).optional(),
});

// POST /api/v1/public/clients — creates a new client, or returns the existing
// one when name+email+phone already dedupe to a client on file (same rule
// used everywhere else a client gets attached to a quote).
router.post("/clients", requireApiKey, publicApiLimiter, requirePermission("leads", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const body = createSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Invalid parameters", details: body.error }); return; }
    const d = body.data;
    const dedupKey = clientDedupKey({ name: d.name, email: d.email, phone: d.phone });

    const [existing] = await db.select().from(clientsTable).where(and(eq(clientsTable.userId, userId), eq(clientsTable.dedupKey, dedupKey)));
    if (existing) { res.status(200).json({ client: serializeClient(existing), created: false }); return; }

    const [client] = await db
      .insert(clientsTable)
      .values({
        userId,
        name: d.name,
        type: d.type ?? (d.businessNumber ? "business" : "individual"),
        email: d.email ?? null,
        phone: d.phone ?? null,
        address: d.address ?? null,
        city: d.city ?? null,
        province: normalizeProvince(d.province) ?? null,
        postalCode: d.postalCode ?? null,
        businessNumber: d.businessNumber ?? null,
        preferredLanguage: d.preferredLanguage ?? "en",
        notes: d.notes ?? "",
        dedupKey,
      })
      .onConflictDoNothing({ target: [clientsTable.userId, clientsTable.dedupKey] })
      .returning();

    if (client) { res.status(201).json({ client: serializeClient(client), created: true }); return; }
    const [raced] = await db.select().from(clientsTable).where(and(eq(clientsTable.userId, userId), eq(clientsTable.dedupKey, dedupKey)));
    res.status(200).json({ client: serializeClient(raced!), created: false });
  } catch (err) {
    req.log.error({ err }, "Public API: error creating client");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
