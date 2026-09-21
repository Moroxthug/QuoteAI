import { db, scheduleBlocksTable, collaboratorsTable, projectsTable, businessProfilesTable, DEFAULT_AUTOMATION_SETTINGS, type BusinessProfile, type ScheduleBlock } from "@workspace/db";
import { and, gt, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import { sendSms, isSmsConfigured } from "../lib/sms.js";
import { sendWorkerScheduleReminderEmail } from "../lib/emailTeam.js";
import { logger } from "../lib/logger.js";
import { reminderBody, reminderDue, blockLabel } from "./service.js";

// ── Crew reminders (cron) ────────────────────────────────────────────────────
// The evening before a scheduled block (and, as a catch-up, the morning of),
// each assigned worker gets one text — or an email when they have no phone
// or the text cannot go (Twilio not configured, STOP, allowance). One send
// per block: `reminder_sent_at` is stamped whatever the channel, and also
// when there is no channel at all, so a worker with neither phone nor email
// does not make the sweep retry forever. Moving a block resets the stamp
// (routes/schedule.ts), so a rescheduled shift gets a fresh reminder.

const DAY_MS = 86_400_000;

export async function runScheduleReminderMaintenance(now = new Date()): Promise<{ sms: number; email: number; skipped: number }> {
  const candidates = await db
    .select()
    .from(scheduleBlocksTable)
    .where(and(isNull(scheduleBlocksTable.reminderSentAt), isNotNull(scheduleBlocksTable.collaboratorId), gt(scheduleBlocksTable.startsAt, now), lt(scheduleBlocksTable.startsAt, new Date(now.getTime() + 2 * DAY_MS))))
    .limit(500);
  const result = { sms: 0, email: 0, skipped: 0 };
  if (!candidates.length) return result;

  const profiles = new Map<string, BusinessProfile>();
  for (const p of await db.select().from(businessProfilesTable).where(inArray(businessProfilesTable.userId, [...new Set(candidates.map((b) => b.userId))]))) profiles.set(p.userId, p);
  const workers = new Map<string, typeof collaboratorsTable.$inferSelect>();
  for (const w of await db.select().from(collaboratorsTable).where(inArray(collaboratorsTable.id, [...new Set(candidates.map((b) => b.collaboratorId!))]))) workers.set(w.id, w);
  const projectIds = [...new Set(candidates.map((b) => b.projectId).filter((id): id is string => !!id))];
  const projects = new Map<string, { name: string; address: string }>();
  if (projectIds.length) for (const p of await db.select({ id: projectsTable.id, name: projectsTable.name, address: projectsTable.address }).from(projectsTable).where(inArray(projectsTable.id, projectIds))) projects.set(p.id, p);

  for (const block of candidates) {
    const profile = profiles.get(block.userId);
    if (!profile) continue;
    const settings = { ...DEFAULT_AUTOMATION_SETTINGS, ...(profile.automationSettings ?? {}) };
    if (!settings.scheduleReminders) continue;
    const kind = reminderDue(block, now, profile.province);
    if (!kind) continue;
    const worker = workers.get(block.collaboratorId!);
    if (!worker || !worker.active) continue;
    const project = block.projectId ? projects.get(block.projectId) : undefined;
    const lang: "en" | "fr" = profile.province === "QC" ? "fr" : "en";
    const outcome = await sendReminder({ profile, worker, block, kind, jobName: project?.name ?? null, address: project?.address || null, lang });
    result[outcome]++;
    await db.update(scheduleBlocksTable).set({ reminderSentAt: now }).where(and(isNull(scheduleBlocksTable.reminderSentAt), inArray(scheduleBlocksTable.id, [block.id])));
  }
  return result;
}

async function sendReminder(params: {
  profile: BusinessProfile;
  worker: typeof collaboratorsTable.$inferSelect;
  block: ScheduleBlock;
  kind: "tomorrow" | "today";
  jobName: string | null;
  address: string | null;
  lang: "en" | "fr";
}): Promise<"sms" | "email" | "skipped"> {
  const { profile, worker, block, kind, jobName, address, lang } = params;
  const body = reminderBody({ kind, block, jobName, address, province: profile.province, lang });
  if (worker.phone && isSmsConfigured()) {
    const sent = await sendSms({ profile, to: worker.phone, body, lang, purpose: "appointment_reminder", relatedEntityType: "schedule_block", relatedEntityId: block.id });
    if (sent.ok) return "sms";
    logger.info({ blockId: block.id, reason: sent.reason }, "Schedule reminder text not sent; trying email");
  }
  if (worker.email) {
    try {
      await sendWorkerScheduleReminderEmail({ toEmail: worker.email, workerName: worker.name, companyName: profile.companyName, kind, body, label: blockLabel(block, jobName, lang), notes: block.notes, language: lang });
      return "email";
    } catch (err) {
      logger.error({ err, blockId: block.id }, "Schedule reminder email failed");
    }
  }
  return "skipped";
}
