import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enCA } from "date-fns/locale";
import { Plus, Receipt, CheckCircle2, Circle, Loader2, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCan } from "@/hooks/use-role";
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
const can = useCan();
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

  const remainingCents = Math.max(0, job.totalValueCents - invoiceTotals.invoicedCents - live.filter((i) => i.status === "draft").reduce((s, i) => s + i.totalCents, 0));

  return (
    <div>
      <section className="stat-grid">
        <Kpi label={t("invoices.kpi.invoiced")} value={formatCents(invoiceTotals.invoicedCents)} sub={invoiceTotals.draftCount ? `${invoiceTotals.draftCount} ${t(invoiceTotals.draftCount === 1 ? "invoices.kpi.draftsOne" : "invoices.kpi.drafts")}` : undefined} />
        <Kpi label={t("invoices.kpi.collected")} value={formatCents(invoiceTotals.collectedCents)} tone="ok" />
        <Kpi label={t("invoices.kpi.outstanding")} value={formatCents(invoiceTotals.outstandingCents)} tone="teal" sub={invoiceTotals.overdueCents ? `${formatCents(invoiceTotals.overdueCents)} ${t("invoices.kpi.overdue")}` : undefined} />
        <Kpi label={t("invoices.kpi.remaining")} value={formatCents(remainingCents)} sub={t("invoices.kpi.remainingSub")} />
      </section>

      {job.contract && terms.length > 0 && (
        <section className="card">
          <div className="card-head"><div><h2>{t("invoices.plan.title")}</h2></div></div>
          <div>
            {terms.map((term) => {
              const ms = milestones.find((m) => m.paymentTermId === term.id);
              const inv = live.find((i) => i.paymentTermId === term.id) ?? (term.type === "completion" ? live.find((i) => i.type === "final") : undefined);
              const released = term.trigger === "on_signing" || ms?.status === "completed" || (term.trigger === "on_completion" && job.status === "completed");
              const kind = term.trigger === "on_signing" ? "deposit" : term.type === "completion" || term.trigger === "on_completion" ? "final" : term.trigger === "holdback_release" ? "holdback_release" : "term";
              const amount = job.contract ? Math.round((term.amountType === "percent" ? (job.contract.total * term.value) / 100 : term.value) * 100) : 0;
              return (
                <div key={term.id} className="item-row">
                  {inv ? <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: inv.status === "paid" ? "var(--green)" : "var(--teal)" }} /> : released ? <Circle className="h-4 w-4 shrink-0" style={{ color: "var(--yellow-dark)" }} /> : <Lock className="h-4 w-4 shrink-0" style={{ color: "var(--line)" }} />}
                  <div className="grow">
                    <span className="ttl">{term.label}</span>
                    <span className="sub">
                      {ms ? `${t("jobs.overview.onMilestone")} ${ms.title}` : term.trigger === "on_signing" ? t("invoices.plan.onSigning") : term.trigger === "on_completion" ? t("jobs.overview.onCompletion") : term.trigger === "holdback_release" ? t("invoices.plan.afterLien") : t("jobs.overview.unlinked")}
                      {inv ? ` · ${inv.number} · ${t(`invoices.status.${inv.status}`)}` : released ? ` · ${t("invoices.plan.dueNow")}` : ""}
                    </span>
                  </div>
                  <span className="amt">{formatCents(inv?.totalCents ?? amount)}</span>
                  {inv ? (
                    <button type="button" className="text-link" onClick={() => navigate(`/dashboard/invoices/${inv.id}`)}>{t("invoices.plan.open")}</button>
                  ) : can("invoicing", "edit") && (
                    <button type="button" className={cn("btn btn-sm", released ? "btn-navy" : "btn-outline-navy")} disabled={create.isPending} onClick={() => create.mutate({ kind, paymentTermId: term.id, milestoneId: ms?.id })}>
                      {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} {t("invoices.plan.create")}
                    </button>
                  )}
                </div>
              );
            })}
            {holdback?.enabled && !terms.some((x) => x.trigger === "holdback_release") && (
              <div className="item-row">
                {live.some((i) => i.type === "holdback_release") ? <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "var(--teal)" }} /> : <Lock className="h-4 w-4 shrink-0" style={{ color: "var(--line)" }} />}
                <div className="grow">
                  <span className="ttl">{t("invoices.type.holdback_release")} ({holdback.percent}%)</span>
                  <span className="sub">{t("invoices.plan.afterLien")}</span>
                </div>
                <span className="amt">{formatCents(live.filter((i) => i.type !== "holdback_release").reduce((s, i) => s + i.holdbackCents, 0))}</span>
                {live.some((i) => i.type === "holdback_release") ? (
                  <button type="button" className="text-link" onClick={() => navigate(`/dashboard/invoices/${live.find((i) => i.type === "holdback_release")!.id}`)}>{t("invoices.plan.open")}</button>
                ) : can("invoicing", "edit") && (
                  <button type="button" className="btn btn-sm btn-outline-navy" disabled={create.isPending || job.status !== "completed"} onClick={() => create.mutate({ kind: "holdback_release" })}><Plus className="h-3.5 w-3.5" /> {t("invoices.plan.create")}</button>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <div><h2>{t("invoices.title")}</h2></div>
          {can("invoicing", "edit") && <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => setManualOpen(true)}><Plus className="h-4 w-4" /> {t("invoices.manual")}</button>}
        </div>
        {invoices.length === 0 ? (
          <div className="card-empty">
            <Receipt />
            {job.contract ? t("invoices.jobEmptyContract") : t("invoices.jobEmpty")}
          </div>
        ) : (
          <div>
            {[...invoices].reverse().map((inv) => <InvoiceRow key={inv.id} inv={inv} locale={locale} compact />)}
          </div>
        )}
      </section>

      <NewInvoiceDialog open={manualOpen} onOpenChange={setManualOpen} defaultJobId={job.id} />
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "ok" | "warn" | "bad" | "teal" }) {
  return (
    <div className="card stat-card">
      <p className="lbl">{label}</p>
      <p className={cn("val", tone)}>{value}</p>
      {sub && <p className="sub">{sub}</p>}
    </div>
  );
}
