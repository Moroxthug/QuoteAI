// Phase 87 — compliance: the filing calendar with what has been marked
// filed, the company's own reminders, open permits, and the daily sweep that
// rings the bell before something is due.

import { and, asc, eq, gte, inArray, isNotNull, isNull, lte } from "drizzle-orm";
import {
  db,
  businessProfilesTable,
  complianceFilingsTable,
  complianceRemindersTable,
  hasFeature,
  jobPermitsTable,
  projectsTable,
  OPEN_PERMIT_STATUSES,
  type BusinessProfile,
  type ComplianceReminder,
  type JobPermit,
} from "@workspace/db";
import { deadlinesBetween, daysUntil, type Deadline } from "./deadlines.js";
import { localDayFor } from "../jobs/dates.js";
import { createNotification } from "../lib/notifications.js";
import { logger } from "../lib/logger.js";

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (day: string, n: number) => isoDay(new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000));

export function todayFor(province: string | null | undefined): string {
  return isoDay(localDayFor(new Date(), province));
}

export type DeadlineDto = Deadline & {
  filedAt: string | null;
  filedByName: string | null;
  note: string;
  daysLeft: number;
  state: "filed" | "overdue" | "due_soon" | "upcoming";
};

function deadlineInputs(profile: BusinessProfile | undefined | null) {
  return { province: profile?.province ?? null, settings: profile?.complianceSettings ?? {}, hasPstNumber: !!profile?.pstNumber?.trim() };
}

/** Deadlines due in [from, to], each with whether it was marked filed. */
export async function deadlinesWithStatus(userId: string, profile: BusinessProfile | undefined | null, from: string, to: string): Promise<DeadlineDto[]> {
  const list = deadlinesBetween(deadlineInputs(profile), from, to);
  if (list.length === 0) return [];
  const filings = await db.select().from(complianceFilingsTable).where(eq(complianceFilingsTable.userId, userId));
  const byKey = new Map(filings.map((f) => [`${f.kind}:${f.periodKey}`, f]));
  const today = todayFor(profile?.province);
  // Deadlines due more than a month before the company set this up were
  // handled outside QuoteAI; listing them as "146 days late" would be noise.
  const configuredAt = profile?.complianceSettings?.configuredAt;
  const cutoff = configuredAt ? addDays(configuredAt, -31) : null;
  return list.filter((d) => !cutoff || d.dueDate >= cutoff || byKey.get(d.key)?.filedAt).map((d) => {
    const f = byKey.get(d.key);
    const daysLeft = daysUntil(today, d.dueDate);
    const filed = !!f?.filedAt;
    return {
      ...d,
      filedAt: f?.filedAt?.toISOString() ?? null,
      filedByName: f?.filedByName ?? null,
      note: f?.note ?? "",
      daysLeft,
      state: filed ? "filed" : daysLeft < 0 ? "overdue" : daysLeft <= 14 ? "due_soon" : "upcoming",
    };
  });
}

export function serializeReminder(r: ComplianceReminder, today: string) {
  const due = isoDay(r.dueDate);
  const daysLeft = daysUntil(today, due);
  return {
    id: r.id,
    kind: r.kind,
    preset: r.preset,
    title: r.title,
    authority: r.authority,
    reference: r.reference,
    url: r.url,
    dueDate: due,
    recurrence: r.recurrence,
    remindDaysBefore: r.remindDaysBefore,
    notes: r.notes,
    lastDoneAt: r.lastDoneAt?.toISOString() ?? null,
    daysLeft,
    state: (daysLeft < 0 ? "overdue" : daysLeft <= Math.max(14, Math.min(r.remindDaysBefore, 30)) ? "due_soon" : "upcoming") as "overdue" | "due_soon" | "upcoming",
  };
}

export function serializePermit(p: JobPermit) {
  const day = (d: Date | null) => (d ? isoDay(d) : null);
  return {
    id: p.id,
    projectId: p.projectId,
    kind: p.kind,
    title: p.title,
    authority: p.authority,
    referenceNumber: p.referenceNumber,
    url: p.url,
    status: p.status,
    open: OPEN_PERMIT_STATUSES.includes(p.status),
    appliedAt: day(p.appliedAt),
    issuedAt: day(p.issuedAt),
    inspectionAt: p.inspectionAt?.toISOString() ?? null,
    expiresAt: day(p.expiresAt),
    closedAt: day(p.closedAt),
    notes: p.notes,
  };
}

