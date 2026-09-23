// Phase 85 — one agenda out of five separate things.
//
// "What is happening today?" was, until now, five reads on four pages: the
// schedule board for blocks, the job page for milestones, the invoice list for
// what is due, the quotes list for follow-ups, and someone's phone for the
// rest of their life. This merges them into one ordered list for a window,
// which the dashboard widget renders and anything else can reuse.
//
// Everything here is read-only and derived — no new source of truth.

import { and, asc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import {
  db,
  businessProfilesTable,
  calendarExternalEventsTable,
  collaboratorsTable,
  hasFeature,
  invoicesTable,
  milestonesTable,
  projectsTable,
  quotesTable,
  scheduleBlocksTable,
} from "@workspace/db";

const AGENDA_KINDS = ["block", "milestone", "invoice", "followup", "external"] as const;
type AgendaKind = (typeof AGENDA_KINDS)[number];

export type AgendaEntry = {
  id: string;
  kind: AgendaKind;
  title: string;
  /** Second line in the widget: the job, the client, the worker, the calendar. */
  subtitle: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  /** Where clicking it goes, inside the dashboard. Null for external events. */
  href: string | null;
  /** External events only: the event in its own calendar. */
  externalUrl?: string | null;
  /** Invoice entries carry the amount so the widget can show it without a second read. */
  amountCents?: number | null;
  /** `overdue` (invoice past due), `done` (completed milestone), or null. */
  state?: "overdue" | "done" | null;
  source?: "google" | "outlook" | "ics";
};

const iso = (d: Date) => d.toISOString();
/** A date-only value (milestone, invoice due date) becomes that whole local day. */
const wholeDay = (d: Date): { start: Date; end: Date } => {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  return { start, end: new Date(start.getTime() + 86_400_000) };
};

export type AgendaOptions = {
  /** Include the mirrored personal-calendar events (Elite + connected). */
  includeExternal?: boolean;
  limit?: number;
};

export async function buildAgenda(userId: string, from: Date, to: Date, opts: AgendaOptions = {}): Promise<AgendaEntry[]> {
  const limit = opts.limit ?? 500;
  const entries: AgendaEntry[] = [];

  // ── Schedule blocks (who is where) ─────────────────────────────────────────
  const blocks = await db
    .select({
      id: scheduleBlocksTable.id,
      title: scheduleBlocksTable.title,
      startsAt: scheduleBlocksTable.startsAt,
      endsAt: scheduleBlocksTable.endsAt,
      allDay: scheduleBlocksTable.allDay,
      projectId: scheduleBlocksTable.projectId,
      projectName: projectsTable.name,
      workerName: collaboratorsTable.name,
    })
    .from(scheduleBlocksTable)
    .leftJoin(projectsTable, eq(scheduleBlocksTable.projectId, projectsTable.id))
    .leftJoin(collaboratorsTable, eq(scheduleBlocksTable.collaboratorId, collaboratorsTable.id))
    .where(and(eq(scheduleBlocksTable.userId, userId), lte(scheduleBlocksTable.startsAt, to), gte(scheduleBlocksTable.endsAt, from)))
    .orderBy(asc(scheduleBlocksTable.startsAt))
    .limit(limit);

  for (const b of blocks) {
    entries.push({
      id: `block:${b.id}`,
      kind: "block",
      title: b.title || b.projectName || "Block",
      subtitle: [b.workerName, b.projectName && b.title ? b.projectName : null].filter(Boolean).join(" · "),
      startsAt: iso(b.startsAt),
      endsAt: iso(b.endsAt),
      allDay: b.allDay,
      href: b.projectId ? `/dashboard/jobs/${b.projectId}` : "/dashboard/schedule",
    });
  }

  // ── Job milestones (what is due on site) ───────────────────────────────────
  const milestones = await db
    .select({
      id: milestonesTable.id,
      title: milestonesTable.title,
      status: milestonesTable.status,
      plannedStart: milestonesTable.plannedStart,
      plannedEnd: milestonesTable.plannedEnd,
      projectId: milestonesTable.projectId,
      projectName: projectsTable.name,
    })
    .from(milestonesTable)
    .innerJoin(projectsTable, eq(milestonesTable.projectId, projectsTable.id))
    .where(
      and(
        eq(projectsTable.userId, userId),
        inArray(projectsTable.status, ["planning", "active"]),
        lte(milestonesTable.plannedStart, to),
        gte(sql`coalesce(${milestonesTable.plannedEnd}, ${milestonesTable.plannedStart})`, from),
      ),
    )
    .orderBy(asc(milestonesTable.plannedStart))
    .limit(limit);

  for (const m of milestones) {
    if (!m.plannedStart) continue;
    const start = wholeDay(m.plannedStart).start;
    const end = wholeDay(m.plannedEnd ?? m.plannedStart).end;
    entries.push({
      id: `milestone:${m.id}`,
      kind: "milestone",
      title: m.title,
      subtitle: m.projectName,
      startsAt: iso(start),
      endsAt: iso(end),
      allDay: true,
      href: `/dashboard/jobs/${m.projectId}`,
      state: m.status === "completed" ? "done" : null,
    });
  }

  // ── Invoices due (what is owed to the company) ─────────────────────────────
  const invoices = await db
    .select({
      id: invoicesTable.id,
      number: invoicesTable.number,
      dueDate: invoicesTable.dueDate,
      status: invoicesTable.status,
      totalCents: invoicesTable.totalCents,
      paidCents: invoicesTable.paidCents,
      customer: invoicesTable.customer,
    })
    .from(invoicesTable)
    .where(
      and(
        eq(invoicesTable.userId, userId),
        inArray(invoicesTable.status, ["sent", "overdue", "partially_paid"]),
        gte(invoicesTable.dueDate, from),
        lte(invoicesTable.dueDate, to),
      ),
    )
    .orderBy(asc(invoicesTable.dueDate))
    .limit(limit);

  const now = new Date();
  for (const inv of invoices) {
    const { start, end } = wholeDay(inv.dueDate);
    const customer = (inv.customer as { name?: string } | null)?.name ?? "";
    entries.push({
      id: `invoice:${inv.id}`,
      kind: "invoice",
      title: inv.number,
      subtitle: customer,
      startsAt: iso(start),
      endsAt: iso(end),
      allDay: true,
      href: `/dashboard/invoices/${inv.id}`,
      amountCents: Math.max(0, inv.totalCents - inv.paidCents),
      state: inv.dueDate < now ? "overdue" : null,
    });
  }

  // ── Quote follow-ups (what to chase) ───────────────────────────────────────
  const followups = await db
    .select({
      id: quotesTable.id,
      title: quotesTable.titoloPreventivoRiga1,
      number: quotesTable.numeroPreventivoData,
      followUpAt: quotesTable.nextFollowUpAt,
      clientData: quotesTable.clientData,
    })
    .from(quotesTable)
    .where(
      and(
        eq(quotesTable.userId, userId),
        ne(quotesTable.status, "accepted"),
        gte(quotesTable.nextFollowUpAt, from),
        lte(quotesTable.nextFollowUpAt, to),
      ),
    )
    .orderBy(asc(quotesTable.nextFollowUpAt))
    .limit(limit);

  for (const q of followups) {
    if (!q.followUpAt) continue;
    const { start, end } = wholeDay(q.followUpAt);
    const client = (q.clientData as { nome?: string } | null)?.nome ?? "";
    entries.push({
      id: `followup:${q.id}`,
      kind: "followup",
      title: q.title || q.number || "Quote",
      subtitle: client,
      startsAt: iso(start),
      endsAt: iso(end),
      allDay: true,
      href: `/dashboard/quotes/${q.id}`,
    });
  }

  // ── The rest of their life (Elite, and only what they connected) ───────────
  if (opts.includeExternal) {
    const [profile] = await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
    if (profile && hasFeature(profile, "calendar_sync")) {
      const external = await db
        .select()
        .from(calendarExternalEventsTable)
        .where(
          and(
            eq(calendarExternalEventsTable.userId, userId),
            eq(calendarExternalEventsTable.isOurs, false),
            lte(calendarExternalEventsTable.startsAt, to),
            gte(calendarExternalEventsTable.endsAt, from),
          ),
        )
        .orderBy(asc(calendarExternalEventsTable.startsAt))
        .limit(limit);

      for (const e of external) {
        entries.push({
          id: `external:${e.id}`,
          kind: "external",
          title: e.title,
          subtitle: e.location,
          startsAt: iso(e.startsAt),
          endsAt: iso(e.endsAt),
          allDay: e.allDay,
          href: null,
          externalUrl: e.htmlLink,
          source: e.source,
        });
      }
    }
  }

  entries.sort((a, b) => {
    if (a.startsAt !== b.startsAt) return a.startsAt < b.startsAt ? -1 : 1;
    // Within a day: all-day markers first, then timed events.
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return a.title.localeCompare(b.title);
  });
  return entries.slice(0, limit);
}

/**
 * The same schedule, shaped for publishing as .ics — blocks and milestones
 * only. Invoices and follow-ups are QuoteAI's own admin, not something a
 * person wants mixed into their phone calendar.
 */
export async function publishableSchedule(userId: string, from: Date, to: Date) {
  const agenda = await buildAgenda(userId, from, to, { includeExternal: false, limit: 750 });
  return agenda
    .filter((e) => e.kind === "block" || e.kind === "milestone")
    .map((e) => ({
      uid: e.id.replace(":", "-"),
      title: e.subtitle ? `${e.title} — ${e.subtitle}` : e.title,
      startsAt: new Date(e.startsAt),
      endsAt: new Date(e.endsAt),
      allDay: e.allDay,
    }));
}
