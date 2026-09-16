import { Sparkles } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { AssistantPanel } from "@/components/assistant/assistant-panel";

/** Company-wide assistant: every job, invoice and cash question in one place. */
export default function AssistantPage() {
  const { t } = useLanguage();
  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2"><Sparkles className="h-8 w-8 text-navy-600" />{t("assistant.pageTitle")}</h1>
        <p className="text-slate-500 mt-1">{t("assistant.pageSubtitle")}</p>
      </div>
      <AssistantPanel projectId={null} />
    </div>
  );
}
