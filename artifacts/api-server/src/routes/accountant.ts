import { Router, type Response } from "express";
import { z } from "zod";
import { and, asc, eq, gte, lte, ne, notInArray } from "drizzle-orm";
import {
  db,
  accountantCommentsTable,
  authUsersTable,
  booksClosesTable,
  businessProfilesTable,
  costEntriesTable,
  flinksConnectionsTable,
  flinksTransactionsTable,
  hasFeature,
  invoicePaymentsTable,
  invoicesTable,
  minimumPlanFor,
  payExportsTable,
  timeEntriesTable,
  type BusinessProfile,
} from "@workspace/db";
import { requireAuth, getUserId, getUserName, getActorRole, getActorUserId } from "../middlewares/authMiddleware.js";
import { requirePermission, roleCan } from "../middlewares/requirePermission.js";
import { isMonth } from "../books/close.js";
import { dayOf } from "../compliance/remittance.js";
import { todayFor } from "../compliance/service.js";
import { periodContaining, addDays } from "../pay/rules.js";
import { paySettingsFor } from "../pay/service.js";
import { createNotification } from "../lib/notifications.js";
import { payrollSummaryCsv } from "./team.js";

// ── Pocket 127.3: the accountant's view of the books (AccountantView) ───────────
// The accountant is a company member with the read-only `accountant` role. This router gathers what the board shows for one month of books
// (how finished each part is), the two files that have no other read-only route, and the comment thread. Everything else the screen shows
// (sales tax, deadlines, the tax worksheet) comes from the compliance routes, which already answer a reader.

const router = Router();

async function profileFor(userId: string): Promise<BusinessProfile | undefined> {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  return profile;
}

const shiftMonth = (month: string, by: number): string => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const i = y * 12 + (m - 1) + by;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
};

function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const first = `${month}-01`;
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  // Pad a day each side in SQL and settle the company's local day in JS (as the tax worksheet does).
  return { first, last, from: new Date(Date.UTC(y, m - 1, 0)), to: new Date(Date.UTC(y, m, 1, 23, 59, 59)) };
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const money = (c: number) => (c / 100).toFixed(2);

/** The cost sources that are purchases (labour, equipment and allowances are not receipts). */
const NOT_PURCHASE = ["time_entry", "equipment", "allowance"] as const;
/** An expense of this size or more needs its receipt attached. */
const RECEIPT_FROM_CENTS = 3000;

