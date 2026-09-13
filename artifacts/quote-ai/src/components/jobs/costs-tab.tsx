import { useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { enCA } from "date-fns/locale";
import { Plus, Trash2, Upload, Loader2, Sparkles, Receipt, Clock, Wrench, Pencil, CheckCircle2, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { jobsApi, formatCents, type CostCategory, type CostEntryDto, type JobDetailDto } from "@/lib/jobs-api";
import { CostEntryDialog, COST_CATEGORY_KEYS } from "./cost-entry-dialog";

const day = (s: string | null) => (s ? new Date(`${s}T00:00:00`) : null);
const SOURCE_ICON: Record<CostEntryDto["source"], typeof Receipt> = { receipt: Receipt, time_entry: Clock, equipment: Wrench, manual: Pencil, legacy: Pencil };

/**
 * Costs tab: receipt dropzone → AI review queue → confirmed entries, with
 * budget-vs-actual by category on the side.
 */
export function CostsTab({ data, locale }: { data: JobDetailDto; locale: typeof enCA }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { job, budget, budgetTotalCents, costs, milestones } = data;
  const refresh = () => { queryClient.invalidateQueries({ queryKey: ["job", job.id] }); queryClient.invalidateQueries({ queryKey: ["jobs"] }); };
  const onError = (e: Error & { code?: string }) => toast({ title: e.code === "PLAN_REQUIRED" ? t("jobs.planRequired") : t("jobs.error"), description: e.message, variant: "destructive" });

  const [dialog, setDialog] = useState<{ open: boolean; entry: CostEntryDto | null }>({ open: false, entry: null });
  const [filter, setFilter] = useState<CostCategory | "all">("all");
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const del = useMutation({ mutationFn: (cid: string) => jobsApi.deleteCost(job.id, cid), onSuccess: refresh, onError });
  const confirm = useMutation({ mutationFn: (cid: string) => jobsApi.updateCost(job.id, cid, { status: "confirmed" }), onSuccess: () => { refresh(); toast({ title: t("jobs.costs.confirmedToast") }); }, onError });
  const scan = useMutation({
    mutationFn: (file: File) => jobsApi.scanReceipt(file, job.id),
    onSuccess: (r) => { refresh(); setDialog({ open: true, entry: r.entry }); },
    onError,
  });

  const onFiles = (files: FileList | null) => {
    if (!files || !files.length) return;
    // One at a time keeps the review dialog meaningful; the rest queue up.
    Array.from(files).slice(0, 10).forEach((f, i) => setTimeout(() => scan.mutate(f), i * 300));
  };

  const pending = costs.entries.filter((e) => e.status === "pending_review");
  const confirmed = useMemo(() => costs.entries.filter((e) => e.status === "confirmed" && (filter === "all" || e.category === filter)), [costs.entries, filter]);
  const budgetByCat = useMemo(() => {
    const m = Object.fromEntries(COST_CATEGORY_KEYS.map((c) => [c, 0])) as Record<CostCategory, number>;
    for (const b of budget) m[b.category] += b.plannedCents;
    return m;
  }, [budget]);
  const pct = budgetTotalCents ? Math.min(100, Math.round((costs.totalCents / budgetTotalCents) * 100)) : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        {/* Dropzone */}
        <div
          className={cn("rounded-2xl border-2 border-dashed p-5 text-center transition-colors cursor-pointer", dragging ? "border-violet-400 bg-violet-50" : "border-slate-200 bg-white hover:border-violet-300")}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); onFiles(e.dataTransfer.files); }}
          onClick={() => fileInput.current?.click()}
        >
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
          <div className="flex flex-col items-center gap-1.5">
            <div className="h-10 w-10 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center">{scan.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}</div>
            <div className="font-semibold text-slate-900 text-sm">{scan.isPending ? t("jobs.costs.scanning") : t("jobs.costs.dropTitle")}</div>
            <div className="text-xs text-slate-500 max-w-md">{t("jobs.costs.dropDesc")}</div>
          </div>
        </div>

        {/* Review queue */}
        {pending.length > 0 && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-900"><Sparkles className="h-4 w-4" /> {t("jobs.costs.toReview")} <span className="text-[10px] bg-amber-200 text-amber-900 rounded-full px-1.5">{pending.length}</span></div>
            <ul className="divide-y divide-amber-100">
              {pending.map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-2 text-sm">
                  <button className="min-w-0 flex-1 text-left" onClick={() => setDialog({ open: true, entry: e })}>
                    <div className="font-medium text-slate-900 truncate">{e.vendor || t("jobs.costs.unknownVendor")} <span className="font-normal text-slate-500">· {e.description}</span></div>
                    <div className="text-xs text-slate-500">{e.date ? format(day(e.date)!, "PP", { locale }) : "—"} · {t(`jobs.cost.${e.category}`)}{e.aiExtraction ? ` · ${t(`jobs.costs.confidence.${e.aiExtraction.confidence}`)}` : ""}</div>
                  </button>
                  <span className="font-semibold whitespace-nowrap">{formatCents(e.totalCents)}</span>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => setDialog({ open: true, entry: e })}>{t("jobs.costs.review")}</Button>
                  <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 gap-1" disabled={confirm.isPending || !e.totalCents} onClick={() => confirm.mutate(e.id)}><CheckCircle2 className="h-3.5 w-3.5" /> {t("jobs.costs.confirm")}</Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Entries */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900">{t("jobs.costs.entries")}</h2>
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1 text-xs text-slate-500"><Filter className="h-3.5 w-3.5" />
                <select value={filter} onChange={(e) => setFilter(e.target.value as CostCategory | "all")} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs">
                  <option value="all">{t("jobs.costs.allCategories")}</option>
                  {COST_CATEGORY_KEYS.map((c) => <option key={c} value={c}>{t(`jobs.cost.${c}`)}</option>)}
                </select>
              </div>
              <Button size="sm" className="h-8 gap-1" onClick={() => setDialog({ open: true, entry: null })}><Plus className="h-4 w-4" /> {t("jobs.costs.add")}</Button>
            </div>
          </div>
          {confirmed.length === 0 ? <p className="text-sm text-slate-400 py-6 text-center">{t("jobs.costs.empty")}</p> : (
            <ul className="divide-y">
              {confirmed.map((e) => {
                const Icon = SOURCE_ICON[e.source];
                const derived = e.source === "time_entry" || e.source === "equipment";
                return (
                  <li key={e.id} className="flex items-center gap-3 py-2 text-sm group">
                    <span className="h-7 w-7 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0" title={t(`jobs.costs.source.${e.source}`)}><Icon className="h-3.5 w-3.5" /></span>
                    <span className="text-xs text-slate-400 w-20 shrink-0">{e.date ? format(day(e.date)!, "d MMM yy", { locale }) : "—"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-slate-800">{e.vendor && !derived ? <span className="font-medium">{e.vendor}</span> : null}{e.vendor && !derived && e.description ? " · " : ""}{e.description}</div>
                      <div className="text-[11px] text-slate-400 truncate">{t(`jobs.cost.${e.category}`)}{e.milestoneTitle ? ` · ${e.milestoneTitle}` : ""}{e.taxCents ? ` · ${t("jobs.costs.tax")} ${formatCents(e.taxCents)}` : ""}</div>
                    </div>
                    <span className="font-medium whitespace-nowrap">{formatCents(e.totalCents)}</span>
                    {!derived && <button className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-slate-700" onClick={() => setDialog({ open: true, entry: e })}><Pencil className="h-3.5 w-3.5" /></button>}
                    {!derived && <button className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500" onClick={() => del.mutate(e.id)}><Trash2 className="h-4 w-4" /></button>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 h-fit">
        <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-slate-900">{t("jobs.costs.budgetVsActual")}</h3><Link href={`/dashboard/jobs/${job.id}/setup`} className="text-xs text-violet-600 hover:underline">{t("jobs.costs.editBudget")}</Link></div>
        <div>
          <div className="flex justify-between text-sm"><span className="text-slate-500">{t("jobs.kpi.costs")}</span><span className="font-semibold">{formatCents(costs.totalCents)}</span></div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden mt-1"><div className={cn("h-full", costs.totalCents > budgetTotalCents && budgetTotalCents ? "bg-rose-500" : "bg-emerald-500")} style={{ width: `${pct}%` }} /></div>
          <div className="flex justify-between text-xs text-slate-400 mt-1"><span>{t("jobs.kpi.budget")}</span><span>{formatCents(budgetTotalCents)}</span></div>
          {costs.pendingCents > 0 && <div className="text-[11px] text-amber-700 mt-1">{t("jobs.costs.pendingHint")} {formatCents(costs.pendingCents)}</div>}
        </div>
        <ul className="space-y-2 pt-2 border-t">
          {COST_CATEGORY_KEYS.map((c) => {
            const actual = costs.byCategory[c] ?? 0;
            const planned = budgetByCat[c];
            if (!actual && !planned) return null;
            const p = planned ? Math.min(100, Math.round((actual / planned) * 100)) : actual ? 100 : 0;
            const over = planned > 0 && actual > planned;
            return (
              <li key={c}>
                <div className="flex justify-between text-xs"><span className="text-slate-600">{t(`jobs.cost.${c}`)}</span><span className={cn("font-medium", over ? "text-rose-600" : "text-slate-800")}>{formatCents(actual)} <span className="text-slate-400 font-normal">/ {formatCents(planned)}</span></span></div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1"><div className={cn("h-full", over ? "bg-rose-500" : "bg-violet-500")} style={{ width: `${p}%` }} /></div>
              </li>
            );
          })}
        </ul>
        <p className="text-[11px] text-slate-400 pt-1">{t("jobs.costs.derivedHint")}</p>
      </section>

      <CostEntryDialog jobId={job.id} entry={dialog.entry} milestones={milestones} open={dialog.open} onOpenChange={(v) => setDialog((d) => ({ ...d, open: v }))} />
    </div>
  );
}
