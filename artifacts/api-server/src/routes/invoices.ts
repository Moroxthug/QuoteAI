import { Router } from "express";
import { z } from "zod";
import {
  db,
  invoicesTable,
  projectsTable,
  clientsTable,
  businessProfilesTable,
  milestonesTable,
  hasFeature,
  minimumPlanFor,
  PAYMENT_METHODS,
  type Invoice,
  type InvoicePayment,
  type InvoiceEvent,
  type InvoiceLine,
} from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { requireAuth, getUserId, getUserName } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { writeAudit } from "../lib/notifications.js";
import { userRateLimiter } from "../lib/rateLimit.js";
import {
  loadInvoice,
  buildInvoiceContext,
  createInvoice,
  repriceDraft,
  sendInvoice,
  recordPayment,
  removePayment,
  voidInvoice,
  createCreditNote,
  invoicePdfBuffer,
  invoicesForUser,
  invoicesForProject,
  draftDepositInvoice,
  draftMilestoneInvoice,
  draftFinalInvoice,
  draftHoldbackReleaseInvoice,
  logInvoiceEvent,
  invoiceToken,
  publicInvoiceUrl,
  projectInvoiceTotals,
} from "../invoices/service.js";
import { arAging, balanceCents, addDays, REMINDER_AFTER_DAYS, lineFrom } from "../invoices/math.js";
import { renderInvoiceHtml, INVOICE_CSS } from "../invoices/render.js";
import { sendInvoiceReminderEmail } from "../lib/emailInvoices.js";

const router = Router();
const sendLimiter = userRateLimiter({ windowMs: 60 * 60_000, max: 120, message: "Too many emails sent this hour" });

// ── Helpers ──────────────────────────────────────────────────────────────────