/** Permits that keep a job from being marked complete. */
async function openPermits(projectId: string): Promise<JobPermit[]> {
  return db
    .select()
    .from(jobPermitsTable)
    .where(and(eq(jobPermitsTable.projectId, projectId), inArray(jobPermitsTable.status, [...OPEN_PERMIT_STATUSES])))
    .orderBy(asc(jobPermitsTable.createdAt));
}

/** The 409 body a completion attempt gets while permits are open, or null. */
export async function permitCompletionBlock(projectId: string) {
  const open = await openPermits(projectId);
  if (open.length === 0) return null;
  return {
    error: "PERMITS_OPEN",
    message: `This job still has ${open.length} open permit${open.length === 1 ? "" : "s"} (${open.map((p) => p.title).join(", ")}). Close them or mark them not required before completing the job.`,
    permits: open.map(serializePermit),
  };
}

// ── The agenda (Phase 85 widget) ─────────────────────────────────────────────

export type ComplianceAgendaItem = { id: string; kind: "filing" | "permit"; title: string; subtitle: string; startsAt: Date; endsAt: Date; allDay: boolean; href: string; state: "overdue" | "done" | null };

const KIND_TITLE: Record<string, { en: string; fr: string }> = {
  sales_tax: { en: "{tax} return due", fr: "Déclaration {tax} à produire" },
  sales_tax_payment: { en: "{tax} payment due", fr: "Paiement {tax} dû" },
  gst_instalment: { en: "{tax} instalment due", fr: "Acompte {tax} dû" },
  pst: { en: "{tax} return due", fr: "Déclaration {tax} à produire" },
  t5018: { en: "T5018 slips due", fr: "Feuillets T5018 à produire" },
};

function deadlineTitle(d: Pick<Deadline, "kind" | "tax">, lang: "en" | "fr"): string {
  return (KIND_TITLE[d.kind]?.[lang] ?? d.kind).replace("{tax}", d.tax);
}

export async function complianceAgenda(userId: string, from: Date, to: Date, langHint?: "en" | "fr"): Promise<ComplianceAgendaItem[]> {
  const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  if (!hasFeature(profile, "invoicing")) return [];
  const lang = langHint ?? (profile?.province === "QC" ? "fr" : "en");
  const out: ComplianceAgendaItem[] = [];
  const wholeDay = (day: string) => {
    const start = new Date(`${day}T00:00:00Z`);
    return { startsAt: start, endsAt: new Date(start.getTime() + 86_400_000), allDay: true };
  };

  for (const d of await deadlinesWithStatus(userId, profile, isoDay(from), isoDay(to))) {
    out.push({ id: `filing:${d.key}`, kind: "filing", title: deadlineTitle(d, lang), subtitle: `${d.periodStart} → ${d.periodEnd}`, ...wholeDay(d.dueDate), href: "/dashboard/compliance", state: d.state === "filed" ? "done" : d.state === "overdue" ? "overdue" : null });
  }

  const reminders = await db
    .select()
    .from(complianceRemindersTable)
    .where(and(eq(complianceRemindersTable.userId, userId), gte(complianceRemindersTable.dueDate, new Date(from.getTime() - 86_400_000)), lte(complianceRemindersTable.dueDate, to)));
  const today = todayFor(profile?.province);
  for (const r of reminders) {
    const day = isoDay(r.dueDate);
    out.push({ id: `reminder:${r.id}`, kind: "filing", title: r.title, subtitle: r.authority, ...wholeDay(day), href: "/dashboard/compliance?tab=reminders", state: day < today ? "overdue" : null });
  }

  const inspections = await db
    .select({ id: jobPermitsTable.id, title: jobPermitsTable.title, inspectionAt: jobPermitsTable.inspectionAt, projectId: jobPermitsTable.projectId, projectName: projectsTable.name })
    .from(jobPermitsTable)
    .innerJoin(projectsTable, eq(jobPermitsTable.projectId, projectsTable.id))
    .where(and(eq(jobPermitsTable.userId, userId), isNotNull(jobPermitsTable.inspectionAt), inArray(jobPermitsTable.status, ["applied", "issued"]), gte(jobPermitsTable.inspectionAt, from), lte(jobPermitsTable.inspectionAt, to)));
  for (const i of inspections) {
    const at = i.inspectionAt!;
    // A date-only inspection (stored at UTC midnight) is an all-day marker; a booked hour is one hour.
    const dateOnly = at.getUTCHours() === 0 && at.getUTCMinutes() === 0;
    out.push({
      id: `permit:${i.id}`,
      kind: "permit",
      title: lang === "fr" ? `Inspection — ${i.title}` : `Inspection — ${i.title}`,
      subtitle: i.projectName,
      ...(dateOnly ? wholeDay(isoDay(at)) : { startsAt: at, endsAt: new Date(at.getTime() + 3_600_000), allDay: false }),
      href: `/dashboard/jobs/${i.projectId}`,
      state: null,
    });
  }
  return out;
}