// GET /api/accountant/overview?month=YYYY-MM — who is looking, the months, and how finished each part of the month is.
router.get("/accountant/overview", requireAuth, requirePermission("invoicing", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const profile = await profileFor(userId);
    if (!hasFeature(profile, "invoicing")) {
      res.json({ enabled: false, requiredPlan: minimumPlanFor("invoicing") });
      return;
    }
    const province = profile?.province ?? null;
    const today = todayFor(province);
    const thisMonth = today.slice(0, 7);
    const q = z.object({ month: z.string().refine(isMonth).optional() }).safeParse(req.query);
    const month = q.success && q.data.month && q.data.month <= thisMonth ? q.data.month : shiftMonth(thisMonth, -1);
    const { first, last, from, to } = monthBounds(month);
    const inMonth = (d: Date) => {
      const day = dayOf(d, province);
      return day >= first && day <= last;
    };

    const [owner] = await db.select({ name: authUsersTable.name }).from(authUsersTable).where(eq(authUsersTable.id, userId));
    const closes = await db.select().from(booksClosesTable).where(eq(booksClosesTable.userId, userId));
    const closeOf = (m: string) => closes.find((c) => c.month === m);
    const months = [-3, -2, -1, 0].map((d) => shiftMonth(thisMonth, d)).map((m) => {
      const c = closeOf(m);
      return { month: m, closed: c ? { at: c.closedAt.toISOString(), by: c.closedByName } : null };
    });

    // Bank lines (only when a bank is connected).
    const [flinks] = await db.select({ userId: flinksConnectionsTable.userId }).from(flinksConnectionsTable).where(eq(flinksConnectionsTable.userId, userId));
    let bank: { total: number; matched: number } | null = null;
    if (flinks) {
      const lines = (await db.select().from(flinksTransactionsTable).where(and(eq(flinksTransactionsTable.userId, userId), gte(flinksTransactionsTable.date, from), lte(flinksTransactionsTable.date, to)))).filter((l) => inMonth(l.date));
      const open = lines.filter((l) => l.matchStatus === "unmatched" || (l.matchStatus === "matched" && !l.matchedCostEntryId && !l.matchedInvoicePaymentId)).length;
      bank = { total: lines.length, matched: lines.length - open };
    }

    // Receipts: purchases of $30 or more, and how many have their receipt attached.
    const costs = (await db.select({ date: costEntriesTable.date, totalCents: costEntriesTable.totalCents, sourceDocumentId: costEntriesTable.sourceDocumentId }).from(costEntriesTable).where(and(eq(costEntriesTable.userId, userId), notInArray(costEntriesTable.source, [...NOT_PURCHASE]), gte(costEntriesTable.date, from), lte(costEntriesTable.date, to)))).filter((c) => inMonth(c.date) && c.totalCents >= RECEIPT_FROM_CENTS);
    const receipts = { total: costs.length, attached: costs.filter((c) => !!c.sourceDocumentId).length };

    // Invoices dated in the month: how many have been issued (not a draft), and for how much.
    const inv = (await db.select({ status: invoicesTable.status, issueDate: invoicesTable.issueDate, totalCents: invoicesTable.totalCents }).from(invoicesTable).where(and(eq(invoicesTable.userId, userId), ne(invoicesTable.status, "void"), gte(invoicesTable.issueDate, from), lte(invoicesTable.issueDate, to)))).filter((i) => inMonth(i.issueDate));
    const issued = inv.filter((i) => i.status !== "draft");
    const invoices = { total: inv.length, issued: issued.length, issuedCents: issued.reduce((s, i) => s + i.totalCents, 0) };

    // Payroll: the pay periods that end in the month, and which of them were exported.
    let payroll: { periods: { start: string; end: string; exported: boolean }[] } | null = null;
    const exports = await db.select({ periodStart: payExportsTable.periodStart }).from(payExportsTable).where(eq(payExportsTable.userId, userId));
    const [anyTime] = await db.select({ id: timeEntriesTable.id }).from(timeEntriesTable).where(eq(timeEntriesTable.userId, userId)).limit(1);
    if (exports.length > 0 || anyTime) {
      const { effective } = await paySettingsFor(userId);
      const done = new Set(exports.map((e) => String(e.periodStart)));
      const periods: { start: string; end: string; exported: boolean }[] = [];
      let p = periodContaining(last, effective);
      for (let guard = 0; guard < 6 && p.end >= first; guard++) {
        if (p.end <= last) periods.push({ ...p, exported: done.has(p.start) });
        p = periodContaining(addDays(p.start, -1), effective);
      }
      payroll = { periods: periods.reverse() };
    }

    res.json({
      enabled: true,
      today,
      company: { name: profile?.companyName ?? "", ownerName: owner?.name ?? "" },
      you: { name: getUserName(res), role: getActorRole(res) },
      fiscalYearEnd: profile?.complianceSettings?.fiscalYearEnd ?? null,
      province,
      month,
      months,
      bank,
      receipts,
      invoices,
      payroll,
    });
  } catch (err) {
    req.log.error({ err }, "Error loading the accountant overview");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/accountant/export.csv?kind=transactions|payroll&month=YYYY-MM — the files that have no read-only route of their own.
router.get("/accountant/export.csv", requireAuth, requirePermission("invoicing", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const profile = await profileFor(userId);
    if (!hasFeature(profile, "invoicing")) {
      res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: minimumPlanFor("invoicing") });
      return;
    }
    const q = z.object({ kind: z.enum(["transactions", "payroll"]), month: z.string().refine(isMonth) }).safeParse(req.query);
    if (!q.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    const province = profile?.province ?? null;
    const { month, kind } = q.data;
    const { first, last, from, to } = monthBounds(month);
    const inMonth = (d: Date) => {
      const day = dayOf(d, province);
      return day >= first && day <= last;
    };
    let csv: string;
    if (kind === "payroll") {
      if (!roleCan(getActorRole(res), "costs", "view")) {
        res.status(403).json({ error: "FORBIDDEN" });
        return;
      }
      csv = await payrollSummaryCsv(userId, first, last);
    } else {
      const rows: { day: string; source: string; description: string; cents: number; state: string }[] = [];
      // A cost or payment a bank line was matched to is that line already: listing both would count it twice.
      const onBank = { costs: new Set<string>(), payments: new Set<string>() };
      const [flinks] = await db.select({ userId: flinksConnectionsTable.userId }).from(flinksConnectionsTable).where(eq(flinksConnectionsTable.userId, userId));
      if (flinks) {
        const lines = await db.select().from(flinksTransactionsTable).where(and(eq(flinksTransactionsTable.userId, userId), gte(flinksTransactionsTable.date, from), lte(flinksTransactionsTable.date, to)));
        for (const l of lines) {
          if (l.matchedCostEntryId) onBank.costs.add(l.matchedCostEntryId);
          if (l.matchedInvoicePaymentId) onBank.payments.add(l.matchedInvoicePaymentId);
        }
        for (const l of lines) if (inMonth(l.date)) rows.push({ day: dayOf(l.date, province), source: "Bank", description: l.description, cents: l.amountCents, state: l.matchStatus });
      }
      const costs = await db.select().from(costEntriesTable).where(and(eq(costEntriesTable.userId, userId), notInArray(costEntriesTable.source, [...NOT_PURCHASE]), gte(costEntriesTable.date, from), lte(costEntriesTable.date, to)));
      for (const c of costs) if (inMonth(c.date) && !onBank.costs.has(c.id)) rows.push({ day: dayOf(c.date, province), source: "Cost", description: [c.vendor, c.description].filter(Boolean).join(" · "), cents: -c.totalCents, state: c.status + (c.sourceDocumentId ? ", receipt" : "") });
      const pays = await db.select({ id: invoicePaymentsTable.id, date: invoicePaymentsTable.date, amountCents: invoicePaymentsTable.amountCents, method: invoicePaymentsTable.method, reference: invoicePaymentsTable.reference, number: invoicesTable.number }).from(invoicePaymentsTable).innerJoin(invoicesTable, eq(invoicesTable.id, invoicePaymentsTable.invoiceId)).where(and(eq(invoicePaymentsTable.userId, userId), gte(invoicePaymentsTable.date, from), lte(invoicePaymentsTable.date, to)));
      for (const p of pays) if (inMonth(p.date) && !onBank.payments.has(p.id)) rows.push({ day: dayOf(p.date, province), source: "Payment", description: `${p.number} · ${p.method}${p.reference ? ` · ${p.reference}` : ""}`, cents: p.amountCents, state: "recorded" });
      rows.sort((a, b) => (a.day === b.day ? a.source.localeCompare(b.source) : a.day < b.day ? -1 : 1));
      const lines = [["Date", "Source", "Description", "Amount (CAD)", "State"].map(csvCell).join(",")];
      for (const r of rows) lines.push([r.day, r.source, r.description, money(r.cents), r.state].map(csvCell).join(","));
      csv = `﻿${lines.join("\r\n")}`;
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${kind === "payroll" ? "payroll-summary" : "transactions"}-${month}.csv"`);
    res.send(csv);
  } catch (err) {
    req.log.error({ err }, "Error exporting for the accountant");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Comments ─────────────────────────────────────────────────────────────────

const serializeComment = (c: typeof accountantCommentsTable.$inferSelect, actorId: string) => ({
  id: c.id,
  month: c.month,
  authorName: c.authorName,
  authorRole: c.authorRole,
  body: c.body,
  at: c.createdAt.toISOString(),
  mine: c.authorUserId === actorId,
});

/** The accountant and the people who run the books can write; anyone else with view access can only read. */
function canWrite(res: Response): boolean {
  const role = getActorRole(res);
  return role === "accountant" || roleCan(role, "invoicing", "full");
}

// GET /api/accountant/comments?month=YYYY-MM
router.get("/accountant/comments", requireAuth, requirePermission("invoicing", "view"), async (req, res) => {
  try {
    const q = z.object({ month: z.string().refine(isMonth) }).safeParse(req.query);
    if (!q.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    const rows = await db.select().from(accountantCommentsTable).where(and(eq(accountantCommentsTable.userId, getUserId(res)), eq(accountantCommentsTable.month, q.data.month))).orderBy(asc(accountantCommentsTable.createdAt)).limit(200);
    res.json({ items: rows.map((r) => serializeComment(r, getActorUserId(res))), canWrite: canWrite(res) });
  } catch (err) {
    req.log.error({ err }, "Error listing accountant comments");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/accountant/comments { month, body }
router.post("/accountant/comments", requireAuth, requirePermission("invoicing", "view"), async (req, res) => {
  try {
    if (!canWrite(res)) {
      res.status(403).json({ error: "FORBIDDEN", message: "Your role can read this thread but not write in it." });
      return;
    }
    const body = z.object({ month: z.string().refine(isMonth), body: z.string().trim().min(1).max(2000) }).safeParse(req.body ?? {});
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    const userId = getUserId(res);
    const actorId = getActorUserId(res);
    const role = getActorRole(res);
    const [row] = await db.insert(accountantCommentsTable).values({ userId, month: body.data.month, authorUserId: actorId, authorName: getUserName(res), authorRole: role, body: body.data.body }).returning();
    // The company hears about the accountant's comment (the bell and, for the ones worth it, the phone).
    if (role === "accountant" && actorId !== userId) {
      await createNotification({ userId, type: "accountant_comment", title: `${getUserName(res) || "Your accountant"} commented on ${body.data.month}`, body: body.data.body.slice(0, 200), link: "/dashboard/books", entityType: "accountant_comment", entityId: row!.id });
    }
    res.status(201).json({ comment: serializeComment(row!, actorId) });
  } catch (err) {
    req.log.error({ err }, "Error adding an accountant comment");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
