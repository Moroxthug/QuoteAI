// Pocket 128.1: the company assistant. It looks at the books and suggests (a reminder for a late invoice, a nudge for a quote nobody answered, a
// supplier order for what is running low), waits for a yes, does it, and writes down what it did so it can be undone. How much it may do alone is
// the company's Permissions (assistant_settings). The pure parts are in companyRules.ts.
import { createHash } from "node:crypto";
import { and, asc, desc, eq, gte, inArray, isNull, lt, ne, notInArray, or, sql } from "drizzle-orm";
import {
  assistantActivityTable,
  assistantProposalsTable,
  assistantSettingsTable,
  assistantSuggestionsTable,
  businessProfilesTable,
  clientsTable,
  costEntriesTable,
  db,
  hasFeature,
  inventoryItemsTable,
  invoicesTable,
  projectsTable,
  quotesTable,
  scheduleBlocksTable,
  suppliersTable,
  supplierOrdersTable,
  usageEventsTable,
  type ActivityUndoData,
  type AssistantActivityRow,
  type AssistantActivityUndo,
  type AssistantSettings,
  type AssistantSuggestion,
  type BusinessProfile,
  type SuggestionPayload,
} from "@workspace/db";
import { balanceCents } from "../invoices/math.js";
import { invoiceToken, logInvoiceEvent, publicInvoiceUrl } from "../invoices/service.js";
import { timeZoneForProvince } from "../jobs/dates.js";
import { localMidnight } from "../today/business.js";
import { getBaseUrl } from "../lib/baseUrl.js";
import { sendCustomerEmail } from "../lib/connectedEmailSend.js";
import { escapeHtml } from "../lib/email.js";
import { isSmsConfigured, normalizePhone, sendSms } from "../lib/sms.js";
import { latestPrice, priceSeries, stockLevel, suggestedQty, vendorMatches, type ReceiptLines } from "../materials/suppliers.js";
import {
  FOLLOWUP_DRAFT_DAYS,
  REMINDER_DRAFT_DAYS,
  daysBetween,
  followupDraft,
  isQuiet,
  levelsOf,
  localClock,
  localDay,
  nextMonthStart,
  overLimit,
  reminderDraft,
  ruleOf,
  type Quiet,
  type Rule,
  type RuleKey,
} from "./companyRules.js";

/** The voice minutes a company has in a month. (Owner ruling open: this is a constant until the plans say.) */
export const VOICE_MINUTES_INCLUDED = 300;

export const assistantEnabled = (profile: BusinessProfile | null | undefined): boolean => hasFeature(profile, "assistant");

// ── Permissions ──────────────────────────────────────────────────────────────

export type PermissionsDto = {
  levels: ReturnType<typeof levelsOf>;
  spendLimitCents: number;
  quiet: Quiet;
  readBack: boolean;
};

export async function settingsFor(userId: string): Promise<PermissionsDto> {
  const [row] = await db.select().from(assistantSettingsTable).where(eq(assistantSettingsTable.userId, userId));
  return permissionsOf(row);
}

export function permissionsOf(row: AssistantSettings | undefined): PermissionsDto {
  return {
    levels: levelsOf(row?.levels),
    spendLimitCents: row?.spendLimitCents ?? 30000,
    quiet: { on: (row?.quietHours ?? "on") === "on", from: row?.quietFrom ?? 20 * 60, until: row?.quietUntil ?? 7 * 60, sunday: (row?.quietSunday ?? "on") === "on" },
    readBack: (row?.readBack ?? "on") === "on",
  };
}

export type PermissionsPatch = Partial<{
  levels: Partial<PermissionsDto["levels"]>;
  spendLimitCents: number;
  quiet: Partial<Quiet>;
  readBack: boolean;
}>;