async function requireInvoicing(userId: string): Promise<{ ok: true } | { ok: false; plan: string }> {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  if (hasFeature(profile, "invoicing")) return { ok: true };
  return { ok: false, plan: minimumPlanFor("invoicing") };
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export function serializeInvoice(inv: Invoice, extra: { projectName?: string | null; clientName?: string | null } = {}) {
  return {
    id: inv.id,
    number: inv.number,
    type: inv.type,
    status: inv.status,
    source: inv.source,
    language: inv.language,
    province: inv.province,
    title: inv.title,
    projectId: inv.projectId,
    projectName: extra.projectName ?? null,
    clientId: inv.clientId,
    clientName: extra.clientName ?? inv.customer.name ?? null,
    contractId: inv.contractId,
    milestoneId: inv.milestoneId,
    paymentTermId: inv.paymentTermId,
    paymentTermLabel: inv.paymentTermLabel,
    creditNoteForId: inv.creditNoteForId,
    issueDate: inv.issueDate.toISOString(),
    dueDate: inv.dueDate.toISOString(),
    scheduledFor: iso(inv.scheduledFor),
    contractor: inv.contractor,
    customer: inv.customer,
    siteAddress: inv.siteAddress,
    lines: inv.lines,
    subtotalCents: inv.subtotalCents,
    holdbackPercent: inv.holdbackPercent,
    holdbackCents: inv.holdbackCents,
    taxableCents: inv.taxableCents,
    taxLines: inv.taxLines,
    taxCents: inv.taxCents,
    totalCents: inv.totalCents,
    paidCents: inv.paidCents,
    balanceCents: balanceCents(inv),
    notes: inv.notes,
    paymentInstructions: inv.paymentInstructions,
    hasPdf: !!inv.pdfUrl,
    sentAt: iso(inv.sentAt),
    viewedAt: iso(inv.viewedAt),
    paidAt: iso(inv.paidAt),
    voidedAt: iso(inv.voidedAt),
    voidReason: inv.voidReason,
    autoSendAt: iso(inv.autoSendAt),
    reminderCount: inv.reminderCount,
    lastReminderAt: iso(inv.lastReminderAt),
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
    archivedAt: iso(inv.archivedAt),
  };
}

function serializePayment(p: InvoicePayment) {
  return { id: p.id, date: p.date.toISOString(), amountCents: p.amountCents, method: p.method, reference: p.reference, note: p.note, creditNoteId: p.creditNoteId, createdAt: p.createdAt.toISOString() };
}

function serializeEvent(e: InvoiceEvent) {
  return { id: e.id, type: e.type, actor: e.actor, detail: e.detail, createdAt: e.createdAt.toISOString() };
}

async function namesFor(invoices: Invoice[]) {
  const projectIds = [...new Set(invoices.map((i) => i.projectId).filter((x): x is string => !!x))];
  const clientIds = [...new Set(invoices.map((i) => i.clientId).filter((x): x is string => !!x))];
  const [projects, clients] = await Promise.all([
    projectIds.length ? db.select({ id: projectsTable.id, name: projectsTable.name }).from(projectsTable).where(inArray(projectsTable.id, projectIds)) : Promise.resolve([] as { id: string; name: string }[]),
    clientIds.length ? db.select({ id: clientsTable.id, name: clientsTable.name }).from(clientsTable).where(inArray(clientsTable.id, clientIds)) : Promise.resolve([] as { id: string; name: string }[]),
  ]);
  return { projectName: new Map(projects.map((p) => [p.id, p.name])), clientName: new Map(clients.map((c) => [c.id, c.name])) };
}

const lineSchema = z.object({ description: z.string().min(1).max(500), quantity: z.number().min(0).max(1_000_000).default(1), unitCents: z.number().int().min(-100_000_000).max(100_000_000) });

function toLines(input: z.infer<typeof lineSchema>[]): InvoiceLine[] {
  return input.map((l) => lineFrom(l.description.trim(), l.unitCents, l.quantity));
}

function fail(res: import("express").Response, err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : String(err);
  const known: Record<string, [number, string]> = {
    CUSTOMER_EMAIL_MISSING: [400, "The customer has no email address. Add one on the client record first."],
    PAYMENTS_EXIST: [400, "This invoice has payments. Remove them or issue a credit note instead."],
  };
  const hit = known[message];
  if (hit) { res.status(hit[0]).json({ error: message, message: hit[1] }); return; }
  if (message === "Invoice not found") { res.status(404).json({ error: "Not found" }); return; }
  res.status(400).json({ error: fallback, message });
}

// ── List & aging ─────────────────────────────────────────────────────────────

// GET /api/invoices
router.get("/invoices", requireAuth, requirePermission("invoicing", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const gate = await requireInvoicing(userId);
    if (!gate.ok) { res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan }); return; }
    const invoices = await invoicesForUser(userId);
    const names = await namesFor(invoices);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const paidThisMonth = invoices.filter((i) => i.status === "paid" && i.paidAt && i.paidAt >= monthStart && i.type !== "credit_note").reduce((s, i) => s + i.totalCents, 0);
    res.json({
      items: invoices.map((i) => serializeInvoice(i, { projectName: i.projectId ? names.projectName.get(i.projectId) ?? null : null, clientName: i.clientId ? names.clientName.get(i.clientId) ?? i.customer.name : i.customer.name })),
      aging: arAging(invoices, now),
      stats: {
        drafts: invoices.filter((i) => i.status === "draft").length,
        outstandingCents: invoices.filter((i) => ["sent", "viewed", "partially_paid", "overdue"].includes(i.status)).reduce((s, i) => s + balanceCents(i), 0),
        overdueCents: invoices.filter((i) => i.status === "overdue").reduce((s, i) => s + balanceCents(i), 0),
        overdueCount: invoices.filter((i) => i.status === "overdue").length,
        paidThisMonthCents: paidThisMonth,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Error listing invoices");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/invoices/clients — real client records (the legacy /api/clients list is derived from quotes)
router.get("/invoices/clients", requireAuth, requirePermission("invoicing", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const rows = await db.select({ id: clientsTable.id, name: clientsTable.name, email: clientsTable.email, province: clientsTable.province }).from(clientsTable).where(eq(clientsTable.userId, userId)).orderBy(clientsTable.name).limit(500);
    res.json({ items: rows });
  } catch (err) {
    req.log.error({ err }, "Error listing clients for invoicing");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/invoices/:id
router.get("/invoices/:id", requireAuth, requirePermission("invoicing", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const loaded = await loadInvoice(req.params.id as string);
    if (!loaded || loaded.invoice.userId !== userId) { res.status(404).json({ error: "Not found" }); return; }
    const names = await namesFor([loaded.invoice]);
    const inv = loaded.invoice;
    let publicUrl: string | null = null;
    if (inv.status !== "draft") {
      try { publicUrl = publicInvoiceUrl(invoiceToken(inv)); } catch { publicUrl = null; }
    }
    res.json({
      invoice: serializeInvoice(inv, { projectName: inv.projectId ? names.projectName.get(inv.projectId) ?? null : null, clientName: inv.clientId ? names.clientName.get(inv.clientId) ?? null : null }),
      payments: loaded.payments.map(serializePayment),
      events: loaded.events.map(serializeEvent),
      html: renderInvoiceHtml(inv, loaded.payments),
      css: INVOICE_CSS,
      publicUrl,
      reminderDays: REMINDER_AFTER_DAYS,
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching invoice");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Create (manual) ──────────────────────────────────────────────────────────

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

// POST /api/invoices — manual invoice for a job or a client
router.post("/invoices", requireAuth, requirePermission("invoicing", "edit"), async (req, res) => {
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
      lines: toLines(d.lines),
      holdbackPercent: d.holdbackPercent ?? 0,
      dueDays: d.dueDays,
      title: d.title,
      notes: d.notes,
    });
    res.status(201).json({ invoice: serializeInvoice(invoice) });
  } catch (err) {
    req.log.error({ err }, "Error creating invoice");
    fail(res, err, "Could not create the invoice");
  }
});

// POST /api/jobs/:id/invoices — create the invoice for a schedule term / the final / the holdback release
router.post("/jobs/:id/invoices", requireAuth, requirePermission("invoicing", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const gate = await requireInvoicing(userId);
    if (!gate.ok) { res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan }); return; }
    const body = z.object({ kind: z.enum(["deposit", "term", "final", "holdback_release"]), paymentTermId: z.string().optional(), milestoneId: z.string().uuid().optional() }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Invalid parameters", details: body.error }); return; }
    const [project] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, req.params.id as string), eq(projectsTable.userId, userId)));
    if (!project) { res.status(404).json({ error: "Not found" }); return; }
    const ctx = await buildInvoiceContext({ userId, projectId: project.id });
    const d = body.data;
    let out: { invoice: Invoice; created: boolean } | null = null;
    if (d.kind === "deposit") {
      if (!ctx.contract) { res.status(400).json({ error: "NO_CONTRACT", message: "This job has no signed contract; create a manual invoice instead." }); return; }
      out = await draftDepositInvoice({ contract: ctx.contract, projectId: project.id, source: "manual", actor: "contractor" });
    } else if (d.kind === "term") {
      const ms = d.milestoneId
        ? (await db.select().from(milestonesTable).where(and(eq(milestonesTable.id, d.milestoneId), eq(milestonesTable.projectId, project.id))))[0]
        : d.paymentTermId
          ? (await db.select().from(milestonesTable).where(and(eq(milestonesTable.projectId, project.id), eq(milestonesTable.paymentTermId, d.paymentTermId))))[0]
          : undefined;
      if (!ms) { res.status(404).json({ error: "Milestone not found for that payment term" }); return; }
      out = await draftMilestoneInvoice({ milestone: ms, source: "manual", actor: "contractor" });
    } else if (d.kind === "final") {
      out = await draftFinalInvoice({ project, source: "manual", actor: "contractor" });
    } else {
      out = await draftHoldbackReleaseInvoice({ project, source: "manual", actor: "contractor" });
    }
    if (!out) { res.status(400).json({ error: "NOTHING_TO_INVOICE", message: "Nothing left to invoice for that item." }); return; }
    res.status(out.created ? 201 : 200).json({ invoice: serializeInvoice(out.invoice), created: out.created });
  } catch (err) {
    req.log.error({ err }, "Error creating job invoice");
    fail(res, err, "Could not create the invoice");
  }
});

// GET /api/jobs/:id/invoices
router.get("/jobs/:id/invoices", requireAuth, requirePermission("invoicing", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const [project] = await db.select({ id: projectsTable.id }).from(projectsTable).where(and(eq(projectsTable.id, req.params.id as string), eq(projectsTable.userId, userId)));
    if (!project) { res.status(404).json({ error: "Not found" }); return; }
    const invoices = await invoicesForProject(project.id);
    res.json({ items: invoices.map((i) => serializeInvoice(i)), totals: projectInvoiceTotals(invoices) });
  } catch (err) {
    req.log.error({ err }, "Error listing job invoices");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Edit draft ───────────────────────────────────────────────────────────────

const editSchema = z.object({
  title: z.string().max(200).optional(),
  lines: z.array(lineSchema).min(1).max(60).optional(),
  dueDays: z.number().int().min(0).max(365).optional(),
  holdbackPercent: z.number().int().min(0).max(50).optional(),
  notes: z.string().max(4000).optional(),
  language: z.enum(["en", "fr"]).optional(),
  customerEmail: z.string().email().max(200).optional(),
  customerName: z.string().min(1).max(200).optional(),
  paymentNote: z.string().max(500).nullable().optional(),
});

// PUT /api/invoices/:id — drafts only; sent invoices are immutable
router.put("/invoices/:id", requireAuth, requirePermission("invoicing", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const loaded = await loadInvoice(req.params.id as string);
    if (!loaded || loaded.invoice.userId !== userId) { res.status(404).json({ error: "Not found" }); return; }
    const inv = loaded.invoice;
    if (inv.status !== "draft") { res.status(400).json({ error: "IMMUTABLE", message: "Sent invoices cannot be edited. Void it and issue a new one, or add a credit note." }); return; }
    const body = editSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Invalid parameters", details: body.error }); return; }
    const d = body.data;
    const updates: Partial<typeof invoicesTable.$inferInsert> = { autoSendAt: null }; // any edit cancels the review timer ("if not touched")
    if (d.title !== undefined) updates.title = d.title;
    if (d.notes !== undefined) updates.notes = d.notes;
    if (d.language !== undefined) updates.language = d.language;
    if (d.dueDays !== undefined) updates.dueDate = addDays(inv.issueDate, d.dueDays);
    if (d.customerEmail !== undefined || d.customerName !== undefined) updates.customer = { ...inv.customer, ...(d.customerEmail !== undefined && { email: d.customerEmail }), ...(d.customerName !== undefined && { name: d.customerName }) };
    if (d.paymentNote !== undefined) updates.paymentInstructions = { ...inv.paymentInstructions, note: d.paymentNote };
    if (d.lines !== undefined || d.holdbackPercent !== undefined) {
      const lines = d.lines ? toLines(d.lines) : inv.lines;
      Object.assign(updates, { lines }, repriceDraft(inv, { lines, holdbackPercent: d.holdbackPercent }));
    }
    const [updated] = await db.update(invoicesTable).set(updates).where(eq(invoicesTable.id, inv.id)).returning();
    await logInvoiceEvent({ invoiceId: inv.id, type: "edited", actor: "contractor", detail: { fields: Object.keys(d) } });
    await writeAudit({ userId, actorType: "user", actorId: userId, entityType: "invoice", entityId: inv.id, action: "updated", diff: d });
    const fresh = (await loadInvoice(inv.id))!;
    res.json({ invoice: serializeInvoice(updated!), html: renderInvoiceHtml(fresh.invoice, fresh.payments) });
  } catch (err) {
    req.log.error({ err }, "Error updating invoice");
    fail(res, err, "Could not update the invoice");
  }
});

// DELETE /api/invoices/:id — drafts only (numbers are never reused; the gap is the audit trail)
router.delete("/invoices/:id", requireAuth, requirePermission("invoicing", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const loaded = await loadInvoice(req.params.id as string);
    if (!loaded || loaded.invoice.userId !== userId) { res.status(404).json({ error: "Not found" }); return; }
    if (loaded.invoice.status !== "draft") { res.status(400).json({ error: "IMMUTABLE", message: "Only drafts can be deleted. Void the invoice instead." }); return; }
    await voidInvoice({ invoiceId: loaded.invoice.id, userId, reason: "Draft discarded" });
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting invoice");
    fail(res, err, "Could not delete the invoice");
  }
});

// POST /api/invoices/:id/archive
router.post("/invoices/:id/archive", requireAuth, requirePermission("invoicing", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const loaded = await loadInvoice(req.params.id as string);
    if (!loaded || loaded.invoice.userId !== userId) { res.status(404).json({ error: "Not found" }); return; }
    const [updated] = await db
      .update(invoicesTable)
      .set({ archivedAt: new Date(), archivedByName: getUserName(res) })
      .where(eq(invoicesTable.id, loaded.invoice.id))
      .returning();
    res.json({ invoice: serializeInvoice(updated) });
  } catch (err) {
    req.log.error({ err }, "Error archiving invoice");
    fail(res, err, "Could not archive the invoice");
  }
});

// POST /api/invoices/:id/restore
router.post("/invoices/:id/restore", requireAuth, requirePermission("invoicing", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const loaded = await loadInvoice(req.params.id as string);
    if (!loaded || loaded.invoice.userId !== userId) { res.status(404).json({ error: "Not found" }); return; }
    const [updated] = await db
      .update(invoicesTable)
      .set({ archivedAt: null, archivedByName: null })
      .where(eq(invoicesTable.id, loaded.invoice.id))
      .returning();
    res.json({ invoice: serializeInvoice(updated) });
  } catch (err) {
    req.log.error({ err }, "Error restoring invoice");
    fail(res, err, "Could not restore the invoice");
  }
});

