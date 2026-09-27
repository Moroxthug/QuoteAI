import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { CheckCircle2, CloudUpload, Loader2, MapPin, Minus, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { runOrQueue, useOutbox } from "@/lib/offline/outbox";
import { workerApi, type WorkerEntryDto } from "@/lib/team-api";

type Job = { id: string; name: string; milestones: { id: string; title: string }[] };

const day = (s: string | null) => (s ? new Date(`${s}T00:00:00`) : null);
export const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Phase 108 — hours typed in by hand, for a day the worker forgot to clock:
 * the job, the day, the hours (a stepper and four quick picks) and a note.
 * It lives in a sheet behind ⋯ on /t/:token — the clock is the normal way.
 * Goes through the offline outbox like the clock does.
 */
export function ManualHoursForm({ token, jobs, defaultJobId, onSaved }: { token: string; jobs: Job[]; defaultJobId: string | null; onSaved?: () => void }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState(defaultJobId ?? "");
  const [milestoneId, setMilestoneId] = useState("");
  const [date, setDate] = useState(isoDay(new Date()));
  const [hours, setHours] = useState(8);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState<false | "online" | "offline">(false);
  const job = jobs.find((j) => j.id === projectId);
  const jobName = (id: string) => jobs.find((j) => j.id === id)?.name ?? "";

  const add = useMutation({
    mutationFn: () => {
      const body = { projectId, date, hours, milestoneId: milestoneId || null, note: note.trim() || undefined };
      return runOrQueue({ kind: "worker.addEntry", token, ...body }, { scope: token, label: `${hours} h · ${jobName(projectId)}` }, (clientRef) => workerApi.add(token, { ...body, clientRef }));
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["worker", token] });
      setNote("");
      setSaved(r.queued ? "offline" : "online");
      setTimeout(() => setSaved(false), 3000);
      if (onSaved) setTimeout(onSaved, 900);
    },
  });

  if (jobs.length === 0) return <p className="text-sm" style={{ color: "var(--muted-mk)" }}>{t("worker.noJobs")}</p>;
  return (
    <div className="space-y-4">
      <div className="field">
        <label htmlFor="hours-job">{t("worker.job")}</label>
        <select id="hours-job" value={projectId} onChange={(e) => { setProjectId(e.target.value); setMilestoneId(""); }}>
          <option value="" disabled>{t("crew.pickJob")}</option>
          {jobs.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
        </select>
      </div>
      {job && job.milestones.length > 0 && (
        <div className="field">
          <label htmlFor="hours-phase">{t("worker.phase")}</label>
          <select id="hours-phase" value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)}>
            <option value="">{t("worker.anyPhase")}</option>
            {job.milestones.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="field">
          <label htmlFor="worker-date">{t("worker.date")}</label>
          <input id="worker-date" type="date" value={date} max={isoDay(new Date())} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label htmlFor="worker-hours" className="text-xs font-medium" style={{ color: "var(--muted-mk)" }}>{t("worker.hours")}</label>
          <div className="flex items-center rounded-xl h-11 overflow-hidden" style={{ border: "1px solid var(--line)", background: "#fff" }}>
            <button type="button" aria-label={t("a11y.decrease")} className="h-full w-11 flex items-center justify-center" style={{ color: "var(--ink)" }} onClick={() => setHours((h) => Math.max(0.5, Math.round((h - 0.5) * 2) / 2))}><Minus className="h-4 w-4" /></button>
            <input id="worker-hours" type="number" step="0.5" min="0.5" max="24" value={hours} onChange={(e) => setHours(Math.min(24, Math.max(0.5, Number(e.target.value) || 0.5)))} className="flex-1 min-w-0 text-center font-bold text-lg outline-none" style={{ color: "var(--navy)" }} />
            <button type="button" aria-label={t("a11y.increase")} className="h-full w-11 flex items-center justify-center" style={{ color: "var(--ink)" }} onClick={() => setHours((h) => Math.min(24, Math.round((h + 0.5) * 2) / 2))}><Plus className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap" role="group" aria-label={t("worker.hours")}>
        {[4, 6, 8, 10].map((h) => (
          <button
            key={h}
            type="button"
            aria-pressed={hours === h}
            onClick={() => setHours(h)}
            className="rounded-full px-3 py-1.5 text-xs font-medium"
            style={hours === h ? { background: "var(--navy)", color: "#fff", border: "1px solid var(--navy)" } : { background: "#fff", border: "1px solid var(--line)", color: "var(--muted-mk)" }}
          >
            {h} h
          </button>
        ))}
      </div>
      <div className="field">
        <label htmlFor="worker-note">{t("worker.notePlaceholder")}</label>
        <input id="worker-note" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      {add.error && <p className="text-xs" role="alert" style={{ color: "var(--red)" }}>{(add.error as Error).message}</p>}
      <button type="button" className="btn w-full text-base" style={saved ? { background: saved === "offline" ? "var(--teal-dark)" : "var(--green-dark)", color: "#fff" } : { background: "var(--navy)", color: "#fff" }} disabled={!projectId || add.isPending} onClick={() => add.mutate()}>
        {add.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : saved === "offline" ? <CloudUpload className="h-5 w-5" /> : saved ? <CheckCircle2 className="h-5 w-5" /> : null} {saved === "offline" ? t("worker.savedOffline") : saved ? t("worker.saved") : t("worker.submit")}
      </button>
      <p className="text-[11px] text-center" style={{ color: "var(--muted-mk)" }}>{t("worker.approvalHint")}</p>
    </div>
  );
}

const SHOWN = 4;

/**
 * Phase 108 — "Your hours" at the end of /t/:token: this week's total, then
 * the last few entries (and any still waiting on the phone to sync), with the
 * rest one tap away. A submitted entry can still be deleted.
 */
export function WorkerHoursList({ token, entries, jobs }: { token: string; entries: WorkerEntryDto[]; jobs: Job[] }) {
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const queryClient = useQueryClient();
  const outbox = useOutbox(token);
  const [all, setAll] = useState(false);
  const remove = useMutation({ mutationFn: (id: string) => workerApi.remove(token, id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["worker", token] }) });
  const jobName = (id: string) => jobs.find((j) => j.id === id)?.name ?? "";

  const weekTotal = useMemo(() => {
    const start = new Date(); start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); start.setHours(0, 0, 0, 0);
    return entries.filter((e) => e.status !== "rejected" && e.date && day(e.date)!.getTime() >= start.getTime()).reduce((s, e) => s + e.hours, 0);
  }, [entries]);
  // The open clock-in is the Now card's; everything else is a finished entry.
  const closed = useMemo(() => entries.filter((e) => !(e.clockInAt && !e.clockOutAt)), [entries]);
  const pending = useMemo(() => outbox.rows.filter((r) => r.op.kind === "worker.addEntry"), [outbox.rows]);
  const total = pending.length + closed.length;
  const room = all ? Infinity : Math.max(0, SHOWN - pending.length);

  return (
    <section className="card p-4 space-y-2" aria-labelledby="worker-hours-h">
      <div className="flex items-center justify-between gap-3">
        <h2 id="worker-hours-h" className="text-sm font-bold" style={{ color: "var(--navy)" }}>{t("worker.m.yourHours")}</h2>
        <span className="text-xs" style={{ color: "var(--muted-mk)" }}>{t("worker.thisWeek")}: <span className="font-semibold" style={{ color: "var(--ink)" }}>{weekTotal} h</span></span>
      </div>
      {total === 0 ? <p className="text-sm py-2" style={{ color: "var(--muted-mk)" }}>{t("worker.noEntries")}</p> : (
        <ul className="divide-y" style={{ borderColor: "var(--soft)" }}>
          {pending.map((r) => {
            const op = r.op as Extract<typeof r.op, { kind: "worker.addEntry" }>;
            return (
              <li key={r.id} className="flex items-center gap-3 py-2 text-sm" style={{ borderColor: "var(--soft)" }}>
                <div className="flex-1 min-w-0">
                  <div className="truncate"><span className="font-medium" style={{ color: "var(--ink)" }}>{op.hours} h</span> <span style={{ color: "var(--muted-mk)" }}>· {jobName(op.projectId)}</span></div>
                  <div className="text-[11px]" style={{ color: "var(--muted-mk)" }}>{format(day(op.date)!, "EEE d MMM", { locale })}{op.note ? ` · ${op.note}` : ""}</div>
                </div>
                <span className={cn("doc-status", r.status === "failed" ? "danger" : "warn")}>{r.status === "failed" ? t("worker.status.failed") : t("worker.status.pending")}</span>
              </li>
            );
          })}
          {closed.slice(0, room).map((e) => (
            <li key={e.id} className="flex items-center gap-3 py-2 text-sm" style={{ borderColor: "var(--soft)" }}>
              <div className="flex-1 min-w-0">
                <div className="truncate"><span className="font-medium" style={{ color: "var(--ink)" }}>{e.hours} h</span> <span style={{ color: "var(--muted-mk)" }}>· {e.projectName}</span>{e.milestoneTitle ? <span style={{ color: "var(--muted-mk)" }}> · {e.milestoneTitle}</span> : null}</div>
                <div className="text-[11px]" style={{ color: "var(--muted-mk)" }}>{e.date ? format(day(e.date)!, "EEE d MMM", { locale }) : ""}{e.note ? ` · ${e.note}` : ""}{e.status === "rejected" && e.rejectedReason ? ` · ${e.rejectedReason}` : ""}</div>
              </div>
              {e.geofenceFlagged && <span title={t("worker.geofenceFlag")}><MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--yellow-dark)" }} aria-label={t("worker.geofenceFlag")} /></span>}
              <span className={cn("doc-status", e.status === "approved" ? "ok" : e.status === "rejected" ? "danger" : "warn")}>{t(`worker.status.${e.status}`)}</span>
              {e.status === "submitted" && (
                <button type="button" className="h-8 w-8 inline-flex items-center justify-center shrink-0" style={{ color: "var(--muted-mk)" }} aria-label={`${t("worker.m.deleteEntry")} — ${e.hours} h`} disabled={remove.isPending} onClick={() => remove.mutate(e.id)}><Trash2 className="h-4 w-4" /></button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!all && closed.length > room && (
        <button type="button" className="text-link" onClick={() => setAll(true)}>{t("worker.m.showAll").replace("{n}", String(total))}</button>
      )}
    </section>
  );
}
