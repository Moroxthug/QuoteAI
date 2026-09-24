import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetQuoteQueryKey } from "@workspace/api-client-react";
import { CalendarClock, Pencil, Save, X, Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { PaymentScheduleEditor } from "@/components/payment-schedule-editor";
import { type PaymentSchedule, paymentTermAmount, validateSchedule } from "@/lib/payment-schedule";
import { formatCad } from "@/lib/money";


/**
 * Sidebar card on the quote detail page: shows the structured payment
 * schedule (deposit / progress / final) that will drive contract terms and
 * invoicing, and lets the company fix it if the AI-derived version is off.
 */
export function PaymentScheduleCard({
  quoteId,
  schedule,
  total,
  locked,
}: {
  quoteId: string;
  schedule: PaymentSchedule | null | undefined;
  total: number;
  locked: boolean;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PaymentSchedule | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(null);
  }, [editing]);

  if (!schedule) return null;

  const startEdit = () => {
    setDraft(JSON.parse(JSON.stringify(schedule)) as PaymentSchedule);
    setEditing(true);
  };

  const save = async () => {
    if (!draft) return;
    const problem = validateSchedule(draft, total);
    if (problem) {
      toast({ title: t(`paymentSchedule.error.${problem}`), variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/quotes/${quoteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ paymentSchedule: { ...draft, terms: draft.terms.map((x) => ({ ...x, label: x.label.trim() || t(`paymentSchedule.type.${x.type}`) })) } }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || "Save failed");
      }
      const updated = await res.json();
      queryClient.setQueryData(getGetQuoteQueryKey(quoteId), updated);
      toast({ title: t("paymentSchedule.saved") });
      setEditing(false);
    } catch (err) {
      toast({ title: t("paymentSchedule.saveError"), description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="flex items-center gap-2"><CalendarClock className="h-4 w-4" style={{ color: "var(--faint)" }} /> {t("paymentSchedule.title")}</h2>
          <p className="sub">{t("paymentSchedule.description")}</p>
        </div>
        {!editing && !locked && (
          <button type="button" className="text-link" onClick={startEdit}>
            <Pencil /> {t("paymentSchedule.edit")}
          </button>
        )}
      </div>
      {editing && draft ? (
        <div className="act-body">
          <PaymentScheduleEditor value={draft} onChange={setDraft} total={total} />
          <div className="flex justify-end gap-2" style={{ marginTop: 14 }}>
            <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => setEditing(false)} disabled={saving}>
              <X className="h-3.5 w-3.5" /> {t("paymentSchedule.cancel")}
            </button>
            <button type="button" className="btn btn-sm btn-navy" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {t("paymentSchedule.save")}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div>
            {schedule.terms.map((term, i) => (
              <div key={term.id} className="item-row">
                <span className="ms-num" style={{ width: 26, height: 26, fontSize: 11.5 }}>{i + 1}</span>
                <div className="grow">
                  <b className="ttl">{term.label || t(`paymentSchedule.type.${term.type}`)}</b>
                  <span className="sub">
                    {t(`paymentSchedule.type.${term.type}`)}
                    {term.dueDays > 0 ? ` · ${t("paymentSchedule.net").replace("{days}", String(term.dueDays))}` : ""}
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className="amt">{formatCad(paymentTermAmount(term, total))}</span>
                  {term.amountType === "percent" && <span className="sub">{term.value}%</span>}
                </div>
              </div>
            ))}
          </div>
          <div className="card-foot">
            <div className="flex items-center gap-1.5 flex-wrap">
              {schedule.derived ? (
                <span className="chip chip-grey"><Sparkles className="h-3 w-3 mr-1" /> {t("paymentSchedule.derivedBadge")}</span>
              ) : (
                <span className="chip chip-grey">{t("paymentSchedule.customBadge")}</span>
              )}
              {schedule.holdback.enabled && (
                <span className="chip chip-teal">{t("paymentSchedule.holdbackBadge").replace("{pct}", String(schedule.holdback.percent))}</span>
              )}
            </div>
            <span className="foot-note">{t("paymentSchedule.total")}: <b style={{ color: "var(--navy)" }}>{formatCad(total)}</b></span>
          </div>
        </>
      )}
    </section>
  );
}
