import { scanOrQueueReceipt } from "@/lib/receipts";
import { openCapture } from "@/lib/capture";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Receipt, Upload, Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCan } from "@/hooks/use-role";
import { useMediaQuery } from "@/hooks/use-media-query";
import { BottomSheet } from "@/components/mobile/bottom-sheet";
import { ListRow } from "@/components/mobile/list-row";
import { jobsApi, formatCents, type CostEntryDto, type JobSummaryDto } from "@/lib/jobs-api";
import { CostEntryDialog } from "./cost-entry-dialog";

/**
 * Company-wide receipt inbox shown on the jobs list: scan a receipt without
 * opening a job first (the AI picks the job) and review anything pending,
 * including receipts it could not match.
 *
 * Phase 106: on a phone it is one row ("2 receipts to review ›") over the
 * jobs, the receipts in a sheet; with nothing to review it is not shown
 * (Photo of a receipt is in the top bar's + sheet).
 */
export function ReceiptQueue({ jobs }: { jobs: JobSummaryDto[] }) {
  const { t } = useLanguage();
  const can = useCan();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const phone = useMediaQuery("(max-width: 640px)");
  const { data } = useQuery({ queryKey: ["costs-review"], queryFn: jobsApi.reviewQueue });
  const [dialog, setDialog] = useState<{ open: boolean; entry: CostEntryDto | null }>({ open: false, entry: null });
  const [sheetOpen, setSheetOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const scan = useMutation({
    mutationFn: (file: File) => scanOrQueueReceipt(file, null, `${t("jobs.receipts.scan")} · ${file.name}`),
    onSuccess: (res) => {
      if (res.queued) { toast({ title: t("offline.savedOnDevice"), description: t("offline.savedOnDeviceHint") }); return; }
      const r = res.result;
      queryClient.invalidateQueries({ queryKey: ["costs-review"] }); if (r.entry.projectId) queryClient.invalidateQueries({ queryKey: ["job", r.entry.projectId] }); setDialog({ open: true, entry: r.entry });
    },
    onError: (e: Error & { code?: string }) => toast({ title: e.code === "PLAN_REQUIRED" ? t("jobs.planRequired") : t("jobs.error"), description: e.message, variant: "destructive" }),
  });
  const entries = data?.entries ?? [];
  const openJobs = jobs.filter((j) => j.status === "planning" || j.status === "active").map((j) => ({ id: j.id, name: j.name }));
  const review = (e: CostEntryDto) => { setSheetOpen(false); setDialog({ open: true, entry: e }); };
  const dialogEl = <CostEntryDialog jobId={dialog.entry?.projectId ?? null} entry={dialog.entry} milestones={[]} jobs={openJobs} open={dialog.open} onOpenChange={(v) => setDialog((d) => ({ ...d, open: v }))} />;
  const fileEl = <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) scan.mutate(f); e.target.value = ""; }} />;
  const scanButton = can("costs", "edit") && (
    <button type="button" className="btn btn-sm btn-outline-navy" disabled={scan.isPending} onClick={() => void openCapture({ mode: "document", input: fileInput.current, onFiles: ([f]) => { if (f) scan.mutate(f); } })}>
      {scan.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {scan.isPending ? t("jobs.costs.scanning") : t("jobs.receipts.scan")}
    </button>
  );

  if (phone) {
    if (entries.length === 0) return dialogEl;
    return (
      <>
        <div className="card rq-phone">
          <ListRow
            onClick={() => setSheetOpen(true)}
            chevron
            lead={<span className="ic warn rq-ic"><Receipt /></span>}
            title={`${entries.length} ${t("jobs.receipts.toReview")}`}
            meta={t("jobs.receipts.desc")}
          />
        </div>
        <BottomSheet open={sheetOpen} onOpenChange={setSheetOpen} title={t("jobs.m.receiptsTitle")} flush footer={scanButton || undefined}>
          {fileEl}
          <ul className="lrows">
            {entries.map((e) => (
              <li key={e.id}>
                <ListRow
                  onClick={() => review(e)}
                  chevron
                  title={e.vendor || t("jobs.costs.unknownVendor")}
                  meta={[e.projectName ?? t("jobs.receipts.noJob"), t(`jobs.cost.${e.category}`)]}
                  amount={formatCents(e.totalCents)}
                />
              </li>
            ))}
          </ul>
        </BottomSheet>
        {dialogEl}
      </>
    );
  }

  return (
    <div className="card">
      <div className="item-row" style={{ borderTop: "none" }}>
        {fileEl}
        <span className="ic warn"><Receipt /></span>
        <div className="grow">
          <b className="ttl">{entries.length ? `${entries.length} ${t("jobs.receipts.toReview")}` : t("jobs.receipts.title")}</b>
          <span className="sub">{t("jobs.receipts.desc")}</span>
        </div>
        {scanButton}
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
              {can("costs", "edit") && <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => setDialog({ open: true, entry: e })}>{t("jobs.costs.review")}</button>}
            </div>
          ))}
        </div>
      )}
      {dialogEl}
    </div>
  );
}