// ── Send / remind / PDF ──────────────────────────────────────────────────────

// POST /api/invoices/:id/send
router.post("/invoices/:id/send", requireAuth, requirePermission("invoicing", "edit"), sendLimiter, async (req, res) => {
  try {
    const userId = getUserId(res);
    const gate = await requireInvoicing(userId);
    if (!gate.ok) { res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan }); return; }
    const body = z.object({ message: z.string().max(2000).optional(), customerEmail: z.string().email().optional() }).safeParse(req.body ?? {});
    if (!body.success) { res.status(400).json({ error: "Invalid parameters" }); return; }
    if (body.data.customerEmail) {
      const loaded = await loadInvoice(req.params.id as string);
      if (loaded && loaded.invoice.userId === userId && loaded.invoice.status === "draft") {
        await db.update(invoicesTable).set({ customer: { ...loaded.invoice.customer, email: body.data.customerEmail } }).where(eq(invoicesTable.id, loaded.invoice.id));
      }
    }
    const { invoice, resend } = await sendInvoice({ invoiceId: req.params.id as string, userId, actor: "contractor", message: body.data.message, ip: req.ip, userAgent: req.headers["user-agent"] });
    res.json({ invoice: serializeInvoice(invoice), resend });
  } catch (err) {
    req.log.error({ err }, "Error sending invoice");
    fail(res, err, "Could not send the invoice");
  }
});

