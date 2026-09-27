import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/i18n/LanguageContext";
import { PaymentScheduleEditor } from "@/components/payment-schedule-editor";
import { defaultPaymentSchedule, type PaymentSchedule } from "@/lib/payment-schedule";
import { SettingsGroup, SettingsRow, SettingsSection, ToggleRow, useSettingsDraft } from "./ui";
import { EMAIL_RE, orNull, useBusinessProfile, useSaveBusinessProfile } from "./data";

type InvoicingDraft = {
  etransferEmail: string;
  schedule: PaymentSchedule;
  autoSendInvoices: boolean;
  invoiceAutoSendAfterHours: number;
  invoiceReminders: boolean;
};

/** Business → Invoices & payments: how clients pay you, the deposit schedule new quotes start from, and invoice automation. */
export function InvoicingSection() {
  const { t, lang } = useLanguage();
  const { data: profile, isLoading } = useBusinessProfile();
  const saveProfile = useSaveBusinessProfile();
  const source = useMemo<InvoicingDraft | undefined>(() => profile && {
    etransferEmail: profile.etransferEmail ?? "",
    schedule: profile.defaultPaymentSchedule ?? defaultPaymentSchedule(lang),
    autoSendInvoices: profile.automationSettings?.autoSendInvoices ?? false,
    invoiceAutoSendAfterHours: profile.automationSettings?.invoiceAutoSendAfterHours ?? 0,
    invoiceReminders: profile.automationSettings?.invoiceReminders ?? true,
    // The language only picks the starting labels; switching it must not reset the draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const emailError = (d: InvoicingDraft) => (d.etransferEmail.trim() && !EMAIL_RE.test(d.etransferEmail.trim()) ? t("dashboard.profile.errors.invalidEmail") : null);
  const { draft, set } = useSettingsDraft<InvoicingDraft>(
    source,
    async (d, s) => {
      const body: Record<string, unknown> = {};
      if (d.etransferEmail !== s.etransferEmail) body.etransferEmail = orNull(d.etransferEmail);
      if (JSON.stringify(d.schedule) !== JSON.stringify(s.schedule)) body.defaultPaymentSchedule = d.schedule;
      if (d.autoSendInvoices !== s.autoSendInvoices || d.invoiceAutoSendAfterHours !== s.invoiceAutoSendAfterHours || d.invoiceReminders !== s.invoiceReminders) {
        body.automationSettings = { autoSendInvoices: d.autoSendInvoices, invoiceAutoSendAfterHours: d.invoiceAutoSendAfterHours, invoiceReminders: d.invoiceReminders };
      }
      await saveProfile(body);
    },
    (d) => !emailError(d),
  );

  return (
    <SettingsSection title={t("settings.section.invoicing")} intro={t("settings.intro.invoicing")}>
      {isLoading || !draft ? (
        <Skeleton className="h-64 w-full rounded-[var(--radius)]" />
      ) : (
        <>
          <SettingsGroup title={t("dashboard.settings.business.paymentsTitle")}>
            <SettingsRow label={t("dashboard.settings.business.etransferEmail")} help={t("dashboard.settings.business.etransferHint")} htmlFor="s-inv-etransfer" error={emailError(draft)}>
              <input id="s-inv-etransfer" type="email" inputMode="email" value={draft.etransferEmail} onChange={(e) => set("etransferEmail", e.target.value)} placeholder="payments@yourcompany.ca" aria-invalid={!!emailError(draft)} />
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup title={t("dashboard.settings.business.scheduleTitle")} desc={t("dashboard.settings.business.scheduleDesc")}>
            <div className="sgroup-pad">
              <PaymentScheduleEditor value={draft.schedule} onChange={(v) => set("schedule", v)} total={0} />
            </div>
          </SettingsGroup>

          <SettingsGroup title={t("settings.group.invoiceAutomation")}>
            <ToggleRow label={t("dashboard.settings.business.autoSendInvoices")} help={t("dashboard.settings.business.autoSendInvoicesHint")} checked={draft.autoSendInvoices} onChange={(v) => set("autoSendInvoices", v)} />
            {!draft.autoSendInvoices && (
              <SettingsRow label={t("dashboard.settings.business.invoiceReviewWindow")} help={t("dashboard.settings.business.invoiceReviewWindowHint")} htmlFor="s-inv-window">
                <select id="s-inv-window" value={draft.invoiceAutoSendAfterHours} onChange={(e) => set("invoiceAutoSendAfterHours", Number(e.target.value))}>
                  <option value={0}>{t("dashboard.settings.business.reviewNever")}</option>
                  <option value={24}>24 h</option>
                  <option value={48}>48 h</option>
                  <option value={72}>72 h</option>
                </select>
              </SettingsRow>
            )}
            <ToggleRow label={t("dashboard.settings.business.invoiceReminders")} help={t("dashboard.settings.business.invoiceRemindersHint")} checked={draft.invoiceReminders} onChange={(v) => set("invoiceReminders", v)} />
          </SettingsGroup>
        </>
      )}
    </SettingsSection>
  );
}
