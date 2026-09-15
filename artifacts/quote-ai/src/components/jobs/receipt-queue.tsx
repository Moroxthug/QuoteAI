import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Receipt, Upload, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <div className="rounded-2xl border border-slate-200 bg-card p-3 md:p-4 flex flex-wrap items-center gap-3">
      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) scan.mutate(f); e.target.value = ""; }} />
      <div className="h-9 w-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0"><Receipt className="h-4 w-4" /></div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-900">{entries.length ? `${entries.length} ${t("jobs.receipts.toReview")}` : t("jobs.receipts.title")}</div>
        <div className="text-xs text-slate-500">{t("jobs.receipts.desc")}</div>
      </div>
      <Button size="sm" variant="outline" className="gap-2" disabled={scan.isPending} onClick={() => fileInput.current?.click()}>{scan.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {scan.isPending ? t("jobs.costs.scanning") : t("jobs.receipts.scan")}</Button>
      {entries.length > 0 && (
        <ul className="w-full divide-y border-t mt-1 pt-1">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center gap-3 py-2 text-sm">
              <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <button className="min-w-0 flex-1 text-left" onClick={() => setDialog({ open: true, entry: e })}>
                <div className="truncate"><span className="font-medium text-slate-900">{e.vendor || t("jobs.costs.unknownVendor")}</span> <span className="text-slate-500">· {e.description}</span></div>
                <div className="text-[11px] text-slate-400 truncate">{e.projectName ?? <span className="text-amber-700">{t("jobs.receipts.noJob")}</span>} · {t(`jobs.cost.${e.category}`)}</div>
              </button>
              <span className="font-semibold whitespace-nowrap">{formatCents(e.totalCents)}</span>
              <Button size="sm" variant="outline" className="h-8" onClick={() => setDialog({ open: true, entry: e })}>{t("jobs.costs.review")}</Button>
            </li>
          ))}
        </ul>
      )}
      <CostEntryDialog jobId={dialog.entry?.projectId ?? null} entry={dialog.entry} milestones={[]} jobs={openJobs} open={dialog.open} onOpenChange={(v) => setDialog((d) => ({ ...d, open: v }))} />
    </div>
  );
}