// POST /api/invoices/:id/remind — manual reminder (does not count against the automatic 3/7/14 schedule)
router.post("/invoices/:id/remind", requireAuth, requirePermission("invoicing", "edit"), sendLimiter, async (req, res) => {
  try {
    const userId = getUserId(res);
    const loaded = await loadInvoice(req.params.id as string);
    if (!loaded || loaded.invoice.userId !== userId) { res.status(404).json({ error: "Not found" }); return; }
    const inv = loaded.invoice;
    if (!["sent", "viewed", "partially_paid", "overdue"].includes(inv.status)) { res.status(400).json({ error: "NOT_OPEN", message: "Only open invoices can be reminded." }); return; }
    const toEmail = (inv.customer.email ?? "").trim();
    if (!toEmail.includes("@")) { res.status(400).json({ error: "CUSTOMER_EMAIL_MISSING", message: "The customer has no email address." }); return; }
    const { buffer } = await invoicePdfBuffer(inv.id);
    const [senderProfile] = await db.select({ email: businessProfilesTable.email }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, inv.userId));
    await sendInvoiceReminderEmail({
      toEmail,
      userId: inv.userId,
      customerName: inv.customer.name,
      companyName: inv.contractor.name,
      number: inv.number,
      totalCents: inv.totalCents,
      balanceCents: balanceCents(inv),
      dueDate: inv.dueDate,
      publicUrl: publicInvoiceUrl(invoiceToken(inv)),
      language: inv.language as "en" | "fr",
      etransferEmail: inv.paymentInstructions.etransferEmail ?? null,
      daysOverdue: Math.max(0, Math.floor((Date.now() - inv.dueDate.getTime()) / 86_400_000)),
      pdfBuffer: buffer,
      replyTo: senderProfile?.email ?? null,
    });
    await db.update(invoicesTable).set({ lastReminderAt: new Date() }).where(eq(invoicesTable.id, inv.id));
    await logInvoiceEvent({ invoiceId: inv.id, type: "reminder_sent", actor: "contractor", detail: { manual: true }, ip: req.ip });
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error sending reminder");
    fail(res, err, "Could not send the reminder");
  }
});

