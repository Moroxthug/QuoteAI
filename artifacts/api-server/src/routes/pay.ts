import { Router, type Response } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import {
  db,
  businessProfilesTable,
  collaboratorsTable,
  payAllowancesTable,
  projectsTable,
  timeEntriesTable,
  hasFeature,
  minimumPlanFor,
  ALLOWANCE_KINDS,
  EARNING_KINDS,
  HOLIDAY_PAY_METHODS,
  PAY_EXPORT_FORMATS,
  PAY_FREQUENCIES,
  type PaySettings,
} from "@workspace/db";
import { requireAuth, getUserId, getUserName } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { writeAudit } from "../lib/notifications.js";
import { todayFor } from "../compliance/service.js";
import { addDays, holidaysBetween, periodContaining, PAY_PRESETS, PROVINCE_HOLIDAY_RULES, PROVINCE_OVERTIME, DEFAULT_EARNING_CODES } from "../pay/rules.js";
import { buildExport, defaultPeriod, deleteAllowance, payPeriodReport, paySettingsFor, recomputeHorizon, recomputeSince, recordExport, reviewAllowance, syncAllowanceCost } from "../pay/service.js";

// ── Phase 89: /dashboard/pay ─────────────────────────────────────────────────
// The pay period worksheet (straight time, overtime, holiday pay, travel and
// per diem per employee), labour by job, and the file for the payroll
// provider. Wages, so the office's: costs:full (owner, admin, office), and the
// plan that has time tracking (team_time, Elite).

const router = Router();
const dateRe = /^\d{4}-\d{2}-\d{2}$/;

async function requirePay(userId: string, res: Response): Promise<boolean> {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  if (!hasFeature(profile, "team_time")) {
    res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: minimumPlanFor("team_time") });
    return false;
  }
  return true;
}

const fail = (res: Response, err: unknown, log: { error: (o: object, m: string) => void }, what: string) => {
  log.error({ err }, what);
  res.status(500).json({ error: "Internal server error" });
};

async function settingsPayload(userId: string) {
  const { raw, effective, province } = await paySettingsFor(userId);
  const today = todayFor(province);
  const year = today.slice(0, 4);
  return {
    settings: raw,
    effective,
    provinceDefaults: { overtime: PROVINCE_OVERTIME[effective.province], holidays: PROVINCE_HOLIDAY_RULES[effective.province], earningCodes: DEFAULT_EARNING_CODES },
    // Phase 89b: the trade presets for this province.
    presets: Object.entries(PAY_PRESETS)
      .filter(([, p]) => p.province === effective.province)
      .map(([key, p]) => ({ key, overtime: p.overtime, holidays: { ...PROVINCE_HOLIDAY_RULES[effective.province]!, ...p.holidays } })),
    // This year's and next year's, with the company's own changes applied — the settings list them to add or remove.
    holidays: holidaysBetween(effective.province, `${year}-01-01`, `${Number(year) + 1}-12-31`, raw),
    provinceHolidays: holidaysBetween(effective.province, `${year}-01-01`, `${Number(year) + 1}-12-31`),
    today,
  };
}

// GET /api/pay/settings
router.get("/pay/settings", requireAuth, requirePermission("costs", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
    if (!hasFeature(profile, "team_time")) {
      res.json({ enabled: false, requiredPlan: minimumPlanFor("team_time") });
      return;
    }
    res.json({ enabled: true, ...(await settingsPayload(userId)) });
  } catch (err) {
    fail(res, err, req.log, "Error loading pay settings");
  }
});

