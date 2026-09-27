// Phase 104 (docs/MOBILE-AND-APP-PLAN.md): the dashboard home's "Needs you".
//
// What an owner has to act on was spread over five cards on the home page and
// four other pages: a blocker on site (the crew card), an e-Transfer to confirm
// and an overdue invoice (the invoice list), hours to approve (the crew card),
// a lead to call back (the follow-ups card) and a sent quote nobody answered
// (nowhere). This merges them into one list, most urgent first, each row with
// the one thing to do about it. Read-only and derived — no new source of truth.

import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
import {
  db,
  fieldReportsTable,
  hasFeature,
  invoicePaymentsTable,
  invoicesTable,
  leadsTable,
  OPEN_INVOICE_STATUSES,
  projectsTable,
  quotesTable,
  timeEntriesTable,
  type BusinessProfile,
  type InvoiceParty,
  type QuoteClientData,
} from "@workspace/db";
import { roleCan, type TeamMemberRole } from "@workspace/permissions";
import { localParts } from "../schedule/service.js";

const DAY_MS = 86_400_000;

/** A sent quote with no answer after this many days needs a person (the automatic follow-ups have had their go). */
const WAITING_AFTER_DAYS = 3;
/** …and stops being "waiting" after this many: it is cold, the quotes list has it. */
const WAITING_UNTIL_DAYS = 45;
/** No "Send a reminder" button again within this many days of the last one. */
const REMIND_AGAIN_AFTER_DAYS = 3;
/** Rows read per kind — the page shows five and a "Show all". */
const PER_KIND = 10;

type NeedsYouKind = "blocker" | "etransfer" | "overdue" | "hours" | "followup" | "waiting";

export type NeedsYouItem = {
  id: string;
  kind: NeedsYouKind;
  /** The strong line: a job, an invoice number, a lead or a client. */
  title: string;
  /** The quiet line: what the crew wrote, the customer, the quote's title. */
  subtitle: string;
  /** The date the row is about (reported, due, follow-up, sent). */
  at: string | null;
  href: string;
  amountCents?: number;
  /** overdue: days past due · waiting: days since sent. */
  days?: number;
  /** hours: entries, total hours and people. */
  count?: number;
  hours?: number;
  people?: number;
  /** followup / waiting: a number to call, when there is one. */
  phone?: string | null;
  /** overdue: whether the row's "Send a reminder" can run (role, customer email, not reminded lately). */
  canRemind?: boolean;
};

/** Most urgent first: something stopping work on site, then money, then people waiting on an answer. */
const KIND_RANK: Record<NeedsYouKind, number> = { blocker: 0, etransfer: 1, overdue: 2, hours: 3, followup: 4, waiting: 5 };

/** Orders the merged list: by kind, then within a kind the one that has waited longest (a blocker: the newest). */
export function rankNeedsYou(items: NeedsYouItem[]): NeedsYouItem[] {
  const time = (i: NeedsYouItem) => (i.at ? new Date(i.at).getTime() : 0);
  return [...items].sort((a, b) => {
    if (a.kind !== b.kind) return KIND_RANK[a.kind] - KIND_RANK[b.kind];
    if (a.kind === "overdue") return (b.days ?? 0) - (a.days ?? 0) || time(a) - time(b);
    if (a.kind === "blocker") return time(b) - time(a);
    return time(a) - time(b);
  });
}

/**
 * Days an invoice is past due. A due date is a calendar day stored as that
 * day's UTC midnight (read in Toronto it would be the evening before), so its
 * UTC date is the day; "now" is the company's local day.
 */
