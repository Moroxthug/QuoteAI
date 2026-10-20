import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { EXPENSE_CATEGORIES, EXPENSE_CADENCES } from "@workspace/db";
import { logger } from "../lib/logger";
import { requireAdmin } from "./admin.js";
import { parseRange, isYmd, type Bucket } from "../hq/time.js";
import { centsToDecimal, toCsv } from "../hq/csv.js";
import {
  overview, series, cohorts, customers, listExpenses, addExpense, deleteExpense, listMarketingSpend, addMarketingSpend, deleteMarketingSpend,
  readCashCents, writeCashCents, revenueExportRows, expenseExportRows, SERIES_METRICS, CUSTOMER_SORTS, type SeriesMetric, type CustomerSort,
} from "../hq/service.js";

// Owner HQ (Phase 132, docs/GROWTH-PLAN.md): owner-only analytics. Every route sits behind requireAdmin.
// The contract with the web page is at the bottom of docs/GROWTH-PLAN.md.

const router = Router();

const fail = (res: Response, err: unknown, what: string) => {
  logger.error({ err }, `Admin HQ ${what} error`);
  res.status(500).json({ error: "Internal server error" });
};

const rangeOrFail = (req: Request, res: Response) => {
  const r = parseRange({ from: req.query.from, to: req.query.to });
  if (typeof r === "string") {
    res.status(400).json({ error: r });
    return null;
  }
  return r;
};

const ymd = z.string().refine(isYmd, "must be YYYY-MM-DD");
const cents = z.number().int().positive().max(1_000_000_000_00);
const text = (max: number) => z.string().trim().min(1).max(max);
const optText = (max: number) => z.string().trim().max(max).nullish().transform((v) => (v ? v : null));
const uuid = z.string().uuid();

router.get("/admin/hq/overview", requireAdmin, async (req, res) => {
  const range = rangeOrFail(req, res);
  if (!range) return;
  try {
    res.json(await overview(range));
  } catch (err) {
    fail(res, err, "overview");
  }
});

router.get("/admin/hq/series", requireAdmin, async (req, res) => {
  const range = rangeOrFail(req, res);
  if (!range) return;
  const metric = String(req.query.metric ?? "");
  const bucket = String(req.query.bucket ?? "day");
  if (!(SERIES_METRICS as readonly string[]).includes(metric)) {
    res.status(400).json({ error: `metric must be one of ${SERIES_METRICS.join(", ")}` });
    return;
  }
  if (bucket !== "day" && bucket !== "week" && bucket !== "month") {
    res.status(400).json({ error: "bucket must be day, week or month" });
    return;
  }
  try {
    res.json(await series(metric as SeriesMetric, bucket as Bucket, range));
  } catch (err) {
    fail(res, err, "series");
  }
});

router.get("/admin/hq/cohorts", requireAdmin, async (req, res) => {
  const months = Math.min(24, Math.max(1, Math.floor(Number(req.query.months) || 12)));
  try {
    res.json(await cohorts(months));
  } catch (err) {
    fail(res, err, "cohorts");
  }
});

router.get("/admin/hq/customers", requireAdmin, async (req, res) => {
  const sort = String(req.query.sort ?? "since");
  if (!(CUSTOMER_SORTS as readonly string[]).includes(sort)) {
    res.status(400).json({ error: `sort must be one of ${CUSTOMER_SORTS.join(", ")}` });
    return;
  }
  const dir = req.query.dir === "asc" ? "asc" : "desc";
  const q = typeof req.query.q === "string" && req.query.q.trim() ? req.query.q.trim() : null;
  const limit = Math.min(500, Math.max(1, Math.floor(Number(req.query.limit) || 100)));
  const offset = Math.max(0, Math.floor(Number(req.query.offset) || 0));
  try {
    res.json(await customers({ sort: sort as CustomerSort, dir, q, limit, offset }));
  } catch (err) {
    fail(res, err, "customers");
  }
});

// ── The owner's own ledger ────────────────────────────────────────────────────

const expenseBody = z
  .object({
    name: text(120),
    category: z.enum(EXPENSE_CATEGORIES).default("other"),
    amountCents: cents,
    cadence: z.enum(EXPENSE_CADENCES),
    startsOn: ymd,
    endsOn: ymd.nullish().transform((v) => v ?? null),
    note: optText(500),
  })
  .strict()
  .refine((b) => !b.endsOn || b.endsOn >= b.startsOn, { message: "endsOn must not be before startsOn", path: ["endsOn"] });

router.get("/admin/hq/expenses", requireAdmin, async (req, res) => {
  const range = rangeOrFail(req, res);
  if (!range) return;
  try {
    res.json(await listExpenses(range.from, range.to));
  } catch (err) {
    fail(res, err, "expenses list");
  }
});

router.post("/admin/hq/expenses", requireAdmin, async (req, res) => {
  const body = expenseBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid expense", issues: body.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
    return;
  }
  try {
    const row = await addExpense(body.data);
    logger.info({ id: row.id }, "HQ expense added");
    res.status(201).json(row);
  } catch (err) {
    fail(res, err, "expense add");
  }
});

router.delete("/admin/hq/expenses/:id", requireAdmin, async (req, res) => {
  const id = uuid.safeParse(req.params.id);
  if (!id.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    if (!(await deleteExpense(id.data))) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    fail(res, err, "expense delete");
  }
});