export async function savePermissions(userId: string, patch: PermissionsPatch): Promise<PermissionsDto> {
  const now = await settingsFor(userId);
  const next: PermissionsDto = {
    levels: { ...now.levels, ...(patch.levels ?? {}) },
    spendLimitCents: patch.spendLimitCents ?? now.spendLimitCents,
    quiet: { ...now.quiet, ...(patch.quiet ?? {}) },
    readBack: patch.readBack ?? now.readBack,
  };
  const values = {
    userId,
    levels: next.levels,
    spendLimitCents: next.spendLimitCents,
    quietHours: next.quiet.on ? "on" : "off",
    quietFrom: next.quiet.from,
    quietUntil: next.quiet.until,
    quietSunday: next.quiet.sunday ? "on" : "off",
    readBack: next.readBack ? "on" : "off",
  } as const;
  await db.insert(assistantSettingsTable).values(values).onConflictDoUpdate({ target: assistantSettingsTable.userId, set: values });
  return next;
}

/**
 * What the assistant may do alone for a company: "ask" drafts it for a yes, "send" does it and tells, "off" leaves it. A company whose plan
 * has no assistant keeps what the automations always did ("send").
 */
export async function ruleFor(userId: string, key: RuleKey, profile?: BusinessProfile | null): Promise<Rule> {
  const p = profile ?? (await db.select().from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId)))[0];
  if (!assistantEnabled(p)) return "send";
  return ruleOf((await settingsFor(userId)).levels[key]);
}

/** Whether an automatic message may go out now, in the company's own day. */
export async function quietNow(userId: string, province: string | null | undefined, at = new Date()): Promise<boolean> {
  const { quiet } = await settingsFor(userId);
  const { day, minute } = localClock(at, timeZoneForProvince(province));
  return isQuiet(quiet, day, minute);
}

// ── Activity ─────────────────────────────────────────────────────────────────

export type ActivityInput = {
  userId: string;
  kind: string;
  title: string;
  detail?: string;
  params?: Record<string, string | number>;
  /** A person's name, or the rule ("Receipts"). */
  who: string;
  whoKind: "you" | "auto";
  category: "msg" | "money" | "jobs";
  undo?: AssistantActivityUndo;
  undoData?: ActivityUndoData;
  word?: string;
  entityType?: string;
  entityId?: string;
  at?: Date;
};

export async function logActivity(a: ActivityInput): Promise<string | null> {
  try {
    const [row] = await db
      .insert(assistantActivityTable)
      .values({
        userId: a.userId, kind: a.kind, title: a.title, detail: a.detail ?? "", params: a.params ?? {}, who: a.who, whoKind: a.whoKind, category: a.category,
        undo: a.undo ?? "none", undoData: a.undoData ?? {}, word: a.word ?? "", entityType: a.entityType ?? null, entityId: a.entityId ?? null, ...(a.at ? { at: a.at } : {}),
      })
      .returning({ id: assistantActivityTable.id });
    return row?.id ?? null;
  } catch {
    // What the assistant did must not be undone because it could not be written down.
    return null;
  }
}

export type ActivityDto = {
  id: string; at: string; kind: string; title: string; detail: string; params: Record<string, string | number>; who: string; whoKind: "you" | "auto"; category: "msg" | "money" | "jobs";
  undo: AssistantActivityUndo; word: string; undone: boolean; invoiceId: string | null;
};

const activityDto = (r: AssistantActivityRow): ActivityDto => ({
  id: r.id, at: r.at.toISOString(), kind: r.kind, title: r.title, detail: r.detail, params: r.params, who: r.who, whoKind: r.whoKind, category: r.category,
  undo: r.undo, word: r.word, undone: !!r.undoneAt, invoiceId: r.entityType === "invoice" ? r.entityId : null,
});

export type ActivityOverview = {
  today: number; todayYou: number; month: number; undoneMonth: number; voice: { used: number; included: number; resets: string };
  rows: ActivityDto[];
};


