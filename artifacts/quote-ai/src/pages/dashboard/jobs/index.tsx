import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { Plus, Loader2, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { jobsApi, formatCents, type JobSummaryDto } from "@/lib/jobs-api";
import { ReceiptQueue } from "@/components/jobs/receipt-queue";

function statusChip(j: JobSummaryDto, t: (key: string) => string): { cls: string; label: string } {
  if (j.setupStatus === "pending_review") return { cls: "chip-yellow", label: t("jobs.status.pending_review") };
  if (j.status === "active") return { cls: "chip-teal", label: t("jobs.status.active") };
  if (j.status === "completed") return { cls: "chip-green", label: t("jobs.status.completed") };
  if (j.status === "suspended") return { cls: "chip-yellow", label: t("jobs.status.suspended") };
  return { cls: "chip-grey", label: t("jobs.status.planning") };
}

export default function JobsListPage() {
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const [, navigate] = useLocation();
  const { data, isLoading } = useQuery({ queryKey: ["jobs"], queryFn: jobsApi.list });
  const [createOpen, setCreateOpen] = useState(false);
  const items = data?.items ?? [];

  return (
    <div className="animate-in fade-in duration-500">
      <div className="page-head">
        <div>
          <h1>{t("jobs.title")}</h1>
          <p className="sub">{t("jobs.subtitle")}</p>
        </div>
        <div className="head-actions">
          <button type="button" className="btn btn-navy" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> {t("jobs.newJob")}
          </button>
        </div>
      </div>

      <ReceiptQueue jobs={items} />

      <div className="card">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full rounded-[var(--radius-sm)]" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-14 px-5">
            <Sparkles className="mx-auto h-10 w-10 text-muted-foreground mb-3 opacity-20" />
            <h3 className="text-base font-medium text-foreground mb-1">{t("jobs.emptyTitle")}</h3>
            <p className="text-sm text-muted-foreground mb-2">{t("jobs.emptyDesc")}</p>
            <Link href="/dashboard/contracts" className="cta-link mx-auto">{t("jobs.goToContracts")}</Link>
          </div>
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
                {items.map((j) => {
                  const chip = statusChip(j, t);
                  const pending = j.setupStatus === "pending_review";
                  const href = pending ? `/dashboard/jobs/${j.id}/setup` : `/dashboard/jobs/${j.id}`;
                  const schedule = j.status === "suspended"
                    ? t("jobs.scheduleOnHold")
                    : j.plannedStart && j.plannedEnd
                      ? `${format(new Date(`${j.plannedStart}T00:00:00`), "MMM d", { locale })} – ${format(new Date(`${j.plannedEnd}T00:00:00`), "MMM d", { locale })}`
                      : "—";
                  return (
                    <tr key={j.id} onClick={() => navigate(href)} className="cursor-pointer">
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
    onError: (e: Error & { code?: string }) => toast({ title: e.code === "PLAN_REQUIRED" ? t("jobs.planRequired") : t("jobs.error"), description: e.message, variant: "destructive" }),
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
