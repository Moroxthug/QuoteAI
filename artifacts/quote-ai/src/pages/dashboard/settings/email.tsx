import { useLanguage } from "@/i18n/LanguageContext";
import { EmailConnectionCard } from "./apps";
import { SettingsSection } from "./ui";

/** Messaging → Email sender: send quotes and invoices from your own Gmail instead of QuoteAI's address (Phase 20). */
export function EmailSection() {
  const { t } = useLanguage();
  return (
    <SettingsSection title={t("settings.section.email")} intro={t("dashboard.settings.emailSend.desc")}>
      <div className="grid gap-3 sm:grid-cols-2">
        <EmailConnectionCard />
      </div>
    </SettingsSection>
  );
}
