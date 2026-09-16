import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetQuoteQueryKey } from "@workspace/api-client-react";
import { CalendarClock, Pencil, Save, X, Loader2, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { PaymentScheduleEditor } from "@/components/payment-schedule-editor";
import { type PaymentSchedule, paymentTermAmount, validateSchedule } from "@/lib/payment-schedule";

const formatCad = (amount: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(amount);

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
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              {t("paymentSchedule.title")}
            </CardTitle>
            <CardDescription className="text-xs mt-1">{t("paymentSchedule.description")}</CardDescription>
          </div>
          {!editing && !locked && (
            <Button variant="ghost" size="sm" className="h-7 px-2 gap-1 text-xs" onClick={startEdit}>
              <Pencil className="h-3 w-3" /> {t("paymentSchedule.edit")}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {editing && draft ? (
          <>
            <PaymentScheduleEditor value={draft} onChange={setDraft} total={total} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving} className="gap-1">
                <X className="h-3.5 w-3.5" /> {t("paymentSchedule.cancel")}
              </Button>
              <Button size="sm" onClick={save} disabled={saving} className="gap-1">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {t("paymentSchedule.save")}
              </Button>
            </div>
          </>
        ) : (
          <>
            <ol className="space-y-2">
              {schedule.terms.map((term, i) => (
                <li key={term.id} className="flex items-start justify-between gap-3 text-sm">
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="h-5 w-5 rounded-full bg-navy-100 text-navy-700 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    <div className="min-w-0">
                      <div className="text-slate-800 font-medium leading-tight truncate">{term.label || t(`paymentSchedule.type.${term.type}`)}</div>
                      <div className="text-[11px] text-slate-400">
                        {t(`paymentSchedule.type.${term.type}`)}
                        {term.dueDays > 0 ? ` · ${t("paymentSchedule.net").replace("{days}", String(term.dueDays))}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-semibold text-slate-800">{formatCad(paymentTermAmount(term, total))}</div>
                    {term.amountType === "percent" && <div className="text-[11px] text-slate-400">{term.value}%</div>}
                  </div>
                </li>
              ))}
            </ol>
            <div className="flex items-center justify-between pt-2 border-t text-xs">
              <div className="flex items-center gap-1.5">
                {schedule.derived ? (
                  <Badge variant="secondary" className="gap-1 text-[10px] font-medium">
                    <Sparkles className="h-3 w-3" /> {t("paymentSchedule.derivedBadge")}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px] font-medium">{t("paymentSchedule.customBadge")}</Badge>
                )}
                {schedule.holdback.enabled && (
                  <Badge variant="outline" className="text-[10px] font-medium">{t("paymentSchedule.holdbackBadge").replace("{pct}", String(schedule.holdback.percent))}</Badge>
                )}
              </div>
              <span className="text-slate-500">{t("paymentSchedule.total")}: <strong className="text-slate-800">{formatCad(total)}</strong></span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