const hours = z.number().min(1).max(24 * 7 * 12).nullable();
const SettingsBody = z.object({
  frequency: z.enum(PAY_FREQUENCIES).optional(),
  anchorDate: z.string().regex(dateRe).optional(),
  weekStartsOn: z.number().int().min(0).max(6).optional(),
  overtime: z
    .object({ dailyHours: hours, dailyDoubleHours: hours, weeklyHours: hours, multiplier: z.number().min(1).max(3), doubleMultiplier: z.number().min(1).max(4) })
    .refine((o) => o.dailyDoubleHours == null || o.dailyHours == null || o.dailyDoubleHours > o.dailyHours, { message: "Double time has to start after overtime" })
    .nullable()
    .optional(),
  averaging: z.object({ weeks: z.number().int().min(2).max(12), startDate: z.string().regex(dateRe) }).nullable().optional(),
  holidays: z
    .object({
      method: z.enum(HOLIDAY_PAY_METHODS).optional(),
      workedMultiplier: z.number().min(1).max(3).optional(),
      minDaysWorked: z.number().int().min(0).max(30).optional(),
      minEmployedDays: z.number().int().min(0).max(365).optional(),
      percent: z.number().min(0).max(20).optional(),
      includeOvertime: z.boolean().optional(),
      includeVacationPay: z.boolean().optional(),
      substituteWeekend: z.boolean().optional(),
      added: z.array(z.object({ date: z.string().regex(dateRe), name: z.string().trim().min(1).max(80) })).max(30).optional(),
      removed: z.array(z.string().regex(dateRe)).max(60).optional(),
    })
    .optional(),
  allowances: z.object({ kmRateCents: z.number().int().min(0).max(1000).optional(), perDiemCents: z.number().int().min(0).max(100_000).optional() }).optional(),
  exportFormat: z.enum(PAY_EXPORT_FORMATS).optional(),
  earningCodes: z.record(z.enum(EARNING_KINDS), z.string().trim().max(30)).optional(),
  vacationPayPercent: z.number().min(0).max(20).nullable().optional(),
  preset: z.enum(Object.keys(PAY_PRESETS) as [string, ...string[]]).nullable().optional(),
});

// PUT /api/pay/settings — replaces the settings; hours from the pay period before the current one on are re-split under the new rules.
router.put("/pay/settings", requireAuth, requirePermission("costs", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    if (!(await requirePay(userId, res))) return;
    const body = SettingsBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", message: body.error.issues[0]?.message, details: body.error });
      return;
    }
    const next = body.data as PaySettings;
    await db.update(businessProfilesTable).set({ paySettings: next }).where(eq(businessProfilesTable.userId, userId));
    const { effective, province } = await paySettingsFor(userId);
    const since = recomputeHorizon(todayFor(province), effective);
    const recomputed = await recomputeSince(userId, since);
    await writeAudit({ userId, actorType: "user", actorId: userId, entityType: "pay_settings", entityId: userId, action: "updated", diff: { recomputed, since } });
    res.json({ enabled: true, ...(await settingsPayload(userId)), recomputed, recomputedSince: since });
  } catch (err) {
    fail(res, err, req.log, "Error saving pay settings");
  }
});

// GET /api/pay/period?date=YYYY-MM-DD — the pay period that day falls in (default: the one that ended last)
router.get("/pay/period", requireAuth, requirePermission("costs", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    if (!(await requirePay(userId, res))) return;
    const q = z.object({ date: z.string().regex(dateRe).optional() }).safeParse(req.query);
    if (!q.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    const { effective, province } = await paySettingsFor(userId);
    const day = q.data.date ?? defaultPeriod(todayFor(province), effective).start;
    const report = await payPeriodReport(userId, day);
    res.json({ ...report, previousStart: periodContaining(addDays(report.period.start, -1), effective).start, nextStart: addDays(report.period.end, 1) });
  } catch (err) {
    fail(res, err, req.log, "Error building the pay period");
  }
});

// GET /api/pay/export.csv?date=&format= — the file for the payroll provider; records who exported what
router.get("/pay/export.csv", requireAuth, requirePermission("costs", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    if (!(await requirePay(userId, res))) return;
    const q = z.object({ date: z.string().regex(dateRe), format: z.enum(PAY_EXPORT_FORMATS).optional() }).safeParse(req.query);
    if (!q.success) {
      res.status(400).json({ error: "date (YYYY-MM-DD) is required" });
      return;
    }
    const report = await payPeriodReport(userId, q.data.date);
    const format = q.data.format ?? report.settings.exportFormat;
    const file = await buildExport(userId, report, format);
    await recordExport(userId, report, format, getUserName(res) || null);
    await writeAudit({ userId, actorType: "user", actorId: userId, entityType: "pay_export", entityId: userId, action: "exported", diff: { period: report.period.start, format, employees: report.employees.length } });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    res.send(file.body);
  } catch (err) {
    fail(res, err, req.log, "Error exporting the pay period");
  }
});

// ── Travel and per diem ──────────────────────────────────────────────────────

const AllowanceBody = z.object({
  workerId: z.string().uuid(),
  date: z.string().regex(dateRe),
  kind: z.enum(ALLOWANCE_KINDS),
  quantity: z.number().positive().max(10_000),
  /** Defaults to the company's km rate / per diem. Required for "other". */
  rateCents: z.number().int().min(0).max(1_000_000).optional(),
  projectId: z.string().uuid().nullable().optional(),
  taxable: z.boolean().optional(),
  note: z.string().max(300).optional(),
});

