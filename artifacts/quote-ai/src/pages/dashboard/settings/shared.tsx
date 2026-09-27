import { AlertCircle } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

// Phase 65: an integration whose server-side app registration is missing
// reports `available: false` on its status endpoint. Rendered in place of the
// Connect button so nobody is bounced to a vendor error page.
export function NotAvailableNote() {
  const { t } = useLanguage();
  return (
    <div className="flex items-start gap-2 text-xs text-muted-foreground" data-testid="integration-not-available">
      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <div>
        <p className="font-medium text-foreground">{t("dashboard.settings.integrations.notAvailableTitle")}</p>
        <p className="mt-0.5">{t("dashboard.settings.integrations.notAvailableDesc")}</p>
      </div>
    </div>
  );
}
