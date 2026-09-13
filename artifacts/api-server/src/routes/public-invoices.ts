import { Router } from "express";
import { db, invoicesTable, invoicePaymentsTable } from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import { ipRateLimiter } from "../lib/rateLimit.js";
import { hashToken, logInvoiceEvent } from "../invoices/service.js";
import { buildInvoicePdf } from "../invoices/pdf.js";
import { renderInvoiceHtml, INVOICE_CSS } from "../invoices/render.js";
import { balanceCents } from "../invoices/math.js";

// Public, token-addressed invoice view (/i/:token). Read-only for the
// customer: see the invoice, the balance, payment instructions, download the
// PDF. Rate-limited by IP; the token is hashed before lookup.

const router = Router();
const viewLimiter = ipRateLimiter({ windowMs: 60_000, max: 60, message: "Too many requests" });

async function resolve(rawToken: string) {
  if (!rawToken || rawToken.length < 20 || rawToken.length > 200) return null;
  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.publicTokenHash, hashToken(rawToken)));
  if (!inv || inv.status === "draft") return null;
  return inv;
}

// GET /api/i/:token
router.get("/i/:token", viewLimiter, async (req, res) => {
  try {
    const inv = await resolve(req.params.token as string);
    if (!inv) { res.status(404).json({ error: "not_found" }); return; }
    const payments = await db.select().from(invoicePaymentsTable).where(eq(invoicePaymentsTable.invoiceId, inv.id)).orderBy(asc(invoicePaymentsTable.date));
    // First open by the customer flips sent → viewed (never overrides paid / overdue / void).
    if (!inv.viewedAt) {
      await db.update(invoicesTable).set({ viewedAt: new Date(), ...(inv.status === "sent" ? { status: "viewed" as const } : {}) }).where(eq(invoicesTable.id, inv.id));
      await logInvoiceEvent({ invoiceId: inv.id, type: "viewed", actor: "customer", ip: req.ip, userAgent: req.headers["user-agent"] ?? null });
      if (inv.status === "sent") inv.status = "viewed";
    }
    res.json({
      invoice: {
        id: inv.id,
        number: inv.number,
        type: inv.type,
        status: inv.status,
        language: inv.language,
        province: inv.province,
        title: inv.title,
        issueDate: inv.issueDate.toISOString(),
        dueDate: inv.dueDate.toISOString(),
        totalCents: inv.totalCents,
        paidCents: inv.paidCents,
        balanceCents: balanceCents(inv),
        companyName: inv.contractor.name,
        companyEmail: inv.contractor.email ?? null,
        companyPhone: inv.contractor.phone ?? null,
        customerName: inv.customer.name,
        paymentInstructions: inv.paymentInstructions,
        paidAt: inv.paidAt ? inv.paidAt.toISOString() : null,
      },
      html: renderInvoiceHtml(inv, payments),
      css: INVOICE_CSS,
    });
  } catch (err) {
    req.log.error({ err }, "Public invoice view failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/i/:token/pdf
router.get("/i/:token/pdf", viewLimiter, async (req, res) => {
  try {
    const inv = await resolve(req.params.token as string);
    if (!inv) { res.status(404).json({ error: "not_found" }); return; }
    const payments = await db.select().from(invoicePaymentsTable).where(eq(invoicePaymentsTable.invoiceId, inv.id)).orderBy(asc(invoicePaymentsTable.date));
    const { buffer } = await buildInvoicePdf(inv, payments);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${req.query.download ? "attachment" : "inline"}; filename="${inv.number}.pdf"`);
    res.send(buffer);
  } catch (err) {
    req.log.error({ err }, "Public invoice PDF failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
