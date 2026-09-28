import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { BottomSheet } from "@/components/mobile/bottom-sheet";

/**
 * Phase 121 — the guided first quote (APP-PLAN Phase 121): describe one real
 * job → it prices → send it to yourself to see what the client gets. A quiet
 * card on top of the real screens, not a tour over them: the person does the
 * real thing, and "Skip the guide" closes it for good.
 */
export function FirstQuoteCoach({ step, title, body, action, onSkip }: { step: 1 | 2; title: string; body: ReactNode; action?: ReactNode; onSkip: () => void }) {
  const { t } = useLanguage();
  return (
    <section className="fq-coach" aria-labelledby="fq-coach-title" data-first-quote={step}>
      <div className="fq-coach-head">
        <span className="fq-coach-step">{t("firstRun.fq.stepOf").replace("{n}", String(step)).replace("{total}", "3")}</span>
        <button type="button" className="fq-coach-skip" onClick={onSkip}>{t("firstRun.fq.skip")}</button>
      </div>
      <h2 id="fq-coach-title">{title}</h2>
      <p>{body}</p>
      {action && <div className="fq-coach-action">{action}</div>}
    </section>
  );
}

/** Step 3 of 3: it went out. Then (on close) the one notification ask, with its reason. */
export function FirstQuoteDone({ open, email, elapsed, onClose }: { open: boolean; email: string; elapsed: string | null; onClose: () => void }) {
  const { t } = useLanguage();
  return (
    <BottomSheet
      open={open}
      onOpenChange={(v) => { if (!v) onClose(); }}
      title={t("firstRun.fq.doneTitle")}
      footer={<button type="button" className="btn btn-navy w-full" onClick={onClose} data-primary-action>{t("firstRun.fq.doneButton")}</button>}
    >
      <div className="flex items-start gap-3" data-first-quote-done="">
        <span className="shrink-0 rounded-xl p-2" style={{ background: "var(--green-t, #e7f4e3)", color: "var(--green, #227a15)" }}><CheckCircle2 className="h-5 w-5" aria-hidden="true" /></span>
        <div className="text-sm" style={{ color: "var(--muted-mk)" }}>
          <p className="m-0">{t("firstRun.fq.doneBody").replace("{email}", email)}</p>
          {elapsed && <p className="m-0 mt-2" style={{ color: "var(--ink)" }}>{t("firstRun.fq.doneTime").replace("{time}", elapsed)}</p>}
        </div>
      </div>
    </BottomSheet>
  );
}
