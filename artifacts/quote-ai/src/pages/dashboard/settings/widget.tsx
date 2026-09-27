import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetBusinessProfileQueryKey } from "@workspace/api-client-react";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { ActionRow, SettingsGroup, SettingsSection } from "./ui";
import { useBusinessProfile } from "./data";

/**
 * Selling → Website widget: the one place for the widget (it used to appear
 * both here and under Business Account). The key and the snippet are
 * actions, not fields, so nothing here goes through the save bar.
 */
export function WidgetSection() {
  const { t, lang } = useLanguage();
  const { data: profile, isLoading } = useBusinessProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<"key" | "code" | null>(null);
  const apiKey = profile?.apiKey || "";

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/business-profile/apikey", { method: "POST" });
      if (!res.ok) throw new Error(t("dashboard.settings.widget.errorGenerating"));
      await queryClient.invalidateQueries({ queryKey: getGetBusinessProfileQueryKey() });
      toast({ title: t("dashboard.settings.widget.apiKeyGenerated") });
    } catch (err) {
      toast({ title: t("dashboard.settings.widget.errorGenerating"), description: err instanceof Error ? err.message : t("dashboard.settings.widget.tryAgainLater"), variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const copy = (text: string, what: "key" | "code") => {
    void navigator.clipboard.writeText(text);
    setCopied(what);
    toast({ title: t("dashboard.settings.widget.copiedToClipboard") });
    setTimeout(() => setCopied(null), 2000);
  };

  const widgetUrl = typeof window !== "undefined" ? `${window.location.origin}/widget.js` : "https://quoteai.ca/widget.js";
  const embedCode = `<!-- QuoteAI Widget Funnel -->
<div id="quoteai-widget">
  <a href="https://quoteai.ca" rel="noopener">${t("dashboard.settings.widget.embedAnchorText")}</a>
</div>
<script
  src="${widgetUrl}"
  data-api-key="${apiKey}"
  async
></script>`;

  return (
    <SettingsSection title={t("settings.section.widget")} intro={t("dashboard.settings.widget.desc")}>
      {isLoading ? (
        <Skeleton className="h-48 w-full rounded-[var(--radius)]" />
      ) : !apiKey ? (
        <SettingsGroup>
          <ActionRow label={t("dashboard.settings.widget.step1Title")} help={t("dashboard.settings.widget.noKeyDesc")}>
            <button type="button" onClick={generate} disabled={generating} className="btn btn-navy btn-sm gap-2">
              {generating && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("dashboard.settings.widget.generateKeyButton")}
            </button>
          </ActionRow>
        </SettingsGroup>
      ) : (
        <>
          <SettingsGroup title={t("dashboard.settings.widget.step1Title")} desc={t("dashboard.settings.widget.step1Desc")}>
            <div className="sgroup-pad swidget-key">
              <input readOnly aria-label={t("dashboard.settings.widget.step1Title")} value={apiKey} className="swidget-mono" onFocus={(e) => e.currentTarget.select()} />
              <button type="button" onClick={() => copy(apiKey, "key")} className="btn btn-outline-navy btn-sm">
                {copied === "key" ? t("dashboard.settings.widget.copied") : t("dashboard.settings.widget.copy")}
              </button>
              <button type="button" onClick={generate} disabled={generating} className="btn btn-outline-navy btn-sm gap-2" title={t("dashboard.settings.account.widgetCard.regenerate")}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {t("dashboard.settings.account.widgetCard.regenerate")}
              </button>
            </div>
          </SettingsGroup>

          <SettingsGroup
            title={t("dashboard.settings.widget.step2Title")}
            desc={t("dashboard.settings.widget.step2Desc")}
            action={
              <button type="button" onClick={() => copy(embedCode, "code")} className="btn btn-navy btn-sm">
                {copied === "code" ? t("dashboard.settings.widget.copied") : t("dashboard.settings.widget.copyCode")}
              </button>
            }
          >
            <div className="sgroup-pad">
              <pre tabIndex={0} aria-label={t("dashboard.settings.widget.step2Title")} className="swidget-code">{embedCode}</pre>
            </div>
          </SettingsGroup>

          <SettingsGroup>
            <ActionRow label={t("dashboard.settings.widget.testLink")} help={<>{t("dashboard.settings.widget.testLinkDesc")} {t("dashboard.settings.widget.langHint")}</>}>
              <a href={`/widget-test.html?key=${encodeURIComponent(apiKey)}&lang=${lang}`} target="_blank" rel="noopener" className="btn btn-outline-navy btn-sm gap-1.5">
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                {t("settings.widget.test")}
              </a>
            </ActionRow>
          </SettingsGroup>
        </>
      )}
    </SettingsSection>
  );
}
