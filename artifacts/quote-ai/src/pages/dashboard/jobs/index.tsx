import { useEffect, useState } from "react";
import { rowLink } from "@/lib/row-link";
import { Link, useLocation, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { Plus, Loader2 } from "lucide-react";
import { ListSkeleton } from "@/components/skeletons";
import { EmptyState, ErrorState } from "@/components/states";
import { usePrefetchOnPress } from "@/hooks/use-prefetch-on-press";
import { useProgressiveList } from "@/hooks/use-progressive-list";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCan } from "@/hooks/use-role";
import { jobsApi, formatCents, type JobSummaryDto } from "@/lib/jobs-api";
import { ReceiptQueue } from "@/components/jobs/receipt-queue";
import { jobLimitToast } from "@/lib/plan-errors";
import { ListRow } from "@/components/mobile/list-row";
import { useMediaQuery } from "@/hooks/use-media-query";
import { formatCadWhole } from "@/lib/money";

function statusChip(j: JobSummaryDto, t: (key: string) => string): { cls: string; label: string } {
  if (j.setupStatus === "pending_review") return { cls: "chip-yellow", label: t("jobs.status.pending_review") };
  if (j.status === "active") return { cls: "chip-teal", label: t("jobs.status.active") };
  if (j.status === "completed") return { cls: "chip-green", label: t("jobs.status.completed") };
  if (j.status === "suspended") return { cls: "chip-yellow", label: t("jobs.status.suspended") };
  return { cls: "chip-grey", label: t("jobs.status.planning") };
}

