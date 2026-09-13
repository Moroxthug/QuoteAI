import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import {
  ArrowLeft, Briefcase, MapPin, FileSignature, Sparkles, Loader2, Plus, Trash2, CheckCircle2, Circle, PlayCircle, Receipt, Users, FolderOpen, CalendarDays, LayoutDashboard, GitBranch, ExternalLink, Download, Pencil, Check, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { jobsApi, formatCents, type JobDetailDto, type JobStatus, type MilestoneDto, type MilestoneStatus, type TaskDto } from "@/lib/jobs-api";
import { contractsApi } from "@/lib/contracts-api";
import { Gantt } from "@/components/jobs/gantt";
import { JobStatusBadge, MilestoneStatusBadge, ChangeOrderStatusBadge } from "@/components/jobs/badges";
import { ChangeOrderDialog } from "@/components/jobs/change-order-dialog";

const TABS = ["overview", "schedule", "changes", "costs", "team", "documents"] as const;
type Tab = (typeof TABS)[number];
const TAB_ICONS: Record<Tab, typeof LayoutDashboard> = { overview: LayoutDashboard, schedule: CalendarDays, changes: GitBranch, costs: Receipt, team: Users, documents: FolderOpen };

const day = (s: string | null) => (s ? new Date(`${s}T00:00:00`) : null);

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const search = useSearch();
  const initialTab = (new URLSearchParams(search).get("tab") as Tab | null) ?? "overview";
  const [tab, setTab] = useState<Tab>(TABS.includes(initialTab) ? initialTab : "overview");
  const [coOpen, setCoOpen] = useState(false);

  const { data, isLoading, error } = useQuery({ queryKey: ["job", id], queryFn: () => jobsApi.get(id!), enabled: !!id });

  useEffect(() => {
    if (data && data.job.setupStatus === "pending_review") navigate(`/dashboard/jobs/${id}/setup`, { replace: true });
  }, [data, id, navigate]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["job", id] });
    queryClient.invalidateQueries({ queryKey: ["jobs"] });
  };
  const onError = (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" });

  const setStatus = useMutation({ mutationFn: (status: JobStatus) => jobsApi.update(id!, { status }), onSuccess: refresh, onError });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-24 w-full rounded-2xl" /><Skeleton className="h-64 w-full rounded-2xl" /></div>;
  if (error || !data) return <div className="p-8 text-center text-slate-500">{t("jobs.notFound")} <Link href="/dashboard/jobs" className="text-violet-600 underline">{t("jobs.backToList")}</Link></div>;

  const { job, milestones, changeOrders, budgetTotalCents, costs } = data;
  const done = milestones.filter((m) => m.status === "completed").length;
  const invoicedHint = milestones.filter((m) => m.status === "completed" && m.paymentAmountCents).reduce((s, m) => s + (m.paymentAmountCents ?? 0), 0);
  const deposit = job.contract?.paymentSchedule.terms.find((x) => x.trigger === "on_signing");
  const depositCents = deposit && job.contract ? Math.round((deposit.amountType === "percent" ? (job.contract.total * deposit.value) / 100 : deposit.value) * 100) : 0;
  const releasedCents = invoicedHint + depositCents;
  const subtotalCents = job.contract ? Math.round(job.contract.subtotal * 100) : job.contractValueCents;
  const projectedMargin = subtotalCents > 0 && budgetTotalCents > 0 ? Math.round(((subtotalCents - budgetTotalCents) / subtotalCents) * 100) : null;
  const actualCosts = costs.totalCents;

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div>
        <Link href="/dashboard/jobs" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /> {t("jobs.backToList")}</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2 flex-wrap">
              <Briefcase className="h-7 w-7 text-violet-600 shrink-0" />
              <EditableName id={job.id} name={job.name} />
              <JobStatusBadge status={job.status} />
            </h1>
            <div className="text-slate-500 mt-1 text-sm flex flex-wrap items-center gap-x-3 gap-y-1">
              {job.client && <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{job.client.name}</span>}
              {job.address && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.address}</span>}
              {job.contract && <Link href={`/dashboard/contracts/${job.contract.id}`} className="inline-flex items-center gap-1 hover:text-violet-700"><FileSignature className="h-3.5 w-3.5" />{job.contract.contractNumber}</Link>}
              {job.plannedStart && job.plannedEnd && <span>{format(day(job.plannedStart)!, "d MMM", { locale })} → {format(day(job.plannedEnd)!, "PP", { locale })}</span>}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href={`/dashboard/jobs/${job.id}/setup`}><Button variant="outline" size="sm" className="gap-2"><Sparkles className="h-4 w-4" /> {t("jobs.editSetup")}</Button></Link>
            {job.status === "planning" && <Button size="sm" className="gap-2" onClick={() => setStatus.mutate("active")}><PlayCircle className="h-4 w-4" /> {t("jobs.action.start")}</Button>}
            {job.status === "active" && <Button size="sm" variant="outline" onClick={() => setStatus.mutate("suspended")}>{t("jobs.action.suspend")}</Button>}
            {job.status === "suspended" && <Button size="sm" onClick={() => setStatus.mutate("active")}>{t("jobs.action.resume")}</Button>}
            {job.status !== "completed" && <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700" disabled={setStatus.isPending} onClick={() => setStatus.mutate("completed")}><CheckCircle2 className="h-4 w-4" /> {t("jobs.action.complete")}</Button>}
            {job.status === "completed" && <Button size="sm" variant="outline" onClick={() => setStatus.mutate("active")}>{t("jobs.action.reopen")}</Button>}
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label={t("jobs.kpi.value")} value={formatCents(job.totalValueCents)} sub={job.changeOrdersCents ? `${formatCents(job.contractValueCents)} + ${formatCents(job.changeOrdersCents)} ${t("jobs.kpi.co")}` : undefined} />
        <Kpi label={t("jobs.kpi.released")} value={formatCents(releasedCents)} sub={t("jobs.kpi.releasedSub")} accent="text-blue-600" />
        <Kpi label={t("jobs.kpi.budget")} value={budgetTotalCents ? formatCents(budgetTotalCents) : "—"} sub={projectedMargin !== null ? `${t("jobs.kpi.projectedMargin")} ${projectedMargin}%` : undefined} />
        <Kpi label={t("jobs.kpi.costs")} value={formatCents(actualCosts)} sub={budgetTotalCents ? `${Math.round((actualCosts / budgetTotalCents) * 100)}% ${t("jobs.kpi.ofBudget")}` : undefined} accent={budgetTotalCents && actualCosts > budgetTotalCents ? "text-rose-600" : undefined} />
        <Kpi label={t("jobs.kpi.progress")} value={`${job.progressPercent}%`} sub={`${done}/${milestones.length} ${t("jobs.milestonesShort")}`} accent="text-emerald-600" progress={job.progressPercent} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit overflow-x-auto max-w-full">
        {TABS.map((k) => {
          const Icon = TAB_ICONS[k];
          const count = k === "changes" ? changeOrders.length : undefined;
          return (
            <button key={k} onClick={() => setTab(k)} className={cn("px-3 py-1.5 text-sm font-medium rounded-lg transition-all inline-flex items-center gap-1.5 whitespace-nowrap", tab === k ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}>
              <Icon className="h-3.5 w-3.5" /> {t(`jobs.tab.${k}`)}{count ? <span className="text-[10px] bg-slate-200 text-slate-700 rounded-full px-1.5">{count}</span> : null}
            </button>
          );
        })}
      </div>

      {tab === "overview" && <OverviewTab data={data} locale={locale} onGoTo={setTab} />}
      {tab === "schedule" && <ScheduleTab data={data} locale={locale} />}
      {tab === "changes" && (
        <ChangesTab data={data} locale={locale} onNew={() => setCoOpen(true)} />
      )}
      {tab === "costs" && <CostsTab data={data} locale={locale} />}
      {tab === "team" && <TeamTab data={data} />}
      {tab === "documents" && <DocumentsTab data={data} locale={locale} />}

      <ChangeOrderDialog jobId={job.id} open={coOpen} onOpenChange={setCoOpen} />
    </div>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────────

function Kpi({ label, value, sub, accent, progress }: { label: string; value: string; sub?: string; accent?: string; progress?: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={cn("text-xl font-bold text-slate-900 mt-0.5", accent)}>{value}</div>
      {progress !== undefined && <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1.5"><div className="h-full bg-emerald-500" style={{ width: `${progress}%` }} /></div>}
      {sub && <div className="text-[11px] text-slate-400 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

function EditableName({ id, name }: { id: string; name: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: () => jobsApi.update(id, { name: value.trim() }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["job", id] }); queryClient.invalidateQueries({ queryKey: ["jobs"] }); setEditing(false); },
  });
  if (!editing) return <span className="inline-flex items-center gap-2 group"><span className="truncate">{name}</span><button className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700" onClick={() => { setValue(name); setEditing(true); }}><Pencil className="h-4 w-4" /></button></span>;
  return (
    <span className="inline-flex items-center gap-1">
      <Input value={value} onChange={(e) => setValue(e.target.value)} className="h-9 text-lg font-bold w-72" autoFocus onKeyDown={(e) => { if (e.key === "Enter") save.mutate(); if (e.key === "Escape") setEditing(false); }} />
      <button className="text-emerald-600" onClick={() => save.mutate()} disabled={!value.trim() || save.isPending}><Check className="h-5 w-5" /></button>
      <button className="text-slate-400" onClick={() => setEditing(false)}><X className="h-5 w-5" /></button>
    </span>
  );
}

function OverviewTab({ data, locale, onGoTo }: { data: JobDetailDto; locale: typeof enCA; onGoTo: (t: Tab) => void }) {
  const { t } = useLanguage();
  const { job, milestones, budget, changeOrders } = data;
  const next = milestones.find((m) => m.status === "in_progress") ?? milestones.find((m) => m.status === "planned");
  const terms = job.contract?.paymentSchedule.terms ?? [];
  const total = job.contract?.total ?? job.contractValueCents / 100;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-slate-900">{t("jobs.overview.timeline")}</h2>
            <button className="text-sm text-violet-600 hover:underline" onClick={() => onGoTo("schedule")}>{t("jobs.overview.openSchedule")}</button>
          </div>
          <Gantt rows={milestones.map((m) => ({ id: m.id, title: m.title, start: m.plannedStart, end: m.plannedEnd, status: m.status, paymentAmountCents: m.paymentAmountCents }))} onRowClick={() => onGoTo("schedule")} />
        </section>

        {next && (
          <section className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 md:p-5">
            <div className="text-xs uppercase tracking-wide text-blue-600 font-semibold">{t("jobs.overview.upNext")}</div>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold text-slate-900">{next.title}</div>
                <div className="text-sm text-slate-500">
                  {next.plannedStart && next.plannedEnd ? `${format(day(next.plannedStart)!, "d MMM", { locale })} → ${format(day(next.plannedEnd)!, "PP", { locale })}` : "—"}
                  {next.paymentAmountCents ? ` · ${t("jobs.overview.releases")} ${formatCents(next.paymentAmountCents)}` : ""}
                </div>
              </div>
              <MilestoneStatusBadge status={next.status} />
            </div>
          </section>
        )}
      </div>

      <div className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold text-slate-900 mb-2">{t("jobs.overview.payments")}</h3>
          {terms.length === 0 ? <p className="text-sm text-slate-400">{t("jobs.overview.noSchedule")}</p> : (
            <ul className="space-y-1.5">
              {terms.map((x) => {
                const amount = x.amountType === "percent" ? (total * x.value) / 100 : x.value;
                const ms = milestones.find((m) => m.paymentTermId === x.id);
                const released = x.trigger === "on_signing" || ms?.status === "completed";
                return (
                  <li key={x.id} className="flex items-start gap-2 text-sm">
                    {released ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" /> : <Circle className="h-4 w-4 text-slate-300 mt-0.5 shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="text-slate-800 truncate">{x.label}</div>
                      <div className="text-[11px] text-slate-400 truncate">{ms ? `${t("jobs.overview.onMilestone")} ${ms.title}` : x.trigger === "on_signing" ? t("jobs.setup.dueNow") : x.trigger === "on_completion" ? t("jobs.overview.onCompletion") : t("jobs.overview.unlinked")}</div>
                    </div>
                    <div className="font-medium text-slate-900 whitespace-nowrap">{formatCents(Math.round(amount * 100))}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold text-slate-900 mb-2">{t("jobs.overview.budget")}</h3>
          {budget.length === 0 ? <p className="text-sm text-slate-400">{t("jobs.overview.noBudget")}</p> : (
            <ul className="space-y-1">
              {budget.map((b) => (
                <li key={b.id} className="flex justify-between text-sm"><span className="text-slate-600">{t(`jobs.cost.${b.category}`)}</span><span className="font-medium text-slate-900">{formatCents(b.plannedCents)}</span></li>
              ))}
            </ul>
          )}
          <button className="text-xs text-violet-600 hover:underline mt-2" onClick={() => onGoTo("costs")}>{t("jobs.overview.openCosts")}</button>
        </section>

        {changeOrders.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-bold text-slate-900 mb-2">{t("jobs.tab.changes")}</h3>
            <ul className="space-y-1.5">
              {changeOrders.map((co) => (
                <li key={co.id} className="flex items-center justify-between gap-2 text-sm"><span className="truncate">{co.number} · {co.title}</span><ChangeOrderStatusBadge status={co.status} /></li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function ScheduleTab({ data, locale }: { data: JobDetailDto; locale: typeof enCA }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { job, milestones, unassignedTasks } = data;
  const refresh = () => { queryClient.invalidateQueries({ queryKey: ["job", job.id] }); queryClient.invalidateQueries({ queryKey: ["jobs"] }); };
  const onError = (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" });
  const setMs = useMutation({ mutationFn: ({ mid, status }: { mid: string; status: MilestoneStatus }) => jobsApi.updateMilestone(job.id, mid, { status }), onSuccess: (_r, v) => { refresh(); if (v.status === "completed") toast({ title: t("jobs.milestone.completedToast") }); }, onError });
  const addTask = useMutation({ mutationFn: (v: { title: string; milestoneId: string | null }) => jobsApi.addTask(job.id, v), onSuccess: refresh, onError });
  const toggleTask = useMutation({ mutationFn: (task: TaskDto) => jobsApi.updateTask(job.id, task.id, { status: task.status === "done" ? "todo" : "done" }), onSuccess: refresh, onError });
  const delTask = useMutation({ mutationFn: (tid: string) => jobsApi.deleteTask(job.id, tid), onSuccess: refresh, onError });
  const [newTask, setNewTask] = useState<{ milestoneId: string | null; title: string } | null>(null);

  const [open, setOpen] = useState<string | null>(milestones.find((m) => m.status === "in_progress")?.id ?? null);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-slate-900">{t("jobs.schedule.gantt")}</h2>
          <Link href={`/dashboard/jobs/${job.id}/setup`} className="text-sm text-violet-600 hover:underline">{t("jobs.schedule.editDates")}</Link>
        </div>
        <Gantt rows={milestones.map((m) => ({ id: m.id, title: m.title, start: m.plannedStart, end: m.plannedEnd, status: m.status, paymentAmountCents: m.paymentAmountCents }))} onRowClick={(mid) => setOpen(mid)} />
      </section>

      <div className="space-y-2">
        {milestones.map((m: MilestoneDto, idx) => {
          const expanded = open === m.id;
          const doneTasks = m.tasks.filter((x) => x.status === "done").length;
          return (
            <div key={m.id} className={cn("rounded-2xl border bg-white transition-colors", m.status === "in_progress" ? "border-blue-200" : m.status === "completed" ? "border-emerald-100" : "border-slate-200")}>
              <button className="w-full flex items-center gap-3 px-4 py-3 text-left" onClick={() => setOpen(expanded ? null : m.id)}>
                <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0", m.status === "completed" ? "bg-emerald-500 text-white" : m.status === "in_progress" ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-600")}>
                  {m.status === "completed" ? <Check className="h-4 w-4" /> : idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900">{m.title}</span>
                    <MilestoneStatusBadge status={m.status} />
                    {m.paymentAmountCents ? <span className="text-[11px] text-emerald-700 bg-emerald-50 rounded px-1.5 py-0.5">{t("jobs.overview.releases")} {formatCents(m.paymentAmountCents)}</span> : null}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {m.plannedStart && m.plannedEnd ? `${format(day(m.plannedStart)!, "d MMM", { locale })} → ${format(day(m.plannedEnd)!, "d MMM yyyy", { locale })}` : "—"}
                    {m.tasks.length ? ` · ${doneTasks}/${m.tasks.length} ${t("jobs.tasksShort")}` : ""}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {m.status === "planned" && <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setMs.mutate({ mid: m.id, status: "in_progress" })}><PlayCircle className="h-3.5 w-3.5" /> {t("jobs.milestone.start")}</Button>}
                  {(m.status === "planned" || m.status === "in_progress") && <Button size="sm" className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => setMs.mutate({ mid: m.id, status: "completed" })}><CheckCircle2 className="h-3.5 w-3.5" /> {t("jobs.milestone.complete")}</Button>}
                  {m.status === "completed" && <Button size="sm" variant="ghost" className="h-8" onClick={() => setMs.mutate({ mid: m.id, status: "in_progress" })}>{t("jobs.milestone.reopen")}</Button>}
                </div>
              </button>
              {expanded && (
                <div className="px-4 pb-4 pl-[3.75rem] space-y-2">
                  {m.description && <p className="text-sm text-slate-600">{m.description}</p>}
                  {m.paymentTermLabel && <p className="text-xs text-slate-500">{t("jobs.milestone.linkedPayment")}: <span className="font-medium text-slate-700">{m.paymentTermLabel}</span></p>}
                  <TaskList tasks={m.tasks} onToggle={(x) => toggleTask.mutate(x)} onDelete={(tid) => delTask.mutate(tid)} />
                  {newTask?.milestoneId === m.id ? (
                    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (newTask.title.trim()) { addTask.mutate({ title: newTask.title.trim(), milestoneId: m.id }); setNewTask(null); } }}>
                      <Input autoFocus value={newTask.title} onChange={(e) => setNewTask({ milestoneId: m.id, title: e.target.value })} placeholder={t("jobs.task.placeholder")} className="h-8" />
                      <Button type="submit" size="sm" className="h-8">{t("jobs.task.add")}</Button>
                      <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setNewTask(null)}>{t("jobs.cancel")}</Button>
                    </form>
                  ) : (
                    <button className="text-xs text-violet-600 hover:underline inline-flex items-center gap-1" onClick={() => setNewTask({ milestoneId: m.id, title: "" })}><Plus className="h-3 w-3" /> {t("jobs.task.add")}</button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {milestones.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            {t("jobs.schedule.empty")} <Link href={`/dashboard/jobs/${job.id}/setup`} className="text-violet-600 underline">{t("jobs.schedule.addMilestones")}</Link>
          </div>
        )}
      </div>

      {unassignedTasks.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold text-slate-900 mb-2">{t("jobs.schedule.otherTasks")}</h3>
          <TaskList tasks={unassignedTasks} onToggle={(x) => toggleTask.mutate(x)} onDelete={(tid) => delTask.mutate(tid)} />
        </section>
      )}
    </div>
  );
}

function TaskList({ tasks, onToggle, onDelete }: { tasks: TaskDto[]; onToggle: (t: TaskDto) => void; onDelete: (id: string) => void }) {
  if (tasks.length === 0) return null;
  return (
    <ul className="space-y-1">
      {tasks.map((x) => (
        <li key={x.id} className="flex items-center gap-2 text-sm group">
          <button onClick={() => onToggle(x)} className={cn("h-4 w-4 rounded border flex items-center justify-center shrink-0", x.status === "done" ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 hover:border-violet-400")}>{x.status === "done" && <Check className="h-3 w-3" />}</button>
          <span className={cn("flex-1 truncate", x.status === "done" && "line-through text-slate-400")}>{x.title}</span>
          <button className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500" onClick={() => onDelete(x.id)}><Trash2 className="h-3.5 w-3.5" /></button>
        </li>
      ))}
    </ul>
  );
}

function ChangesTab({ data, locale, onNew }: { data: JobDetailDto; locale: typeof enCA; onNew: () => void }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { job, changeOrders } = data;
  const del = useMutation({ mutationFn: (coId: string) => jobsApi.deleteChangeOrder(job.id, coId), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["job", job.id] }), onError: (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" }) });
  const signedTotal = changeOrders.filter((c) => c.status === "signed").reduce((s, c) => s + c.totalCents, 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{t("jobs.co.intro")}</p>
        <Button size="sm" className="gap-2" onClick={onNew} disabled={!job.contract || job.contract.status !== "signed"}><Plus className="h-4 w-4" /> {t("jobs.co.new")}</Button>
      </div>
      {!job.contract && <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">{t("jobs.co.noContract")}</p>}
      {changeOrders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">{t("jobs.co.empty")}</div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden divide-y">
          {changeOrders.map((co) => (
            <div key={co.id} className="flex items-center gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap"><span className="font-semibold text-slate-900">{co.number}</span><span className="text-slate-700 truncate">{co.title}</span><ChangeOrderStatusBadge status={co.status} /></div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {format(new Date(co.createdAt), "PP", { locale })}
                  {co.scheduleDeltaDays ? ` · ${co.scheduleDeltaDays > 0 ? "+" : ""}${co.scheduleDeltaDays} ${t("jobs.co.days")}` : ""}
                  {co.signedAt ? ` · ${t("jobs.co.signedOn")} ${format(new Date(co.signedAt), "PP", { locale })}` : ""}
                </div>
              </div>
              <div className={cn("font-semibold whitespace-nowrap", co.totalCents < 0 ? "text-rose-600" : "text-slate-900")}>{formatCents(co.totalCents)}</div>
              {co.documentContractId && (
                <Link href={`/dashboard/contracts/${co.documentContractId}`} className="text-sm text-violet-600 hover:underline inline-flex items-center gap-1 whitespace-nowrap">
                  {co.status === "draft" ? t("jobs.co.signAndSend") : t("jobs.co.open")} <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              )}
              {co.status === "draft" && <button className="text-slate-300 hover:text-rose-500" onClick={() => del.mutate(co.id)}><Trash2 className="h-4 w-4" /></button>}
            </div>
          ))}
          {signedTotal !== 0 && <div className="px-4 py-2 text-sm text-right text-slate-600 bg-slate-50">{t("jobs.co.signedTotal")} <span className="font-semibold text-slate-900">{formatCents(signedTotal)}</span></div>}
        </div>
      )}
    </div>
  );
}

function CostsTab({ data, locale }: { data: JobDetailDto; locale: typeof enCA }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { job, budget, budgetTotalCents, costs } = data;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["job", job.id] });
  const onError = (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" });
  const add = useMutation({ mutationFn: (v: { description: string; amountCents: number; date?: string }) => jobsApi.addCost(job.id, v), onSuccess: () => { refresh(); setDesc(""); setAmount(""); }, onError });
  const del = useMutation({ mutationFn: (cid: string) => jobsApi.deleteCost(job.id, cid), onSuccess: refresh, onError });
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const pct = budgetTotalCents ? Math.min(100, Math.round((costs.totalCents / budgetTotalCents) * 100)) : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <section className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-4 md:p-5 space-y-3">
        <h2 className="text-base font-bold text-slate-900">{t("jobs.costs.entries")}</h2>
        <form className="grid grid-cols-1 md:grid-cols-[1fr_120px_140px_auto] gap-2" onSubmit={(e) => { e.preventDefault(); if (desc.trim() && amount) add.mutate({ description: desc.trim(), amountCents: Math.round(Number(amount) * 100), date: date || undefined }); }}>
          <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t("jobs.costs.descPlaceholder")} />
          <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="$" />
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Button type="submit" size="sm" className="h-10 gap-1" disabled={add.isPending}><Plus className="h-4 w-4" /> {t("jobs.costs.add")}</Button>
        </form>
        <p className="text-[11px] text-slate-400">{t("jobs.costs.phase3Hint")}</p>
        {costs.entries.length === 0 ? <p className="text-sm text-slate-400 py-4 text-center">{t("jobs.costs.empty")}</p> : (
          <ul className="divide-y">
            {costs.entries.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2 text-sm group">
                <span className="text-xs text-slate-400 w-24 shrink-0">{format(new Date(c.date), "PP", { locale })}</span>
                <span className="flex-1 truncate text-slate-800">{c.description}</span>
                <span className="font-medium">{formatCents(c.amountCents)}</span>
                <button className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500" onClick={() => del.mutate(c.id)}><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-slate-900">{t("jobs.costs.budgetVsActual")}</h3><Link href={`/dashboard/jobs/${job.id}/setup`} className="text-xs text-violet-600 hover:underline">{t("jobs.costs.editBudget")}</Link></div>
        <div>
          <div className="flex justify-between text-sm"><span className="text-slate-500">{t("jobs.kpi.costs")}</span><span className="font-semibold">{formatCents(costs.totalCents)}</span></div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden mt-1"><div className={cn("h-full", costs.totalCents > budgetTotalCents && budgetTotalCents ? "bg-rose-500" : "bg-emerald-500")} style={{ width: `${pct}%` }} /></div>
          <div className="flex justify-between text-xs text-slate-400 mt-1"><span>{t("jobs.kpi.budget")}</span><span>{formatCents(budgetTotalCents)}</span></div>
        </div>
        {budget.length > 0 && (
          <ul className="space-y-1 pt-2 border-t">
            {budget.map((b) => <li key={b.id} className="flex justify-between text-sm"><span className="text-slate-600">{t(`jobs.cost.${b.category}`)}</span><span>{formatCents(b.plannedCents)}</span></li>)}
          </ul>
        )}
      </section>
    </div>
  );
}

function TeamTab({ data }: { data: JobDetailDto }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { job, assignments } = data;
  const { data: collaborators } = useQuery({ queryKey: ["collaborators"], queryFn: jobsApi.collaborators });
  const refresh = () => { queryClient.invalidateQueries({ queryKey: ["job", job.id] }); queryClient.invalidateQueries({ queryKey: ["collaborators"] }); };
  const onError = (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" });
  const assign = useMutation({ mutationFn: (collaboratorId: string) => jobsApi.assign(job.id, { collaboratorId }), onSuccess: refresh, onError });
  const unassign = useMutation({ mutationFn: (aid: string) => jobsApi.unassign(job.id, aid), onSuccess: refresh, onError });
  const addCollab = useMutation({ mutationFn: (v: { name: string; hourlyRate?: number }) => jobsApi.addCollaborator(v), onSuccess: async (c) => { await assign.mutateAsync(c.id); setName(""); setRate(""); }, onError });
  const [name, setName] = useState("");
  const [rate, setRate] = useState("");
  const [pick, setPick] = useState("");
  const available = (collaborators ?? []).filter((c) => !assignments.some((a) => a.collaboratorId === c.id));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <section className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-4 md:p-5 space-y-3">
        <h2 className="text-base font-bold text-slate-900">{t("jobs.team.assigned")}</h2>
        {assignments.length === 0 ? <p className="text-sm text-slate-400 py-4 text-center">{t("jobs.team.empty")}</p> : (
          <ul className="divide-y">
            {assignments.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2 text-sm group">
                <div className="h-8 w-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-bold">{a.collaboratorName.slice(0, 2).toUpperCase()}</div>
                <div className="flex-1 min-w-0"><div className="font-medium text-slate-800 truncate">{a.collaboratorName}</div><div className="text-xs text-slate-400">{a.collaboratorRole}{a.collaboratorHourlyRate ? ` · ${formatCents(a.collaboratorHourlyRate)}/h` : ""}</div></div>
                <button className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500" onClick={() => unassign.mutate(a.id)}><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-slate-400">{t("jobs.team.phase3Hint")}</p>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        <h3 className="text-sm font-bold text-slate-900">{t("jobs.team.add")}</h3>
        {available.length > 0 && (
          <div className="flex gap-2">
            <select value={pick} onChange={(e) => setPick(e.target.value)} className="h-9 flex-1 rounded-md border border-slate-200 bg-white px-2 text-sm">
              <option value="">{t("jobs.team.pick")}</option>
              {available.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Button size="sm" className="h-9" disabled={!pick || assign.isPending} onClick={() => { assign.mutate(pick); setPick(""); }}>{t("jobs.team.assign")}</Button>
          </div>
        )}
        <form className="space-y-2 pt-2 border-t" onSubmit={(e) => { e.preventDefault(); if (name.trim()) addCollab.mutate({ name: name.trim(), hourlyRate: rate ? Math.round(Number(rate) * 100) : undefined }); }}>
          <Label className="text-xs text-slate-500">{t("jobs.team.newWorker")}</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("jobs.team.namePlaceholder")} className="h-9" />
          <Input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder={t("jobs.team.ratePlaceholder")} className="h-9" />
          <Button type="submit" size="sm" variant="outline" className="w-full h-9" disabled={!name.trim() || addCollab.isPending}>{t("jobs.team.addAndAssign")}</Button>
        </form>
      </section>
    </div>
  );
}

function DocumentsTab({ data, locale }: { data: JobDetailDto; locale: typeof enCA }) {
  const { t } = useLanguage();
  const { job, changeOrders } = data;
  const docs = useMemo(() => {
    const list: { id: string; title: string; sub: string; href: string; pdf?: string }[] = [];
    if (job.contract) list.push({ id: job.contract.id, title: `${t("jobs.docs.contract")} ${job.contract.contractNumber}`, sub: job.contract.signedAt ? `${t("jobs.co.signedOn")} ${format(new Date(job.contract.signedAt), "PP", { locale })}` : job.contract.status, href: `/dashboard/contracts/${job.contract.id}`, pdf: contractsApi.pdfUrl(job.contract.id, true) });
    for (const co of changeOrders) if (co.documentContractId) list.push({ id: co.id, title: `${co.number} · ${co.title}`, sub: t(`jobs.co.status.${co.status}`), href: `/dashboard/contracts/${co.documentContractId}`, pdf: contractsApi.pdfUrl(co.documentContractId, true) });
    if (job.quote) list.push({ id: job.quote.id, title: `${t("jobs.docs.quote")} ${job.quote.number ?? ""}`.trim(), sub: job.quote.status, href: `/dashboard/quotes/${job.quote.id}` });
    return list;
  }, [job, changeOrders, t, locale]);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden divide-y">
      {docs.length === 0 && <div className="p-8 text-center text-sm text-slate-400">{t("jobs.docs.empty")}</div>}
      {docs.map((d) => (
        <div key={d.id} className="flex items-center gap-3 px-4 py-3">
          <div className="h-9 w-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center"><FileSignature className="h-4 w-4" /></div>
          <div className="min-w-0 flex-1"><Link href={d.href} className="font-medium text-slate-900 hover:text-violet-700 truncate block">{d.title}</Link><div className="text-xs text-slate-400">{d.sub}</div></div>
          {d.pdf && <a href={d.pdf} className="text-sm text-violet-600 hover:underline inline-flex items-center gap-1"><Download className="h-3.5 w-3.5" /> PDF</a>}
        </div>
      ))}
      <div className="px-4 py-3 text-[11px] text-slate-400">{t("jobs.docs.phase3Hint")}</div>
    </div>
  );
}
