import { useEffect, useState } from "react";
import { Camera, Mic } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { BottomSheet } from "@/components/mobile/bottom-sheet";
import { isNativeApp } from "@/lib/native/env";
import { WHY_EVENT, markExplained, type WhyRequest } from "@/lib/permission-why";

/** Phase 121: the one-line why before the phone's own camera / microphone question (lib/permission-why.ts). */
export function PermissionWhy() {
  const { t } = useLanguage();
  const [req, setReq] = useState<WhyRequest | null>(null);

  useEffect(() => {
    if (!isNativeApp) return;
    const on = (e: Event) => {
      const detail = (e as CustomEvent<WhyRequest>).detail;
      detail.claimed = true;
      setReq(detail);
    };
    window.addEventListener(WHY_EVENT, on);
    return () => window.removeEventListener(WHY_EVENT, on);
  }, []);

  if (!req) return null;
  const Icon = req.kind === "camera" ? Camera : Mic;
  const done = (go: boolean) => {
    markExplained(req.kind);
    req.answer(go);
    setReq(null);
  };

  return (
    <BottomSheet
      open
      onOpenChange={(v) => { if (!v) done(false); }}
      title={t(`firstRun.why.${req.kind}Title`)}
      footer={
        <div className="grid grid-cols-2 gap-2 w-full">
          <button type="button" className="btn btn-outline-navy" onClick={() => done(false)}>{t("firstRun.notNow")}</button>
          <button type="button" className="btn btn-navy" onClick={() => done(true)} data-primary-action>{t("firstRun.why.continue")}</button>
        </div>
      }
    >
      <div className="flex items-start gap-3" data-permission-why={req.kind}>
        <span className="shrink-0 rounded-xl p-2" style={{ background: "var(--soft)", color: "var(--navy)" }}><Icon className="h-5 w-5" aria-hidden="true" /></span>
        <p className="text-sm" style={{ color: "var(--muted-mk)" }}>{t(`firstRun.why.${req.kind}Body`)}</p>
      </div>
    </BottomSheet>
  );
}