// ── The daily sweep ──────────────────────────────────────────────────────────

/** How many days ahead a derived filing deadline rings the bell. */
const FILING_NOTICE_DAYS = 10;

/** `onlyUserIds` scopes the sweep (tests run against a shared database and must never notify real companies). */
export async function runComplianceReminders(now = new Date(), onlyUserIds?: string[]): Promise<{ filings: number; reminders: number }> {
  let filings = 0;
  let reminders = 0;
  const profiles = onlyUserIds ? (onlyUserIds.length ? await db.select().from(businessProfilesTable).where(inArray(businessProfilesTable.userId, onlyUserIds)) : []) : await db.select().from(businessProfilesTable);
  for (const profile of profiles) {
    if (!hasFeature(profile, "invoicing")) continue;
    const s = profile.complianceSettings ?? {};
    const hasDerived = !!(s.salesTaxFrequency || s.pstFrequency || s.t5018);
    try {
      const lang = profile.province === "QC" ? "fr" : "en";
      const today = isoDay(localDayFor(now, profile.province));
      if (hasDerived) {
        const due = await deadlinesWithStatus(profile.userId, profile, today, addDays(today, FILING_NOTICE_DAYS));
        for (const d of due) {
          if (d.state === "filed") continue;
          // One notice per deadline: the row that later records "filed" also remembers it was announced.
          const [row] = await db
            .insert(complianceFilingsTable)
            .values({ userId: profile.userId, kind: d.kind, periodKey: d.periodKey, notifiedAt: now })
            .onConflictDoNothing()
            .returning({ id: complianceFilingsTable.id });
          let claimed = !!row;
          if (!claimed) {
            const updated = await db
              .update(complianceFilingsTable)
              .set({ notifiedAt: now })
              .where(and(eq(complianceFilingsTable.userId, profile.userId), eq(complianceFilingsTable.kind, d.kind), eq(complianceFilingsTable.periodKey, d.periodKey), isNull(complianceFilingsTable.notifiedAt)))
              .returning({ id: complianceFilingsTable.id });
            claimed = updated.length > 0;
          }
          if (!claimed) continue;
          await createNotification({
            userId: profile.userId,
            type: "compliance_due",
            title: `${deadlineTitle(d, lang)} — ${d.dueDate}`,
            body: lang === "fr" ? `Période du ${d.periodStart} au ${d.periodEnd}. La feuille de travail est prête dans Conformité ; vous ou votre comptable produisez la déclaration.` : `Period ${d.periodStart} to ${d.periodEnd}. The worksheet is ready under Compliance; you or your accountant file the return.`,
            link: "/dashboard/compliance",
            entityType: "compliance_filing",
            entityId: d.key,
          });
          filings += 1;
        }
      }

      const rows = await db
        .select()
        .from(complianceRemindersTable)
        .where(and(eq(complianceRemindersTable.userId, profile.userId), lte(complianceRemindersTable.dueDate, new Date(`${addDays(today, 180)}T00:00:00Z`))));
      for (const r of rows) {
        const due = isoDay(r.dueDate);
        const left = daysUntil(today, due);
        if (left > r.remindDaysBefore || left < -30) continue;
        if (r.notifiedForDue && isoDay(r.notifiedForDue) === due) continue;
        await db.update(complianceRemindersTable).set({ notifiedForDue: r.dueDate }).where(eq(complianceRemindersTable.id, r.id));
        await createNotification({
          userId: profile.userId,
          type: "compliance_due",
          title: `${r.title} — ${due}`,
          body: [r.authority, r.reference].filter(Boolean).join(" · "),
          link: "/dashboard/compliance?tab=reminders",
          entityType: "compliance_reminder",
          entityId: r.id,
        });
        reminders += 1;
      }
    } catch (err) {
      logger.error({ err, userId: profile.userId }, "Compliance reminder sweep failed for a company");
    }
  }
  return { filings, reminders };
}

