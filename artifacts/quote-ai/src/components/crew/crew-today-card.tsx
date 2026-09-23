import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { Check, HardHat, Loader2, Lock, MapPin, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCan } from "@/hooks/use-role";
import { useToast } from "@/hooks/use-toast";
import { crewApi, teamApi, type CrewTodayDto } from "@/lib/team-api";
import { FieldReportRow } from "./field-reports-card";
import { mapsUrl } from "./worker-today";

type Enabled = Extract<CrewTodayDto, { enabled: true }>;

/**
 * Phase 86 — the crew's day, for whoever runs it: each job with the people
 * booked on it and whether they have clocked in, anything blocked, hours
 * waiting for approval, and what came in from the field.
 *
 * `variant="foreman"` is the foreman's landing page and always renders (with
 * honest empty and locked states). On the owner's dashboard it stays out of
 * the way unless there is actually a crew out today or something to act on.
 */
export function CrewTodayCard({ variant }: { variant: "foreman" | "owner" }) {
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const can = useCan();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["crew-today"], queryFn: crewApi.today, refetchInterval: 120_000 });
  const approve = useMutation({
    mutationFn: (ids: string[]) => teamApi.approveMany(ids),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["crew-today"] });
      toast({ title: `${r.approved} ${t("team.time.approvedToast")}` });
    },
    onError: (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" }),
  });

  if (isLoading) return variant === "foreman" ? <section className="card"><div className="act-body"><Skeleton className="h-40 w-full" /></div></section> : null;
  if (!data) return null;
  if (!data.enabled) {
    if (variant === "owner") return null;
    return (
      <section className="card" data-testid="crew-today">
        <div className="act-body text-sm inline-flex items-center gap-2" style={{ color: "var(--muted-mk)" }}>
          <Lock className="h-4 w-4" /> {t("crew.locked")}
        </div>
      </section>
    );
  }
  const d: Enabled = data;
  const scheduled = new Set(d.jobs.flatMap((j) => j.crew.map((c) => c.workerId)));
  const unscheduled = d.clockedIn.filter((c) => !scheduled.has(c.workerId));
  const others = d.recentReports.filter((r) => r.kind !== "blocker").slice(0, 5);
  const nothing = d.jobs.length === 0 && d.clockedIn.length === 0 && d.awaitingApproval.length === 0 && d.blockers.length === 0 && others.length === 0;
  if (variant === "owner" && nothing) return null;
  const now = Date.now();
  const hm = (iso: string) => format(new Date(iso), "H:mm", { locale });

  return (
    <section className="card" data-testid="crew-today" aria-labelledby="crew-today-h">
      <div className="card-head">
        <div>
          <h2 id="crew-today-h"><Users className="inline h-4 w-4 mr-1 -mt-0.5" />{t("crew.dayTitle")}</h2>
          <p className="foot-note">{format(new Date(`${d.day}T12:00:00`), "EEEE d MMMM", { locale })}</p>
        </div>
        <Link href="/dashboard/schedule" className="text-link">{t("crew.openBoard")}</Link>
      </div>
      <div className="act-body stack">
        {d.blockers.length > 0 && (
          <div>
            <h3 className="eyebrow mb-2" style={{ color: "var(--red)" }}>{t("crew.blockedNow")} ({d.blockers.length})</h3>
            <div className="note-list">{d.blockers.map((r) => <FieldReportRow key={r.id} report={r} showJob />)}</div>
          </div>
        )}

        <div>
          <h3 className="eyebrow mb-2">{t("crew.onSite")}</h3>
          {d.jobs.length === 0 && unscheduled.length === 0 ? (
            <p className="text-sm text-slate-500">{t("crew.nobodyBooked")}</p>
          ) : (
            <ul className="note-list">
              {d.jobs.map((j) => (
                <li key={j.jobId ?? "other"} className="note-row" style={{ display: "block" }}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    {j.jobId ? <Link href={`/dashboard/jobs/${j.jobId}`} className="font-semibold" style={{ color: "var(--navy)" }}>{j.jobName}</Link> : <span className="font-semibold" style={{ color: "var(--navy)" }}>{t("crew.otherBlocks")}</span>}
                    {j.address && <a href={mapsUrl(j.address)} target="_blank" rel="noopener noreferrer" className="text-xs inline-flex items-center gap-1" style={{ color: "var(--muted-mk)" }}><MapPin className="h-3 w-3" />{j.address}</a>}
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {j.crew.map((c) => {
                      const started = new Date(c.startsAt).getTime() <= now;
                      const status = c.clockedInAt ? { cls: "ok", label: `${t("crew.inSince")} ${hm(c.clockedInAt)}` } : c.clockedInElsewhere ? { cls: "warn", label: t("crew.elsewhere") } : started && !c.allDay ? { cls: "warn", label: t("crew.notIn") } : { cls: "info", label: t("crew.notYet") };
                      return (
                        <li key={c.blockId} className="flex items-center gap-2 text-sm">
                          <span className="flex-1 min-w-0 truncate" style={{ color: "var(--ink)" }}>{c.workerName ?? (c.title || "—")}</span>
                          <span className="text-xs tabular-nums" style={{ color: "var(--muted-mk)" }}>{c.allDay ? t("worker.allDay") : `${hm(c.startsAt)}–${hm(c.endsAt)}`}</span>
                          {c.workerId && <span className={cn("doc-status", status.cls)}>{status.label}</span>}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
              {unscheduled.length > 0 && (
                <li className="note-row" style={{ display: "block" }}>
                  <span className="font-semibold" style={{ color: "var(--navy)" }}>{t("crew.inNotBooked")}</span>
                  <ul className="mt-1.5 space-y-1">
                    {unscheduled.map((c) => (
                      <li key={c.entryId} className="flex items-center gap-2 text-sm">
                        <span className="flex-1 min-w-0 truncate">{c.workerName} · <span style={{ color: "var(--muted-mk)" }}>{c.projectName}</span></span>
                        <span className="doc-status ok">{t("crew.inSince")} {hm(c.since)}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              )}
            </ul>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="eyebrow">{t("crew.toApprove")} ({d.awaitingApproval.length})</h3>
            {d.awaitingApproval.length > 1 && can("jobs", "edit") && (
              <button type="button" className="btn btn-sm btn-outline-navy" disabled={approve.isPending} onClick={() => approve.mutate(d.awaitingApproval.map((e) => e.id))}>
                {approve.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {t("team.time.approveAll")}
              </button>
            )}
          </div>
          {d.awaitingApproval.length === 0 ? (
            <p className="text-sm text-slate-500">{t("crew.nothingToApprove")}</p>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--soft)" }}>
              {d.awaitingApproval.slice(0, 8).map((e) => (
                <li key={e.id} className="flex items-center gap-2 py-2 text-sm" style={{ borderColor: "var(--soft)" }}>
                  <div className="flex-1 min-w-0">
                    <div className="truncate"><b>{e.hours} h</b> · {e.workerName} · <span style={{ color: "var(--muted-mk)" }}>{e.projectName}</span></div>
                    <div className="text-[11px]" style={{ color: "var(--faint)" }}>
                      {e.date ? format(new Date(`${e.date}T12:00:00`), "EEE d MMM", { locale }) : ""}
                      {e.clocked ? ` · ${t("crew.clocked")}` : ` · ${t("crew.typedIn")}`}
                      {e.geofenceFlagged ? ` · ${t("worker.geofenceFlag")}` : ""}
                      {e.note ? ` · ${e.note}` : ""}
                    </div>
                  </div>
                  {can("jobs", "edit") && (
                    <button type="button" className="ic-btn" aria-label={`${t("crew.approve")} — ${e.workerName ?? ""} ${e.hours} h`} disabled={approve.isPending} onClick={() => approve.mutate([e.id])}><Check /></button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {d.awaitingApproval.length > 8 && <Link href="/dashboard/team?tab=time" className="text-link text-sm">{t("crew.seeAllHours")}</Link>}
        </div>

        {others.length > 0 && (
          <div>
            <h3 className="eyebrow mb-2"><HardHat className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />{t("crew.fromTheField")}</h3>
            <div className="note-list">{others.map((r) => <FieldReportRow key={r.id} report={r} showJob />)}</div>
          </div>
        )}
      </div>
    </section>
  );
}