// GET /api/invoices/:id/pdf
router.get("/invoices/:id/pdf", requireAuth, requirePermission("invoicing", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const loaded = await loadInvoice(req.params.id as string);
    if (!loaded || loaded.invoice.userId !== userId) { res.status(404).json({ error: "Not found" }); return; }
    const { buffer, filename } = await invoicePdfBuffer(loaded.invoice.id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${req.query.download ? "attachment" : "inline"}; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    req.log.error({ err }, "Error rendering invoice PDF");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Payments ─────────────────────────────────────────────────────────────────

// POST /api/invoices/:id/payments
router.post("/invoices/:id/payments", requireAuth, requirePermission("invoicing", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const body = z
      .object({
        amountCents: z.number().int().min(1).max(1_000_000_000),
        method: z.enum(PAYMENT_METHODS.filter((m) => m !== "credit_note") as [string, ...string[]]).default("etransfer"),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        reference: z.string().max(200).optional(),
        note: z.string().max(1000).optional(),
        sendReceipt: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Invalid parameters", details: body.error }); return; }
    const d = body.data;
    const { invoice, payment } = await recordPayment({
      invoiceId: req.params.id as string,
      userId,
      amountCents: d.amountCents,
      method: d.method as (typeof PAYMENT_METHODS)[number],
      date: d.date ? new Date(`${d.date}T12:00:00`) : undefined,
      reference: d.reference,
      note: d.note,
      sendReceipt: d.sendReceipt,
      ip: req.ip,
    });
    res.status(201).json({ invoice: serializeInvoice(invoice), payment: serializePayment(payment) });
  } catch (err) {
    req.log.error({ err }, "Error recording payment");
    fail(res, err, "Could not record the payment");
  }
});

// DELETE /api/invoices/:id/payments/:pid
router.delete("/invoices/:id/payments/:pid", requireAuth, requirePermission("invoicing", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const invoice = await removePayment({ invoiceId: req.params.id as string, paymentId: req.params.pid as string, userId });
    res.json({ invoice: serializeInvoice(invoice) });
  } catch (err) {
    req.log.error({ err }, "Error removing payment");
    fail(res, err, "Could not remove the payment");
  }
});

// ── Void & credit note ───────────────────────────────────────────────────────

// POST /api/invoices/:id/void
router.post("/invoices/:id/void", requireAuth, requirePermission("invoicing", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const body = z.object({ reason: z.string().max(500).optional() }).safeParse(req.body ?? {});
    if (!body.success) { res.status(400).json({ error: "Invalid parameters" }); return; }
    const invoice = await voidInvoice({ invoiceId: req.params.id as string, userId, reason: body.data.reason, ip: req.ip });
    res.json({ invoice: serializeInvoice(invoice) });
  } catch (err) {
    req.log.error({ err }, "Error voiding invoice");
    fail(res, err, "Could not void the invoice");
  }
});

// POST /api/invoices/:id/credit-note
router.post("/invoices/:id/credit-note", requireAuth, requirePermission("invoicing", "full"), sendLimiter, async (req, res) => {
  try {
    const userId = getUserId(res);
    const gate = await requireInvoicing(userId);
    if (!gate.ok) { res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: gate.plan }); return; }
    const body = z.object({ amountCents: z.number().int().min(1), description: z.string().min(1).max(500), reason: z.string().max(1000).optional(), send: z.boolean().optional() }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Invalid parameters", details: body.error }); return; }
    const { creditNote, original } = await createCreditNote({ invoiceId: req.params.id as string, userId, ...body.data, ip: req.ip });
    res.status(201).json({ creditNote: serializeInvoice(creditNote), invoice: serializeInvoice(original) });
  } catch (err) {
    req.log.error({ err }, "Error issuing credit note");
    fail(res, err, "Could not issue the credit note");
  }
});

export default router;
