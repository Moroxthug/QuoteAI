import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/i18n/LanguageContext";
import { SettingsGroup, SettingsRow, SettingsSection, ToggleRow, useSettingsDraft } from "./ui";
import { isUrl, orNull, parseCadence, useBusinessProfile, useSaveBusinessProfile } from "./data";

type FollowupDraft = {
  notifyOnQuoteAccepted: boolean;
  leadCadence: string;
  quoteCadence: string;
  googleReviewUrl: string;
  homeStarsProfileUrl: string;
  sendReviewRequests: boolean;
  reviewRequestDelayDays: number;
};

/** Selling → Quotes & follow-ups: the automatic nudges to leads and clients, and the review request after a job. */
export function FollowupsSection() {
  const { t } = useLanguage();
  const { data: profile, isLoading } = useBusinessProfile();
  const saveProfile = useSaveBusinessProfile();
  const source = useMemo<FollowupDraft | undefined>(() => profile && {
    notifyOnQuoteAccepted: profile.automationSettings?.notifyOnQuoteAccepted ?? true,
    leadCadence: (profile.automationSettings?.leadFollowupDays ?? [1, 3, 7]).join(", "),
    quoteCadence: (profile.automationSettings?.quoteFollowupDays ?? [2, 5, 10]).join(", "),
    googleReviewUrl: profile.googleReviewUrl ?? "",
    homeStarsProfileUrl: profile.homeStarsProfileUrl ?? "",
    sendReviewRequests: profile.sendReviewRequests ?? true,
    reviewRequestDelayDays: profile.automationSettings?.reviewRequestDelayDays ?? 3,
  }, [profile]);

  const urlError = (s: string) => (s.trim() && !isUrl(s.trim()) ? t("settings.error.url") : null);
  const valid = (d: FollowupDraft) => parseCadence(d.leadCadence) !== null && parseCadence(d.quoteCadence) !== null && !urlError(d.googleReviewUrl) && !urlError(d.homeStarsProfileUrl);
  const { draft, set } = useSettingsDraft<FollowupDraft>(
    source,
    async (d, s) => {
      const body: Record<string, unknown> = {};
      if (d.googleReviewUrl !== s.googleReviewUrl) body.googleReviewUrl = orNull(d.googleReviewUrl);
      if (d.homeStarsProfileUrl !== s.homeStarsProfileUrl) body.homeStarsProfileUrl = orNull(d.homeStarsProfileUrl);
      if (d.sendReviewRequests !== s.sendReviewRequests) body.sendReviewRequests = d.sendReviewRequests;
      const auto: Record<string, unknown> = {};
      if (d.notifyOnQuoteAccepted !== s.notifyOnQuoteAccepted) auto.notifyOnQuoteAccepted = d.notifyOnQuoteAccepted;
      if (d.leadCadence !== s.leadCadence) auto.leadFollowupDays = parseCadence(d.leadCadence);
      if (d.quoteCadence !== s.quoteCadence) auto.quoteFollowupDays = parseCadence(d.quoteCadence);
      if (d.reviewRequestDelayDays !== s.reviewRequestDelayDays) auto.reviewRequestDelayDays = d.reviewRequestDelayDays;
      if (Object.keys(auto).length) body.automationSettings = auto;
      await saveProfile(body);
    },
    valid,
  );

  const cadenceNote = (text: string, okKey: string) => {
    const days = parseCadence(text);
    if (days === null) return { error: t("dashboard.settings.business.cadenceInvalid"), help: undefined };
    return { error: null, help: days.length === 0 ? t("dashboard.settings.business.cadenceOff") : t(okKey) };
  };

  if (isLoading || !draft) {
    return (
      <SettingsSection title={t("settings.section.followups")} intro={t("settings.intro.followups")}>
        <Skeleton className="h-64 w-full rounded-[var(--radius)]" />
      </SettingsSection>
    );
  }
  const lead = cadenceNote(draft.leadCadence, "dashboard.settings.business.leadCadenceHint");
  const quote = cadenceNote(draft.quoteCadence, "dashboard.settings.business.quoteCadenceHint");

  return (
    <SettingsSection title={t("settings.section.followups")} intro={t("settings.intro.followups")}>
      <SettingsGroup title={t("dashboard.settings.business.followupCadence")} desc={t("dashboard.settings.business.followupCadenceHint")}>
        <SettingsRow label={t("dashboard.settings.business.leadCadence")} help={lead.help} htmlFor="s-fu-lead" error={lead.error}>
          <input id="s-fu-lead" value={draft.leadCadence} onChange={(e) => set("leadCadence", e.target.value)} placeholder="1, 3, 7" inputMode="numeric" aria-invalid={!!lead.error} />
        </SettingsRow>
        <SettingsRow label={t("dashboard.settings.business.quoteCadence")} help={quote.help} htmlFor="s-fu-quote" error={quote.error}>
          <input id="s-fu-quote" value={draft.quoteCadence} onChange={(e) => set("quoteCadence", e.target.value)} placeholder="2, 5, 10" inputMode="numeric" aria-invalid={!!quote.error} />
        </SettingsRow>
        <ToggleRow label={t("dashboard.settings.business.notifyAccepted")} help={t("dashboard.settings.business.notifyAcceptedHint")} checked={draft.notifyOnQuoteAccepted} onChange={(v) => set("notifyOnQuoteAccepted", v)} />
      </SettingsGroup>

      <SettingsGroup title={t("dashboard.settings.business.reviewsTitle")} desc={t("dashboard.settings.business.reviewsDesc")}>
        <SettingsRow label={t("dashboard.settings.business.googleReviewUrl")} help={t("dashboard.settings.business.googleReviewUrlHint")} htmlFor="s-fu-google" error={urlError(draft.googleReviewUrl)}>
          <input id="s-fu-google" type="url" inputMode="url" value={draft.googleReviewUrl} onChange={(e) => set("googleReviewUrl", e.target.value)} placeholder="https://g.page/r/.../review" aria-invalid={!!urlError(draft.googleReviewUrl)} />
        </SettingsRow>
        <SettingsRow label={t("dashboard.settings.business.homeStarsProfileUrl")} help={t("dashboard.settings.business.homeStarsProfileUrlHint")} htmlFor="s-fu-homestars" error={urlError(draft.homeStarsProfileUrl)}>
          <input id="s-fu-homestars" type="url" inputMode="url" value={draft.homeStarsProfileUrl} onChange={(e) => set("homeStarsProfileUrl", e.target.value)} placeholder="https://homestars.com/companies/..." aria-invalid={!!urlError(draft.homeStarsProfileUrl)} />
        </SettingsRow>
        <ToggleRow label={t("dashboard.settings.business.sendReviewRequests")} help={t("dashboard.settings.business.sendReviewRequestsHint")} checked={draft.sendReviewRequests} onChange={(v) => set("sendReviewRequests", v)} disabled={!draft.googleReviewUrl.trim()} />
        {draft.sendReviewRequests && (
          <SettingsRow label={t("dashboard.settings.business.reviewDelay")} help={t("dashboard.settings.business.reviewDelayHint")} htmlFor="s-fu-delay">
            <select id="s-fu-delay" value={draft.reviewRequestDelayDays} onChange={(e) => set("reviewRequestDelayDays", Number(e.target.value))}>
              {[0, 1, 2, 3, 5, 7, 10, 14].map((d) => (
                <option key={d} value={d}>{d === 0 ? t("dashboard.settings.business.reviewDelaySameDay") : d === 1 ? t("dashboard.settings.business.reviewDelayDay") : t("dashboard.settings.business.reviewDelayDays").replace("{n}", String(d))}</option>
              ))}
            </select>
          </SettingsRow>
        )}
      </SettingsGroup>
    </SettingsSection>
  );
}