export async function activityOverview(userId: string, province: string | null | undefined, now = new Date()): Promise<ActivityOverview> {
  const zone = timeZoneForProvince(province);
  const todayKey = localDay(now, zone);
  const dayStart = localMidnight(todayKey, zone);
  const monthStart = localMidnight(`${todayKey.slice(0, 7)}-01`, zone);
  const since = new Date(Math.min(monthStart.getTime(), now.getTime() - 14 * 86_400_000));
  const rows = await db.select().from(assistantActivityTable).where(and(eq(assistantActivityTable.userId, userId), gte(assistantActivityTable.at, since))).orderBy(desc(assistantActivityTable.at)).limit(400);
  const inMonth = rows.filter((r) => r.at >= monthStart);
  const today = rows.filter((r) => r.at >= dayStart);
  const [voice] = await db
    .select({ s: sql<string>`coalesce(sum(${usageEventsTable.quantity}), 0)` })
    .from(usageEventsTable)
    .where(and(eq(usageEventsTable.userId, userId), eq(usageEventsTable.kind, "voice_seconds"), gte(usageEventsTable.createdAt, monthStart)));
  const resets = nextMonthStart(todayKey);
  return {
    today: today.length,
    todayYou: today.filter((r) => r.whoKind === "you").length,
    month: inMonth.length,
    undoneMonth: inMonth.filter((r) => r.undoneAt).length,
    voice: { used: Math.round(Number(voice?.s ?? 0) / 60), included: VOICE_MINUTES_INCLUDED, resets },
    rows: rows.filter((r) => r.at >= since).map(activityDto),
  };
}

/** Takes an action back. Returns the row, or why not. */
export async function undoActivity(userId: string, id: string): Promise<{ ok: true; row: ActivityDto; toast: string } | { ok: false; status: number; message: string }> {
  const [row] = await db.select().from(assistantActivityTable).where(and(eq(assistantActivityTable.id, id), eq(assistantActivityTable.userId, userId)));
  if (!row) return { ok: false, status: 404, message: "Not found" };
  if (row.undoneAt) return { ok: false, status: 409, message: "Already undone" };
  if (row.undo !== "undo" && row.undo !== "void") return { ok: false, status: 400, message: "This can't be undone" };
  const d = row.undoData;
  let toast = "";
  if (d.entity === "cost" && d.id) {
    await db.delete(costEntriesTable).where(and(eq(costEntriesTable.id, d.id), eq(costEntriesTable.userId, userId)));
    toast = "cost";
  } else if (d.entity === "order" && d.id) {
    // Only what is still on the list: an order already placed is the supplier's now.
    const ids = d.id.split(",");
    await db.delete(supplierOrdersTable).where(and(inArray(supplierOrdersTable.id, ids), eq(supplierOrdersTable.userId, userId), eq(supplierOrdersTable.status, "listed")));
    toast = "order";
  } else if (d.entity === "block" && d.id && d.was) {
    const was = JSON.parse(d.was) as { startsAt: string; endsAt: string };
    await db.update(scheduleBlocksTable).set({ startsAt: new Date(was.startsAt), endsAt: new Date(was.endsAt), reminderSentAt: null }).where(and(eq(scheduleBlocksTable.id, d.id), eq(scheduleBlocksTable.userId, userId)));
    toast = "block";
  } else if (d.entity === "payment" && d.id) {
    return { ok: false, status: 400, message: "Voiding a payment is done from the invoice" };
  } else {
    return { ok: false, status: 400, message: "This can't be undone" };
  }
  const [after] = await db
    .update(assistantActivityTable)
    .set({ undoneAt: new Date(), word: row.undo === "void" ? "Voided" : "Undone", undo: "none" })
    .where(eq(assistantActivityTable.id, id))
    .returning();
  return { ok: true, row: activityDto(after!), toast };
}

// ── Suggestions ──────────────────────────────────────────────────────────────

export type SuggestionDto = { id: string; kind: AssistantSuggestion["kind"]; payload: SuggestionPayload; createdAt: string };
/** A row of "Recently decided": a suggestion of the company assistant, or a proposal of the job assistant (a cost, a change order, a payment). */
export type DecidedDto = {
  id: string; source: "suggestion" | "job"; kind: string; status: "approved" | "dismissed" | "failed"; at: string;
  payload?: SuggestionPayload; summary?: string; project?: string | null; invoiceId?: string | null;
};

