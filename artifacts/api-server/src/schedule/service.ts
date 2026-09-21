import type { ScheduleBlock } from "@workspace/db";
import { timeZoneForProvince } from "../jobs/dates.js";

// ── Phase 75: schedule board helpers ────────────────────────────────────────
// Pure functions shared by the routes, the worker page and the reminder
// sweep. Nothing here touches the database, so it is unit-testable.

export type BlockLike = Pick<ScheduleBlock, "id" | "collaboratorId" | "startsAt" | "endsAt">;

/** Two blocks conflict when they are on the same worker and their intervals overlap (touching ends do not). */
function blocksOverlap(a: Pick<BlockLike, "startsAt" | "endsAt">, b: Pick<BlockLike, "startsAt" | "endsAt">): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

/**
 * Conflict map for a set of blocks: id → ids of other blocks on the same
 * worker that overlap it. Unassigned blocks never conflict (the "Unassigned"
 * lane is a to-do list, not a person). O(n²) per worker — a board window is
 * a week or a day, never thousands of rows.
 */
export function findConflicts(blocks: BlockLike[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const byWorker = new Map<string, BlockLike[]>();
  for (const b of blocks) {
    if (!b.collaboratorId) continue;
    const list = byWorker.get(b.collaboratorId) ?? [];
    list.push(b);
    byWorker.set(b.collaboratorId, list);
  }
  for (const list of byWorker.values()) {
    for (const a of list) {
      const hits = list.filter((b) => b.id !== a.id && blocksOverlap(a, b)).map((b) => b.id);
      if (hits.length) out.set(a.id, hits);
    }
  }
  return out;
}

const DAY_MS = 86_400_000;

/** "YYYY-MM-DD" of an instant in a province's zone, plus the local hour — the two facts the reminder rule needs. */
export function localParts(instant: Date, province: string | null | undefined): { day: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timeZoneForProvince(province), year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { day: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

/** Local "HH:mm" of an instant in a province's zone. */
function localTime(instant: Date, province: string | null | undefined): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timeZoneForProvince(province), hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(instant);
}

export type ReminderKind = "tomorrow" | "today";

/**
 * Whether a block is due a reminder right now, and which one:
 * - "tomorrow": it starts on the next local day and it is 15:00 or later
 *   locally (the evening-before text — 15:00 so the 23:00 UTC cron lands
 *   after it in every province from BC to Newfoundland);
 * - "today": it starts later today (a block added last night, or a morning
 *   tick catching up) — still worth a heads-up, not silence.
 * Anything further out, already started, or before 15:00 the day before → null.
 */
export function reminderDue(block: Pick<ScheduleBlock, "startsAt" | "reminderSentAt">, now: Date, province: string | null | undefined): ReminderKind | null {
  if (block.reminderSentAt) return null;
  if (block.startsAt <= now) return null;
  if (block.startsAt.getTime() - now.getTime() > 2 * DAY_MS) return null;
  const start = localParts(block.startsAt, province);
  const cur = localParts(now, province);
  if (start.day === cur.day) return "today";
  const nextDay = localParts(new Date(now.getTime() + DAY_MS), province).day;
  if (start.day === nextDay && cur.hour >= 15) return "tomorrow";
  return null;
}

/** The label a block shows: its own title, else the job name, else a generic word. */
export function blockLabel(block: Pick<ScheduleBlock, "title">, jobName: string | null | undefined, lang: "en" | "fr"): string {
  return block.title || jobName || (lang === "fr" ? "Bloc" : "Block");
}

/** The reminder text (before lib/sms.ts adds the identity line and the STOP footer). Plain hyphen, not an en dash: U+2013 is outside GSM-7 and would double the segment count. */
export function reminderBody(params: { kind: ReminderKind; block: Pick<ScheduleBlock, "title" | "startsAt" | "endsAt" | "allDay" | "notes">; jobName: string | null; address: string | null; province: string | null; lang: "en" | "fr" }): string {
  const { kind, block, lang } = params;
  const when = block.allDay ? (lang === "fr" ? "toute la journée" : "all day") : `${localTime(block.startsAt, params.province)}-${localTime(block.endsAt, params.province)}`;
  const lead = lang === "fr" ? (kind === "tomorrow" ? "Demain" : "Aujourd'hui") : kind === "tomorrow" ? "Tomorrow" : "Today";
  const what = blockLabel(block, params.jobName, lang);
  const where = params.address ? `, ${params.address}` : "";
  const notes = block.notes ? ` ${block.notes.trim()}` : "";
  return `${lead} ${when}: ${what}${where}.${notes}`;
}
