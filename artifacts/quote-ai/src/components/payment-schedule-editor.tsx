import { Plus, Trash2, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  type PaymentSchedule,
  type PaymentTerm,
  type PaymentTermType,
  newTermId,
  triggerForType,
  paymentTermAmount,
  scheduleTotal,
  validateSchedule,
} from "@/lib/payment-schedule";

const TERM_TYPES: PaymentTermType[] = ["deposit", "milestone", "completion", "holdback_release"];

const formatCad = (amount: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(amount);

/**
 * Editable list of payment tranches. `total` is the quote total the
 * percentages are checked against (pass 0 for a company-wide default
 * schedule where only percentages make sense).
 */
export function PaymentScheduleEditor({
  value,
  onChange,
  total,
  showHoldback = true,
}: {
  value: PaymentSchedule;
  onChange: (next: PaymentSchedule) => void;
  total: number;
  showHoldback?: boolean;
}) {
  const { t } = useLanguage();
  const problem = validateSchedule(value, total);
  const percentSum = value.terms.filter((x) => x.amountType === "percent").reduce((s, x) => s + x.value, 0);

  const updateTerm = (id: string, patch: Partial<PaymentTerm>) =>
    onChange({ ...value, terms: value.terms.map((x) => (x.id === id ? { ...x, ...patch } : x)) });

  const removeTerm = (id: string) => onChange({ ...value, terms: value.terms.filter((x) => x.id !== id) });

  const addTerm = () => {
    const remaining = Math.max(0, 100 - percentSum);
    onChange({
      ...value,
      terms: [
        ...value.terms,
        { id: newTermId(), type: "milestone", label: "", trigger: "milestone", amountType: "percent", value: remaining, dueDays: 15 },
      ],
    });
  };

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div>
        {value.terms.map((term, i) => (
          <div key={term.id} className="var-block">
            <div className="row">
              <GripVertical className="h-4 w-4 shrink-0" style={{ color: "var(--line)" }} />
              <span>{i + 1}.</span>
              <input
                value={term.label}
                onChange={(e) => updateTerm(term.id, { label: e.target.value })}
                placeholder={t("paymentSchedule.labelPlaceholder")}
                className="inp-sm"
              />
              <button type="button" onClick={() => removeTerm(term.id)} className="ic-btn danger" aria-label={t("paymentSchedule.remove")}>
                <Trash2 />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <label className="field sm">
                <span className="lbl-xs">{t("paymentSchedule.when")}</span>
                <select
                  value={term.type}
                  onChange={(e) => {
                    const type = e.target.value as PaymentTermType;
                    updateTerm(term.id, { type, trigger: triggerForType(type), dueDays: type === "deposit" ? 0 : term.dueDays || 15 });
                  }}
                  className="inp-sm"
                >
                  {TERM_TYPES.map((tt) => (
                    <option key={tt} value={tt}>{t(`paymentSchedule.type.${tt}`)}</option>
                  ))}
                </select>
              </label>
              <label className="field sm">
                <span className="lbl-xs">{t("paymentSchedule.amount")}</span>
                <div className="flex gap-1">
                  <input
                    type="number"
                    min={0}
                    step={term.amountType === "percent" ? 1 : 0.01}
                    value={Number.isFinite(term.value) ? term.value : 0}
                    onChange={(e) => updateTerm(term.id, { value: Number(e.target.value) })}
                    className="inp-sm r"
                  />
                  <button
                    type="button"
                    onClick={() => updateTerm(term.id, { amountType: term.amountType === "percent" ? "fixed" : "percent" })}
                    className="pill sm"
                    style={{ padding: "0 10px", flex: "none" }}
                    title={t("paymentSchedule.toggleAmountType")}
                  >
                    {term.amountType === "percent" ? "%" : "$"}
                  </button>
                </div>
              </label>
              <label className="field sm">
                <span className="lbl-xs">{t("paymentSchedule.dueDays")}</span>
                <input
                  type="number"
                  min={0}
                  value={term.dueDays}
                  onChange={(e) => updateTerm(term.id, { dueDays: Math.max(0, Number(e.target.value)) })}
                  className="inp-sm r"
                />
              </label>
              <div className="field sm">
                <span className="lbl-xs">{t("paymentSchedule.equals")}</span>
                <div className="t-amt" style={{ padding: "7px 0", fontSize: 13.5 }}>
                  {total > 0 ? formatCad(paymentTermAmount(term, total)) : term.amountType === "percent" ? `${term.value}%` : formatCad(term.value)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button type="button" onClick={addTerm} className="text-link">
          <Plus /> {t("paymentSchedule.addTerm")}
        </button>
        <span className={cn("foot-note")} style={{ color: problem ? "var(--yellow-dark)" : "var(--green-dark)" }}>
          {total > 0
            ? `${t("paymentSchedule.scheduled")}: ${formatCad(scheduleTotal(value, total))} / ${formatCad(total)}`
            : `${t("paymentSchedule.scheduled")}: ${percentSum}%`}
        </span>
      </div>

      {problem && (
        <div className="notice warn" style={{ marginTop: 0 }}>
          <span className="grow">{t(`paymentSchedule.error.${problem}`)}</span>
        </div>
      )}

      {showHoldback && (
        <div className="set-row" style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "12px 14px" }}>
          <div className="txt">
            <b>{t("paymentSchedule.holdback")}</b>
            <span>{t("paymentSchedule.holdbackHint")}</span>
          </div>
          {value.holdback.enabled && (
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={50}
                value={value.holdback.percent}
                onChange={(e) => onChange({ ...value, holdback: { ...value.holdback, percent: Number(e.target.value) } })}
                className="inp-sm r"
                style={{ width: 64 }}
                aria-label={t("paymentSchedule.holdback")}
              />
              <span className="foot-note">%</span>
            </div>
          )}
          <button
            type="button"
            role="switch"
            aria-checked={value.holdback.enabled}
            aria-label={t("paymentSchedule.holdback")}
            className={cn("tgl", value.holdback.enabled && "on")}
            onClick={() => onChange({ ...value, holdback: { ...value.holdback, enabled: !value.holdback.enabled } })}
          />
        </div>
      )}
    </div>
  );
}
