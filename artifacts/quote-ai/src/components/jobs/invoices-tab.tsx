import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enCA } from "date-fns/locale";
import { Plus, Receipt, CheckCircle2, Circle, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { formatCents, type JobDetailDto } from "@/lib/jobs-api";
import { invoicesApi } from "@/lib/invoices-api";
import { InvoiceRow } from "@/pages/dashboard/invoices";
import { NewInvoiceDialog } from "@/components/invoices/invoice-dialogs";

/**
 * Invoices tab on the job page: the billing plan (one row per payment
 * term + final + holdback release) with what has been invoiced/collected,
 * and the list of the job's invoices. Missing invoices can be created with
 * one click; the automations normally create them first.
 */
export function InvoicesTab({ data, locale }: { data: JobDetailDto; locale: typeof enCA }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [manualOpen, setManualOpen] = useState(false);
  const { job, milestones, invoices, invoiceTotals } = data;
  const terms = job.contract?.paymentSchedule.terms ?? [];
  const holdback = job.contract?.paymentSchedule.holdback;
  const live = invoices.filter((i) => i.status !== "void");

  const create = useMutation({
    mutationFn: (body: Parameters<typeof invoicesApi.createForJob>[1]) => invoicesApi.createForJob(job.id, body),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["job", job.id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({ title: res.created ? t("invoices.created") : t("invoices.alreadyExists") });
      navigate(`/dashboard/invoices/${res.invoice.id}`);
    },
    onError: (e: Error & { code?: string }) => toast({ title: e.code === "PLAN_REQUIRED" ? t("jobs.planRequired") : e.code === "NOTHING_TO_INVOICE" ? t("invoices.nothingToInvoice") : t("jobs.error"), description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label={t("invoices.kpi.invoiced")} value={formatCents(invoiceTotals.invoicedCents)} sub={invoiceTotals.draftCount ? `${invoiceTotals.draftCount} ${t("invoices.kpi.drafts")}` : undefined} />
        <Kpi label={t("invoices.kpi.collected")} value={formatCents(invoiceTotals.collectedCents)} accent="text-emerald-600" />
        <Kpi label={t("invoices.kpi.outstanding")} value={formatCents(invoiceTotals.outstandingCents)} accent="text-blue-600" sub={invoiceTotals.overdueCents ? `${formatCents(invoiceTotals.overdueCents)} ${t("invoices.kpi.overdue")}` : undefined} />
        <Kpi label={t("invoices.kpi.remaining")} value={formatCents(Math.max(0, job.totalValueCents - invoiceTotals.invoicedCents - live.filter((i) => i.status === "draft").reduce((s, i) => s + i.totalCents, 0)))} sub={t("invoices.kpi.remainingSub")} />
      </div>

      {job.contract && terms.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-card p-4 md:p-5">
          <h2 className="text-base font-bold text-slate-900 mb-3">{t("invoices.plan.title")}</h2>
          <ul className="divide-y">
            {terms.map((term) => {
              const ms = milestones.find((m) => m.paymentTermId === term.id);
              const inv = live.find((i) => i.paymentTermId === term.id) ?? (term.type === "completion" ? live.find((i) => i.type === "final") : undefined);
              const released = term.trigger === "on_signing" || ms?.status === "completed" || (term.trigger === "on_completion" && job.status === "completed");
              const kind = term.trigger === "on_signing" ? "deposit" : term.type === "completion" || term.trigger === "on_completion" ? "final" : term.trigger === "holdback_release" ? "holdback_release" : "term";
              const amount = job.contract ? Math.round((term.amountType === "percent" ? (job.contract.total * term.value) / 100 : term.value) * 100) : 0;
              return (
                <li key={term.id} className="flex items-center gap-3 py-2.5">
                  {inv ? <CheckCircle2 className={cn("h-4 w-4 shrink-0", inv.status === "paid" ? "text-emerald-500" : "text-blue-500")} /> : released ? <Circle className="h-4 w-4 text-amber-400 shrink-0" /> : <Lock className="h-4 w-4 text-slate-300 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-slate-900 truncate">{term.label}</div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {ms ? `${t("jobs.overview.onMilestone")} ${ms.title}` : term.trigger === "on_signing" ? t("invoices.plan.onSigning") : term.trigger === "on_completion" ? t("jobs.overview.onCompletion") : term.trigger === "holdback_release" ? t("invoices.plan.afterLien") : t("jobs.overview.unlinked")}
                      {inv ? ` · ${inv.number} · ${t(`invoices.status.${inv.status}`)}` : released ? ` · ${t("invoices.plan.dueNow")}` : ""}
                    </div>
                  </div>
                  <div className="text-sm font-medium text-slate-900 whitespace-nowrap">{formatCents(inv?.totalCents ?? amount)}</div>
                  {inv ? (
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => navigate(`/dashboard/invoices/${inv.id}`)}>{t("invoices.plan.open")}</Button>
                  ) : (
                    <Button size="sm" variant={released ? "default" : "outline"} className="h-8 gap-1" disabled={create.isPending} onClick={() => create.mutate({ kind, paymentTermId: term.id, milestoneId: ms?.id })}>
                      {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} {t("invoices.plan.create")}
                    </Button>
                  )}
                </li>
              );
            })}
            {holdback?.enabled && !terms.some((x) => x.trigger === "holdback_release") && (
              <li className="flex items-center gap-3 py-2.5">
                {live.some((i) => i.type === "holdback_release") ? <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0" /> : <Lock className="h-4 w-4 text-slate-300 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-slate-900">{t("invoices.type.holdback_release")} ({holdback.percent}%)</div>
                  <div className="text-[11px] text-slate-400">{t("invoices.plan.afterLien")}</div>
                </div>
                <div className="text-sm font-medium text-slate-900">{formatCents(live.filter((i) => i.type !== "holdback_release").reduce((s, i) => s + i.holdbackCents, 0))}</div>
                {live.some((i) => i.type === "holdback_release") ? (
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => navigate(`/dashboard/invoices/${live.find((i) => i.type === "holdback_release")!.id}`)}>{t("invoices.plan.open")}</Button>
                ) : (
                  <Button size="sm" variant="outline" className="h-8 gap-1" disabled={create.isPending || job.status !== "completed"} onClick={() => create.mutate({ kind: "holdback_release" })}><Plus className="h-3.5 w-3.5" /> {t("invoices.plan.create")}</Button>
                )}
              </li>
            )}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">{t("invoices.title")}</h2>
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setManualOpen(true)}><Plus className="h-4 w-4" /> {t("invoices.manual")}</Button>
        </div>
        {invoices.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-card p-8 text-center text-sm text-slate-500">
            <Receipt className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            {job.contract ? t("invoices.jobEmptyContract") : t("invoices.jobEmpty")}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-card overflow-hidden divide-y">
            {[...invoices].reverse().map((inv) => <InvoiceRow key={inv.id} inv={inv} locale={locale} compact />)}
          </div>
        )}
      </section>

      <NewInvoiceDialog open={manualOpen} onOpenChange={setManualOpen} defaultJobId={job.id} />
    </div>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-card px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={cn("text-xl font-bold text-slate-900 mt-0.5", accent)}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}
