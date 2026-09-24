import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { Sparkles, ArrowLeft, Loader2, Plus, Trash2, ChevronUp, ChevronDown, CheckCircle2, RefreshCw, FileSignature, Wand2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCan } from "@/hooks/use-role";
import { jobsApi, formatCents, formatCad, type JobDetailDto, type MilestoneDto, type BudgetLineDto, type CostCategory, type SetupEdits } from "@/lib/jobs-api";
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
  const can = useCan();
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

  if (isLoading || (data && loadedFor === null)) return <div className="space-y-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-64 w-full rounded-[var(--radius-mk)]" /></div>;
  if (error || !data) return <div className="card card-empty">{t("jobs.notFound")} <Link href="/dashboard/jobs" className="text-link">{t("jobs.backToList")}</Link></div>;

  const { job } = data;
  const confirmed = job.setupStatus === "confirmed";

  // Phase 83: the whole page is an editor (milestones, tasks, budget, then
  // Confirm) and every one of its three routes is jobs:edit on the server.
  if (!can("jobs", "edit")) {
    return (
      <div className="card card-empty">
        {t("roles.readOnly")} <Link href={`/dashboard/jobs/${job.id}`} className="text-link">{t("jobs.backToJob")}</Link>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300">
      <Link href={confirmed ? `/dashboard/jobs/${job.id}` : "/dashboard/jobs"} className="back-link"><ArrowLeft /> {confirmed ? t("jobs.backToJob") : t("jobs.backToList")}</Link>
      <div className="page-head">
        <div className="min-w-0">
          <div className="title-row">
            <h1><Sparkles /> {confirmed ? t("jobs.setup.editTitle") : t("jobs.setup.title")}</h1>
          </div>
          <p className="sub">
            {job.contract
              ? t("jobs.setup.subtitle").replace("{customer}", job.contract.customerName).replace("{contract}", job.contract.contractNumber)
              : t("jobs.setup.subtitleManual")}
          </p>
        </div>
        <div className="head-actions">
          {!confirmed && job.contractId && (
            <button type="button" className="btn btn-sm btn-outline-navy" disabled={regenerate.isPending} onClick={() => regenerate.mutate()}>
              {regenerate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {t("jobs.setup.regenerate")}
            </button>
          )}
          <button type="button" className="btn btn-sm btn-outline-navy" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {t("jobs.setup.save")}</button>
        </div>
      </div>

      {/* Summary strip */}
      <section className="stat-grid">
        <div className="card stat-card editable span-2">
          <label className="lbl" htmlFor="setup-name">{t("jobs.field.name")}</label>
          <input id="setup-name" className="inp-sm" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="card stat-card">
          <div className="lbl">{t("jobs.contractValue")}</div>
          <div className="val">{formatCents(job.contractValueCents)}</div>
          {job.contract && <Link href={`/dashboard/contracts/${job.contract.id}`} className="text-link"><FileSignature /> {job.contract.contractNumber}</Link>}
        </div>
        <div className="card stat-card">
          <div className="lbl">{t("jobs.setup.window")}</div>
          <div className="val sm">
            {plannedStart && plannedEnd ? `${format(parseDay(plannedStart), "d MMM", { locale })} → ${format(parseDay(plannedEnd), "PP", { locale })}` : "—"}
          </div>
          <div className="sub">{milestones.length} {t("jobs.milestonesShort")}</div>
        </div>
      </section>

      {job.setupProposal && (
        <div className="notice info">
          <Wand2 />
          <div className="grow">
            <b>{job.setupProposal.source === "ai" ? t("jobs.setup.aiNote") : t("jobs.setup.fallbackNote")}</b>{" "}
            {job.setupProposal.rationale && <span>{job.setupProposal.rationale}</span>}
            <small>{t("jobs.setup.editHint")}</small>
          </div>
        </div>
      )}

      {/* Schedule */}
      <section className="card">
        <div className="card-head">
          <h2>{t("jobs.setup.milestones")}</h2>
          <div className="shift-start">
            <span className="lbl-xs" style={{ marginBottom: 0 }}>{t("jobs.setup.shiftStart")}</span>
            <input type="date" className="inp-sm" aria-label={t("jobs.setup.shiftStart")} value={plannedStart ?? ""} onChange={(e) => shiftAll(e.target.value)} />
          </div>
        </div>

        <div className="act-body" style={{ paddingTop: 0 }}>
          <Gantt rows={milestones.map((m, i) => ({ id: m.id ?? `new-${i}`, title: m.title || "…", start: m.plannedStart || null, end: m.plannedEnd || null, status: m.status, paymentAmountCents: termAmount(m.paymentTermId) }))} />
        </div>

        <div className="ms-list">
          {milestones.map((m, i) => (
            <div key={m.id ?? `new-${i}`} className="ms-edit">
              <div className="order">
                <button type="button" className="ic-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t("a11y.moveUp")}><ChevronUp /></button>
                <button type="button" className="ic-btn" onClick={() => move(i, 1)} disabled={i === milestones.length - 1} aria-label={t("a11y.moveDown")}><ChevronDown /></button>
              </div>
              <div className="desc">
                <input className="inp-sm" value={m.title} onChange={(e) => updateMs(i, { title: e.target.value })} placeholder={t("jobs.milestone.titlePlaceholder")} />
                <span className="sub">
                  {m.taskCount > 0 ? `${m.taskCount} ${t("jobs.tasksShort")}` : t("jobs.noTasks")}
                  {m.valueCents > 0 ? ` · ${formatCents(m.valueCents)} ${t("jobs.ofWork")}` : ""}
                </span>
              </div>
              <div className="dates">
                <input type="date" className="inp-sm" aria-label={t("a11y.startDate")} value={m.plannedStart} onChange={(e) => updateMs(i, { plannedStart: e.target.value, plannedEnd: m.plannedEnd && e.target.value > m.plannedEnd ? e.target.value : m.plannedEnd })} />
                <input type="date" className="inp-sm" aria-label={t("a11y.endDate")} value={m.plannedEnd} min={m.plannedStart || undefined} onChange={(e) => updateMs(i, { plannedEnd: e.target.value })} />
              </div>
              <select
                aria-label={t("a11y.linkedPayment")}
                value={m.paymentTermId ?? ""}
                onChange={(e) => updateMs(i, { paymentTermId: e.target.value || null })}
                className={cn("inp-sm pay", m.paymentTermId && "linked")}
              >
                <option value="">{t("jobs.milestone.noPayment")}</option>
                {linkableTerms.map((x) => (
                  <option key={x.id} value={x.id} disabled={milestones.some((o, oi) => oi !== i && o.paymentTermId === x.id)}>
                    {x.amountType === "percent" ? `${x.value}%` : formatCad(x.value)} — {x.label}
                  </option>
                ))}
              </select>
              <button type="button" className="ic-btn danger" onClick={() => setMilestones((ms) => ms.filter((_, idx) => idx !== i))} aria-label={t("jobs.photos.delete")}><Trash2 /></button>
            </div>
          ))}
          <button type="button" className="add-dashed" onClick={addMs}><Plus /> {t("jobs.milestone.add")}</button>
        </div>

        {/* Payment coverage */}
        {terms.length > 0 && (
          <div className="cov-list">
            {terms.map((x) => {
              const linked = x.trigger === "on_signing" || x.trigger === "days_after_signing" || x.trigger === "holdback_release" || milestones.some((m) => m.paymentTermId === x.id);
              return (
                <span key={x.id} className={cn(linked && "ok")}>
                  <CheckCircle2 />
                  {x.amountType === "percent" ? `${x.value}%` : formatCad(x.value)} {x.label}
                  {x.trigger === "on_signing" && ` (${t("jobs.setup.dueNow")})`}
                </span>
              );
            })}
          </div>
        )}
      </section>

      {/* Budget */}
      <section className="card">
        <div className="card-head">
          <div>
            <h2>{t("jobs.setup.budget")}</h2>
            <p className="hint">{t("jobs.setup.budgetHint")}</p>
          </div>
          <div className="totals">
            <span>{t("jobs.setup.budgetTotal")} <b>{formatCents(budgetTotalCents)}</b></span>
            {marginPct !== null && <span className={marginPct < 15 ? "warn" : "ok"}>{t("jobs.setup.projectedMargin")} {marginPct}%</span>}
          </div>
        </div>
        <div className="budget-grid">
          {CATEGORIES.map((c) => {
            const line = budget.find((b) => b.category === c);
            return (
              <div key={c} className="cell">
                <label className="lbl-xs" htmlFor={`budget-${c}`}>{t(`jobs.cost.${c}`)}</label>
                <div className="money-in">
                  <span>$</span>
                  <input
                    id={`budget-${c}`}
                    type="number" min={0} step="1"
                    className="inp-sm"
                    value={line?.amount ?? ""}
                    onChange={(e) => setBudget((b) => (line ? b.map((x) => (x.category === c ? { ...x, amount: e.target.value } : x)) : [...b, { category: c, label: t(`jobs.cost.${c}`), amount: e.target.value }]))}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="save-bar">
        <span className="foot-note">{confirmed ? t("jobs.setup.editFooter") : t("jobs.setup.footer")}</span>
        <button type="button" className="btn btn-sm btn-outline-navy" disabled={save.isPending} onClick={() => save.mutate()}>{t("jobs.setup.save")}</button>
        <button type="button" className="btn btn-sm btn-navy" style={{ background: "var(--green)" }} disabled={confirm.isPending || milestones.length === 0} onClick={() => confirm.mutate()}>
          {confirm.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {confirmed ? t("jobs.setup.saveAndBack") : t("jobs.setup.confirm")}
        </button>
      </div>
    </div>
  );
}
