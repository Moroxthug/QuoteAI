import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { ArrowRight, Check, HardHat, Loader2, Lock, MapPin, OctagonAlert, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SwipeRow } from "@/components/mobile/swipe-row";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCan } from "@/hooks/use-role";
import { useToast } from "@/hooks/use-toast";
import { crewApi, teamApi, type CrewTodayDto } from "@/lib/team-api";
import { FieldReportRow } from "./field-reports-card";
import { mapsUrl } from "./worker-today";

type Enabled = Extract<CrewTodayDto, { enabled: true }>;
type Person = Enabled["jobs"][number]["crew"][number];

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));

/** The crew's day, shared by every piece below (one request, refreshed every two minutes). */
function useCrewToday() {
  return useQuery({ queryKey: ["crew-today"], queryFn: crewApi.today, refetchInterval: 120_000 });
}

/** Where one booked person stands right now: in, on another job, late, or not yet. */
function personStatus(c: Person, now: number, t: (k: string) => string, hm: (iso: string) => string) {
  if (c.clockedInAt) return { cls: "ok", label: `${t("crew.inSince")} ${hm(c.clockedInAt)}`, late: false };
  if (c.clockedInElsewhere) return { cls: "warn", label: t("crew.elsewhere"), late: false };
  if (!c.allDay && new Date(c.startsAt).getTime() <= now) return { cls: "warn", label: t("crew.notIn"), late: true };
  return { cls: "info", label: t("crew.notYet"), late: false };
}

/**
 * Phase 86 — the crew's day, for whoever runs it. Phase 108 splits the one
 * tall card into the foreman home's pieces, in the order a foreman asks:
 * what is stuck, who is where, whose hours are waiting, what came in.
 */
export function CrewLocked() {
  const { t } = useLanguage();
  const { data, isLoading } = useCrewToday();
  if (isLoading) return <Skeleton className="h-40 w-full rounded-[var(--radius-mk)]" />;
  if (!data || data.enabled) return null;
  return (
    <section className="card" data-testid="crew-today">
      <div className="today-empty" style={{ paddingTop: 20 }}><Lock style={{ color: "var(--muted-mk)" }} /> {t("crew.locked")}</div>
    </section>
  );
}

/** Open blockers first — red, with Answer on each. Nothing when nothing is stuck. */
export function CrewBlockers() {
  const { t } = useLanguage();
  const { data } = useCrewToday();
  if (!data?.enabled || data.blockers.length === 0) return null;
  return (
    <section className="card crew-block" aria-labelledby="crew-blocked-h">
      <div className="today-head">
        <h2 id="crew-blocked-h" style={{ color: "var(--red)" }}><OctagonAlert className="h-4 w-4" /> {t("crew.blockedNow")} <span className="ny-count red">{data.blockers.length}</span></h2>
      </div>
      <div className="act-body pt-2">
        <div className="note-list">{data.blockers.map((r) => <FieldReportRow key={r.id} report={r} showJob />)}</div>
      </div>
    </section>
  );
}

