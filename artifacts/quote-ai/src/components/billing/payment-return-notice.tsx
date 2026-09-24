import { useEffect, useRef, useState } from "react";
import { useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Info, X } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

/**
 * Phase 93: the way back from Stripe checkout (`?payment=success|cancelled`)
 * used to land on a page that said nothing. Say what happened, and on success
 * ask the server to read the subscription from Stripe right away (the webhook
 * may still be on its way), then refresh everything that depends on the plan.
 * The parameter is dropped from the address so a reload doesn't repeat it.
 */
export function PaymentReturnNotice() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const initial = new URLSearchParams(useSearch()).get("payment");
  const [state, setState] = useState<"success" | "cancelled" | null>(initial === "success" || initial === "cancelled" ? initial : null);
  const handled = useRef(false);

  useEffect(() => {
    if (!state || handled.current) return;
    handled.current = true;
    const url = new URL(window.location.href);
    url.searchParams.delete("payment");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    if (state !== "success") return;
    void fetch("/api/payments/sync-subscription", { method: "POST", credentials: "include" })
      .catch(() => undefined)
      .finally(() => void queryClient.invalidateQueries());
  }, [state, queryClient]);

  if (!state) return null;
  return (
    <div className={state === "success" ? "notice ok mb-4" : "notice info mb-4"} role="status" data-payment-return={state}>
      {state === "success" ? <CheckCircle2 /> : <Info />}
      <span className="grow">{t(state === "success" ? "payment.return.success" : "payment.return.cancelled")}</span>
      <button type="button" className="ic-btn" aria-label={t("payment.return.dismiss")} onClick={() => setState(null)}><X /></button>
    </div>
  );
}
