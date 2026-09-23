import { Router, type Response } from "express";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import {
  db,
  businessProfilesTable,
  complianceFilingsTable,
  complianceRemindersTable,
  jobPermitsTable,
  projectsTable,
  hasFeature,
  minimumPlanFor,
  FILING_KINDS,
  PERMIT_KINDS,
  PERMIT_STATUSES,
  REMINDER_KINDS,
  REMINDER_RECURRENCES,
  type BusinessProfile,
  type ComplianceSettings,
} from "@workspace/db";
import { requireAuth, getUserId, getUserName } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { writeAudit } from "../lib/notifications.js";
import { deadlinesWithStatus, serializePermit, serializeReminder, todayFor } from "../compliance/service.js";
import { AUTHORITY_URL, T5018_URL, nextOccurrence } from "../compliance/deadlines.js";
import { loadWorksheet, worksheetCsv } from "../compliance/remittance.js";
import { loadT5018, t5018Csv } from "../compliance/t5018.js";
import { WORK_TYPES, presetsFor, suggestPermits } from "../compliance/catalog.js";

// ── Phase 87: compliance and filings ─────────────────────────────────────────
// Prepares and reminds. Nothing here files a return, sends anything to CRA,
// Revenu Québec or a province, or tells anyone what they owe beyond adding
// up their own invoices and receipts.

const router = Router();

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const toDate = (day: string) => new Date(`${day}T00:00:00Z`);
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

async function profileFor(userId: string): Promise<BusinessProfile | undefined> {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  return profile;
}

/** Compliance rides on invoicing (Pro): the worksheet is made of invoices. */
async function requireCompliance(userId: string, res: Response): Promise<BusinessProfile | null> {
  const profile = await profileFor(userId);
  if (!hasFeature(profile, "invoicing")) {
    res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: minimumPlanFor("invoicing") });
    return null;
  }
  return profile ?? null;
}

function registrations(profile: BusinessProfile | null) {
  return {
    province: profile?.province ?? null,
    gstHstNumber: profile?.gstHstNumber ?? null,
    qstNumber: profile?.qstNumber ?? null,
    pstNumber: profile?.pstNumber ?? null,
    licenceNumber: profile?.licenceNumber ?? null,
  };
}

// GET /api/compliance/overview — the filing calendar (six months back, fifteen ahead), reminders, setup.
router.get("/compliance/overview", requireAuth, requirePermission("invoicing", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const profile = await profileFor(userId);
    if (!hasFeature(profile, "invoicing")) {
      res.json({ enabled: false, requiredPlan: minimumPlanFor("invoicing") });
      return;
    }
    const today = todayFor(profile?.province);
    const deadlines = await deadlinesWithStatus(userId, profile, addDays(today, -183), addDays(today, 460));
    const reminders = await db.select().from(complianceRemindersTable).where(eq(complianceRemindersTable.userId, userId)).orderBy(asc(complianceRemindersTable.dueDate));
    res.json({
      enabled: true,
      today,
      settings: profile?.complianceSettings ?? {},
      registrations: registrations(profile ?? null),
      // Old, filed periods are history, not work: keep the unfiled late ones and everything from today on.
      deadlines: deadlines.filter((d) => d.dueDate >= today || d.state !== "filed").map((d) => ({ ...d, url: d.kind === "t5018" ? T5018_URL : AUTHORITY_URL[d.authority] })),
      reminders: reminders.map((r) => serializeReminder(r, today)),
      presets: presetsFor(profile?.province ?? null),
    });
  } catch (err) {
    req.log.error({ err }, "Error loading compliance overview");
    res.status(500).json({ error: "Internal server error" });
  }
});

const settingsSchema = z.object({
  salesTaxFrequency: z.enum(["monthly", "quarterly", "annual"]).nullable().optional(),
  fiscalYearEnd: z.string().regex(/^(0[1-9]|1[0-2])-(\d{2})$/).nullable().optional(),
  structure: z.enum(["sole_proprietor", "partnership", "corporation"]).nullable().optional(),
  instalments: z.boolean().optional(),
  pstFrequency: z.enum(["monthly", "quarterly", "semiannual", "annual"]).nullable().optional(),
  t5018: z.boolean().optional(),
});

