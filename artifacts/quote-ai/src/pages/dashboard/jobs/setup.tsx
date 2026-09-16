import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { Sparkles, ArrowLeft, Loader2, Plus, Trash2, ChevronUp, ChevronDown, CheckCircle2, RefreshCw, FileSignature, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { jobsApi, formatCents, type JobDetailDto, type MilestoneDto, type BudgetLineDto, type CostCategory, type SetupEdits } from "@/lib/jobs-api";
import { Gantt } from "@/components/jobs/gantt";

type MilestoneDraft = { id?: string; key?: string; title: string; description: string; plannedStart: string; plannedEnd: string; paymentTermId: string | null; valueCents: number; taskCount: number; status: MilestoneDto["status"] };
type BudgetDraft = { category: CostCategory; label: string; amount: string };

const CATEGORIES: CostCategory[] = ["materials", "labour", "subcontractor", "permits_fees", "equipment", "misc"];
const parseDay = (s: string) => new Date(`${s}T00:00:00`);
const dayStr = (d: Date) => format(d, "yyyy-MM-dd");

function toDrafts(d: JobDetailDto): { milestones: MilestoneDraft[]; budget: BudgetDraft[] } {
  return {
    milestones: d.milestones.map((m) => ({ id: m.id, key: m.key, title: m.title, description: m.description, plannedStart: m.plannedStart ?? "", plannedEnd: m.plannedEnd ?? "", paymentTermId: m.paymentTermId, valueCents: m.valueCents, taskCount: m.tasks.length, status: m.status })),
    budget: d.budget.map((b: BudgetLineDto) => ({ category: b.category, label: b.label, amount: (b.plannedCents / 100).toFixed(0) })),
  };
}

export default function JobSetupPage() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const { data, isLoading, error } = useQuery({ queryKey: ["job", id], queryFn: () => jobsApi.get(id!), enabled: !!id });

  const [name, setName] = useState("");
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([]);
  const [budget, setBudget] = useState<BudgetDraft[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const stamp = `${data.job.id}:${data.job.updatedAt}:${data.milestones.length}`;
    if (loadedFor === stamp) return;
    const drafts = toDrafts(data);
    setName(data.job.name);
    setMilestones(drafts.milestones);
    setBudget(drafts.budget);
    setLoadedFor(stamp);
  }, [data, loadedFor]);

  const terms = data?.job.contract?.paymentSchedule.terms ?? [];
  const linkableTerms = terms.filter((x) => x.trigger === "milestone" || x.trigger === "on_completion");
  const contractTotal = data?.job.contract?.total ?? (data ? data.job.contractValueCents / 100 : 0);
  const subtotal = data?.job.contract?.subtotal ?? contractTotal;
  const termAmount = (termId: string | null) => {
    const term = terms.find((x) => x.id === termId);
    if (!term) return null;
    return Math.round((term.amountType === "percent" ? (contractTotal * term.value) / 100 : term.value) * 100);
  };

  const budgetTotalCents = budget.reduce((s, b) => s + Math.round((Number(b.amount) || 0) * 100), 0);
  const marginPct = subtotal > 0 ? Math.round(((subtotal * 100 - budgetTotalCents) / (subtotal * 100)) * 100) : null;
  const plannedEnd = useMemo(() => milestones.map((m) => m.plannedEnd).filter(Boolean).sort().at(-1) ?? null, [milestones]);
  const plannedStart = useMemo(() => milestones.map((m) => m.plannedStart).filter(Boolean).sort()[0] ?? null, [milestones]);

  const edits = (): SetupEdits => ({
    name: name.trim() || undefined,
    milestones: milestones.map((m) => ({ id: m.id, key: m.key, title: m.title.trim() || "—", description: m.description, plannedStart: m.plannedStart || null, plannedEnd: m.plannedEnd || null, paymentTermId: m.paymentTermId, valueCents: m.valueCents })),
    budget: budget.map((b) => ({ category: b.category, label: b.label, plannedCents: Math.round((Number(b.amount) || 0) * 100) })),
  });

  const save = useMutation({
    mutationFn: () => jobsApi.saveSetup(id!, edits()),
    onSuccess: (d) => { queryClient.setQueryData(["job", id], d); toast({ title: t("jobs.setup.saved") }); },
    onError: (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" }),
  });
  const confirm = useMutation({
    mutationFn: () => jobsApi.confirmSetup(id!, edits()),
    onSuccess: (d) => {
      queryClient.setQueryData(["job", id], d);
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast({ title: t("jobs.setup.confirmed"), description: t("jobs.setup.confirmedDesc") });
      navigate(`/dashboard/jobs/${id}`);
    },
    onError: (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" }),
  });
  const regenerate = useMutation({
    mutationFn: () => jobsApi.regenerateSetup(id!),
    onSuccess: (d) => { queryClient.setQueryData(["job", id], d); setLoadedFor(null); toast({ title: t("jobs.setup.regenerated") }); },
    onError: (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" }),
  });

  // Shifting the first start date moves the whole schedule by the same delta.
  const shiftAll = (newStart: string) => {
    if (!plannedStart || !newStart) return;
    const delta = differenceInCalendarDays(parseDay(newStart), parseDay(plannedStart));
    if (!delta) return;
    setMilestones((ms) => ms.map((m) => ({ ...m, plannedStart: m.plannedStart ? dayStr(addDays(parseDay(m.plannedStart), delta)) : m.plannedStart, plannedEnd: m.plannedEnd ? dayStr(addDays(parseDay(m.plannedEnd), delta)) : m.plannedEnd })));
  };

  const updateMs = (i: number, patch: Partial<MilestoneDraft>) => setMilestones((ms) => ms.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  const move = (i: number, dir: -1 | 1) => setMilestones((ms) => { const j = i + dir; if (j < 0 || j >= ms.length) return ms; const copy = [...ms]; [copy[i], copy[j]] = [copy[j]!, copy[i]!]; return copy; });
  const addMs = () => setMilestones((ms) => { const last = ms.at(-1); const s = last?.plannedEnd ? dayStr(addDays(parseDay(last.plannedEnd), 1)) : ""; return [...ms, { title: "", description: "", plannedStart: s, plannedEnd: s, paymentTermId: null, valueCents: 0, taskCount: 0, status: "planned" }]; });

  if (isLoading || (data && loadedFor === null)) return <div className="space-y-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-64 w-full rounded-[var(--radius)]" /></div>;
  if (error || !data) return <div className="p-8 text-center text-slate-500">{t("jobs.notFound")} <Link href="/dashboard/jobs" className="text-navy-600 underline">{t("jobs.backToList")}</Link></div>;

  const { job } = data;
  const confirmed = job.setupStatus === "confirmed";

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-5xl">
      <div>
        <Link href={confirmed ? `/dashboard/jobs/${job.id}` : "/dashboard/jobs"} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /> {confirmed ? t("jobs.backToJob") : t("jobs.backToList")}</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
              <Sparkles className="h-7 w-7 text-amber-500" /> {confirmed ? t("jobs.setup.editTitle") : t("jobs.setup.title")}
            </h1>
            <p className="text-slate-500 mt-1">
              {job.contract
                ? t("jobs.setup.subtitle").replace("{customer}", job.contract.customerName).replace("{contract}", job.contract.contractNumber)
                : t("jobs.setup.subtitleManual")}
            </p>
          </div>
          <div className="flex gap-2">
            {!confirmed && job.contractId && (
              <Button variant="outline" size="sm" className="gap-2" disabled={regenerate.isPending} onClick={() => regenerate.mutate()}>
                {regenerate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {t("jobs.setup.regenerate")}
              </Button>
            )}
            <Button variant="outline" size="sm" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("jobs.setup.save")}</Button>
          </div>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-[var(--radius)] border border-slate-200 bg-card px-4 py-3 md:col-span-2">
          <Label className="text-xs text-slate-500">{t("jobs.field.name")}</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 font-semibold" />
        </div>
        <div className="rounded-[var(--radius)] border border-slate-200 bg-card px-4 py-3">
          <div className="text-xs text-slate-500">{t("jobs.contractValue")}</div>
          <div className="text-xl font-bold text-slate-900 mt-0.5">{formatCents(job.contractValueCents)}</div>
          {job.contract && <Link href={`/dashboard/contracts/${job.contract.id}`} className="text-[11px] text-navy-600 hover:underline inline-flex items-center gap-1"><FileSignature className="h-3 w-3" /> {job.contract.contractNumber}</Link>}
        </div>
        <div className="rounded-[var(--radius)] border border-slate-200 bg-card px-4 py-3">
          <div className="text-xs text-slate-500">{t("jobs.setup.window")}</div>
          <div className="text-sm font-semibold text-slate-900 mt-1">
            {plannedStart && plannedEnd ? `${format(parseDay(plannedStart), "d MMM", { locale })} → ${format(parseDay(plannedEnd), "PP", { locale })}` : "—"}
          </div>
          <div className="text-[11px] text-slate-400">{milestones.length} {t("jobs.milestonesShort")}</div>
        </div>
      </div>

      {job.setupProposal && (
        <div className="rounded-[var(--radius)] border border-navy-100 dark:border-navy-800/40 bg-navy-50/60 dark:bg-navy-500/15 px-4 py-3 text-sm text-navy-900 dark:text-navy-300 flex gap-3">
          <Wand2 className="h-4 w-4 mt-0.5 shrink-0 text-navy-600" />
          <div>
            <span className="font-semibold">{job.setupProposal.source === "ai" ? t("jobs.setup.aiNote") : t("jobs.setup.fallbackNote")}</span>{" "}
            {job.setupProposal.rationale && <span className="text-navy-800">{job.setupProposal.rationale}</span>}
            <span className="text-navy-700/80"> {t("jobs.setup.editHint")}</span>
          </div>
        </div>
      )}

      {/* Schedule */}
      <section className="rounded-[var(--radius)] border border-slate-200 bg-card p-4 md:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900">{t("jobs.setup.milestones")}</h2>
          <div className="flex items-center gap-2 text-sm">
            <Label className="text-xs text-slate-500">{t("jobs.setup.shiftStart")}</Label>
            <Input type="date" value={plannedStart ?? ""} onChange={(e) => shiftAll(e.target.value)} className="h-8 w-40" />
          </div>
        </div>

        <Gantt rows={milestones.map((m, i) => ({ id: m.id ?? `new-${i}`, title: m.title || "…", start: m.plannedStart || null, end: m.plannedEnd || null, status: m.status, paymentAmountCents: termAmount(m.paymentTermId) }))} />

        <div className="space-y-2">
          {milestones.map((m, i) => (
            <div key={m.id ?? `new-${i}`} className="rounded-[var(--radius-sm)] border border-slate-200 p-3 grid grid-cols-1 md:grid-cols-[auto_minmax(0,1.3fr)_auto_auto_minmax(0,1fr)_auto] gap-2 items-center">
              <div className="flex md:flex-col gap-1">
                <button type="button" onClick={() => move(i, -1)} className="text-slate-400 hover:text-slate-700 disabled:opacity-30" disabled={i === 0}><ChevronUp className="h-4 w-4" /></button>
                <button type="button" onClick={() => move(i, 1)} className="text-slate-400 hover:text-slate-700 disabled:opacity-30" disabled={i === milestones.length - 1}><ChevronDown className="h-4 w-4" /></button>
              </div>
              <div className="min-w-0">
                <Input value={m.title} onChange={(e) => updateMs(i, { title: e.target.value })} placeholder={t("jobs.milestone.titlePlaceholder")} className="font-medium" />
                <div className="text-[11px] text-slate-400 mt-1 truncate">
                  {m.taskCount > 0 ? `${m.taskCount} ${t("jobs.tasksShort")}` : t("jobs.noTasks")}
                  {m.valueCents > 0 ? ` · ${formatCents(m.valueCents)} ${t("jobs.ofWork")}` : ""}
                </div>
              </div>
              <Input type="date" value={m.plannedStart} onChange={(e) => updateMs(i, { plannedStart: e.target.value, plannedEnd: m.plannedEnd && e.target.value > m.plannedEnd ? e.target.value : m.plannedEnd })} className="h-9 w-full md:w-36" />
              <Input type="date" value={m.plannedEnd} min={m.plannedStart || undefined} onChange={(e) => updateMs(i, { plannedEnd: e.target.value })} className="h-9 w-full md:w-36" />
              <select
                value={m.paymentTermId ?? ""}
                onChange={(e) => updateMs(i, { paymentTermId: e.target.value || null })}
                className={cn("h-9 rounded-md border border-slate-200 bg-card px-2 text-sm", m.paymentTermId ? "text-emerald-700 font-medium" : "text-slate-500")}
              >
                <option value="">{t("jobs.milestone.noPayment")}</option>
                {linkableTerms.map((x) => (
                  <option key={x.id} value={x.id} disabled={milestones.some((o, oi) => oi !== i && o.paymentTermId === x.id)}>
                    {x.amountType === "percent" ? `${x.value}%` : `$${x.value}`} — {x.label}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => setMilestones((ms) => ms.filter((_, idx) => idx !== i))} className="text-slate-300 hover:text-rose-500 justify-self-end"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="gap-2" onClick={addMs}><Plus className="h-4 w-4" /> {t("jobs.milestone.add")}</Button>
        </div>

        {/* Payment coverage */}
        {terms.length > 0 && (
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
            {terms.map((x) => {
              const linked = x.trigger === "on_signing" || x.trigger === "days_after_signing" || x.trigger === "holdback_release" || milestones.some((m) => m.paymentTermId === x.id);
              return (
                <span key={x.id} className={cn("inline-flex items-center gap-1", linked ? "text-emerald-700" : "text-amber-700")}>
                  <CheckCircle2 className={cn("h-3 w-3", !linked && "opacity-30")} />
                  {x.amountType === "percent" ? `${x.value}%` : `$${x.value}`} {x.label}
                  {x.trigger === "on_signing" && ` (${t("jobs.setup.dueNow")})`}
                </span>
              );
            })}
          </div>
        )}
      </section>

      {/* Budget */}
      <section className="rounded-[var(--radius)] border border-slate-200 bg-card p-4 md:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900">{t("jobs.setup.budget")}</h2>
          <div className="text-sm text-slate-600">
            {t("jobs.setup.budgetTotal")} <span className="font-semibold text-slate-900">{formatCents(budgetTotalCents)}</span>
            {marginPct !== null && <span className={cn("ml-3 font-semibold", marginPct < 15 ? "text-amber-600" : "text-emerald-600")}>{t("jobs.setup.projectedMargin")} {marginPct}%</span>}
          </div>
        </div>
        <p className="text-xs text-slate-500">{t("jobs.setup.budgetHint")}</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {CATEGORIES.map((c) => {
            const line = budget.find((b) => b.category === c);
            return (
              <div key={c} className="rounded-lg border border-slate-200 px-3 py-2">
                <Label className="text-xs text-slate-500">{t(`jobs.cost.${c}`)}</Label>
                <div className="relative mt-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <Input
                    type="number" min={0} step="1"
                    value={line?.amount ?? ""}
                    onChange={(e) => setBudget((b) => (line ? b.map((x) => (x.category === c ? { ...x, amount: e.target.value } : x)) : [...b, { category: c, label: t(`jobs.cost.${c}`), amount: e.target.value }]))}
                    className="pl-6 h-9"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="sticky bottom-4 flex flex-wrap items-center justify-end gap-2 rounded-[var(--radius)] border border-slate-200 bg-card/95 backdrop-blur px-4 py-3 shadow-lg">
        <span className="text-xs text-slate-500 mr-auto">{confirmed ? t("jobs.setup.editFooter") : t("jobs.setup.footer")}</span>
        <Button variant="outline" disabled={save.isPending} onClick={() => save.mutate()}>{t("jobs.setup.save")}</Button>
        <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" disabled={confirm.isPending || milestones.length === 0} onClick={() => confirm.mutate()}>
          {confirm.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {confirmed ? t("jobs.setup.saveAndBack") : t("jobs.setup.confirm")}
        </Button>
      </div>
    </div>
  );
}
