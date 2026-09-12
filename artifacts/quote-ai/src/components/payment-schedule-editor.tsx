import { Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
    <div className="space-y-3">
      <div className="space-y-2">
        {value.terms.map((term, i) => (
          <div key={term.id} className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-slate-300 shrink-0" />
              <span className="text-xs font-semibold text-slate-400 w-5 shrink-0">{i + 1}.</span>
              <Input
                value={term.label}
                onChange={(e) => updateTerm(term.id, { label: e.target.value })}
                placeholder={t("paymentSchedule.labelPlaceholder")}
                className="h-8 text-sm flex-1"
              />
              <button
                type="button"
                onClick={() => removeTerm(term.id)}
                className="text-slate-300 hover:text-red-500 hover:bg-red-50 rounded p-1 transition-colors shrink-0"
                aria-label={t("paymentSchedule.remove")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pl-11">
              <label className="space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{t("paymentSchedule.when")}</span>
                <select
                  value={term.type}
                  onChange={(e) => {
                    const type = e.target.value as PaymentTermType;
                    updateTerm(term.id, { type, trigger: triggerForType(type), dueDays: type === "deposit" ? 0 : term.dueDays || 15 });
                  }}
                  className="w-full h-8 text-xs rounded-md border border-slate-200 bg-white px-2 focus:outline-none focus:border-violet-400"
                >
                  {TERM_TYPES.map((tt) => (
                    <option key={tt} value={tt}>{t(`paymentSchedule.type.${tt}`)}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{t("paymentSchedule.amount")}</span>
                <div className="flex">
                  <Input
                    type="number"
                    min={0}
                    step={term.amountType === "percent" ? 1 : 0.01}
                    value={Number.isFinite(term.value) ? term.value : 0}
                    onChange={(e) => updateTerm(term.id, { value: Number(e.target.value) })}
                    className="h-8 text-xs rounded-r-none"
                  />
                  <button
                    type="button"
                    onClick={() => updateTerm(term.id, { amountType: term.amountType === "percent" ? "fixed" : "percent" })}
                    className="h-8 px-2 text-xs font-semibold border border-l-0 border-slate-200 rounded-r-md bg-slate-50 hover:bg-slate-100 text-slate-600"
                    title={t("paymentSchedule.toggleAmountType")}
                  >
                    {term.amountType === "percent" ? "%" : "$"}
                  </button>
                </div>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{t("paymentSchedule.dueDays")}</span>
                <Input
                  type="number"
                  min={0}
                  value={term.dueDays}
                  onChange={(e) => updateTerm(term.id, { dueDays: Math.max(0, Number(e.target.value)) })}
                  className="h-8 text-xs"
                />
              </label>
              <div className="space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{t("paymentSchedule.equals")}</span>
                <div className="h-8 flex items-center text-sm font-semibold text-slate-700">
                  {total > 0 ? formatCad(paymentTermAmount(term, total)) : term.amountType === "percent" ? `${term.value}%` : formatCad(term.value)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button type="button" variant="outline" size="sm" onClick={addTerm} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> {t("paymentSchedule.addTerm")}
        </Button>
        <div className={cn("text-xs font-medium", problem ? "text-amber-600" : "text-emerald-600")}>
          {total > 0
            ? `${t("paymentSchedule.scheduled")}: ${formatCad(scheduleTotal(value, total))} / ${formatCad(total)}`
            : `${t("paymentSchedule.scheduled")}: ${percentSum}%`}
        </div>
      </div>

      {problem && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          {t(`paymentSchedule.error.${problem}`)}
        </p>
      )}

      {showHoldback && (
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <div>
            <div className="text-sm font-medium text-slate-700">{t("paymentSchedule.holdback")}</div>
            <div className="text-xs text-slate-500">{t("paymentSchedule.holdbackHint")}</div>
          </div>
          <div className="flex items-center gap-2">
            {value.holdback.enabled && (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  max={50}
                  value={value.holdback.percent}
                  onChange={(e) => onChange({ ...value, holdback: { ...value.holdback, percent: Number(e.target.value) } })}
                  className="h-8 w-16 text-xs"
                />
                <span className="text-xs text-slate-500">%</span>
              </div>
            )}
            <Switch
              checked={value.holdback.enabled}
              onCheckedChange={(enabled) => onChange({ ...value, holdback: { ...value.holdback, enabled } })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