const suggestionDto = (s: AssistantSuggestion): SuggestionDto => ({ id: s.id, kind: s.kind, payload: s.payload, createdAt: s.createdAt.toISOString() });

type Candidate = { key: string; kind: AssistantSuggestion["kind"]; payload: SuggestionPayload };

const hash = (parts: string[]) => createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 10);

async function reminderCandidates(userId: string, profile: BusinessProfile, now: Date, who: string): Promise<Candidate[]> {
  const open = await db
    .select()
    .from(invoicesTable)
    .where(and(eq(invoicesTable.userId, userId), inArray(invoicesTable.status, ["sent", "viewed", "partially_paid", "overdue"]), lt(invoicesTable.dueDate, now), isNull(invoicesTable.creditNoteForId)))
    .orderBy(asc(invoicesTable.dueDate))
    .limit(60);
  const out: Candidate[] = [];
  for (const inv of open) {
    const bal = balanceCents(inv);
    const late = daysBetween(inv.dueDate, now);
    const need = REMINDER_DRAFT_DAYS[inv.reminderCount];
    if (bal <= 0 || need === undefined || late < need) continue;
    const phone = isSmsConfigured() ? normalizePhone(inv.customer.phone) : null;
    const email = (inv.customer.email ?? "").trim();
    const channel: "sms" | "email" | null = phone ? "sms" : email.includes("@") ? "email" : null;
    if (!channel) continue;
    const lang = inv.language === "fr" ? "fr" : "en";
    out.push({
      key: `reminder:${inv.id}:${inv.reminderCount}`,
      kind: "reminder",
      payload: {
        channel, to: channel === "sms" ? phone! : email, toName: inv.customer.name, language: lang, invoiceId: inv.id, number: inv.number, balanceCents: bal, daysLate: late,
        subject: lang === "fr" ? `Rappel : facture ${inv.number}` : `Reminder: invoice ${inv.number}`,
        draft: reminderDraft({ lang, client: inv.customer.name, number: inv.number, balanceCents: bal, due: inv.dueDate, link: publicInvoiceUrl(invoiceToken(inv)), who, zone: timeZoneForProvince(inv.province) }),
      },
    });
  }
  void profile;
  return out;
}

async function followupCandidates(userId: string, now: Date, who: string): Promise<Candidate[]> {
  const cutoff = new Date(now.getTime() - FOLLOWUP_DRAFT_DAYS * 86_400_000);
  const quotes = await db
    .select()
    .from(quotesTable)
    .where(and(eq(quotesTable.userId, userId), ne(quotesTable.status, "accepted"), isNull(quotesTable.archivedAt), isNull(quotesTable.declinedAt), isNull(quotesTable.unsubscribedAt), lt(quotesTable.sentAt, cutoff), eq(quotesTable.followUpStage, 0)))
    .orderBy(desc(quotesTable.sentAt))
    .limit(40);
  const out: Candidate[] = [];
  for (const q of quotes) {
    if (!q.sentAt) continue;
    const email = (q.clientData.email ?? "").trim();
    if (!email.includes("@")) continue;
    const province = (q.province ?? q.clientData.province ?? "").toUpperCase();
    let lang: "en" | "fr" = province === "QC" ? "fr" : "en";
    if (q.clientId) {
      const [c] = await db.select({ l: clientsTable.preferredLanguage }).from(clientsTable).where(eq(clientsTable.id, q.clientId));
      if (c?.l === "fr" || c?.l === "en") lang = c.l;
    }
    const number = q.numeroPreventivoData || `No. ${q.id.slice(0, 4).toUpperCase()}`;
    const title = [q.titoloPreventivoRiga2].map((s) => (s ?? "").trim()).filter(Boolean)[0] ?? "";
    out.push({
      key: `followup:${q.id}`,
      kind: "followup",
      payload: {
        channel: "email", to: email, toName: q.clientData.nome, language: lang, quoteId: q.id, number, totalCents: Math.round(Number(q.totale) * 100), daysSent: daysBetween(q.sentAt, now),
        subject: lang === "fr" ? `Votre soumission ${number}` : `Your quote ${number}`,
        draft: followupDraft({ lang, client: q.clientData.nome, title, link: `${getBaseUrl()}/p/${q.id}`, who }),
      },
    });
  }
  return out;
}