// POST /api/pay/allowances
router.post("/pay/allowances", requireAuth, requirePermission("costs", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    if (!(await requirePay(userId, res))) return;
    const body = AllowanceBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const d = body.data;
    const [worker] = await db.select().from(collaboratorsTable).where(and(eq(collaboratorsTable.id, d.workerId), eq(collaboratorsTable.userId, userId)));
    if (!worker) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (worker.workerType !== "employee") {
      res.status(400).json({ error: "NOT_AN_EMPLOYEE", message: "A subcontractor bills travel on their own invoice — log it as a cost on the job." });
      return;
    }
    if (d.projectId) {
      const [p] = await db.select({ id: projectsTable.id }).from(projectsTable).where(and(eq(projectsTable.id, d.projectId), eq(projectsTable.userId, userId)));
      if (!p) {
        res.status(404).json({ error: "Not found" });
        return;
      }
    }
    const { effective } = await paySettingsFor(userId);
    const rate = d.rateCents ?? (d.kind === "mileage" ? effective.allowances.kmRateCents : d.kind === "per_diem" ? effective.allowances.perDiemCents : undefined);
    if (rate == null) {
      res.status(400).json({ error: "RATE_REQUIRED", message: "Give the amount for this line." });
      return;
    }
    const quantity = d.kind === "other" ? 1 : d.quantity;
    const [a] = await db
      .insert(payAllowancesTable)
      .values({
        userId,
        workerId: worker.id,
        projectId: d.projectId ?? null,
        date: d.date,
        kind: d.kind,
        quantity: quantity.toFixed(2),
        rateCents: rate,
        amountCents: Math.round(quantity * rate),
        taxable: d.taxable ?? d.kind === "other",
        note: d.note ?? "",
        createdByUserId: userId,
        status: "approved",
        enteredBy: "office",
      })
      .returning();
    await syncAllowanceCost(a!, worker.name);
    res.status(201).json({ allowance: { id: a!.id, amountCents: a!.amountCents } });
  } catch (err) {
    fail(res, err, req.log, "Error adding an allowance");
  }
});

// POST /api/pay/allowances/:id/review — { decision: approved | rejected, reason? } — a line the crew sent from the site
router.post("/pay/allowances/:id/review", requireAuth, requirePermission("costs", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    if (!(await requirePay(userId, res))) return;
    const body = z.object({ decision: z.enum(["approved", "rejected"]), reason: z.string().trim().max(300).optional() }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    const [a] = await db.select().from(payAllowancesTable).where(and(eq(payAllowancesTable.id, req.params.id as string), eq(payAllowancesTable.userId, userId)));
    if (!a) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (a.status !== "submitted") {
      res.status(409).json({ error: "ALREADY_REVIEWED", message: "This line has already been reviewed." });
      return;
    }
    const updated = await reviewAllowance(a, body.data.decision, getUserName(res) || null, body.data.reason ?? null);
    await writeAudit({ userId, actorType: "user", actorId: userId, entityType: "pay_allowance", entityId: a.id, action: body.data.decision, diff: { workerId: a.workerId, kind: a.kind, quantity: Number(a.quantity), amountCents: a.amountCents } });
    res.json({ allowance: { id: updated.id, status: updated.status } });
  } catch (err) {
    fail(res, err, req.log, "Error reviewing an allowance");
  }
});

// DELETE /api/pay/allowances/:id — and its cost on the job
router.delete("/pay/allowances/:id", requireAuth, requirePermission("costs", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const [a] = await db.select().from(payAllowancesTable).where(and(eq(payAllowancesTable.id, req.params.id as string), eq(payAllowancesTable.userId, userId)));
    if (!a) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await deleteAllowance(a);
    res.json({ success: true });
  } catch (err) {
    fail(res, err, req.log, "Error deleting an allowance");
  }
});

// GET /api/pay/workers — employees and their payroll numbers, for the settings table
router.get("/pay/workers", requireAuth, requirePermission("costs", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    if (!(await requirePay(userId, res))) return;
    const workers = await db.select().from(collaboratorsTable).where(eq(collaboratorsTable.userId, userId));
    const withHours = new Set((await db.selectDistinct({ id: timeEntriesTable.workerId }).from(timeEntriesTable).where(eq(timeEntriesTable.userId, userId))).map((r) => r.id));
    res.json({
      workers: workers
        .filter((w) => w.active || withHours.has(w.id))
        .map((w) => ({ id: w.id, name: w.name, workerType: w.workerType, payrollId: w.payrollId, active: w.active, hourlyRateCents: w.hourlyRate }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    });
  } catch (err) {
    fail(res, err, req.log, "Error listing workers for pay");
  }
});

export default router;
