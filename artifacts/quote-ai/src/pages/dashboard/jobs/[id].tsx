import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import {
  ArrowLeft, Briefcase, MapPin, MessageSquareText, MessageSquare, FileSignature, Sparkles, Plus, Trash2, CheckCircle2, Circle, PlayCircle, Receipt, Wallet, Users, FolderOpen, CalendarDays, LayoutDashboard, GitBranch, ExternalLink, Download, Pencil, Check, X, Camera, Archive,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { jobsApi, formatCents, type JobDetailDto, type JobStatus, type MilestoneDto, type MilestoneStatus, type TaskDto } from "@/lib/jobs-api";
import { contractsApi } from "@/lib/contracts-api";
import { invoicesApi } from "@/lib/invoices-api";
import { Gantt } from "@/components/jobs/gantt";
import { JobStatusBadge, MilestoneStatusBadge, ChangeOrderStatusBadge } from "@/components/jobs/badges";
import { ChangeOrderDialog } from "@/components/jobs/change-order-dialog";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CostsTab } from "@/components/jobs/costs-tab";
import { TeamTab } from "@/components/jobs/team-tab";
import { InvoicesTab } from "@/components/jobs/invoices-tab";
import { OverviewCharts } from "@/components/jobs/overview-charts";
import { AssistantPanel } from "@/components/assistant/assistant-panel";
import { PhotosTab } from "@/components/jobs/photos-tab";
import { FieldReportsCard } from "@/components/crew/field-reports-card";
import { PermitsCard } from "@/components/jobs/permits-card";
import { CrewScheduleCard } from "@/components/schedule/crew-schedule-card";
import { ClientThreadCard } from "@/components/clients/client-thread";
import { VoiceActions } from "@/components/jobs/voice-actions";
import { useCan } from "@/hooks/use-role";
import { CompleteJobDialog, ArchiveJobDialog, completionPreview } from "@/components/jobs/lifecycle-dialogs";
import { NotesCard } from "@/components/jobs/notes-card";
import { ClientPortalCard } from "@/components/clients/client-portal-card";
import { clientPortalApi } from "@/lib/portal-api";

const TABS = ["overview", "schedule", "changes", "costs", "invoices", "team", "photos", "messages", "documents", "assistant"] as const;
type Tab = (typeof TABS)[number];
const TAB_ICONS: Record<Tab, typeof LayoutDashboard> = { overview: LayoutDashboard, schedule: CalendarDays, changes: GitBranch, costs: Wallet, invoices: Receipt, team: Users, photos: Camera, messages: MessageSquare, documents: FolderOpen, assistant: Sparkles };

