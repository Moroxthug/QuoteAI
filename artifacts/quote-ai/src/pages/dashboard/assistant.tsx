import { useLanguage } from "@/i18n/LanguageContext";
import { AssistantPanel } from "@/components/assistant/assistant-panel";

export default function AssistantPage() {
  const { t } = useLanguage();
  return (
    <div className="animate-in fade-in duration-500">
      <div className="page-head">
        <div>
          <h1>{t("assistant.pageTitle")}</h1>
          <p className="sub">{t("assistant.pageSubtitle")}</p>
        </div>
        <div className="head-actions"><span className="chip chip-purple">{t("assistant.includedInElite")}</span></div>
      </div>
      <AssistantPanel projectId={null} />
    </div>
  );
}