async function orderCandidates(userId: string, limitCents: number, now: Date): Promise<Candidate[]> {
  const [items, suppliers, listed, costs] = await Promise.all([
    db.select().from(inventoryItemsTable).where(eq(inventoryItemsTable.userId, userId)).orderBy(asc(inventoryItemsTable.name)),
    db.select().from(suppliersTable).where(and(eq(suppliersTable.userId, userId), isNull(suppliersTable.archivedAt))),
    db.select({ itemId: supplierOrdersTable.inventoryItemId }).from(supplierOrdersTable).where(and(eq(supplierOrdersTable.userId, userId), notInArray(supplierOrdersTable.status, ["delivered", "picked_up"]))),
    db
      .select({ supplierId: costEntriesTable.supplierId, vendor: costEntriesTable.vendor, date: costEntriesTable.date, ai: costEntriesTable.aiExtraction })
      .from(costEntriesTable)
      .where(and(eq(costEntriesTable.userId, userId), gte(costEntriesTable.date, new Date(now.getTime() - 190 * 86_400_000)), or(eq(costEntriesTable.category, "materials"), eq(costEntriesTable.category, "equipment"), eq(costEntriesTable.category, "misc"))))
      .orderBy(desc(costEntriesTable.date))
      .limit(3000),
  ]);
  const onList = new Set(listed.map((l) => l.itemId).filter(Boolean));
  const seriesBySupplier = suppliers.map((s) => {
    const mine: ReceiptLines[] = costs
      .filter((c) => c.supplierId === s.id || (!c.supplierId && vendorMatches(c.vendor, s.name)))
      .map((c) => ({ at: c.date, lines: Array.isArray(c.ai?.lines) ? c.ai!.lines.map((l) => ({ description: String(l.description ?? ""), unitPrice: typeof l.unitPrice === "number" ? l.unitPrice : null })) : [] }));
    return { supplier: s, series: priceSeries(mine) };
  });
  type Line = NonNullable<SuggestionPayload["lines"]>[number];
  const bySupplier = new Map<string, { name: string; lines: Line[] }>();
  for (const i of items) {
    if (onList.has(i.id)) continue;
    const stock = { shopQty: Number(i.shopQty), truckQty: Number(i.truckQty), sites: i.sites ?? [], reserved: i.reserved ?? [], par: Number(i.par) };
    if (stockLevel(stock) === "ok") continue;
    // The cheapest supplier that has a price for it; with no price known, nothing to suggest.
    const best = seriesBySupplier
      .map(({ supplier, series }) => ({ supplier, p: latestPrice(series, i.name) }))
      .filter((x) => x.p)
      .sort((a, b) => a.p!.price - b.p!.price)[0];
    if (!best) continue;
    const cur = bySupplier.get(best.supplier.id) ?? { name: best.supplier.name, lines: [] };
    cur.lines.push({ itemId: i.id, name: i.name, unit: i.unit, qty: suggestedQty(stock), unitPriceCents: Math.round(best.p!.price * 100) });
    bySupplier.set(best.supplier.id, cur);
  }
  return [...bySupplier.entries()].map(([supplierId, v]) => {
    const total = v.lines.reduce((n, l) => n + Math.round(l.qty * (l.unitPriceCents ?? 0)), 0);
    return {
      key: `order:${supplierId}:${hash(v.lines.map((l) => `${l.itemId}:${l.qty}`).sort())}`,
      kind: "order" as const,
      payload: { supplierId, supplierName: v.name, lines: v.lines, totalCents: total, destination: "Shop", overLimit: overLimit(total, limitCents) },
    };
  });
}

