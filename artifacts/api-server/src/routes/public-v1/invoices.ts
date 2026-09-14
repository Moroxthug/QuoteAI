import { Router } from "express";
import { z } from "zod";
import { db, invoicesTable, businessProfilesTable, hasFeature, minimumPlanFor } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { requireApiKey, publicApiLimiter } from "../../middlewares/apiKeyAuth.js";
import { requirePermission } from "../../middlewares/requirePermission.js";
import { getUserId } from "../../middlewares/authMiddleware.js";
import { serializeInvoice } from "../invoices.js";
import { buildInvoiceContext, createInvoice } from "../../invoices/service.js";
import { lineFrom } from "../../invoices/math.js";

const router = Router();

async function requireInvoicing(userId: string): Promise<{ ok: true } | { ok: false; plan: string }> {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  if (hasFeature(profile, "invoicing")) return { ok: true };
  return { ok: false, plan: minimumPlanFor("invoicing") };
}

// GET /api/v1/public/invoices
router.get("/invoices", requireApiKey, publicApiLimiter, requirePermission("invoicing", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const invoices = await db.select().from(invoicesTable).where(eq(invoicesTable.userId, userId)).orderBy(desc(invoicesTable.createdAt)).limit(limit);
    res.json({ items: invoices.map((inv) => serializeInvoice(inv)) });
  } catch (err) {
    req.log.error({ err }, "Public API: error listing invoices");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/v1/public/invoices/:id
router.get("/invoices/:id", requireApiKey, publicApiLimiter, requirePermission("invoicing", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const [invoice] = await db.select().from(invoicesTable).where(and(eq(invoicesTable.id, req.params.id as string), eq(invoicesTable.userId, userId)));
    if (!invoice) { res.status(404).json({ error: "Not found" }); return; }
    res.json(serializeInvoice(invoice));
  } catch (err) {
    req.log.error({ err }, "Public API: error fetching invoice");
    res.status(500).json({ error: "Internal server error" });
  }
});

const lineSchema = z.object({ description: z.string().min(1).max(300), quantity: z.number().positive(), unitCents: z.number().int() });
const createSchema = z.object({
  projectId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  title: z.string().max(200).optional(),
  lines: z.array(lineSchema).min(1).max(60),
  dueDays: z.number().int().min(0).max(365).default(15),
  holdbackPercent: z.number().int().min(0).max(50).optional(),
  notes: z.string().max(4000).optional(),
  language: z.enum(["en", "fr"]).optional(),
  province: z.string().max(2).optional(),
});

// POST /api/v1/public/invoices — manual invoice for a job or a client, same path as the in-app "New invoice" form
router.post("/invoices", requireApiKey, publicApiLimiter, requirePermission("invoicing", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const gate = await requireInvoicing(userId);
    if (!gate.ok) { res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan }); return; }
    const body = createSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Invalid parameters", details: body.error }); return; }
    const d = body.data;
    if (!d.projectId && !d.clientId) { res.status(400).json({ error: "Invalid parameters", message: "Pick a job or a client." }); return; }
    const ctx = await buildInvoiceContext({ userId, projectId: d.projectId, clientId: d.clientId, language: d.language, province: d.province });
    if (d.projectId && !ctx.project) { res.status(404).json({ error: "Job not found" }); return; }
    if (d.clientId && !ctx.client) { res.status(404).json({ error: "Client not found" }); return; }
    const invoice = await createInvoice({
      userId,
      ctx,
      type: "manual",
      source: "manual",
      actor: "contractor",
      lines: d.lines.map((l) => lineFrom(l.description.trim(), l.unitCents, l.quantity)),
      holdbackPercent: d.holdbackPercent ?? 0,
      dueDays: d.dueDays,
      title: d.title,
      notes: d.notes,
    });
    res.status(201).json({ invoice: serializeInvoice(invoice) });
  } catch (err) {
    req.log.error({ err }, "Public API: error creating invoice");
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: "Could not create the invoice", message });
  }
});

export default router;
