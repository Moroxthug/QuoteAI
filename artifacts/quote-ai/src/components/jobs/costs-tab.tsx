import { useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { enCA } from "date-fns/locale";
import { Plus, Trash2, Upload, Loader2, Sparkles, Receipt, Clock, Wrench, Pencil, CheckCircle2 } from "lucide-react";
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
  const overBudget = !!budgetTotalCents && costs.totalCents > budgetTotalCents;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 stack">
        {/* Dropzone */}
        <div
          className={cn("dropzone flush", dragging && "on")}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); onFiles(e.dataTransfer.files); }}
          onClick={() => fileInput.current?.click()}
        >
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
          <div className="dz-ic">{scan.isPending ? <Loader2 className="animate-spin" /> : <Upload />}</div>
          <b>{scan.isPending ? t("jobs.costs.scanning") : t("jobs.costs.dropTitle")}</b>
          <p>{t("jobs.costs.dropDesc")}</p>
        </div>

        {/* Review queue */}
        {pending.length > 0 && (
          <section className="card" style={{ borderColor: "var(--yellow)" }}>
            <div className="card-head">
              <div><h2 className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4" style={{ color: "var(--yellow-dark)" }} /> {t("jobs.costs.toReview")} <span className="chip chip-yellow">{pending.length}</span></h2></div>
            </div>
            <div>
              {pending.map((e) => (
                <div key={e.id} className="item-row">
                  <button type="button" className="grow text-left" onClick={() => setDialog({ open: true, entry: e })}>
                    <span className="ttl"><b>{e.vendor || t("jobs.costs.unknownVendor")}</b> <span style={{ color: "var(--muted-mk)" }}>· {e.description}</span></span>
                    <span className="sub">{e.date ? format(day(e.date)!, "PP", { locale }) : "—"} · {t(`jobs.cost.${e.category}`)}{e.aiExtraction ? ` · ${t(`jobs.costs.confidence.${e.aiExtraction.confidence}`)}` : ""}</span>
                  </button>
                  <span className="amt">{formatCents(e.totalCents)}</span>
                  <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => setDialog({ open: true, entry: e })}>{t("jobs.costs.review")}</button>
                  <button type="button" className="btn btn-sm btn-navy" style={{ background: "var(--green)" }} disabled={confirm.isPending || !e.totalCents} onClick={() => confirm.mutate(e.id)}><CheckCircle2 className="h-3.5 w-3.5" /> {t("jobs.costs.confirm")}</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Entries */}
        <section className="card">
          <div className="card-head">
            <div><h2>{t("jobs.costs.entries")}</h2></div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="field">
                <select aria-label={t("jobs.costs.category")} value={filter} onChange={(e) => setFilter(e.target.value as CostCategory | "all")} style={{ padding: "8px 12px", fontSize: 13.5 }}>
                  <option value="all">{t("jobs.costs.allCategories")}</option>
                  {COST_CATEGORY_KEYS.map((c) => <option key={c} value={c}>{t(`jobs.cost.${c}`)}</option>)}
                </select>
              </div>
              <button type="button" className="btn btn-sm btn-navy" onClick={() => setDialog({ open: true, entry: null })}><Plus className="h-4 w-4" /> {t("jobs.costs.add")}</button>
            </div>
          </div>
          {confirmed.length === 0 ? <div className="card-empty">{t("jobs.costs.empty")}</div> : (
            <div>
              {confirmed.map((e) => {
                const Icon = SOURCE_ICON[e.source];
                const derived = e.source === "time_entry" || e.source === "equipment";
                return (
                  <div key={e.id} className="item-row">
                    <span className="ic" title={t(`jobs.costs.source.${e.source}`)}><Icon /></span>
                    <span className="date">{e.date ? format(day(e.date)!, "d MMM yy", { locale }) : "—"}</span>
                    <div className="grow">
                      <span className="ttl">{e.vendor && !derived ? <b>{e.vendor}</b> : null}{e.vendor && !derived && e.description ? " · " : ""}{e.description}</span>
                      <span className="sub">{t(`jobs.cost.${e.category}`)}{e.milestoneTitle ? ` · ${e.milestoneTitle}` : ""}{e.taxCents ? ` · ${t("jobs.costs.tax")} ${formatCents(e.taxCents)}` : ""}</span>
                    </div>
                    <span className="amt">{formatCents(e.totalCents)}</span>
                    {!derived && (
                      <div className="hover-act">
                        <button type="button" className="ic-btn" onClick={() => setDialog({ open: true, entry: e })}><Pencil /></button>
                        <button type="button" className="ic-btn danger" onClick={() => del.mutate(e.id)}><Trash2 /></button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <section className="card h-fit">
        <div className="card-head">
          <div><h2>{t("jobs.costs.budgetVsActual")}</h2></div>
          <Link href={`/dashboard/jobs/${job.id}/setup`} className="text-link">{t("jobs.costs.editBudget")}</Link>
        </div>
        <div>
        <div className="hbar-row">
          <div className="hbar-top">{t("jobs.kpi.costs")}<span>{formatCents(costs.totalCents)}</span></div>
          <div className="hbar"><i style={{ width: `${pct}%`, background: overBudget ? "var(--red)" : "var(--green)" }} /></div>
          <div className="hbar-top" style={{ marginTop: 8, marginBottom: 0 }}><span>{t("jobs.kpi.budget")}</span><span>{formatCents(budgetTotalCents)}</span></div>
          {costs.pendingCents > 0 && <p className="field-hint" style={{ color: "var(--yellow-dark)" }}>{t("jobs.costs.pendingHint")} {formatCents(costs.pendingCents)}</p>}
        </div>
        {COST_CATEGORY_KEYS.map((c) => {
          const actual = costs.byCategory[c] ?? 0;
          const planned = budgetByCat[c];
          if (!actual && !planned) return null;
          const p = planned ? Math.min(100, Math.round((actual / planned) * 100)) : actual ? 100 : 0;
          const over = planned > 0 && actual > planned;
          return (
            <div key={c} className="hbar-row">
              <div className="hbar-top" style={{ fontSize: 13 }}>{t(`jobs.cost.${c}`)}<span style={over ? { color: "var(--red)" } : undefined}>{formatCents(actual)} <span style={{ color: "var(--faint)" }}>/ {formatCents(planned)}</span></span></div>
              <div className="hbar" style={{ height: 6 }}><i style={{ width: `${p}%`, background: over ? "var(--red)" : undefined }} /></div>
            </div>
          );
        })}
        </div>
        <div className="card-foot"><span className="foot-note">{t("jobs.costs.derivedHint")}</span></div>
      </section>

      <CostEntryDialog jobId={job.id} entry={dialog.entry} milestones={milestones} open={dialog.open} onOpenChange={(v) => setDialog((d) => ({ ...d, open: v }))} />
    </div>
  );
}
