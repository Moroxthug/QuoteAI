import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Receipt, Upload, Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { jobsApi, formatCents, type CostEntryDto, type JobSummaryDto } from "@/lib/jobs-api";
import { CostEntryDialog } from "./cost-entry-dialog";

/**
 * Company-wide receipt inbox shown on the jobs list: scan a receipt without
 * opening a job first (the AI picks the job) and review anything pending,
 * including receipts it could not match.
 */
export function ReceiptQueue({ jobs }: { jobs: JobSummaryDto[] }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["costs-review"], queryFn: jobsApi.reviewQueue });
  const [dialog, setDialog] = useState<{ open: boolean; entry: CostEntryDto | null }>({ open: false, entry: null });
  const fileInput = useRef<HTMLInputElement>(null);
  const scan = useMutation({
    mutationFn: (file: File) => jobsApi.scanReceipt(file),
    onSuccess: (r) => { queryClient.invalidateQueries({ queryKey: ["costs-review"] }); if (r.entry.projectId) queryClient.invalidateQueries({ queryKey: ["job", r.entry.projectId] }); setDialog({ open: true, entry: r.entry }); },
    onError: (e: Error & { code?: string }) => toast({ title: e.code === "PLAN_REQUIRED" ? t("jobs.planRequired") : t("jobs.error"), description: e.message, variant: "destructive" }),
  });
  const entries = data?.entries ?? [];
  const openJobs = jobs.filter((j) => j.status === "planning" || j.status === "active").map((j) => ({ id: j.id, name: j.name }));

  return (
    <div className="card">
      <div className="item-row" style={{ borderTop: "none" }}>
      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) scan.mutate(f); e.target.value = ""; }} />
        <span className="ic warn"><Receipt /></span>
        <div className="grow">
          <b className="ttl">{entries.length ? `${entries.length} ${t("jobs.receipts.toReview")}` : t("jobs.receipts.title")}</b>
          <span className="sub">{t("jobs.receipts.desc")}</span>
        </div>
        <button type="button" className="btn btn-sm btn-outline-navy" disabled={scan.isPending} onClick={() => fileInput.current?.click()}>{scan.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {scan.isPending ? t("jobs.costs.scanning") : t("jobs.receipts.scan")}</button>
      </div>
      {entries.length > 0 && (
        <div>
          {entries.map((e) => (
            <div key={e.id} className="item-row">
              <Sparkles className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--yellow-dark)" }} />
              <button type="button" className="grow text-left" onClick={() => setDialog({ open: true, entry: e })}>
                <span className="ttl"><b>{e.vendor || t("jobs.costs.unknownVendor")}</b> <span style={{ color: "var(--muted-mk)" }}>· {e.description}</span></span>
                <span className="sub">{e.projectName ?? <span style={{ color: "var(--yellow-dark)" }}>{t("jobs.receipts.noJob")}</span>} · {t(`jobs.cost.${e.category}`)}</span>
              </button>
              <span className="amt">{formatCents(e.totalCents)}</span>
              <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => setDialog({ open: true, entry: e })}>{t("jobs.costs.review")}</button>
            </div>
          ))}
        </div>
      )}
      <CostEntryDialog jobId={dialog.entry?.projectId ?? null} entry={dialog.entry} milestones={[]} jobs={openJobs} open={dialog.open} onOpenChange={(v) => setDialog((d) => ({ ...d, open: v }))} />
    </div>
  );
}