const day = (s: string | null) => (s ? new Date(`${s}T00:00:00`) : null);

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useLanguage();
const can = useCan();
  const locale = lang === "fr" ? frCA : enCA;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const search = useSearch();
  const initialTab = (new URLSearchParams(search).get("tab") as Tab | null) ?? "overview";
  const [tab, setTab] = useState<Tab>(TABS.includes(initialTab) ? initialTab : "overview");
  const [coOpen, setCoOpen] = useState(false);
  // Phase 80: complete / archive ask first (see lifecycle-dialogs.tsx).
  const [completeOpen, setCompleteOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const { data, isLoading, error } = useQuery({ queryKey: ["job", id], queryFn: () => jobsApi.get(id!), enabled: !!id });
  // Phase 76: unread client replies drive the Messages tab badge.
  const clientId = data?.job.client?.id;
  const { data: portalStatus } = useQuery({ queryKey: ["client-portal", clientId], queryFn: () => clientPortalApi.status(clientId!), enabled: !!clientId });

  useEffect(() => {
    if (data && data.job.setupStatus === "pending_review") navigate(`/dashboard/jobs/${id}/setup`, { replace: true });
  }, [data, id, navigate]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["job", id] });
    queryClient.invalidateQueries({ queryKey: ["jobs"] });
  };
  const onError = (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" });

  const setStatus = useMutation({ mutationFn: (status: JobStatus) => jobsApi.update(id!, { status }), onSuccess: refresh, onError });
  // The job.completed automation runs before the PUT answers, so the final
  // invoice draft (when there was an unbilled balance) is already there.
  const complete = useMutation({
    mutationFn: () => jobsApi.update(id!, { status: "completed" }),
    onSuccess: () => {
      refresh();
      setCompleteOpen(false);
      const drafted = data ? completionPreview(data).unbilledCents > 0 : false;
      toast({ title: t(drafted ? "jobs.complete.doneToastInvoice" : "jobs.complete.doneToast") });
      if (drafted) setTab("invoices");
    },
    onError,
  });
  const archive = useMutation({ mutationFn: () => jobsApi.archive(id!), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["jobs"] }); toast({ title: t("archive.archivedToast") }); navigate("/dashboard/jobs"); }, onError });
  const canEditJob = can("jobs", "edit");
  const canFullJob = can("jobs", "full");

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-24 w-full rounded-[var(--radius-mk)]" /><Skeleton className="h-64 w-full rounded-[var(--radius-mk)]" /></div>;
  if (error || !data) return <div className="card card-empty">{t("jobs.notFound")} <Link href="/dashboard/jobs" className="text-link">{t("jobs.backToList")}</Link></div>;

  const { job, milestones, changeOrders, budgetTotalCents, costs, invoiceTotals } = data;
  const done = milestones.filter((m) => m.status === "completed").length;
  const subtotalCents = job.contract ? Math.round(job.contract.subtotal * 100) : job.contractValueCents;
  const projectedMargin = subtotalCents > 0 && budgetTotalCents > 0 ? Math.round(((subtotalCents - budgetTotalCents) / subtotalCents) * 100) : null;
  const actualCosts = costs.totalCents;

  return (
    <div className="animate-in fade-in duration-300">
      <Link href="/dashboard/jobs" className="back-link"><ArrowLeft /> {t("jobs.backToList")}</Link>
      <div className="page-head">
        <div className="min-w-0">
          <div className="title-row">
            <h1><Briefcase /><EditableName id={job.id} name={job.name} /></h1>
            <JobStatusBadge status={job.status} />
          </div>
          <div className="meta">
            {job.client && <span><Users />{job.client.name}</span>}
            {job.address && <span><MapPin />{job.address}</span>}
            {job.contract && <Link href={`/dashboard/contracts/${job.contract.id}`}><FileSignature />{job.contract.contractNumber}</Link>}
            {job.plannedStart && job.plannedEnd && <span>{format(day(job.plannedStart)!, "d MMM", { locale })} → {format(day(job.plannedEnd)!, "PP", { locale })}</span>}
          </div>
        </div>
        <div className="head-actions">
          {job.status !== "completed" && canEditJob && <VoiceActions jobId={job.id} />}
          {job.client?.phone && job.status !== "completed" && canEditJob && <OnMyWayButton jobId={job.id} clientName={job.client.name} />}
          {canEditJob && <Link href={`/dashboard/jobs/${job.id}/setup`} className="btn btn-sm btn-outline-navy"><Sparkles className="h-4 w-4" /> {t("jobs.editSetup")}</Link>}
          {canEditJob && job.status === "planning" && <button type="button" className="btn btn-sm btn-navy" onClick={() => setStatus.mutate("active")}><PlayCircle className="h-4 w-4" /> {t("jobs.action.start")}</button>}
          {canEditJob && job.status === "active" && <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => setStatus.mutate("suspended")}>{t("jobs.action.suspend")}</button>}
          {canEditJob && job.status === "suspended" && <button type="button" className="btn btn-sm btn-navy" onClick={() => setStatus.mutate("active")}>{t("jobs.action.resume")}</button>}
          {canEditJob && job.status !== "completed" && <button type="button" className="btn btn-sm btn-navy" style={{ background: "var(--green)" }} disabled={complete.isPending} onClick={() => setCompleteOpen(true)}><CheckCircle2 className="h-4 w-4" /> {t("jobs.action.complete")}</button>}
          {canEditJob && job.status === "completed" && <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => setStatus.mutate("active")}>{t("jobs.action.reopen")}</button>}
          {canFullJob && job.status === "completed" && <button type="button" className="text-link" onClick={() => setArchiveOpen(true)} disabled={archive.isPending}><Archive /> {t("dashboard.quotesList.archive")}</button>}
          <CompleteJobDialog data={data} open={completeOpen} onOpenChange={setCompleteOpen} onConfirm={() => complete.mutate()} busy={complete.isPending} />
          <ArchiveJobDialog open={archiveOpen} onOpenChange={setArchiveOpen} onConfirm={() => archive.mutate()} busy={archive.isPending} />
        </div>
      </div>

      {/* KPI strip */}
      <section className="stat-grid cols-5">
        <Kpi label={t("jobs.kpi.value")} value={formatCents(job.totalValueCents)} sub={job.changeOrdersCents ? `${formatCents(job.contractValueCents)} + ${formatCents(job.changeOrdersCents)} ${t("jobs.kpi.co")}` : undefined} />
        <Kpi label={t("jobs.kpi.invoiced")} value={formatCents(invoiceTotals.invoicedCents)} sub={`${formatCents(invoiceTotals.collectedCents)} ${t("jobs.kpi.collected")}${invoiceTotals.outstandingCents ? ` · ${formatCents(invoiceTotals.outstandingCents)} ${t("jobs.kpi.outstanding")}` : ""}`} tone={invoiceTotals.overdueCents ? "bad" : "teal"} />
        <Kpi label={t("jobs.kpi.budget")} value={budgetTotalCents ? formatCents(budgetTotalCents) : "—"} sub={projectedMargin !== null ? `${t("jobs.kpi.projectedMargin")} ${projectedMargin}%` : undefined} />
        <Kpi label={t("jobs.kpi.costs")} value={formatCents(actualCosts)} sub={costs.pendingCount ? `${costs.pendingCount} ${t("jobs.kpi.toReview")}` : budgetTotalCents ? `${Math.round((actualCosts / budgetTotalCents) * 100)}% ${t("jobs.kpi.ofBudget")}` : undefined} tone={budgetTotalCents && actualCosts > budgetTotalCents ? "bad" : undefined} />
        <Kpi label={t("jobs.kpi.progress")} value={`${job.progressPercent}%`} sub={`${done}/${milestones.length} ${t("jobs.milestonesShort")}`} tone="ok" progress={job.progressPercent} />
      </section>

      {/* Tabs */}
      <div className="pills scroll" style={{ marginBottom: 16 }}>
        {TABS.map((k) => {
          const Icon = TAB_ICONS[k];
          const count = k === "changes" ? changeOrders.length : k === "costs" ? costs.pendingCount : k === "invoices" ? invoiceTotals.draftCount : k === "team" ? data.timeEntries.filter((e) => e.status === "submitted").length : k === "messages" ? portalStatus?.unread : undefined;
          return (
            <button key={k} type="button" onClick={() => setTab(k)} className={cn("pill", tab === k && "on")}>
              <Icon /> {t(`jobs.tab.${k}`)}{count ? <span className="cnt">{count}</span> : null}
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
      {tab === "invoices" && <InvoicesTab data={data} locale={locale} />}
      {tab === "team" && <TeamTab data={data} locale={locale} />}
      {tab === "photos" && <PhotosTab data={data} />}
      {tab === "messages" && (
        job.client ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2"><ClientThreadCard clientId={job.client.id} jobId={job.id} jobName={job.name} /></div>
            <div><ClientPortalCard clientId={job.client.id} /></div>
          </div>
        ) : (
          <div className="card card-empty">{t("thread.noClient")}</div>
        )
      )}
      {tab === "documents" && <DocumentsTab data={data} locale={locale} />}
      {tab === "assistant" && <AssistantPanel projectId={job.id} />}

      <ChangeOrderDialog jobId={job.id} open={coOpen} onOpenChange={setCoOpen} />
    </div>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────────

function Kpi({ label, value, sub, tone, progress }: { label: string; value: string; sub?: string; tone?: "ok" | "warn" | "bad" | "teal"; progress?: number }) {
  return (
    <div className="card stat-card">
      <p className="lbl">{label}</p>
      <p className={cn("val", tone)}>{value}</p>
      {progress !== undefined && <div className="pbar"><i style={{ width: `${progress}%` }} /></div>}
      {sub && <p className="sub">{sub}</p>}
    </div>
  );
}

/** Phase 74: one-off "on my way" text to the job's client, with an optional ETA. */
function OnMyWayButton({ jobId, clientName }: { jobId: string; clientName: string }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [eta, setEta] = useState<string>("30");
  const send = useMutation({
    mutationFn: () => jobsApi.onMyWay(jobId, eta === "" ? {} : { etaMinutes: Number(eta) }),
    onSuccess: (r) => { setOpen(false); toast({ title: t("jobs.onMyWay.sent").replace("{name}", clientName), description: r.body }); },
    onError: (e: Error & { status?: number; reason?: string }) => {
      const reason = e.reason;
      const key = e.status === 503 ? "jobs.onMyWay.notAvailable" : e.status === 402 ? "jobs.onMyWay.allowance" : reason === "opted_out" ? "jobs.onMyWay.optedOut" : "jobs.onMyWay.failed";
      toast({ title: t(key), description: e.status === 503 || e.status === 402 ? undefined : e.message, variant: "destructive" });
    },
  });
  return (
    <>
      <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => setOpen(true)}><MessageSquareText className="h-4 w-4" /> {t("jobs.onMyWay.button")}</button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("jobs.onMyWay.title")}</DialogTitle>
            <DialogDescription>{t("jobs.onMyWay.desc").replace("{name}", clientName)}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="field">
              <label>{t("jobs.onMyWay.eta")}</label>
              <select value={eta} onChange={(e) => setEta(e.target.value)}>
                <option value="">{t("jobs.onMyWay.etaNone")}</option>
                {["15", "30", "45", "60", "90", "120"].map((m) => <option key={m} value={m}>{t("jobs.onMyWay.etaMinutes").replace("{n}", m)}</option>)}
              </select>
              <span className="text-xs text-muted-foreground mt-1 block">{t("jobs.onMyWay.hint")}</span>
            </div>
          </DialogBody>
          <DialogFooter>
            <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => setOpen(false)}>{t("jobs.cancel")}</button>
            <button type="button" className="btn btn-sm btn-navy" disabled={send.isPending} onClick={() => send.mutate()}>{send.isPending ? "…" : t("jobs.onMyWay.send")}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}


function EditableName({ id, name }: { id: string; name: string }) {
  const { t } = useLanguage();
const can = useCan();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: () => jobsApi.update(id, { name: value.trim() }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["job", id] }); queryClient.invalidateQueries({ queryKey: ["jobs"] }); setEditing(false); },
  });
  if (!editing) return <span className="inline-flex items-center gap-2 group min-w-0"><span className="truncate">{name}</span>{can("jobs", "edit") && <button type="button" className="ic-btn opacity-0 group-hover:opacity-100 focus-visible:opacity-100" aria-label={t("a11y.rename")} onClick={() => { setValue(name); setEditing(true); }}><Pencil /></button>}</span>;
  return (
    <span className="field inline">
      <input value={value} onChange={(e) => setValue(e.target.value)} style={{ width: 288, fontSize: 18, fontWeight: 700 }} autoFocus onKeyDown={(e) => { if (e.key === "Enter") save.mutate(); if (e.key === "Escape") setEditing(false); }} />
      <button type="button" className="ic-btn ok" onClick={() => save.mutate()} disabled={!value.trim() || save.isPending}><Check /></button>
      <button type="button" className="ic-btn" onClick={() => setEditing(false)}><X /></button>
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
    <div className="stack">
      <OverviewCharts jobId={job.id} locale={locale} jobStatus={job.status} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 stack">
          <section className="card">
            <div className="card-head">
              <div><h2>{t("jobs.overview.timeline")}</h2></div>
              <button type="button" className="text-link" onClick={() => onGoTo("schedule")}>{t("jobs.overview.openSchedule")}</button>
            </div>
            <div className="act-body">
              <Gantt rows={milestones.map((m) => ({ id: m.id, title: m.title, start: m.plannedStart, end: m.plannedEnd, status: m.status, paymentAmountCents: m.paymentAmountCents }))} onRowClick={() => onGoTo("schedule")} />
            </div>
          </section>

          {next && (
            <section className="card" style={{ borderColor: "var(--teal)" }}>
              <div className="act-body">
                <p className="eyebrow" style={{ color: "var(--teal-dark)" }}>{t("jobs.overview.upNext")}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <b className="block text-[15px]" style={{ color: "var(--navy)" }}>{next.title}</b>
                    <span className="foot-note">
                      {next.plannedStart && next.plannedEnd ? `${format(day(next.plannedStart)!, "d MMM", { locale })} → ${format(day(next.plannedEnd)!, "PP", { locale })}` : "—"}
                      {next.paymentAmountCents ? ` · ${t("jobs.overview.releases")} ${formatCents(next.paymentAmountCents)}` : ""}
                    </span>
                  </div>
                  <MilestoneStatusBadge status={next.status} />
                </div>
              </div>
            </section>
          )}

          <FieldReportsCard jobId={job.id} />

          <PermitsCard jobId={job.id} />

          <NotesCard jobId={job.id} milestoneTitles={new Map(milestones.map((m) => [m.id, m.title]))} />
        </div>

        <div className="stack">
          <section className="card">
            <div className="card-head">
              <div><h2>{t("jobs.overview.payments")}</h2></div>
              <button type="button" className="text-link" onClick={() => onGoTo("invoices")}>{t("jobs.overview.openInvoices")}</button>
            </div>
            {terms.length === 0 ? <div className="card-empty">{t("jobs.overview.noSchedule")}</div> : (
              <div>
                {terms.map((x) => {
                  const amount = x.amountType === "percent" ? (total * x.value) / 100 : x.value;
                  const ms = milestones.find((m) => m.paymentTermId === x.id);
                  const inv = data.invoices.find((i) => i.paymentTermId === x.id && i.status !== "void");
                  const released = !!inv || x.trigger === "on_signing" || ms?.status === "completed";
                  return (
                    <div key={x.id} className="item-row">
                      {inv?.status === "paid" ? <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "var(--green)" }} /> : released ? <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "var(--teal)" }} /> : <Circle className="h-4 w-4 shrink-0" style={{ color: "var(--line)" }} />}
                      <div className="grow">
                        <span className="ttl">{x.label}</span>
                        <span className="sub">{inv ? `${inv.number} · ${t(`invoices.status.${inv.status}`)}` : ms ? `${t("jobs.overview.onMilestone")} ${ms.title}` : x.trigger === "on_signing" ? t("jobs.setup.dueNow") : x.trigger === "on_completion" ? t("jobs.overview.onCompletion") : t("jobs.overview.unlinked")}</span>
                      </div>
                      <span className="amt">{formatCents(Math.round(amount * 100))}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <div><h2>{t("jobs.overview.budget")}</h2></div>
              <button type="button" className="text-link" onClick={() => onGoTo("costs")}>{t("jobs.overview.openCosts")}</button>
            </div>
            {budget.length === 0 ? <div className="card-empty">{t("jobs.overview.noBudget")}</div> : (
              <div className="py-2">
                {budget.map((b) => (
                  <div key={b.id} className="kv"><span>{t(`jobs.cost.${b.category}`)}</span><b>{formatCents(b.plannedCents)}</b></div>
                ))}
              </div>
            )}
          </section>

          {changeOrders.length > 0 && (
            <section className="card">
              <div className="card-head"><div><h2>{t("jobs.tab.changes")}</h2></div></div>
              <div>
                {changeOrders.map((co) => (
                  <div key={co.id} className="item-row">
                    <div className="grow"><span className="ttl">{co.number} · {co.title}</span></div>
                    <ChangeOrderStatusBadge status={co.status} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function ScheduleTab({ data, locale }: { data: JobDetailDto; locale: typeof enCA }) {
  const { t } = useLanguage();
const can = useCan();
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
    <div className="stack">
      <section className="card">
        <div className="card-head">
          <div><h2>{t("jobs.schedule.gantt")}</h2></div>
          <Link href={`/dashboard/jobs/${job.id}/setup`} className="text-link">{t("jobs.schedule.editDates")}</Link>
        </div>
        <div className="act-body">
          <Gantt rows={milestones.map((m) => ({ id: m.id, title: m.title, start: m.plannedStart, end: m.plannedEnd, status: m.status, paymentAmountCents: m.paymentAmountCents }))} onRowClick={(mid) => setOpen(mid)} />
        </div>
      </section>

      <CrewScheduleCard jobId={job.id} />

      <div className="stack" style={{ gap: 10 }}>
        {milestones.map((m: MilestoneDto, idx) => {
          const expanded = open === m.id;
          const doneTasks = m.tasks.filter((x) => x.status === "done").length;
          return (
            <div key={m.id} className={cn("card", m.status === "in_progress" && "ms-on", m.status === "completed" && "ms-done")} style={{ marginTop: 0 }}>
              {/* The expand toggle is its own button — a role="button" row around Start/Complete nested interactive controls (Phase 66). */}
              <div className="item-row" style={{ borderTop: "none" }}>
                <button type="button" className="ms-toggle grow" aria-expanded={expanded} aria-controls={`ms-panel-${m.id}`} onClick={() => setOpen(expanded ? null : m.id)}>
                <span className={cn("ms-num", m.status === "completed" && "done", m.status === "in_progress" && "on")}>
                  {m.status === "completed" ? <Check /> : idx + 1}
                </span>
                <div className="grow">
                  <div className="flex items-center gap-2 flex-wrap">
                    <b>{m.title}</b>
                    <MilestoneStatusBadge status={m.status} />
                    {m.paymentAmountCents ? <span className="chip chip-green">{t("jobs.overview.releases")} {formatCents(m.paymentAmountCents)}</span> : null}
                  </div>
                  <span className="sub">
                    {m.plannedStart && m.plannedEnd ? `${format(day(m.plannedStart)!, "d MMM", { locale })} → ${format(day(m.plannedEnd)!, "d MMM yyyy", { locale })}` : "—"}
                    {m.tasks.length ? ` · ${doneTasks}/${m.tasks.length} ${t("jobs.tasksShort")}` : ""}
                  </span>
                </div>
                </button>
                {can("jobs", "edit") && <div className="flex gap-2 shrink-0">
                  {m.status === "planned" && <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => setMs.mutate({ mid: m.id, status: "in_progress" })}><PlayCircle className="h-3.5 w-3.5" /> {t("jobs.milestone.start")}</button>}
                  {(m.status === "planned" || m.status === "in_progress") && <button type="button" className="btn btn-sm btn-navy" style={{ background: "var(--green)" }} onClick={() => setMs.mutate({ mid: m.id, status: "completed" })}><CheckCircle2 className="h-3.5 w-3.5" /> {t("jobs.milestone.complete")}</button>}
                  {m.status === "completed" && <button type="button" className="text-link" onClick={() => setMs.mutate({ mid: m.id, status: "in_progress" })}>{t("jobs.milestone.reopen")}</button>}
                </div>}
              </div>
              {expanded && (
                <div className="ms-body" id={`ms-panel-${m.id}`}>
                  {m.description && <p>{m.description}</p>}
                  {m.paymentTermLabel && <p>{t("jobs.milestone.linkedPayment")}: <b>{m.paymentTermLabel}</b></p>}
                  <TaskList tasks={m.tasks} onToggle={(x) => toggleTask.mutate(x)} onDelete={(tid) => delTask.mutate(tid)} readOnly={!can("jobs", "edit")} />
                  {!can("jobs", "edit") ? null : newTask?.milestoneId === m.id ? (
                    <form className="field inline mt-2" onSubmit={(e) => { e.preventDefault(); if (newTask.title.trim()) { addTask.mutate({ title: newTask.title.trim(), milestoneId: m.id }); setNewTask(null); } }}>
                      <input autoFocus className="flex-1" value={newTask.title} onChange={(e) => setNewTask({ milestoneId: m.id, title: e.target.value })} placeholder={t("jobs.task.placeholder")} style={{ padding: "8px 12px", fontSize: 13.5 }} />
                      <button type="submit" className="btn btn-sm btn-navy">{t("jobs.task.add")}</button>
                      <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => setNewTask(null)}>{t("jobs.cancel")}</button>
                    </form>
                  ) : (
                    <button type="button" className="text-link mt-1" onClick={() => setNewTask({ milestoneId: m.id, title: "" })}><Plus /> {t("jobs.task.add")}</button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {milestones.length === 0 && (
          <div className="card dashed card-empty" style={{ marginTop: 0 }}>
            {t("jobs.schedule.empty")} <Link href={`/dashboard/jobs/${job.id}/setup`} className="text-link">{t("jobs.schedule.addMilestones")}</Link>
          </div>
        )}
      </div>

      {unassignedTasks.length > 0 && (
        <section className="card">
          <div className="card-head"><div><h2>{t("jobs.schedule.otherTasks")}</h2></div></div>
          <div className="act-body">
            <TaskList tasks={unassignedTasks} onToggle={(x) => toggleTask.mutate(x)} onDelete={(tid) => delTask.mutate(tid)} readOnly={!can("jobs", "edit")} />
          </div>
        </section>
      )}
    </div>
  );
}

function TaskList({ tasks, onToggle, onDelete, readOnly }: { tasks: TaskDto[]; onToggle: (t: TaskDto) => void; onDelete: (id: string) => void; readOnly?: boolean }) {
  const { t } = useLanguage();
  if (tasks.length === 0) return null;
  return (
    <div>
      {tasks.map((x) => (
        <div key={x.id} className={cn("task-row", x.status === "done" && "done")}>
          <button type="button" onClick={() => onToggle(x)} disabled={readOnly} className={cn("chk", x.status === "done" && "on")}>{x.status === "done" && <Check />}</button>
          <span className="grow">{x.title}{x.addedFromFieldBy && <span className="block text-[11px]" style={{ color: "var(--muted-mk)" }}>{t("jobs.task.fromField").replace("{name}", x.addedFromFieldBy)}</span>}</span>
          {!readOnly && <button type="button" className="ic-btn danger" onClick={() => onDelete(x.id)}><Trash2 /></button>}
        </div>
      ))}
    </div>
  );
}

function ChangesTab({ data, locale, onNew }: { data: JobDetailDto; locale: typeof enCA; onNew: () => void }) {
  const { t } = useLanguage();
const can = useCan();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { job, changeOrders } = data;
  const del = useMutation({ mutationFn: (coId: string) => jobsApi.deleteChangeOrder(job.id, coId), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["job", job.id] }), onError: (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" }) });
  const signedTotal = changeOrders.filter((c) => c.status === "signed").reduce((s, c) => s + c.totalCents, 0);
  return (
    <div className="stack">
      {!job.contract && <div className="notice warn"><FileSignature /><span className="grow">{t("jobs.co.noContract")}</span></div>}
      <section className="card">
        <div className="card-head">
          <div><h2>{t("jobs.tab.changes")}</h2><p className="sub">{t("jobs.co.intro")}</p></div>
          {can("jobs", "full") && <button type="button" className="btn btn-sm btn-navy" onClick={onNew} disabled={!job.contract || job.contract.status !== "signed"}><Plus className="h-4 w-4" /> {t("jobs.co.new")}</button>}
        </div>
        {changeOrders.length === 0 ? (
          <div className="card-empty">{t("jobs.co.empty")}</div>
        ) : (
          <div>
            {changeOrders.map((co) => (
              <div key={co.id} className="item-row">
                <div className="grow">
                  <div className="flex items-center gap-2 flex-wrap"><b>{co.number}</b><span className="truncate">{co.title}</span><ChangeOrderStatusBadge status={co.status} /></div>
                  <span className="sub">
                    {format(new Date(co.createdAt), "PP", { locale })}
                    {co.scheduleDeltaDays ? ` · ${co.scheduleDeltaDays > 0 ? "+" : ""}${co.scheduleDeltaDays} ${t("jobs.co.days")}` : ""}
                    {co.signedAt ? ` · ${t("jobs.co.signedOn")} ${format(new Date(co.signedAt), "PP", { locale })}` : ""}
                  </span>
                </div>
                <span className={cn("amt", co.totalCents < 0 && "neg")}>{formatCents(co.totalCents)}</span>
                {co.documentContractId && (
                  <Link href={`/dashboard/contracts/${co.documentContractId}`} className="text-link whitespace-nowrap">
                    {co.status === "draft" ? t("jobs.co.signAndSend") : t("jobs.co.open")} <ExternalLink />
                  </Link>
                )}
                {co.status === "draft" && <button type="button" className="ic-btn danger" onClick={() => del.mutate(co.id)}><Trash2 /></button>}
              </div>
            ))}
            {signedTotal !== 0 && <div className="card-sum">{t("jobs.co.signedTotal")} <b>{formatCents(signedTotal)}</b></div>}
          </div>
        )}
      </section>
    </div>
  );
}

function DocumentsTab({ data, locale }: { data: JobDetailDto; locale: typeof enCA }) {
  const { t } = useLanguage();
  const { job, changeOrders, costs } = data;
  const receipts = costs.entries.filter((e) => e.source === "receipt" && e.sourceDocumentId);
  const docs = useMemo(() => {
    const list: { id: string; title: string; sub: string; href: string; pdf?: string }[] = [];
    if (job.contract) list.push({ id: job.contract.id, title: `${t("jobs.docs.contract")} ${job.contract.contractNumber}`, sub: job.contract.signedAt ? `${t("jobs.co.signedOn")} ${format(new Date(job.contract.signedAt), "PP", { locale })}` : job.contract.status, href: `/dashboard/contracts/${job.contract.id}`, pdf: contractsApi.pdfUrl(job.contract.id, true) });
    for (const co of changeOrders) if (co.documentContractId) list.push({ id: co.id, title: `${co.number} · ${co.title}`, sub: t(`jobs.co.status.${co.status}`), href: `/dashboard/contracts/${co.documentContractId}`, pdf: contractsApi.pdfUrl(co.documentContractId, true) });
    if (job.quote) list.push({ id: job.quote.id, title: `${t("jobs.docs.quote")} ${job.quote.number ?? ""}`.trim(), sub: job.quote.status, href: `/dashboard/quotes/${job.quote.id}` });
    for (const inv of data.invoices) if (inv.status !== "draft") list.push({ id: inv.id, title: `${t(`invoices.type.${inv.type}`)} ${inv.number}`, sub: `${t(`invoices.status.${inv.status}`)} · ${formatCents(inv.totalCents)}`, href: `/dashboard/invoices/${inv.id}`, pdf: invoicesApi.pdfUrl(inv.id, true) });
    return list;
  }, [job, changeOrders, data.invoices, t, locale]);
  return (
    <section className="card">
      <div className="card-head"><div><h2>{t("jobs.tab.documents")}</h2></div></div>
      {docs.length === 0 && receipts.length === 0 && <div className="card-empty">{t("jobs.docs.empty")}</div>}
      <div>
        {docs.map((d) => (
          <div key={d.id} className="item-row">
            <span className="ic"><FileSignature /></span>
            <div className="grow"><Link href={d.href} className="hover:underline"><b className="ttl">{d.title}</b></Link><span className="sub">{d.sub}</span></div>
            {d.pdf && <a href={d.pdf} className="text-link"><Download /> PDF</a>}
          </div>
        ))}
        {receipts.map((r) => (
          <div key={r.id} className="item-row">
            <span className="ic warn"><Receipt /></span>
            <div className="grow"><b className="ttl">{r.vendor || t("jobs.costs.unknownVendor")} · {formatCents(r.totalCents)}</b><span className="sub">{t("jobs.docs.receipt")} · {r.date ? format(day(r.date)!, "PP", { locale }) : ""}{r.status === "pending_review" ? ` · ${t("jobs.costs.toReview")}` : ""}</span></div>
            <a href={jobsApi.receiptFileUrl(r.sourceDocumentId!)} target="_blank" rel="noreferrer" className="text-link"><ExternalLink /> {t("jobs.costs.openReceipt")}</a>
          </div>
        ))}
      </div>
    </section>
  );
}
