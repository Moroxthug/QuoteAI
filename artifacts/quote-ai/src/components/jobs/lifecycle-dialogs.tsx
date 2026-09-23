import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { complianceApi } from "@/lib/compliance-api";
import { PermitStatusChip } from "@/components/jobs/permits-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatCents, type JobDetailDto } from "@/lib/jobs-api";
import { useLanguage } from "@/i18n/LanguageContext";

// Phase 80: "Mark complete" and "Archive" used to fire on a single click.
// Completing a job runs the job.completed automation (a final invoice for the
// unbilled balance, plus the holdback release when the contract withholds
// one), so the dialog spells out what is about to be drafted before it happens.

/**
 * What completing the job will draft, from the numbers the job page already
 * has. Mirrors the server's draftFinalInvoice: the job value less every
 * non-void invoice (drafts and scheduled ones included) except holdback
 * releases and credit notes, which are not part of the contract balance.
 */
export function completionPreview(data: JobDetailDto): { unbilledCents: number; holdback: { percent: number; withheldCents: number } | null } {
  const { job, invoices } = data;
  const live = invoices.filter((i) => i.status !== "void");
  const billed = live.filter((i) => i.type !== "holdback_release" && i.type !== "credit_note").reduce((s, i) => s + i.totalCents, 0);
  const unbilledCents = Math.max(0, job.totalValueCents - billed);
  const hb = job.contract?.paymentSchedule.holdback;
  const holdback = hb?.enabled
    ? { percent: hb.percent, withheldCents: live.filter((i) => i.type !== "holdback_release").reduce((s, i) => s + i.holdbackCents, 0) }
    : null;
  return { unbilledCents, holdback };
}

export function CompleteJobDialog({ data, open, onOpenChange, onConfirm, busy }: { data: JobDetailDto; open: boolean; onOpenChange: (o: boolean) => void; onConfirm: () => void; busy: boolean }) {
  const { t } = useLanguage();
  const preview = completionPreview(data);
  // Phase 87: the server refuses to complete a job with a permit still open, so say which ones before the click.
  const permits = useQuery({ queryKey: ["permits", data.job.id], queryFn: () => complianceApi.permits(data.job.id), enabled: open, retry: false });
  const openPermits = (permits.data?.permits ?? []).filter((p) => p.open);
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("jobs.complete.title")}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="stack" style={{ gap: 8 }}>
              <p>{preview.unbilledCents > 0 ? t("jobs.complete.finalDraft").replace("{amount}", formatCents(preview.unbilledCents)) : t("jobs.complete.nothingLeft")}</p>
              {preview.holdback && preview.holdback.withheldCents > 0 && (
                <p>{t("jobs.complete.holdback").replace("{percent}", String(preview.holdback.percent)).replace("{amount}", formatCents(preview.holdback.withheldCents))}</p>
              )}
              {openPermits.length > 0 && (
                <div className="notice danger" role="alert" style={{ fontWeight: 500 }}>
                  <div className="grow">
                    <p className="m-0" style={{ fontWeight: 700 }}>{t("permits.blocksCompletion")}</p>
                    <ul className="stack" style={{ gap: 4, marginTop: 6 }}>
                      {openPermits.map((p) => <li key={p.id} className="flex items-center justify-between gap-2"><span>{p.title}</span><PermitStatusChip status={p.status} /></li>)}
                    </ul>
                  </div>
                </div>
              )}
              <p className="foot-note m-0">{t("jobs.complete.review")}</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("jobs.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={(e) => { e.preventDefault(); onConfirm(); }} disabled={busy || openPermits.length > 0} style={{ background: "var(--green)" }}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("jobs.complete.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ArchiveJobDialog({ open, onOpenChange, onConfirm, busy }: { open: boolean; onOpenChange: (o: boolean) => void; onConfirm: () => void; busy: boolean }) {
  const { t } = useLanguage();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("jobs.archive.title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("jobs.archive.desc")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("jobs.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={(e) => { e.preventDefault(); onConfirm(); }} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("jobs.archive.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
