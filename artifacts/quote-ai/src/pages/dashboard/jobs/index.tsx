import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { Briefcase, Search, ChevronRight, Plus, Loader2, Sparkles, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { jobsApi, formatCents, type JobSummaryDto } from "@/lib/jobs-api";
import { JobStatusBadge } from "@/components/jobs/badges";
import { ReceiptQueue } from "@/components/jobs/receipt-queue";

const FILTERS = ["all", "pending_review", "active", "planning", "completed"] as const;
type Filter = (typeof FILTERS)[number];

export default function JobsListPage() {
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const { data, isLoading } = useQuery({ queryKey: ["jobs"], queryFn: jobsApi.list });
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const items = useMemo(() => {
    const all = data?.items ?? [];
    const q = search.trim().toLowerCase();
    return all.filter((j) => {
      const inFilter =
        filter === "all" ? true
        : filter === "pending_review" ? j.setupStatus === "pending_review"
        : filter === "active" ? j.status === "active" && j.setupStatus === "confirmed"
        : filter === "planning" ? j.status === "planning" && j.setupStatus === "confirmed"
        : j.status === "completed";
      const inSearch = !q || j.name.toLowerCase().includes(q) || (j.clientName ?? "").toLowerCase().includes(q) || j.address.toLowerCase().includes(q);
      return inFilter && inSearch;
    });
  }, [data, filter, search]);

  const stats = useMemo(() => {
    const all = data?.items ?? [];
    const open = all.filter((j) => j.status !== "completed");
    return {
      pending: all.filter((j) => j.setupStatus === "pending_review").length,
      active: all.filter((j) => j.status === "active").length,
      openValue: open.reduce((s, j) => s + j.totalValueCents, 0),
      completed: all.filter((j) => j.status === "completed").length,
    };
  }, [data]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
            <Briefcase className="h-8 w-8 text-navy-600" />
            {t("jobs.title")}
          </h1>
          <p className="text-slate-500 mt-1">{t("jobs.subtitle")}</p>
        </div>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> {t("jobs.newJob")}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label={t("jobs.stat.pending")} value={String(stats.pending)} accent={stats.pending ? "text-amber-600" : undefined} />
        <Stat label={t("jobs.stat.active")} value={String(stats.active)} accent="text-blue-600" />
        <Stat label={t("jobs.stat.openValue")} value={formatCents(stats.openValue)} accent="text-emerald-600" />
        <Stat label={t("jobs.stat.completed")} value={String(stats.completed)} />
      </div>

      <ReceiptQueue jobs={data?.items ?? []} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={cn("px-3 py-1.5 text-sm font-medium rounded-lg transition-all", filter === f ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {t(`jobs.filter.${f}`)}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("jobs.searchPlaceholder")} className="pl-9" />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-card p-12 text-center">
          <Sparkles className="h-10 w-10 text-slate-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-800">{t("jobs.emptyTitle")}</h2>
          <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">{t("jobs.emptyDesc")}</p>
          <Link href="/dashboard/contracts" className="inline-block mt-4 text-sm font-medium text-navy-600 hover:underline">{t("jobs.goToContracts")}</Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-card overflow-hidden divide-y">
          {items.map((j) => (
            <JobRow key={j.id} j={j} locale={locale} />
          ))}
        </div>
      )}

      <CreateJobDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-card px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={cn("text-xl font-bold text-slate-900 mt-0.5", accent)}>{value}</div>
    </div>
  );
}

function JobRow({ j, locale }: { j: JobSummaryDto; locale: typeof enCA }) {
  const { t } = useLanguage();
  const pending = j.setupStatus === "pending_review";
  const href = pending ? `/dashboard/jobs/${j.id}/setup` : `/dashboard/jobs/${j.id}`;
  return (
    <Link href={href} className={cn("flex items-center gap-4 px-4 py-3.5 hover:bg-slate-50 transition-colors", pending && "bg-amber-50/40")}>
      <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", pending ? "bg-amber-100 text-amber-700" : "bg-navy-50 text-navy-600")}>
        {pending ? <Sparkles className="h-5 w-5" /> : <Briefcase className="h-5 w-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-900 truncate">{j.name}</span>
          <JobStatusBadge status={j.status} pendingReview={pending} />
        </div>
        <div className="text-sm text-slate-500 truncate flex items-center gap-1.5">
          {j.clientName && <span>{j.clientName}</span>}
          {j.clientName && j.address && <span>·</span>}
          {j.address && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{j.address}</span>}
        </div>
        {!pending && j.milestoneCount > 0 && (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 w-32 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${j.progressPercent}%` }} /></div>
            <span className="text-[11px] text-slate-400">{j.milestonesDone}/{j.milestoneCount} {t("jobs.milestonesShort")} · {j.progressPercent}%</span>
          </div>
        )}
        {pending && <div className="text-xs text-amber-700 mt-1">{t("jobs.reviewPrompt")}</div>}
      </div>
      <div className="text-right shrink-0 hidden sm:block">
        <div className="font-semibold text-slate-900">{formatCents(j.totalValueCents)}</div>
        <div className="text-xs text-slate-400">
          {j.nextMilestone?.plannedEnd
            ? `${t("jobs.next")}: ${j.nextMilestone.title.slice(0, 24)} · ${format(new Date(`${j.nextMilestone.plannedEnd}T00:00:00`), "d MMM", { locale })}`
            : j.plannedEnd ? `${t("jobs.ends")} ${format(new Date(`${j.plannedEnd}T00:00:00`), "PP", { locale })}` : ""}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
    </Link>
  );
}

function CreateJobDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [value, setValue] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const create = useMutation({
    mutationFn: () => jobsApi.create({ name: name.trim(), address: address.trim() || undefined, contractValueCents: value ? Math.round(Number(value) * 100) : undefined, plannedStart: start || undefined, plannedEnd: end || undefined }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      onOpenChange(false);
      navigate(`/dashboard/jobs/${res.job.id}`);
    },
    onError: (e: Error & { code?: string }) => toast({ title: e.code === "PLAN_REQUIRED" ? t("jobs.planRequired") : t("jobs.error"), description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("jobs.newJob")}</DialogTitle>
          <DialogDescription>{t("jobs.newJobDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>{t("jobs.field.name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("jobs.field.namePlaceholder")} autoFocus />
          </div>
          <div className="space-y-1">
            <Label>{t("jobs.field.address")}</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label>{t("jobs.field.value")}</Label>
              <Input type="number" min={0} step="0.01" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t("jobs.field.start")}</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t("jobs.field.end")}</Label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <Button className="w-full gap-2" disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {t("jobs.create")}
          </Button>
          <p className="text-[11px] text-slate-400 text-center">{t("jobs.newJobHint")}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