const spendBody = z
  .object({
    channel: text(60).transform((v) => v.toLowerCase()),
    campaign: optText(80),
    spentOn: ymd,
    amountCents: cents,
    note: optText(500),
  })
  .strict();

router.get("/admin/hq/marketing-spend", requireAdmin, async (req, res) => {
  const range = rangeOrFail(req, res);
  if (!range) return;
  try {
    res.json(await listMarketingSpend(range.from, range.to));
  } catch (err) {
    fail(res, err, "marketing spend list");
  }
});

router.post("/admin/hq/marketing-spend", requireAdmin, async (req, res) => {
  const body = spendBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid marketing spend", issues: body.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
    return;
  }
  try {
    const row = await addMarketingSpend(body.data);
    logger.info({ id: row.id }, "HQ marketing spend added");
    res.status(201).json(row);
  } catch (err) {
    fail(res, err, "marketing spend add");
  }
});

router.delete("/admin/hq/marketing-spend/:id", requireAdmin, async (req, res) => {
  const id = uuid.safeParse(req.params.id);
  if (!id.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    if (!(await deleteMarketingSpend(id.data))) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    fail(res, err, "marketing spend delete");
  }
});

// ── Settings: cash in the bank ────────────────────────────────────────────────

router.get("/admin/hq/settings/cash", requireAdmin, async (_req, res) => {
  try {
    res.json(await readCashCents());
  } catch (err) {
    fail(res, err, "cash read");
  }
});

router.put("/admin/hq/settings/cash", requireAdmin, async (req, res) => {
  const body = z.object({ cashCents: z.number().int().min(0).max(1_000_000_000_00).nullable() }).strict().safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "cashCents must be a whole number of cents (0 or more), or null to clear" });
    return;
  }
  try {
    res.json(await writeCashCents(body.data.cashCents));
  } catch (err) {
    fail(res, err, "cash write");
  }
});

// ── CSV for the accountant ────────────────────────────────────────────────────

router.get("/admin/hq/export.csv", requireAdmin, async (req, res) => {
  const kind = String(req.query.kind ?? "");
  if (kind !== "revenue" && kind !== "expenses" && kind !== "customers") {
    res.status(400).json({ error: "kind must be revenue, expenses or customers" });
    return;
  }
  const range = rangeOrFail(req, res);
  if (!range) return;
  try {
    let csv: string;
    if (kind === "revenue") {
      const r = await revenueExportRows(range);
      csv = toCsv(
        ["date", "type", "company", "customer_id", "plan", "interval", "gross_cad", "tax_cad", "revenue_ex_tax_cad", "fee_cad", "currency", "provider", "reference"],
        r.map((x) => {
          const sign = x.type === "payment" ? 1 : -1; // refunds and disputes reduce revenue
          const gross = Number(x.amount_cents) * sign;
          const tax = Number(x.tax_cents) * sign;
          return [x.day, x.type, x.company, x.customer_id, x.plan, x.interval, { n: Number(centsToDecimal(gross)) }, { n: Number(centsToDecimal(tax)) }, { n: Number(centsToDecimal(gross - tax)) }, { n: Number(centsToDecimal(Number(x.fee_cents))) }, x.currency, x.provider, x.ref];
        }),
      );
    } else if (kind === "expenses") {
      const e = await expenseExportRows(range);
      csv = toCsv(
        ["record", "name_or_channel", "category", "cadence", "amount_cad", "starts_on", "ends_on", "counted_in_period_cad", "note"],
        [
          ...e.expenses.map((x) => ["expense", x.name, x.category, x.cadence, { n: Number(centsToDecimal(x.amountCents)) }, x.startsOn, x.endsOn, { n: Number(centsToDecimal(x.countedCents)) }, x.note]),
          ...e.spend.map((x) => ["marketing_spend", x.campaign ? `${x.channel} / ${x.campaign}` : x.channel, "marketing", "one_off", { n: Number(centsToDecimal(x.amountCents)) }, x.spentOn, null, { n: Number(centsToDecimal(x.amountCents)) }, x.note]),
        ],
      );
    } else {
      const lines: Array<Array<string | number | null | { n: number }>> = [];
      for (let offset = 0; ; offset += 500) {
        const page = await customers({ sort: "since", dir: "asc", q: null, limit: 500, offset });
        for (const c of page.customers) {
          lines.push([c.companyName, c.email, c.plan, c.status, c.interval, c.since, c.source, c.founding ? "yes" : "no", { n: Number(centsToDecimal(c.mtdRevenueCents)) }, c.estimated ? "estimated" : "measured", { n: Number(centsToDecimal(c.costCents)) }, c.lastActiveAt]);
        }
        if (page.customers.length < 500 || offset > 100_000) break;
      }
      csv = toCsv(["company", "email", "plan", "status", "interval", "customer_since", "source", "founding", "revenue_this_month_cad", "revenue_basis", "usage_cost_this_month_usd", "last_active_at"], lines);
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="quoteai-${kind}-${range.from}_${range.to}.csv"`);
    res.setHeader("Cache-Control", "no-store");
    res.send(`﻿${csv}`);
  } catch (err) {
    fail(res, err, "export");
  }
});

export default router;
