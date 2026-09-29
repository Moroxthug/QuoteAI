// Pocket (docs/POCKET-DESIGN-PLAN.md, Phase 149) — Settings → Notifications → "Morning brief:
// at 6:30 · day, crew and weather". Every half hour (GET /api/cron/morning, from the
// morning-brief GitHub workflow), each company whose local time is 6:30–7:29 and that hasn't
// had today's brief gets one push: what's booked, who's on the crew, and the weather. Only
// people who have a phone or browser signed up and haven't turned the kind off get it.

import { and, eq, gte, isNull, lt, ne, or, sql } from "drizzle-orm";
import { businessProfilesTable, db, deviceTokensTable, pushSubscriptionsTable, scheduleBlocksTable } from "@workspace/db";
import { sendPushToCompany } from "../lib/push.js";
import { timeZoneForProvince } from "../jobs/dates.js";
import { localMidnight } from "./business.js";
import { siteFor, weatherAt } from "../weather/service.js";
import { logger } from "../lib/logger.js";

const DAY_MS = 86_400_000;

function localNow(zone: string, now: Date): { day: string; minutes: number } {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return { day: `${g("year")}-${g("month")}-${g("day")}`, minutes: Number(g("hour")) * 60 + Number(g("minute")) };
}

export async function runMorningBriefs(now = new Date()): Promise<{ sent: number; companies: number }> {
  const withDevices = await db.execute<{ user_id: string }>(sql`select distinct user_id from ${deviceTokensTable} union select distinct user_id from ${pushSubscriptionsTable}`);
  const ids = withDevices.rows.map((r) => r.user_id);
  let sent = 0, companies = 0;
  for (const userId of ids) {
    const [p] = await db.select({ province: businessProfilesTable.province, address: businessProfilesTable.address, lastBriefDay: businessProfilesTable.lastBriefDay }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
    if (!p) continue;
    const zone = timeZoneForProvince(p.province);
    const { day, minutes } = localNow(zone, now);
    if (minutes < 6 * 60 + 30 || minutes >= 7 * 60 + 30 || p.lastBriefDay === day) continue;
    // Claim the day first: two overlapping runs send it once.
    const [claimed] = await db.update(businessProfilesTable).set({ lastBriefDay: day })
      .where(and(eq(businessProfilesTable.userId, userId), or(isNull(businessProfilesTable.lastBriefDay), ne(businessProfilesTable.lastBriefDay, day))))
      .returning({ userId: businessProfilesTable.userId });
    if (!claimed) continue;
    companies++;
    try {
      const from = localMidnight(day, zone), to = new Date(from.getTime() + DAY_MS);
      const blocks = await db.select({ collaboratorId: scheduleBlocksTable.collaboratorId, startsAt: scheduleBlocksTable.startsAt })
        .from(scheduleBlocksTable).where(and(eq(scheduleBlocksTable.userId, userId), gte(scheduleBlocksTable.startsAt, from), lt(scheduleBlocksTable.startsAt, to)));
      const crew = new Set(blocks.map((b) => b.collaboratorId).filter(Boolean)).size;
      const site = await siteFor(p.address, p.province).catch(() => null);
      const wx = site ? await weatherAt(site, zone).catch(() => null) : null;
      const fr = p.province === "QC";
      const first = blocks.map((b) => b.startsAt).sort((a, b) => a.getTime() - b.getTime())[0];
      const at = first ? new Intl.DateTimeFormat(fr ? "fr-CA" : "en-CA", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(first) : null;
      const parts = [
        blocks.length === 0 ? (fr ? "Rien de prévu" : "Nothing booked") : fr ? `${blocks.length} prévu${blocks.length > 1 ? "s" : ""}, dès ${at}` : `${blocks.length} booked, from ${at}`,
        crew > 0 ? (fr ? `${crew} à l’équipe` : `${crew} on the crew`) : null,
        wx?.tempC != null ? `${Math.round(wx.tempC)}°${wx.condition[fr ? "fr" : "en"] ? `, ${wx.condition[fr ? "fr" : "en"].toLowerCase()}` : ""}` : null,
      ].filter(Boolean);
      const r = await sendPushToCompany(userId, { title: fr ? "Votre journée" : "Your day", body: parts.join(" · "), link: "/dashboard", tag: `brief:${day}` }, { category: "brief" });
      sent += r.sent;
    } catch (err) {
      logger.warn({ err, userId }, "Morning brief failed");
    }
  }
  return { sent, companies };
}
