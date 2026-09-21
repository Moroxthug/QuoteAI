import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format, isSameDay } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { AlertTriangle, CalendarDays, Plus } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { localDay } from "@/lib/local-day";
import { scheduleApi, type ScheduleBlockDto } from "@/lib/schedule-api";
import { BlockDialog, type BlockDraft } from "@/components/schedule/block-dialog";

/**
 * Phase 75: the job page's slice of the schedule board — this job's crew
 * blocks for the next four weeks, an "Add" button that opens the same block
 * dialog with the job locked, and a link to the full board filtered on the
 * job. Reads the board endpoint with `projectId`, so conflicts are the
 * server's, same as everywhere else.
 */
export function CrewScheduleCard({ jobId }: { jobId: string }) {
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const range = useMemo(() => {
    const from = new Date(`${localDay(new Date())}T00:00:00`);
    return { from, to: new Date(from.getTime() + 28 * 86_400_000) };
  }, []);
  const { data } = useQuery({ queryKey: ["schedule", "job", jobId, range.from.toISOString()], queryFn: () => scheduleApi.window(range.from, range.to, jobId) });
  const [dialog, setDialog] = useState<{ block: ScheduleBlockDto | null; draft: BlockDraft | null } | null>(null);
  const blocks = data?.blocks ?? [];

  const addDraft = () => {
    const d = new Date(`${localDay(new Date())}T08:00:00`);
    setDialog({ block: null, draft: { projectId: jobId, startsAt: d, endsAt: new Date(d.getTime() + 8 * 3_600_000) } });
  };

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>{t("schedule.jobCard.title")}</h2>
          <p className="sub">{t("schedule.jobCard.sub")}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/dashboard/schedule?job=${jobId}`} className="btn btn-sm btn-outline-navy"><CalendarDays className="h-4 w-4" /> {t("schedule.jobCard.openBoard")}</Link>
          <button type="button" className="btn btn-sm btn-navy" onClick={addDraft}><Plus className="h-4 w-4" /> {t("schedule.addBlock")}</button>
        </div>
      </div>
      {blocks.length === 0 ? (
        <div className="act-body"><p className="foot-note m-0">{t("schedule.jobCard.empty")}</p></div>
      ) : (
        <div>
          {blocks.map((b) => {
            const s = new Date(b.startsAt);
            const e = new Date(b.endsAt);
            const when = b.allDay
              ? `${format(s, "EEE d MMM", { locale })}${isSameDay(s, new Date(e.getTime() - 1)) ? "" : ` → ${format(new Date(e.getTime() - 1), "EEE d MMM", { locale })}`} · ${t("schedule.allDay")}`
              : `${format(s, "EEE d MMM", { locale })} · ${format(s, "H:mm")}–${format(e, "H:mm")}`;
            return (
              <button key={b.id} type="button" className="item-row w-full text-left" onClick={() => setDialog({ block: b, draft: null })}>
                <div className="grow min-w-0">
                  <span className="ttl block truncate">{b.collaboratorName ?? t("schedule.unassigned")}{b.milestoneTitle ? ` · ${b.milestoneTitle}` : ""}{b.title ? ` · ${b.title}` : ""}</span>
                  <span className="sub block text-xs" style={{ color: "var(--faint)" }}>{when}{b.notes ? ` · ${b.notes}` : ""}</span>
                </div>
                {b.conflicts.length > 0 && <span className="chip chip-red"><AlertTriangle className="h-3 w-3 mr-1" /> {t("schedule.legend.conflict")}</span>}
              </button>
            );
          })}
        </div>
      )}
      <BlockDialog open={!!dialog} onOpenChange={(o) => { if (!o) setDialog(null); }} block={dialog?.block ?? null} draft={dialog?.draft ?? null} jobs={data?.jobs ?? []} workers={data?.workers ?? []} lockJob />
    </section>
  );
}
