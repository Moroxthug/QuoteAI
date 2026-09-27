import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/i18n/LanguageContext";
import { CANADIAN_PROVINCES } from "@/lib/payment-schedule";
import { SettingsGroup, SettingsRow, SettingsSection, useSettingsDraft } from "./ui";
import { PROVINCE_TAX, changed, orNull, useBusinessProfile, useSaveBusinessProfile } from "./data";

type TaxDraft = { province: string; gstHstNumber: string; qstNumber: string; pstNumber: string };

/** Business → Taxes & province: which sales taxes quotes and invoices charge, and the numbers printed with them. */
export function TaxesSection() {
  const { t, lang } = useLanguage();
  const { data: profile, isLoading } = useBusinessProfile();
  const saveProfile = useSaveBusinessProfile();
  const source = useMemo<TaxDraft | undefined>(() => profile && {
    province: profile.province ?? "",
    gstHstNumber: profile.gstHstNumber ?? "",
    qstNumber: profile.qstNumber ?? "",
    pstNumber: profile.pstNumber ?? "",
  }, [profile]);
  const { draft, set } = useSettingsDraft<TaxDraft>(source, async (d, s) => {
    const body: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(changed(d, s))) body[k] = orNull(v as string);
    await saveProfile(body);
  });

  const hint = draft ? PROVINCE_TAX[draft.province] : undefined;
  return (
    <SettingsSection title={t("settings.section.taxes")} intro={t("settings.intro.taxes")}>
      {isLoading || !draft ? (
        <Skeleton className="h-48 w-full rounded-[var(--radius)]" />
      ) : (
        <SettingsGroup>
          <SettingsRow label={t("dashboard.settings.business.province")} help={hint ? <>{t("dashboard.settings.business.taxApplied")}: <strong>{hint}</strong></> : t("settings.help.province")} htmlFor="s-tax-province">
            <select id="s-tax-province" value={draft.province} onChange={(e) => set("province", e.target.value)}>
              <option value="">{t("dashboard.settings.business.provinceSelect")}</option>
              {CANADIAN_PROVINCES.map((p) => (
                <option key={p.code} value={p.code}>{lang === "fr" ? p.fr : p.en}</option>
              ))}
            </select>
          </SettingsRow>
          <SettingsRow label={t("dashboard.settings.business.gstHst")} help={t("settings.help.gst")} htmlFor="s-tax-gst">
            <input id="s-tax-gst" value={draft.gstHstNumber} onChange={(e) => set("gstHstNumber", e.target.value)} placeholder="123456789 RT0001" />
          </SettingsRow>
          {draft.province === "QC" && (
            <SettingsRow label={t("dashboard.settings.business.qst")} htmlFor="s-tax-qst">
              <input id="s-tax-qst" value={draft.qstNumber} onChange={(e) => set("qstNumber", e.target.value)} placeholder="1234567890 TQ0001" />
            </SettingsRow>
          )}
          {(draft.province === "BC" || draft.province === "SK" || draft.province === "MB") && (
            <SettingsRow label={t("dashboard.settings.business.pst")} htmlFor="s-tax-pst">
              <input id="s-tax-pst" value={draft.pstNumber} onChange={(e) => set("pstNumber", e.target.value)} placeholder="PST-1234-5678" />
            </SettingsRow>
          )}
        </SettingsGroup>
      )}
    </SettingsSection>
  );
}