/**
 * Looks at the books and makes the suggestions that are due, once each. A suggestion whose reason has gone (the invoice was paid) is taken away
 * while it is still waiting. What a company turned off, or lets the assistant do alone, is not suggested.
 */
export async function refreshSuggestions(userId: string, profile: BusinessProfile, who: string, now = new Date()): Promise<void> {
  const perm = await settingsFor(userId);
  const wanted: Candidate[] = [];
  if (ruleOf(perm.levels.reminders) === "ask") wanted.push(...(await reminderCandidates(userId, profile, now, who)));
  if (ruleOf(perm.levels.followups) === "ask") wanted.push(...(await followupCandidates(userId, now, who)));
  if (hasFeature(profile, "inventory")) wanted.push(...(await orderCandidates(userId, perm.spendLimitCents, now)));
  const keys = new Set(wanted.map((w) => w.key));
  const pending = await db.select().from(assistantSuggestionsTable).where(and(eq(assistantSuggestionsTable.userId, userId), eq(assistantSuggestionsTable.status, "pending")));
  const gone = pending.filter((p) => p.kind !== "move" && !keys.has(p.key)).map((p) => p.id);
  if (gone.length) await db.delete(assistantSuggestionsTable).where(inArray(assistantSuggestionsTable.id, gone));
  if (wanted.length) await db.insert(assistantSuggestionsTable).values(wanted.map((w) => ({ userId, key: w.key, kind: w.kind, payload: w.payload }))).onConflictDoNothing();
}

export type ProposalsOverview = {
  enabled: boolean; requiredPlan?: string; pending: SuggestionDto[]; recent: DecidedDto[]; spendLimitCents: number;
};

export async function proposalsOverview(userId: string, profile: BusinessProfile, who: string): Promise<Omit<ProposalsOverview, "enabled" | "requiredPlan">> {
  await refreshSuggestions(userId, profile, who);
  const rows = await db.select().from(assistantSuggestionsTable).where(eq(assistantSuggestionsTable.userId, userId)).orderBy(desc(assistantSuggestionsTable.createdAt)).limit(80);
  const pending = rows.filter((r) => r.status === "pending");
  const decided: DecidedDto[] = rows
    .filter((r) => r.status !== "pending")
    .map((r) => ({ id: r.id, source: "suggestion" as const, kind: r.kind, status: r.status as "approved" | "dismissed" | "failed", payload: r.payload, at: (r.decidedAt ?? r.createdAt).toISOString() }));
  const jobRows = await db
    .select({ p: assistantProposalsTable, project: projectsTable.name })
    .from(assistantProposalsTable)
    .leftJoin(projectsTable, eq(projectsTable.id, assistantProposalsTable.projectId))
    .where(and(eq(assistantProposalsTable.userId, userId), ne(assistantProposalsTable.status, "pending")))
    .orderBy(desc(assistantProposalsTable.resolvedAt))
    .limit(8);
  for (const { p, project } of jobRows) {
    decided.push({
      id: p.id, source: "job", kind: p.kind, status: p.status === "confirmed" ? "approved" : p.status === "dismissed" ? "dismissed" : "failed", at: (p.resolvedAt ?? p.createdAt).toISOString(),
      summary: p.summary, project, invoiceId: p.resultEntityType === "invoice" ? p.resultEntityId : null,
    });
  }
  decided.sort((a, b) => b.at.localeCompare(a.at));
  return { pending: pending.map(suggestionDto), recent: decided.slice(0, 6), spendLimitCents: (await settingsFor(userId)).spendLimitCents };
}

const paragraphs = (text: string): string =>
  text.split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.5">${escapeHtml(p).replace(/(https?:\/\/[^\s<]+?)([.,;:!?)]*)(\s|$)/g, '<a href="$1">$1</a>$2$3').replace(/\n/g, "<br>")}</p>`).join("");

export class SuggestionError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

/**
 * Does what a suggestion says, once. `draft` replaces the text the person edited. A failure leaves it waiting, with what went wrong, so it can be
 * tried again. Returns the activity row that says what was done.
 */
