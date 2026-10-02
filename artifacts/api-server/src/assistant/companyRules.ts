// Pocket 128.1: the pure parts of the company assistant (Proposals, Activity, Permissions): what a level means, when a message may go out, and the
// drafts of the reminder and the follow-up. Tested in companyRules.test.ts.
import { RECOMMENDED_LEVELS, type AssistantLevel, type AssistantLevels } from "@workspace/db";

export type Rule = "ask" | "send" | "off";
export type RuleKey = keyof AssistantLevels;

export const LEVEL_KEYS: RuleKey[] = ["followups", "reminders", "receipts", "scheduling", "crew"];

/** The levels a company has: what it chose, the recommended where it chose nothing. */
export function levelsOf(stored: Partial<AssistantLevels> | null | undefined): AssistantLevels {
  const out = { ...RECOMMENDED_LEVELS };
  for (const k of LEVEL_KEYS) {
    const v = stored?.[k];
    if (v === 0 || v === 1 || v === 2) out[k] = v as AssistantLevel;
  }
  return out;
}

/** 0 asks first, 1 does it and tells, 2 is off. */
export const ruleOf = (level: AssistantLevel): Rule => (level === 0 ? "ask" : level === 1 ? "send" : "off");

/** Minutes after midnight in the company's own day. */
export type Quiet = { on: boolean; from: number; until: number; sunday: boolean };

/**
 * Whether a message may go out at this local time. Quiet hours span midnight when `from` is later than `until` ("8:00 pm until 7:00 am").
 * `day` is 0 for Sunday, as Date#getDay.
 */
export function isQuiet(q: Quiet, day: number, minute: number): boolean {
  if (q.sunday && day === 0) return true;
  if (!q.on) return false;
  if (q.from === q.until) return false;
  return q.from > q.until ? minute >= q.from || minute < q.until : minute >= q.from && minute < q.until;
}

/** The company's local weekday (0 = Sunday) and minute of the day at an instant. */
export function localClock(at: Date, zone: string): { day: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: zone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { day: day < 0 ? 0 : day, minute: Number(get("hour")) * 60 + Number(get("minute")) };
}

/** The calendar day of an instant in a zone, as YYYY-MM-DD. */
export const localDay = (at: Date, zone: string): string => new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);

/** The first day of the month after the given YYYY-MM-DD, as YYYY-MM-01. */
export function nextMonthStart(day: string): string {
  const [y, m] = day.split("-").map(Number) as [number, number];
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

/** First name for a greeting; "there" / "" when there is none. */
export const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? "";

const money = (cents: number, lang: "en" | "fr") => new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);
const day = (d: Date, lang: "en" | "fr", zone: string) => new Intl.DateTimeFormat(lang === "fr" ? "fr-CA" : "en-CA", { month: "short", day: "numeric", timeZone: zone }).format(d);

/** The text asking for a late invoice, in the invoice's language. `who` is the person who signs it. */
export function reminderDraft(p: { lang: "en" | "fr"; client: string; number: string; balanceCents: number; due: Date; link: string; who: string; /** The company's own zone: the day it was due is the day on its calendar. */ zone: string }): string {
  const hi = firstName(p.client);
  if (p.lang === "fr") {
    return `Bonjour${hi ? ` ${hi}` : ""}, petit rappel : la facture ${p.number} de ${money(p.balanceCents, "fr")} était due le ${day(p.due, "fr", p.zone)}. Vous pouvez payer par carte ou par virement Interac ici : ${p.link}. Merci, ${p.who}`;
  }
  return `Hi${hi ? ` ${hi}` : ""}, a quick reminder that invoice ${p.number} for ${money(p.balanceCents, "en")} was due ${day(p.due, "en", p.zone)}. You can pay by card or e-Transfer here: ${p.link}. Thanks, ${p.who}`;
}

/** The text nudging a quote nobody answered. */
export function followupDraft(p: { lang: "en" | "fr"; client: string; title: string; link: string; who: string }): string {
  const hi = firstName(p.client);
  if (p.lang === "fr") {
    return `Bonjour${hi ? ` ${hi}` : ""}, je fais un petit suivi au sujet de la soumission${p.title ? ` « ${p.title} »` : ""}. Je peux la passer en revue avec vous ou ajuster le travail au besoin : ${p.link}. Merci, ${p.who}`;
  }
  return `Hi${hi ? ` ${hi}` : ""}, just checking in on the${p.title ? ` ${p.title}` : ""} quote. Happy to walk through it or adjust the work if that helps: ${p.link}. Thanks, ${p.who}`;
}

/** Days from `then` to `now`, whole days, never below 0. */
export const daysBetween = (then: Date, now: Date): number => Math.max(0, Math.floor((now.getTime() - then.getTime()) / 86_400_000));

/** How many days late before the first, second and third reminder is drafted. */
export const REMINDER_DRAFT_DAYS = [7, 14, 28];

/** How many days after sending a quote nobody has answered before the assistant drafts a nudge. */
export const FOLLOWUP_DRAFT_DAYS = 3;

/** An order above the limit (cents) always asks. */
export const overLimit = (totalCents: number, limitCents: number): boolean => totalCents > limitCents;