/** Who is where: one line of counts, then each job with its people and whether they are in. */
export function CrewWhoIsWhere() {
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const { data } = useCrewToday();
  if (!data?.enabled) return null;
  const d: Enabled = data;
  const now = Date.now();
  const hm = (iso: string) => format(new Date(iso), "H:mm", { locale });
  const scheduled = new Set(d.jobs.flatMap((j) => j.crew.map((c) => c.workerId)));
  const unscheduled = d.clockedIn.filter((c) => !scheduled.has(c.workerId));
  const late = new Set(d.jobs.flatMap((j) => j.crew.filter((c) => c.workerId && personStatus(c, now, t, hm).late).map((c) => c.workerId)));
  const onSite = new Set(d.clockedIn.map((c) => c.workerId)).size;
  const jobs = d.jobs.filter((j) => j.jobId).length;
  const summary = [
    fill(t(onSite === 1 ? "today.crew.onSiteOne" : "today.crew.onSiteMany"), { n: onSite }),
    late.size > 0 ? fill(t(late.size === 1 ? "today.crew.notInOne" : "today.crew.notInMany"), { n: late.size }) : null,
    jobs > 0 ? fill(t(jobs === 1 ? "today.crew.jobsOne" : "today.crew.jobsMany"), { n: jobs }) : null,
  ].filter(Boolean);

  return (
    <section className="card" data-testid="crew-today" aria-labelledby="crew-where-h">
      <div className="today-head">
        <h2 id="crew-where-h"><Users className="h-4 w-4" /> {t("crew.onSite")}</h2>
        <Link href="/dashboard/schedule" className="cta-link today-link">{t("crew.openBoard")} <ArrowRight className="chev" /></Link>
      </div>
      {d.jobs.length === 0 && unscheduled.length === 0 ? (
        <p className="today-empty">{t("crew.nobodyBooked")}</p>
      ) : (
        <>
          <p className={cn("crew-sum", late.size > 0 && "warn")}>{summary.join(" · ")}</p>
          <ul className="crew-jobs">
            {d.jobs.map((j) => (
              <li key={j.jobId ?? "other"}>
                <div className="crew-job-head">
                  {j.jobId ? <Link href={`/dashboard/jobs/${j.jobId}`} className="crew-job-name">{j.jobName}</Link> : <span className="crew-job-name">{t("crew.otherBlocks")}</span>}
                  {j.address && <a href={mapsUrl(j.address)} target="_blank" rel="noopener noreferrer" className="crew-job-addr"><MapPin aria-hidden="true" /><span className="truncate">{j.address}</span></a>}
                </div>
                <ul className="crew-people">
                  {j.crew.map((c) => {
                    const st = personStatus(c, now, t, hm);
                    return (
                      <li key={c.blockId}>
                        <span className="crew-person">{c.workerName ?? (c.title || "—")}</span>
                        <span className="crew-time">{c.allDay ? t("worker.allDay") : `${hm(c.startsAt)}–${hm(c.endsAt)}`}</span>
                        {c.workerId && <span className={cn("doc-status", st.cls)}>{st.label}</span>}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
            {unscheduled.length > 0 && (
              <li>
                <div className="crew-job-head"><span className="crew-job-name">{t("crew.inNotBooked")}</span></div>
                <ul className="crew-people">
                  {unscheduled.map((c) => (
                    <li key={c.entryId}>
                      <span className="crew-person">{c.workerName} · <span style={{ color: "var(--muted-mk)" }}>{c.projectName}</span></span>
                      <span className="doc-status ok">{t("crew.inSince")} {hm(c.since)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            )}
          </ul>
        </>
      )}
    </section>
  );
}

const APPROVE_SHOWN = 8;

/** Hours waiting for approval: swipe a row right on a phone, or its ✓, or Approve all. */
export function HoursToApprove() {
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const can = useCan();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data } = useCrewToday();
  const approve = useMutation({
    mutationFn: (ids: string[]) => teamApi.approveMany(ids),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["crew-today"] });
      toast({ title: `${r.approved} ${t("team.time.approvedToast")}` });
    },
    onError: (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" }),
  });
  if (!data?.enabled) return null;
  const rows = data.awaitingApproval;
  const canApprove = can("jobs", "edit");

  return (
    <section className="card" aria-labelledby="crew-hours-h">
      <div className="today-head">
        <h2 id="crew-hours-h">{t("crew.toApprove")} {rows.length > 0 && <span className="ny-count">{rows.length}</span>}</h2>
        {rows.length > 1 && canApprove ? (
          <button type="button" className="btn btn-sm btn-outline-navy" disabled={approve.isPending} onClick={() => approve.mutate(rows.map((e) => e.id))}>
            {approve.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {t("team.time.approveAll")}
          </button>
        ) : (
          <Link href="/dashboard/team?tab=time" className="cta-link today-link">{t("crew.link.hours")} <ArrowRight className="chev" /></Link>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="today-empty"><Check /> {t("crew.nothingToApprove")}</p>
      ) : (
        <>
          {canApprove && <p className="crew-hint show-phone">{t("crew.m.swipeHint")}</p>}
          <ul className="lrows">
            {rows.slice(0, APPROVE_SHOWN).map((e) => {
              const body = (
                <div className="lrow">
                  <span className="crew-hrs" aria-hidden="true">{e.hours}<small>h</small></span>
                  <span className="lrow-main">
                    <span className="lrow-title"><span className="sr-only">{e.hours} h · </span>{e.workerName} · <span className="font-semibold" style={{ color: "var(--muted-mk)" }}>{e.projectName}</span></span>
                    <span className={cn("lrow-meta", e.geofenceFlagged && "warn")}>
                      {[e.date ? format(new Date(`${e.date}T12:00:00`), "EEE d MMM", { locale }) : "", e.clocked ? t("crew.clocked") : t("crew.typedIn"), e.geofenceFlagged ? t("worker.geofenceFlag") : "", e.note].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {canApprove && (
                    <button type="button" className="ny-pill ny-act" aria-label={`${t("crew.approve")} — ${e.workerName ?? ""} ${e.hours} h`} disabled={approve.isPending} onClick={() => approve.mutate([e.id])}>
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
              return <li key={e.id}>{canApprove ? <SwipeRow label={t("crew.approve")} onSwipe={() => approve.mutateAsync([e.id])}>{body}</SwipeRow> : body}</li>;
            })}
          </ul>
          {rows.length > APPROVE_SHOWN && <Link href="/dashboard/team?tab=time" className="today-more">{t("crew.seeAllHours")}</Link>}
        </>
      )}
    </section>
  );
}

/** Photos, notes and materials from the field (blockers are above). */
export function CrewFromTheField() {
  const { t } = useLanguage();
  const { data } = useCrewToday();
  if (!data?.enabled) return null;
  const others = data.recentReports.filter((r) => r.kind !== "blocker").slice(0, 5);
  if (others.length === 0) return null;
  return (
    <section className="card" aria-labelledby="crew-field-h">
      <div className="today-head">
        <h2 id="crew-field-h"><HardHat className="h-4 w-4" /> {t("crew.fromTheField")}</h2>
      </div>
      <div className="act-body pt-2">
        <div className="note-list">{others.map((r) => <FieldReportRow key={r.id} report={r} showJob />)}</div>
      </div>
    </section>
  );
}

/**
 * Phase 108 — on a job's Overview: who is booked on this job today and
 * whether they are in, as one card of rows. Nothing when nobody is booked.
 */
export function JobCrewToday({ jobId }: { jobId: string }) {
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const { data } = useCrewToday();
  if (!data?.enabled) return null;
  const job = data.jobs.find((j) => j.jobId === jobId);
  const walkIns = data.clockedIn.filter((c) => c.projectId === jobId && !(job?.crew ?? []).some((x) => x.workerId === c.workerId));
  if (!job?.crew.length && walkIns.length === 0) return null;
  const now = Date.now();
  const hm = (iso: string) => format(new Date(iso), "H:mm", { locale });
  return (
    <section className="card" aria-labelledby="job-crew-h">
      <div className="today-head">
        <h2 id="job-crew-h"><Users className="h-4 w-4" /> {t("crew.m.onThisJob")}</h2>
      </div>
      <ul className="crew-people pad">
        {(job?.crew ?? []).map((c) => {
          const st = personStatus(c, now, t, hm);
          return (
            <li key={c.blockId}>
              <span className="crew-person">{c.workerName ?? (c.title || "—")}</span>
              <span className="crew-time">{c.allDay ? t("worker.allDay") : `${hm(c.startsAt)}–${hm(c.endsAt)}`}</span>
              {c.workerId && <span className={cn("doc-status", st.cls)}>{st.label}</span>}
            </li>
          );
        })}
        {walkIns.map((c) => (
          <li key={c.entryId}>
            <span className="crew-person">{c.workerName}</span>
            <span className="doc-status ok">{t("crew.inSince")} {hm(c.since)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