export async function approveSuggestion(args: { userId: string; id: string; actorName: string; profile: BusinessProfile; draft?: string; ip?: string }): Promise<{ suggestion: SuggestionDto; activityId: string | null }> {
  const { userId, id, actorName, profile } = args;
  const [s] = await db.select().from(assistantSuggestionsTable).where(and(eq(assistantSuggestionsTable.id, id), eq(assistantSuggestionsTable.userId, userId)));
  if (!s) throw new SuggestionError(404, "NOT_FOUND", "Not found");
  if (s.status !== "pending") throw new SuggestionError(409, "DECIDED", "This was already decided.");
  const p = { ...s.payload };
  if (args.draft !== undefined && (s.kind === "reminder" || s.kind === "followup")) p.draft = args.draft.trim().slice(0, 2000);
  const who = actorName || "You";
  const fail = async (message: string, code = "SEND_FAILED", status = 502) => {
    await db.update(assistantSuggestionsTable).set({ error: message }).where(eq(assistantSuggestionsTable.id, id));
    throw new SuggestionError(status, code, message);
  };
  let activityId: string | null = null;
  const fromName = profile.companyName || "Your contractor";

  if (s.kind === "reminder" || s.kind === "followup") {
    const text = (p.draft ?? "").trim();
    if (!text) return fail("The message is empty.", "EMPTY", 400);
    const lang = p.language ?? "en";
    if (p.channel === "sms") {
      const r = await sendSms({ profile, to: p.to, body: text, lang, purpose: s.kind === "reminder" ? "invoice_reminder" : "quote_followup", relatedEntityType: s.kind === "reminder" ? "invoice" : "quote", relatedEntityId: (p.invoiceId ?? p.quoteId) ?? undefined });
      if (!r.ok) return fail(`The text wasn't sent (${r.reason}).`);
    } else {
      try {
        await sendCustomerEmail({ userId, toEmail: p.to ?? "", fromDisplayName: fromName, replyTo: profile.email, subject: p.subject ?? "", html: paragraphs(text) });
      } catch (err) {
        return fail(err instanceof Error ? err.message : "The email wasn't sent.");
      }
    }
    if (s.kind === "reminder" && p.invoiceId) {
      await db.update(invoicesTable).set({ reminderCount: sql`${invoicesTable.reminderCount} + 1`, lastReminderAt: new Date() }).where(and(eq(invoicesTable.id, p.invoiceId), eq(invoicesTable.userId, userId)));
      await logInvoiceEvent({ invoiceId: p.invoiceId, type: "reminder_sent", actor: "contractor", detail: { via: "assistant", channel: p.channel }, ip: args.ip });
    }
    if (s.kind === "followup" && p.quoteId) {
      // One nudge, then the cadence is over: it was the person's decision to send it.
      await db.update(quotesTable).set({ followUpStage: sql`${quotesTable.followUpStage} + 1`, nextFollowUpAt: null }).where(and(eq(quotesTable.id, p.quoteId), eq(quotesTable.userId, userId)));
    }
    activityId = await logActivity({
      userId, kind: s.kind, title: s.kind === "reminder" ? `Reminded ${p.toName ?? ""} about ${p.number ?? ""}` : `Followed up with ${p.toName ?? ""} on ${p.number ?? ""}`,
      detail: `${p.channel === "sms" ? "SMS" : "Email"}`, params: { client: p.toName ?? "", number: p.number ?? "", channel: p.channel ?? "email", amount: p.balanceCents ?? p.totalCents ?? 0 }, who, whoKind: "you", category: "msg", word: "Sent", entityType: s.kind === "reminder" ? "invoice" : "quote", entityId: (p.invoiceId ?? p.quoteId) ?? undefined,
    });
  } else if (s.kind === "order") {
    const lines = p.lines ?? [];
    if (!lines.length || !p.supplierId) return fail("There is nothing on this order.", "EMPTY", 400);
    const made = await db
      .insert(supplierOrdersTable)
      .values(lines.map((l) => ({ userId, supplierId: p.supplierId!, inventoryItemId: l.itemId, itemName: l.name, unit: l.unit, qty: String(l.qty), unitPriceCents: l.unitPriceCents, destination: p.destination ?? "Shop", status: "listed" as const })))
      .returning({ id: supplierOrdersTable.id });
    activityId = await logActivity({
      userId, kind: "order", title: `Added ${lines.length} item${lines.length === 1 ? "" : "s"} to the ${p.supplierName ?? "supplier"} order list`, detail: lines.map((l) => `${l.qty} × ${l.name}`).join(", "), params: { supplier: p.supplierName ?? "", count: lines.length, items: lines.map((l) => `${l.qty} × ${l.name}`).join(", ") },
      who, whoKind: "you", category: "money", undo: "undo", undoData: { entity: "order", id: made.map((m) => m.id).join(",") }, word: "", entityType: "supplier", entityId: p.supplierId,
    });
  } else if (s.kind === "move") {
    if (!p.blockId || !p.moveTo) return fail("There is nothing to move.", "EMPTY", 400);
    const [b] = await db.select().from(scheduleBlocksTable).where(and(eq(scheduleBlocksTable.id, p.blockId), eq(scheduleBlocksTable.userId, userId)));
    if (!b) return fail("That visit is gone.", "GONE", 404);
    const shift = new Date(p.moveTo).getTime() - b.startsAt.getTime();
    await db.update(scheduleBlocksTable).set({ startsAt: new Date(b.startsAt.getTime() + shift), endsAt: new Date(b.endsAt.getTime() + shift), reminderSentAt: null }).where(eq(scheduleBlocksTable.id, b.id));
    activityId = await logActivity({
      userId, kind: "move", title: `Moved ${p.blockTitle ?? p.jobName ?? "a visit"}`, detail: p.jobName ?? "", params: { job: p.jobName ?? "", title: p.blockTitle ?? "" }, who, whoKind: "you", category: "jobs", undo: "undo",
      undoData: { entity: "block", id: b.id, was: JSON.stringify({ startsAt: b.startsAt.toISOString(), endsAt: b.endsAt.toISOString() }) }, entityType: "block", entityId: b.id,
    });
  }
  const [done] = await db.update(assistantSuggestionsTable).set({ status: "approved", payload: p, decidedBy: who, decidedAt: new Date(), error: null }).where(eq(assistantSuggestionsTable.id, id)).returning();
  return { suggestion: suggestionDto(done!), activityId };
}

