import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, FilePlus2, Images, Loader2, Receipt } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCan } from "@/hooks/use-role";
import { BottomSheet } from "@/components/mobile/bottom-sheet";
import { jobsApi, type JobSummaryDto } from "@/lib/jobs-api";
import { runOrQueue } from "@/lib/offline/outbox";
import { scanOrQueueReceipt } from "@/lib/receipts";
import { shrinkAll } from "@/lib/capture";
import { startShareTarget, type SharedIn } from "@/lib/native/share-target";

/**
 * Phase 119: what was shared into QuoteAI from another app, and where it
 * goes — receipts to the OCR, photos to a job, words to a new quote. Loaded
 * only by the phone app (App.tsx); the files go through the same outbox as
 * everything else, so it works with no signal too.
 */
export default function ShareInbox() {
  const { t } = useLanguage();
  const can = useCan();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [shared, setShared] = useState<SharedIn | null>(null);
  const [step, setStep] = useState<"choose" | "job">("choose");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void startShareTarget((s) => {
      setShared(s);
      setStep("choose");
    });
  }, []);

  const { data: jobs } = useQuery({ queryKey: ["jobs"], queryFn: jobsApi.list, enabled: step === "job", staleTime: 30_000 });
  const openJobs = (jobs?.items ?? []).filter((j: JobSummaryDto) => !j.archivedAt && j.status !== "completed");

  const files = shared?.files ?? [];
  const images = files.filter((f) => f.type.startsWith("image/"));
  const close = () => { setShared(null); setBusy(false); };
  const savedToast = (queued: boolean) => toast({ title: queued ? t("offline.savedOnDevice") : t("native.share.done"), description: queued ? t("offline.savedOnDeviceHint") : undefined });
  const fail = (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" });

  const asReceipts = async () => {
    setBusy(true);
    try {
      let queued = false;
      for (const f of files) queued = (await scanOrQueueReceipt(f, null, `${t("native.share.receipt")} · ${f.name}`)).queued || queued;
      queryClient.invalidateQueries({ queryKey: ["costs-review"] });
      savedToast(queued);
      close();
      navigate("/dashboard/jobs");
    } catch (e) {
      fail(e as Error);
      setBusy(false);
    }
  };

  const toJob = async (jobId: string) => {
    setBusy(true);
    try {
      let queued = false;
      for (const f of await shrinkAll(images)) {
        const r = await runOrQueue({ kind: "job.uploadPhoto", jobId, file: f, fileName: f.name }, { scope: jobId, label: `${t("jobs.photos.title")} · ${f.name}` }, (clientRef) => jobsApi.uploadPhoto(jobId, f, { clientRef, fileName: f.name }));
        queued = r.queued || queued;
      }
      queryClient.invalidateQueries({ queryKey: ["job-photos", jobId] });
      savedToast(queued);
      close();
      navigate(`/dashboard/jobs/${jobId}?tab=photos`);
    } catch (e) {
      fail(e as Error);
      setBusy(false);
    }
  };

  const toQuote = () => {
    try {
      sessionStorage.setItem("quoteai:homepage_prompt", shared?.text ?? "");
    } catch {
      /* the box starts empty */
    }
    close();
    navigate("/dashboard/new");
  };

  const choices = [
    files.length > 0 && can("costs", "edit") && { key: "receipt", icon: Receipt, label: t("native.share.receipt"), run: () => void asReceipts() },
    images.length > 0 && can("jobs", "edit") && { key: "photos", icon: Images, label: t("native.share.photos"), run: () => setStep("job") },
    !!shared?.text && can("quotes", "edit") && { key: "quote", icon: FilePlus2, label: t("native.share.quote"), run: toQuote },
  ].filter(Boolean) as { key: string; icon: typeof Receipt; label: string; run: () => void }[];

  const summary = files.length ? `${files.length} ${files.length === 1 ? t("native.share.oneFile") : t("native.share.files")}` : (shared?.text ?? "").slice(0, 140);

  return (
    <BottomSheet open={!!shared} onOpenChange={(v) => { if (!v) close(); }} title={step === "job" ? t("native.share.pickJob") : t("native.share.title")} description={step === "choose" ? summary : undefined} flush>
      {step === "choose" ? (
        choices.length ? (
          <div className="lrows">
            {choices.map((c) => (
              <button key={c.key} type="button" className="lrow" disabled={busy} onClick={c.run}>
                <span className="ic"><c.icon /></span>
                <span className="lrow-main"><span className="lrow-title">{c.label}</span></span>
                {busy && c.key === "receipt" ? <Loader2 className="lrow-chev animate-spin" /> : <ChevronRight className="lrow-chev" aria-hidden="true" />}
              </button>
            ))}
          </div>
        ) : (
          <p className="p-4 text-sm" style={{ color: "var(--muted-mk)" }}>{t("native.share.unsupported")}</p>
        )
      ) : (
        <div className="lrows">
          {!jobs && <div className="p-4"><Loader2 className="h-5 w-5 animate-spin" /></div>}
          {openJobs.map((j) => (
            <button key={j.id} type="button" className="lrow" disabled={busy} onClick={() => void toJob(j.id)}>
              <span className="lrow-main">
                <span className="lrow-title">{j.name}</span>
                <span className="lrow-meta">{[j.clientName, j.address].filter(Boolean).join(" · ") || "—"}</span>
              </span>
              <ChevronRight className="lrow-chev" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </BottomSheet>
  );
}