export function daysPastDue(dueDate: Date, now: Date, province: string | null | undefined): number {
  const due = Date.parse(`${dueDate.toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.round((Date.parse(`${localParts(now, province).day}T00:00:00Z`) - due) / DAY_MS);
}

/** Whole days between two instants, counted on the company's local calendar. */
export function localDaysBetween(earlier: Date, later: Date, province: string | null | undefined): number {
  const a = Date.parse(`${localParts(earlier, province).day}T00:00:00Z`);
  const b = Date.parse(`${localParts(later, province).day}T00:00:00Z`);
  return Math.round((b - a) / DAY_MS);
}

const clientPhone = (c: QuoteClientData | null | undefined): string | null => (c?.phone ?? "").trim() || null;

export async function needsYou(userId: string, role: TeamMemberRole, profile: BusinessProfile | undefined, now = new Date()): Promise<NeedsYouItem[]> {
  const province = profile?.province ?? null;
  const today = localParts(now, province).day;
  const items: NeedsYouItem[] = [];

  // ── On site: blockers and hours (the time-tracking tier) ───────────────────
  if (hasFeature(profile, "team_time") && roleCan(role, "jobs", "view")) {
    const blockers = await db
      .select({ id: fieldReportsTable.id, projectId: fieldReportsTable.projectId, body: fieldReportsTable.body, authorName: fieldReportsTable.authorName, createdAt: fieldReportsTable.createdAt, jobName: projectsTable.name })
      .from(fieldReportsTable)
      .innerJoin(projectsTable, eq(fieldReportsTable.projectId, projectsTable.id))
      .where(and(eq(fieldReportsTable.userId, userId), eq(fieldReportsTable.kind, "blocker"), isNull(fieldReportsTable.resolvedAt)))
      .orderBy(desc(fieldReportsTable.createdAt))
      .limit(PER_KIND);
    for (const b of blockers) {
      items.push({
        id: `blocker:${b.id}`,
        kind: "blocker",
        title: b.jobName,
        subtitle: [b.authorName, b.body].filter(Boolean).join(" — "),
        at: b.createdAt.toISOString(),
        href: `/dashboard/jobs/${b.projectId}`,
      });
    }

    if (roleCan(role, "jobs", "edit")) {
      // The same two sets the crew card approves: clocked shifts that ended, and hours typed in.
      const [hours] = await db
        .select({
          count: sql<number>`count(*)::int`,
          total: sql<string>`coalesce(sum(${timeEntriesTable.hours}), 0)`,
          people: sql<number>`count(distinct ${timeEntriesTable.workerId})::int`,
          oldest: sql<Date | null>`min(${timeEntriesTable.date})`,
        })
        .from(timeEntriesTable)
        .where(and(eq(timeEntriesTable.userId, userId), eq(timeEntriesTable.status, "submitted"), or(isNotNull(timeEntriesTable.clockOutAt), isNull(timeEntriesTable.clockInAt))));
      if (hours && hours.count > 0) {
        const oldest = hours.oldest ? new Date(hours.oldest) : null;
        items.push({
          id: "hours",
          kind: "hours",
          title: "",
          subtitle: "",
          at: oldest ? oldest.toISOString() : null,
          href: "/dashboard/team?tab=time",
          count: hours.count,
          hours: Math.round(Number(hours.total) * 100) / 100,
          people: hours.people,
        });
      }
    }
  }

  // ── Money: e-Transfers to confirm, invoices past due ───────────────────────
  if (roleCan(role, "invoicing", "view")) {
    const open = await db
      .select({
        id: invoicesTable.id,
        number: invoicesTable.number,
        status: invoicesTable.status,
        dueDate: invoicesTable.dueDate,
        totalCents: invoicesTable.totalCents,
        paidCents: invoicesTable.paidCents,
        customer: invoicesTable.customer,
        lastReminderAt: invoicesTable.lastReminderAt,
      })
      .from(invoicesTable)
      .where(
        and(
          eq(invoicesTable.userId, userId),
          isNull(invoicesTable.archivedAt),
          or(eq(invoicesTable.status, "pending_confirmation"), and(inArray(invoicesTable.status, ["sent", "viewed", "partially_paid", "overdue"]), lt(invoicesTable.dueDate, now))),
        ),
      )
      .orderBy(asc(invoicesTable.dueDate))
      .limit(PER_KIND * 2);
    const canEdit = roleCan(role, "invoicing", "edit");
    for (const inv of open) {
      const customer = inv.customer as InvoiceParty;
      const balance = Math.max(0, inv.totalCents - inv.paidCents);
      if (inv.status === "pending_confirmation") {
        items.push({ id: `etransfer:${inv.id}`, kind: "etransfer", title: inv.number, subtitle: customer?.name ?? "", at: inv.dueDate.toISOString(), href: `/dashboard/invoices/${inv.id}`, amountCents: balance });
        continue;
      }
      // Due today is not late yet: the due date is a whole local day.
      const days = daysPastDue(inv.dueDate, now, province);
      if (days <= 0) continue;
      const remindedLately = !!inv.lastReminderAt && now.getTime() - inv.lastReminderAt.getTime() < REMIND_AGAIN_AFTER_DAYS * DAY_MS;
      items.push({
        id: `overdue:${inv.id}`,
        kind: "overdue",
        title: inv.number,
        subtitle: customer?.name ?? "",
        at: inv.dueDate.toISOString(),
        href: `/dashboard/invoices/${inv.id}`,
        amountCents: balance,
        days,
        canRemind: canEdit && (customer?.email ?? "").includes("@") && !remindedLately,
      });
    }
  }

  // ── People waiting on an answer: leads to call back, quotes nobody answered ──
  if (roleCan(role, "leads", "view")) {
    // A day and a half ahead covers "today" in every Canadian zone; the local-day test is done here.
    const leads = await db
      .select({ id: leadsTable.id, name: leadsTable.name, phone: leadsTable.phone, status: leadsTable.status, nextFollowUpAt: leadsTable.nextFollowUpAt, notes: leadsTable.notes })
      .from(leadsTable)
      .where(and(eq(leadsTable.userId, userId), inArray(leadsTable.status, ["new", "contacted", "quoted"]), isNotNull(leadsTable.nextFollowUpAt), lte(leadsTable.nextFollowUpAt, new Date(now.getTime() + 1.5 * DAY_MS))))
      .orderBy(asc(leadsTable.nextFollowUpAt))
      .limit(PER_KIND * 2);
    for (const l of leads) {
      if (!l.nextFollowUpAt || localParts(l.nextFollowUpAt, province).day > today) continue;
      items.push({ id: `followup:${l.id}`, kind: "followup", title: l.name, subtitle: l.notes ?? "", at: l.nextFollowUpAt.toISOString(), href: "/dashboard/leads", phone: l.phone?.trim() || null });
    }
  }

  if (roleCan(role, "quotes", "view")) {
    // Sent, not accepted, and the automatic follow-ups are over (or off, or the client unsubscribed) — a call is what is left.
    const quotes = await db
      .select({ id: quotesTable.id, title: quotesTable.titoloPreventivoRiga1, clientData: quotesTable.clientData, sentAt: quotesTable.sentAt, totale: quotesTable.totale })
      .from(quotesTable)
      .where(
        and(
          eq(quotesTable.userId, userId),
          isNull(quotesTable.archivedAt),
          ne(quotesTable.status, "accepted"),
          isNotNull(quotesTable.sentAt),
          lte(quotesTable.sentAt, new Date(now.getTime() - WAITING_AFTER_DAYS * DAY_MS)),
          gte(quotesTable.sentAt, new Date(now.getTime() - WAITING_UNTIL_DAYS * DAY_MS)),
          or(isNull(quotesTable.nextFollowUpAt), isNotNull(quotesTable.unsubscribedAt)),
        ),
      )
      .orderBy(asc(quotesTable.sentAt))
      .limit(PER_KIND);
    for (const q of quotes) {
      const client = q.clientData as QuoteClientData | null;
      items.push({
        id: `waiting:${q.id}`,
        kind: "waiting",
        title: client?.nome?.trim() || q.title || "",
        subtitle: client?.nome?.trim() ? (q.title ?? "") : "",
        at: q.sentAt!.toISOString(),
        href: `/dashboard/quotes/${q.id}`,
        amountCents: Math.round(Number(q.totale) * 100),
        days: localDaysBetween(q.sentAt!, now, province),
        phone: clientPhone(client),
      });
    }
  }

  return rankNeedsYou(items);
}

export type TodayStats = {
  quotes: { current: number; previous: number } | null;
  won: { current: number; previous: number; valueCents: number } | null;
  /** Open invoices now, not the period's: what is owed today. */
  outstanding: { balanceCents: number; overdueCents: number; count: number } | null;
  collected: { currentCents: number; previousCents: number } | null;
};

/** The home's number strip for a period [from, to) and the one before it [prevFrom, from). Each figure is null when the role can't see its area. */
export async function todayStats(userId: string, role: TeamMemberRole, from: Date, to: Date, prevFrom: Date, now = new Date()): Promise<TodayStats> {
  const out: TodayStats = { quotes: null, won: null, outstanding: null, collected: null };

  if (roleCan(role, "quotes", "view")) {
    const inRange = (col: typeof quotesTable.createdAt | typeof quotesTable.acceptedAt, a: Date, b: Date) => sql<number>`count(*) filter (where ${col} >= ${a.toISOString()} and ${col} < ${b.toISOString()})::int`;
    const [q] = await db
      .select({
        current: inRange(quotesTable.createdAt, from, to),
        previous: inRange(quotesTable.createdAt, prevFrom, from),
        wonCurrent: inRange(quotesTable.acceptedAt, from, to),
        wonPrevious: inRange(quotesTable.acceptedAt, prevFrom, from),
        wonValue: sql<string>`coalesce(sum(${quotesTable.totale}) filter (where ${quotesTable.acceptedAt} >= ${from.toISOString()} and ${quotesTable.acceptedAt} < ${to.toISOString()}), 0)`,
      })
      .from(quotesTable)
      .where(and(eq(quotesTable.userId, userId), isNull(quotesTable.archivedAt), or(gte(quotesTable.createdAt, prevFrom), gte(quotesTable.acceptedAt, prevFrom))));
    out.quotes = { current: q?.current ?? 0, previous: q?.previous ?? 0 };
    out.won = { current: q?.wonCurrent ?? 0, previous: q?.wonPrevious ?? 0, valueCents: Math.round(Number(q?.wonValue ?? 0) * 100) };
  }

  if (roleCan(role, "invoicing", "view")) {
    const [o] = await db
      .select({
        balance: sql<string>`coalesce(sum(greatest(${invoicesTable.totalCents} - ${invoicesTable.paidCents}, 0)), 0)`,
        overdue: sql<string>`coalesce(sum(greatest(${invoicesTable.totalCents} - ${invoicesTable.paidCents}, 0)) filter (where ${invoicesTable.dueDate} < ${now.toISOString()}), 0)`,
        count: sql<number>`count(*)::int`,
      })
      .from(invoicesTable)
      .where(and(eq(invoicesTable.userId, userId), isNull(invoicesTable.archivedAt), inArray(invoicesTable.status, [...OPEN_INVOICE_STATUSES])));
    out.outstanding = { balanceCents: Number(o?.balance ?? 0), overdueCents: Number(o?.overdue ?? 0), count: o?.count ?? 0 };

    // Money in, not credit notes applied against an invoice.
    const [c] = await db
      .select({
        current: sql<string>`coalesce(sum(${invoicePaymentsTable.amountCents}) filter (where ${invoicePaymentsTable.date} >= ${from.toISOString()} and ${invoicePaymentsTable.date} < ${to.toISOString()}), 0)`,
        previous: sql<string>`coalesce(sum(${invoicePaymentsTable.amountCents}) filter (where ${invoicePaymentsTable.date} < ${from.toISOString()}), 0)`,
      })
      .from(invoicePaymentsTable)
      .where(and(eq(invoicePaymentsTable.userId, userId), isNull(invoicePaymentsTable.creditNoteId), gte(invoicePaymentsTable.date, prevFrom), lt(invoicePaymentsTable.date, to)));
    out.collected = { currentCents: Number(c?.current ?? 0), previousCents: Number(c?.previous ?? 0) };
  }

  return out;
}
