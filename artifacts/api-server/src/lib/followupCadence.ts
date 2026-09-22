import { db, businessProfilesTable, DEFAULT_AUTOMATION_SETTINGS, type AutomationSettings, type BusinessProfile } from "@workspace/db";
import { eq } from "drizzle-orm";

// Phase 80: the lead / quote follow-up cadences and the review-request delay
// are per-company settings (business_profiles.automation_settings) instead of
// the constants they used to be. Everything that schedules a touch reads them
// through here so a company with no saved value gets the old defaults.

type Settings = Partial<AutomationSettings> | null | undefined;

function settingsOf(profile: Pick<BusinessProfile, "automationSettings"> | null | undefined): Partial<AutomationSettings> {
  return profile?.automationSettings ?? {};
}

const DAY = 86_400_000;

export function leadFollowupDays(settings: Settings): number[] {
  return settings?.leadFollowupDays ?? DEFAULT_AUTOMATION_SETTINGS.leadFollowupDays;
}

export function quoteFollowupDays(settings: Settings): number[] {
  return settings?.quoteFollowupDays ?? DEFAULT_AUTOMATION_SETTINGS.quoteFollowupDays;
}

export function reviewRequestDelayDays(settings: Settings): number {
  return settings?.reviewRequestDelayDays ?? DEFAULT_AUTOMATION_SETTINGS.reviewRequestDelayDays;
}

/** When stage `stage` of the sequence is due, counted from `from`; null once the sequence is exhausted. */
export function stageDueAt(days: number[], stage: number, from: Date = new Date()): Date | null {
  const d = days[stage];
  return d === undefined ? null : new Date(from.getTime() + d * DAY);
}

/** The company's settings by owner id (one query), for callers that only have the userId. */
export async function automationSettingsFor(userId: string): Promise<Partial<AutomationSettings>> {
  const [profile] = await db.select({ automationSettings: businessProfilesTable.automationSettings }).from(businessProfilesTable).where(eq(businessProfilesTable.userId, userId));
  return settingsOf(profile);
}
