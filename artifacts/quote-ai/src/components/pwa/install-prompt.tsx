import { useState } from "react";
import { Smartphone, Share, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { usePwa, promptInstall } from "@/lib/pwa";

const SNOOZE_KEY = "quoteai-install-snoozed";
const SNOOZE_DAYS = 30;

function snoozed(): boolean {
  try {
    const until = Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
    return until > Date.now();
  } catch {
    return false;
  }
}

/**
 * Phase 77: "Add QuoteAI to your home screen". Chrome/Android get the real
 * install dialog; iOS Safari gets the two-step instructions (there is no
 * prompt API). Hidden once installed, and for 30 days after a dismissal.
 */
export function InstallPrompt({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { t } = useLanguage();
  const pwa = usePwa();
  const [hidden, setHidden] = useState(snoozed);
  const [showIosSteps, setShowIosSteps] = useState(false);

  if (hidden || pwa.standalone || !pwa.supported) return null;
  if (!pwa.canPrompt && !pwa.ios) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 86_400_000));
    } catch {
      /* private mode */
    }
    setHidden(true);
  };

  const install = async () => {
    if (pwa.canPrompt) {
      const ok = await promptInstall();
      if (ok) setHidden(true);
      return;
    }
    setShowIosSteps(true);
  };

  return (
    <section className={cn(compact ? "card p-4" : "card p-5", className)} aria-label={t("install.title")}>
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-xl p-2" style={{ background: "var(--soft)", color: "var(--navy)" }}><Smartphone className="h-5 w-5" /></div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold" style={{ color: "var(--navy)" }}>{t("install.title")}</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-mk)" }}>{t("install.body")}</p>
          {showIosSteps && (
            <ol className="mt-2 text-xs space-y-1 list-decimal pl-4" style={{ color: "var(--ink)" }}>
              <li className="inline-flex items-center gap-1">{t("install.iosStep1")} <Share className="h-3.5 w-3.5" aria-hidden /></li>
              <li>{t("install.iosStep2")}</li>
            </ol>
          )}
          <div className="mt-3 flex items-center gap-2">
            {!showIosSteps && <button type="button" className="btn btn-navy btn-sm" onClick={() => void install()}>{pwa.canPrompt ? t("install.cta") : t("install.howTo")}</button>}
            <button type="button" className="text-xs" style={{ color: "var(--muted-mk)" }} onClick={dismiss}>{t("install.notNow")}</button>
          </div>
        </div>
        <button type="button" aria-label={t("install.notNow")} className="p-1 shrink-0" style={{ color: "var(--faint)" }} onClick={dismiss}><X className="h-4 w-4" /></button>
      </div>
    </section>
  );
}