export async function dismissSuggestion(userId: string, id: string, actorName: string): Promise<SuggestionDto> {
  const [s] = await db
    .update(assistantSuggestionsTable)
    .set({ status: "dismissed", decidedBy: actorName, decidedAt: new Date() })
    .where(and(eq(assistantSuggestionsTable.id, id), eq(assistantSuggestionsTable.userId, userId), eq(assistantSuggestionsTable.status, "pending")))
    .returning();
  if (!s) throw new SuggestionError(404, "NOT_FOUND", "Not found");
  return suggestionDto(s);
}

/** Puts a dismissed suggestion back (the board's Undo after Dismiss). An approved one is done: it is undone from Activity. */
export async function restoreSuggestion(userId: string, id: string): Promise<SuggestionDto> {
  const [s] = await db
    .update(assistantSuggestionsTable)
    .set({ status: "pending", decidedBy: null, decidedAt: null })
    .where(and(eq(assistantSuggestionsTable.id, id), eq(assistantSuggestionsTable.userId, userId), eq(assistantSuggestionsTable.status, "dismissed")))
    .returning();
  if (!s) throw new SuggestionError(404, "NOT_FOUND", "Not found");
  return suggestionDto(s);
}

/** Jobs used to look up a name for a move; kept here so the routes stay thin. */
export async function jobName(userId: string, projectId: string | null): Promise<string | null> {
  if (!projectId) return null;
  const [p] = await db.select({ n: projectsTable.name }).from(projectsTable).where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)));
  return p?.n ?? null;
}