export default function JobsListPage() {
  const { t, lang } = useLanguage();
const can = useCan();
  const locale = lang === "fr" ? frCA : enCA;
  const [, navigate] = useLocation();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["jobs"], queryFn: jobsApi.list });
  const [createOpen, setCreateOpen] = useState(false);
  const items = data?.items ?? [];
  const phone = useMediaQuery("(max-width: 640px)");
  // Phase 115: first 50 rows now, the rest when idle; rows prefetch the job on press.
  const shown = useProgressiveList(items);
  const press = usePrefetchOnPress();
  // Phase 106: on a phone New job is in the top bar's + sheet, which opens this form with ?new=1 (then drops it, so Back does not reopen it).
  const query = useSearch();
  useEffect(() => {
    if (new URLSearchParams(query).get("new") !== "1") return;
    setCreateOpen(true);
    navigate("/dashboard/jobs", { replace: true });
  }, [query, navigate]);
  const day = (s: string) => new Date(`${s}T00:00:00`);
  /** The quiet line's "what's next": the next milestone and when it should be done, else the dates. */
  const nextLine = (j: JobSummaryDto) => {
    if (j.status === "suspended") return t("jobs.scheduleOnHold");
    if (j.status === "completed") return j.completedAt ? format(new Date(j.completedAt), "d MMM yyyy", { locale }) : null;
    if (j.nextMilestone) return t("jobs.m.next").replace("{title}", j.nextMilestone.plannedEnd ? `${j.nextMilestone.title}, ${format(day(j.nextMilestone.plannedEnd), "d MMM", { locale })}` : j.nextMilestone.title);
    return j.plannedStart && j.plannedEnd ? `${format(day(j.plannedStart), "d MMM", { locale })} – ${format(day(j.plannedEnd), "d MMM", { locale })}` : null;
  };
  return (
    <div className="animate-in fade-in duration-500">
      <div className="page-head">
        <div>
          <h1>{t("jobs.title")}</h1>
          <p className="sub hide-phone">{t("jobs.subtitle")}</p>
        </div>
        {can("jobs", "edit") && (
          <div className="head-actions hide-phone">
            <button type="button" className="btn btn-navy" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> {t("jobs.newJob")}
            </button>
          </div>
        )}
      </div>

      <ReceiptQueue jobs={items} />

      <div className="card">
        {isLoading ? (
          <ListSkeleton rows={5} />
        ) : error && !data ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : items.length === 0 ? (
          <EmptyState art="jobs" title={t("states.jobs.empty")} action={<Link href="/dashboard/quotes" className="btn btn-sm btn-navy">{t("dashboard.nav.quotes")}</Link>} />
        ) : phone ? (
          // Phase 106: job · client and what's next / how far along / what it's worth.
          <ul className="lrows jlist" aria-label={t("jobs.title")}>
            {shown.map((j) => {
              const chip = statusChip(j, t);
              return (
                <li key={j.id}>
                  <ListRow
                    href={j.setupStatus === "pending_review" ? `/dashboard/jobs/${j.id}/setup` : `/dashboard/jobs/${j.id}`}
                    title={j.name}
                    meta={[j.clientName, nextLine(j)]}
                    below={j.setupStatus === "pending_review" ? undefined : (
                      <span className="jlist-prog">
                        <span className="pbar" aria-hidden="true"><i style={{ width: `${j.progressPercent}%` }} /></span>
                        <span>{j.progressPercent}%</span>
                      </span>
                    )}
                    amount={formatCadWhole(j.totalValueCents / 100)}
                    end={<span className={cn("chip", chip.cls)}>{chip.label}</span>}
                  />
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t("jobs.col.job")}</th>
                  <th>{t("jobs.col.client")}</th>
                  <th>{t("jobs.col.schedule")}</th>
                  <th>{t("jobs.col.crew")}</th>
                  <th>{t("jobs.col.progress")}</th>
                  <th style={{ textAlign: "right" }}>{t("jobs.col.value")}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((j) => {
                  const chip = statusChip(j, t);
                  const pending = j.setupStatus === "pending_review";
                  const href = pending ? `/dashboard/jobs/${j.id}/setup` : `/dashboard/jobs/${j.id}`;
                  const schedule = j.status === "suspended"
                    ? t("jobs.scheduleOnHold")
                    : j.plannedStart && j.plannedEnd
                      ? `${format(new Date(`${j.plannedStart}T00:00:00`), "MMM d", { locale })} – ${format(new Date(`${j.plannedEnd}T00:00:00`), "MMM d", { locale })}`
                      : "—";
                  return (
                    <tr key={j.id} {...rowLink(() => navigate(href))} {...press(href)}>
                      <td>
                        <span className="t-strong">{j.name}</span>
                        {j.address && <span className="t-sub">{j.address}</span>}
                      </td>
                      <td>{j.clientName || "—"}</td>
                      <td>{schedule}</td>
                      <td>{j.crewCount}</td>
                      <td>
                        <span className="cell-flex">
                          <span className="pbar"><i style={{ width: `${j.progressPercent}%` }} /></span>
                          <span className={cn("chip", chip.cls)}>{chip.label}</span>
                        </span>
                      </td>
                      <td className="t-amt" style={{ textAlign: "right" }}>{formatCents(j.totalValueCents)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateJobDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
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
    onError: (e: Error & { code?: string }) => toast({ ...(jobLimitToast(e, t) ?? { title: e.code === "PLAN_REQUIRED" ? t("jobs.planRequired") : t("jobs.error"), description: e.message }), variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("jobs.newJob")}</DialogTitle>
          <DialogDescription>{t("jobs.newJobDesc")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="field">
            <label>{t("jobs.field.name")}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("jobs.field.namePlaceholder")} autoFocus />
          </div>
          <div className="field">
            <label>{t("jobs.field.address")}</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="form-grid cols-3">
            <div className="field">
              <label>{t("jobs.field.value")}</label>
              <input type="number" min={0} step="0.01" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
            <div className="field">
              <label>{t("jobs.field.start")}</label>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="field">
              <label>{t("jobs.field.end")}</label>
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <span className="foot-note">{t("jobs.newJobHint")}</span>
          <button type="button" className="btn btn-sm btn-navy" disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {t("jobs.create")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
