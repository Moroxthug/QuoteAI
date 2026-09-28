import type { CSSProperties, ReactNode } from "react";
import { Link } from "wouter";
import { Info } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { isNativeApp } from "@/lib/native/env";

// Phase 118: the phone apps sell nothing. App Store 3.1.1 and Google Play's
// payments policy require in-app purchase for digital subscriptions, and
// QuoteAI's are sold on the website — so in the app every upgrade link, plan
// grid and checkout is left out (on iOS the app may not even point to where to
// buy). Plan-locked screens still say which plan adds the feature.

/** A link to Plan & billing ("Upgrade"): the website only. */
export function UpgradeLink({ className, style, children }: { className?: string; style?: CSSProperties; children?: ReactNode }) {
  if (isNativeApp) return null;
  return <Link href="/dashboard/billing" className={className} style={style}>{children}</Link>;
}

/** Said in the app where the website shows plans and checkout. */
export function AppPlanNote() {
  const { t } = useLanguage();
  return (
    <p className="notice info m-0" data-app-plan-note="">
      <Info aria-hidden="true" />
      <span>{t("settings.plan.appNote")}</span>
    </p>
  );
}
