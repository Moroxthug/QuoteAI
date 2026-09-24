import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { Check, HardHat, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCan } from "@/hooks/use-role";
import { useToast } from "@/hooks/use-toast";
import { crewApi, type FieldReportDto } from "@/lib/team-api";

const money = (cents: number, lang: string) => (cents / 100).toLocaleString(lang === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD" });

/** One report as the office sees it — shared by the job card and the crew's day. */
export function FieldReportRow({ report, showJob }: { report: FieldReportDto; showJob?: boolean }) {
  const { t, lang } = useLanguage();
  const can = useCan();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const locale = lang === "fr" ? frCA : enCA;
  const [answering, setAnswering] = useState(false);
  const [note, setNote] = useState("");
  const resolve = useMutation({
    mutationFn: () => crewApi.resolve(report.id, note.trim() || undefined),
    onSuccess: () => {
      setAnswering(false);
      queryClient.invalidateQueries({ queryKey: ["field-reports", report.projectId] });
      queryClient.invalidateQueries({ queryKey: ["crew-today"] });
    },
    onError: (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" }),
  });
  const openBlocker = report.kind === "blocker" && !report.resolvedAt;

  return (
    <div className="note-row" data-testid="field-report">
      {report.photoId && (
        <a href={crewApi.photoUrl(report.projectId, report.photoId)} target="_blank" rel="noopener noreferrer" className="shrink-0">
          <img src={crewApi.photoThumbUrl(report.projectId, report.photoId)} alt={report.body || t("crew.photoFrom").replace("{name}", report.authorName)} className="h-14 w-14 object-cover rounded-lg" style={{ border: "1px solid var(--line)" }} loading="lazy" />
        </a>
      )}
      <div className="body">
        {showJob && report.projectName && <div className="mb-0.5"><Link href={`/dashboard/jobs/${report.projectId}`} className="text-link text-xs">{report.projectName}</Link></div>}
        {report.body || (report.photoId ? <span className="text-slate-500">{t("crew.photoOnly")}</span> : null)}
        {report.materialsCents ? <b className="block">{money(report.materialsCents, lang)} · <span className="font-normal">{t("crew.inCostReview")}</span></b> : null}
        <div className="meta">
          <span className={cn("doc-status", report.kind === "blocker" ? (openBlocker ? "danger" : "ok") : report.kind === "materials" ? "warn" : "info")}>{report.kind === "blocker" ? (openBlocker ? t("crew.blockedOpen") : t("crew.answered")) : t(`crew.kind.${report.kind}`)}</span>
          {report.authorName && <span>{report.authorName}</span>}
          <span>{formatDistanceToNow(new Date(report.createdAt), { addSuffix: true, locale })}</span>
        </div>
        {report.resolvedAt && report.kind === "blocker" && (
          <p className="text-xs mt-1" style={{ color: "var(--muted-mk)" }}>
            {t("crew.answeredBy").replace("{name}", report.resolvedByName || "—")}
            {report.resolutionNote ? ` — ${report.resolutionNote}` : ""}
          </p>
        )}
        {openBlocker && can("jobs", "edit") && (answering ? (
          <div className="mt-2 flex flex-col sm:flex-row gap-2">
            <input className="flex-1 min-w-0 rounded-lg px-2 py-1.5 text-sm" style={{ border: "1px solid var(--line)" }} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("crew.answerPlaceholder")} aria-label={t("crew.answerPlaceholder")} maxLength={500} />
            <button type="button" className="btn btn-sm btn-navy" disabled={resolve.isPending} onClick={() => resolve.mutate()}>
              {resolve.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {t("crew.markSorted")}
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-sm btn-outline-navy mt-2" onClick={() => setAnswering(true)}>{t("crew.answer")}</button>
        ))}
      </div>
    </div>
  );
}

/**
 * Phase 86 — "From the field" on the job's Overview: every photo, note,
 * blocker and materials claim the crew sent from /t/:token, newest first.
 * Open blockers are answered here; the answer shows on the worker's page.
 */
export function FieldReportsCard({ jobId }: { jobId: string }) {
  const { t } = useLanguage();
  const { data, isLoading } = useQuery({ queryKey: ["field-reports", jobId], queryFn: () => crewApi.jobReports(jobId) });
  const reports = data?.reports ?? [];
  const open = reports.filter((r) => r.kind === "blocker" && !r.resolvedAt).length;
  if (isLoading || reports.length === 0) return null;
  return (
    <section className="card" data-testid="field-reports-card" style={open ? { borderColor: "var(--red)" } : undefined}>
      <div className="card-head">
        <div><h2><HardHat className="inline h-4 w-4 mr-1 -mt-0.5" />{t("crew.fromTheField")}</h2></div>
        <span className="foot-note">{open ? `${open} ${t("crew.openBlockers")}` : reports.length}</span>
      </div>
      <div className="act-body">
        <div className="note-list">
          {reports.slice(0, 20).map((r) => <FieldReportRow key={r.id} report={r} />)}
        </div>
      </div>
    </section>
  );
}