// PUT /api/compliance/settings — how the company files.
router.put("/compliance/settings", requireAuth, requirePermission("invoicing", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const profile = await requireCompliance(userId, res);
    if (!profile) return;
    const body = settingsSchema.safeParse(req.body ?? {});
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const prev = profile.complianceSettings ?? {};
    const next: ComplianceSettings = { ...prev, ...body.data, configuredAt: prev.configuredAt ?? todayFor(profile.province) };
    await db.update(businessProfilesTable).set({ complianceSettings: next }).where(eq(businessProfilesTable.userId, userId));
    await writeAudit({ userId, actorType: "user", actorId: userId, entityType: "business_profile", entityId: userId, action: "compliance_settings_updated", diff: body.data });
    res.json({ settings: next });
  } catch (err) {
    req.log.error({ err }, "Error saving compliance settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

const filingSchema = z.object({ kind: z.enum(FILING_KINDS), periodKey: z.string().min(1).max(20), note: z.string().max(500).optional(), filedOn: z.string().regex(DAY).optional() });

// POST /api/compliance/filings — mark a derived deadline as filed (or paid).
router.post("/compliance/filings", requireAuth, requirePermission("invoicing", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    if (!(await requireCompliance(userId, res))) return;
    const body = filingSchema.safeParse(req.body ?? {});
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const filedAt = body.data.filedOn ? toDate(body.data.filedOn) : new Date();
    const values = { filedAt, filedByName: getUserName(res) || null, note: body.data.note?.trim() ?? "" };
    const [row] = await db
      .insert(complianceFilingsTable)
      .values({ userId, kind: body.data.kind, periodKey: body.data.periodKey, ...values })
      .onConflictDoUpdate({ target: [complianceFilingsTable.userId, complianceFilingsTable.kind, complianceFilingsTable.periodKey], set: values })
      .returning();
    await writeAudit({ userId, actorType: "user", actorId: userId, entityType: "compliance_filing", entityId: row!.id, action: "marked_filed", diff: body.data });
    res.status(201).json({ filing: { kind: row!.kind, periodKey: row!.periodKey, filedAt: row!.filedAt?.toISOString() ?? null, filedByName: row!.filedByName, note: row!.note } });
  } catch (err) {
    req.log.error({ err }, "Error marking filing");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/compliance/filings?kind=&periodKey= — undo "filed" (the reminder memory stays).
router.delete("/compliance/filings", requireAuth, requirePermission("invoicing", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    if (!(await requireCompliance(userId, res))) return;
    const q = z.object({ kind: z.enum(FILING_KINDS), periodKey: z.string().min(1).max(20) }).safeParse(req.query);
    if (!q.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    await db
      .update(complianceFilingsTable)
      .set({ filedAt: null, filedByName: null, note: "" })
      .where(and(eq(complianceFilingsTable.userId, userId), eq(complianceFilingsTable.kind, q.data.kind), eq(complianceFilingsTable.periodKey, q.data.periodKey)));
    await writeAudit({ userId, actorType: "user", actorId: userId, entityType: "compliance_filing", entityId: `${q.data.kind}:${q.data.periodKey}`, action: "unmarked_filed" });
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Error unmarking filing");
    res.status(500).json({ error: "Internal server error" });
  }
});

const periodQuery = z.object({ from: z.string().regex(DAY), to: z.string().regex(DAY) }).refine((q) => q.from <= q.to && Date.parse(q.to) - Date.parse(q.from) <= 400 * 86_400_000, { message: "A period is at most about a year." });

// GET /api/compliance/remittance?from=&to= — the worksheet for one period.
router.get("/compliance/remittance", requireAuth, requirePermission("invoicing", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const profile = await requireCompliance(userId, res);
    if (!profile) return;
    const q = periodQuery.safeParse(req.query);
    if (!q.success) {
      res.status(400).json({ error: "Invalid parameters", message: q.error.issues[0]?.message });
      return;
    }
    const w = await loadWorksheet(userId, profile.province, q.data.from, q.data.to);
    res.json({ ...w, province: profile.province, registrations: registrations(profile) });
  } catch (err) {
    req.log.error({ err }, "Error building remittance worksheet");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/compliance/remittance.csv?from=&to=
router.get("/compliance/remittance.csv", requireAuth, requirePermission("invoicing", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const profile = await requireCompliance(userId, res);
    if (!profile) return;
    const q = periodQuery.safeParse(req.query);
    if (!q.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    const w = await loadWorksheet(userId, profile.province, q.data.from, q.data.to);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="sales-tax-worksheet-${q.data.from}-to-${q.data.to}.csv"`);
    res.send(`\uFEFF${worksheetCsv(w)}`);
  } catch (err) {
    req.log.error({ err }, "Error exporting remittance worksheet");
    res.status(500).json({ error: "Internal server error" });
  }
});

const yearQuery = z.object({ year: z.coerce.number().int().min(2000).max(2100) });

// GET /api/compliance/t5018?year= — payments to subcontractors, by recipient.
router.get("/compliance/t5018", requireAuth, requirePermission("costs", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const profile = await requireCompliance(userId, res);
    if (!profile) return;
    const q = yearQuery.safeParse(req.query);
    if (!q.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    res.json(await loadT5018(userId, profile.province, q.data.year));
  } catch (err) {
    req.log.error({ err }, "Error building T5018 summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/compliance/t5018.csv?year=
router.get("/compliance/t5018.csv", requireAuth, requirePermission("costs", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const profile = await requireCompliance(userId, res);
    if (!profile) return;
    const q = yearQuery.safeParse(req.query);
    if (!q.success) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    const data = await loadT5018(userId, profile.province, q.data.year);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="t5018-${q.data.year}.csv"`);
    res.send(`\uFEFF${t5018Csv(data)}`);
  } catch (err) {
    req.log.error({ err }, "Error exporting T5018 summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Reminders the company sets itself ───────────────────────────────────────

const httpsUrl = z.string().url().max(500).refine((u) => /^https?:\/\//i.test(u), { message: "Links must start with http(s)://" });
const reminderSchema = z.object({
  kind: z.enum(REMINDER_KINDS).optional(),
  preset: z.string().max(40).nullable().optional(),
  title: z.string().trim().min(1).max(200),
  authority: z.string().max(200).optional(),
  reference: z.string().max(100).optional(),
  url: httpsUrl.nullable().optional(),
  dueDate: z.string().regex(DAY),
  recurrence: z.enum(REMINDER_RECURRENCES).optional(),
  remindDaysBefore: z.number().int().min(0).max(180).optional(),
  notes: z.string().max(2000).optional(),
});

async function ownedReminder(userId: string, id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return null;
  const [row] = await db.select().from(complianceRemindersTable).where(and(eq(complianceRemindersTable.id, parsed.data), eq(complianceRemindersTable.userId, userId)));
  return row ?? null;
}

// POST /api/compliance/reminders
router.post("/compliance/reminders", requireAuth, requirePermission("invoicing", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const profile = await requireCompliance(userId, res);
    if (!profile) return;
    const body = reminderSchema.safeParse(req.body ?? {});
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const count = await db.$count(complianceRemindersTable, eq(complianceRemindersTable.userId, userId));
    if (count >= 100) {
      res.status(409).json({ error: "LIMIT", message: "A company can keep up to 100 reminders." });
      return;
    }
    const d = body.data;
    const [row] = await db
      .insert(complianceRemindersTable)
      .values({ userId, kind: d.kind ?? "other", preset: d.preset ?? null, title: d.title, authority: d.authority ?? "", reference: d.reference ?? "", url: d.url ?? null, dueDate: toDate(d.dueDate), recurrence: d.recurrence ?? "annual", remindDaysBefore: d.remindDaysBefore ?? 30, notes: d.notes ?? "" })
      .returning();
    res.status(201).json({ reminder: serializeReminder(row!, todayFor(profile.province)) });
  } catch (err) {
    req.log.error({ err }, "Error creating reminder");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/compliance/reminders/:id
router.patch("/compliance/reminders/:id", requireAuth, requirePermission("invoicing", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const profile = await requireCompliance(userId, res);
    if (!profile) return;
    const reminder = await ownedReminder(userId, req.params.id as string);
    if (!reminder) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const body = reminderSchema.partial().safeParse(req.body ?? {});
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const { dueDate, ...rest } = body.data;
    const set: Partial<typeof complianceRemindersTable.$inferInsert> = { ...rest };
    if (dueDate) {
      set.dueDate = toDate(dueDate);
      set.notifiedForDue = null;
    }
    if (Object.keys(set).length === 0) {
      res.json({ reminder: serializeReminder(reminder, todayFor(profile.province)) });
      return;
    }
    const [row] = await db.update(complianceRemindersTable).set(set).where(eq(complianceRemindersTable.id, reminder.id)).returning();
    res.json({ reminder: serializeReminder(row!, todayFor(profile.province)) });
  } catch (err) {
    req.log.error({ err }, "Error updating reminder");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/compliance/reminders/:id/done — recurring ones move to the next occurrence, one-offs go.
router.post("/compliance/reminders/:id/done", requireAuth, requirePermission("invoicing", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const profile = await requireCompliance(userId, res);
    if (!profile) return;
    const reminder = await ownedReminder(userId, req.params.id as string);
    if (!reminder) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const next = nextOccurrence(reminder.dueDate.toISOString().slice(0, 10), reminder.recurrence);
    await writeAudit({ userId, actorType: "user", actorId: userId, entityType: "compliance_reminder", entityId: reminder.id, action: "reminder_done", diff: { title: reminder.title, due: reminder.dueDate.toISOString().slice(0, 10), next } });
    if (!next) {
      await db.delete(complianceRemindersTable).where(eq(complianceRemindersTable.id, reminder.id));
      res.json({ reminder: null });
      return;
    }
    const [row] = await db.update(complianceRemindersTable).set({ dueDate: toDate(next), lastDoneAt: new Date(), notifiedForDue: null }).where(eq(complianceRemindersTable.id, reminder.id)).returning();
    res.json({ reminder: serializeReminder(row!, todayFor(profile.province)) });
  } catch (err) {
    req.log.error({ err }, "Error completing reminder");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/compliance/reminders/:id
router.delete("/compliance/reminders/:id", requireAuth, requirePermission("invoicing", "full"), async (req, res) => {
  try {
    const userId = getUserId(res);
    if (!(await requireCompliance(userId, res))) return;
    const reminder = await ownedReminder(userId, req.params.id as string);
    if (!reminder) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await db.delete(complianceRemindersTable).where(eq(complianceRemindersTable.id, reminder.id));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Error deleting reminder");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Permits on a job ────────────────────────────────────────────────────────

async function ownedJob(userId: string, id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return null;
  const [job] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, parsed.data), eq(projectsTable.userId, userId)));
  return job ?? null;
}

async function requireJobs(userId: string, res: Response): Promise<BusinessProfile | null | false> {
  const profile = await profileFor(userId);
  if (!hasFeature(profile, "jobs")) {
    res.status(403).json({ error: "PLAN_REQUIRED", requiredPlan: minimumPlanFor("jobs") });
    return false;
  }
  return profile ?? null;
}

const dayOrNull = z.string().regex(DAY).nullable().optional();
const permitSchema = z.object({
  kind: z.enum(PERMIT_KINDS).optional(),
  title: z.string().trim().min(1).max(200),
  authority: z.string().max(200).optional(),
  referenceNumber: z.string().max(100).optional(),
  url: httpsUrl.nullable().optional(),
  status: z.enum(PERMIT_STATUSES).optional(),
  appliedAt: dayOrNull,
  issuedAt: dayOrNull,
  inspectionAt: z.string().datetime({ offset: true }).or(z.string().regex(DAY)).nullable().optional(),
  expiresAt: dayOrNull,
  notes: z.string().max(2000).optional(),
});

function permitValues(d: Partial<z.infer<typeof permitSchema>>): Partial<typeof jobPermitsTable.$inferInsert> {
  const v: Partial<typeof jobPermitsTable.$inferInsert> = {};
  if (d.kind !== undefined) v.kind = d.kind;
  if (d.title !== undefined) v.title = d.title;
  if (d.authority !== undefined) v.authority = d.authority;
  if (d.referenceNumber !== undefined) v.referenceNumber = d.referenceNumber;
  if (d.url !== undefined) v.url = d.url;
  if (d.notes !== undefined) v.notes = d.notes;
  if (d.appliedAt !== undefined) v.appliedAt = d.appliedAt ? toDate(d.appliedAt) : null;
  if (d.issuedAt !== undefined) v.issuedAt = d.issuedAt ? toDate(d.issuedAt) : null;
  if (d.expiresAt !== undefined) v.expiresAt = d.expiresAt ? toDate(d.expiresAt) : null;
  if (d.inspectionAt !== undefined) v.inspectionAt = d.inspectionAt ? (DAY.test(d.inspectionAt) ? toDate(d.inspectionAt) : new Date(d.inspectionAt)) : null;
  if (d.status !== undefined) {
    v.status = d.status;
    // The dates follow the status when nobody typed one, so the list reads "applied 12 Sep" without extra clicks.
    const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
    if (d.status === "applied" && d.appliedAt === undefined) v.appliedAt = today;
    if (d.status === "issued" && d.issuedAt === undefined) v.issuedAt = today;
    v.closedAt = d.status === "closed" ? today : null;
  }
  return v;
}

// GET /api/jobs/:id/permits — the list, plus suggestions for the job's province and address.
router.get("/jobs/:id/permits", requireAuth, requirePermission("jobs", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const profile = await requireJobs(userId, res);
    if (profile === false) return;
    const job = await ownedJob(userId, req.params.id as string);
    if (!job) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const rows = await db.select().from(jobPermitsTable).where(and(eq(jobPermitsTable.projectId, job.id), eq(jobPermitsTable.userId, userId))).orderBy(asc(jobPermitsTable.createdAt));
    res.json({ permits: rows.map(serializePermit), workTypes: WORK_TYPES, province: job.province ?? profile?.province ?? null });
  } catch (err) {
    req.log.error({ err }, "Error listing permits");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/jobs/:id/permits/suggest?work=basement,electrical — typical permits for that work, here.
router.get("/jobs/:id/permits/suggest", requireAuth, requirePermission("jobs", "view"), async (req, res) => {
  try {
    const userId = getUserId(res);
    const profile = await requireJobs(userId, res);
    if (profile === false) return;
    const job = await ownedJob(userId, req.params.id as string);
    if (!job) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const works = String(req.query.work ?? "").split(",").filter((w): w is (typeof WORK_TYPES)[number] => (WORK_TYPES as readonly string[]).includes(w));
    res.json({ suggestions: suggestPermits(works, job.province ?? profile?.province ?? null, job.address) });
  } catch (err) {
    req.log.error({ err }, "Error suggesting permits");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/jobs/:id/permits — one permit, or { permits: [...] } to add several suggestions at once.
router.post("/jobs/:id/permits", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    if ((await requireJobs(userId, res)) === false) return;
    const job = await ownedJob(userId, req.params.id as string);
    if (!job) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const body = z.union([z.object({ permits: z.array(permitSchema).min(1).max(12) }), permitSchema]).safeParse(req.body ?? {});
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const list = "permits" in body.data ? body.data.permits : [body.data];
    const existing = await db.$count(jobPermitsTable, eq(jobPermitsTable.projectId, job.id));
    if (existing + list.length > 30) {
      res.status(409).json({ error: "LIMIT", message: "A job can hold up to 30 permits." });
      return;
    }
    const rows = await db
      .insert(jobPermitsTable)
      .values(list.map((p) => ({ userId, projectId: job.id, title: p.title, ...permitValues(p) }) as typeof jobPermitsTable.$inferInsert))
      .returning();
    await writeAudit({ userId, actorType: "user", actorId: userId, entityType: "project", entityId: job.id, action: "permits_added", diff: { titles: rows.map((r) => r.title) } });
    res.status(201).json({ permits: rows.map(serializePermit) });
  } catch (err) {
    req.log.error({ err }, "Error adding permit");
    res.status(500).json({ error: "Internal server error" });
  }
});

async function ownedPermit(userId: string, jobId: string, permitId: string) {
  const job = await ownedJob(userId, jobId);
  const pid = z.string().uuid().safeParse(permitId);
  if (!job || !pid.success) return null;
  const [permit] = await db.select().from(jobPermitsTable).where(and(eq(jobPermitsTable.id, pid.data), eq(jobPermitsTable.projectId, job.id), eq(jobPermitsTable.userId, userId)));
  return permit ?? null;
}

// PATCH /api/jobs/:id/permits/:permitId
router.patch("/jobs/:id/permits/:permitId", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    if ((await requireJobs(userId, res)) === false) return;
    const permit = await ownedPermit(userId, req.params.id as string, req.params.permitId as string);
    if (!permit) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const body = permitSchema.partial().safeParse(req.body ?? {});
    if (!body.success) {
      res.status(400).json({ error: "Invalid parameters", details: body.error });
      return;
    }
    const set = permitValues(body.data);
    if (Object.keys(set).length === 0) {
      res.json({ permit: serializePermit(permit) });
      return;
    }
    const [row] = await db.update(jobPermitsTable).set(set).where(eq(jobPermitsTable.id, permit.id)).returning();
    if (body.data.status && body.data.status !== permit.status) {
      await writeAudit({ userId, actorType: "user", actorId: userId, entityType: "job_permit", entityId: permit.id, action: "permit_status", diff: { from: permit.status, to: body.data.status, title: permit.title } });
    }
    res.json({ permit: serializePermit(row!) });
  } catch (err) {
    req.log.error({ err }, "Error updating permit");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/jobs/:id/permits/:permitId
router.delete("/jobs/:id/permits/:permitId", requireAuth, requirePermission("jobs", "edit"), async (req, res) => {
  try {
    const userId = getUserId(res);
    if ((await requireJobs(userId, res)) === false) return;
    const permit = await ownedPermit(userId, req.params.id as string, req.params.permitId as string);
    if (!permit) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await db.delete(jobPermitsTable).where(eq(jobPermitsTable.id, permit.id));
    await writeAudit({ userId, actorType: "user", actorId: userId, entityType: "job_permit", entityId: permit.id, action: "permit_deleted", diff: { title: permit.title, status: permit.status } });
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Error deleting permit");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
