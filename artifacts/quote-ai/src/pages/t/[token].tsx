import { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { Clock, Loader2, Trash2, CheckCircle2, AlertTriangle, Minus, Plus, MapPin, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { workerApi } from "@/lib/team-api";
import { Logo } from "@/components/logo";

const day = (s: string | null) => (s ? new Date(`${s}T00:00:00`) : null);
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Resolves to {lat, lng} or null — never rejects, since a clock-in must work even without location. */
function getLocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
    );
  });
}

function elapsedLabel(sinceIso: string, now: number) {
  const ms = Math.max(0, now - new Date(sinceIso).getTime());
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}:${String(m).padStart(2, "0")}`;
}

/**
 * Public worker time-entry page. No login: the magic-link token identifies
 * the worker. Built for a phone on site — pick the job, tap the hours, done.
 */
export default function WorkerTimePage() {
  const { token } = useParams<{ token: string }>();
  const { t, lang, setLang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["worker", token], queryFn: () => workerApi.get(token!), enabled: !!token, retry: false });
  useEffect(() => { if (data?.language) setLang(data.language); }, [data?.language, setLang]);

  const [projectId, setProjectId] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [date, setDate] = useState(isoDay(new Date()));
  const [hours, setHours] = useState(8);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationOff, setLocationOff] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (data && !projectId && data.jobs.length === 1) setProjectId(data.jobs[0]!.id); }, [data, projectId]);
  useDocumentTitle(`${t("worker.clockInOut")} · ${data?.companyName ?? "QuoteAI"}`);
  useEffect(() => {
    if (!data?.activeEntry) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [data?.activeEntry]);

  const job = data?.jobs.find((j) => j.id === projectId);
  const add = useMutation({
    mutationFn: () => workerApi.add(token!, { projectId, date, hours, milestoneId: milestoneId || null, note: note.trim() || undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["worker", token] }); setNote(""); setSaved(true); setTimeout(() => setSaved(false), 2500); },
  });
  const remove = useMutation({ mutationFn: (id: string) => workerApi.remove(token!, id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["worker", token] }) });

  const clockIn = useMutation({
    mutationFn: async () => {
      setLocating(true);
      const loc = await getLocation();
      setLocating(false);
      setLocationOff(!loc);
      return workerApi.clockIn(token!, { projectId, milestoneId: milestoneId || null, lat: loc?.lat, lng: loc?.lng });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["worker", token] }),
  });
  const clockOut = useMutation({
    mutationFn: async (entryId: string) => {
      setLocating(true);
      const loc = await getLocation();
      setLocating(false);
      return workerApi.clockOut(token!, entryId, { lat: loc?.lat, lng: loc?.lng });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["worker", token] }),
  });

  const weekTotal = useMemo(() => {
    if (!data) return 0;
    const start = new Date(); start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); start.setHours(0, 0, 0, 0);
    return data.entries.filter((e) => e.status !== "rejected" && e.date && day(e.date)!.getTime() >= start.getTime()).reduce((s, e) => s + e.hours, 0);
  }, [data]);
  // The currently-open clock-in (if any) already renders in its own card above.
  const closedEntries = useMemo(() => (data ? data.entries.filter((e) => !(e.clockInAt && !e.clockOutAt)) : []), [data]);

  if (isLoading) return <div className="doc-shell flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--navy)" }} /></div>;
  if (error || !data) {
    const code = (error as Error & { code?: string })?.code;
    return (
      <div className="doc-shell flex items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-3">
          <AlertTriangle className="h-10 w-10 mx-auto" style={{ color: "var(--yellow-dark)" }} />
          <h1 className="text-lg font-bold" style={{ color: "var(--navy)" }}>{code === "EXPIRED" ? t("worker.expiredTitle") : t("worker.invalidTitle")}</h1>
          <p className="text-sm" style={{ color: "var(--muted-mk)" }}>{code === "EXPIRED" ? t("worker.expiredBody") : t("worker.invalidBody")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="doc-shell pb-16">
      <header className="doc-head">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0"><div className="font-bold truncate" style={{ color: "var(--navy)" }}>{data.worker.name}</div><div className="text-xs truncate" style={{ color: "var(--muted-mk)" }}>{data.companyName}</div></div>
          <div className="flex items-center gap-3">
            <button className="text-xs" style={{ color: "var(--muted-mk)" }} onClick={() => setLang(lang === "fr" ? "en" : "fr")}>{lang === "fr" ? "EN" : "FR"}</button>
            <Logo className="h-5" />
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        <section className="card p-4 space-y-4">
          <h1 className="text-base font-bold inline-flex items-center gap-2" style={{ color: "var(--navy)" }}><Clock className="h-4 w-4" style={{ color: "var(--navy)" }} /> {t("worker.clockInOut")}</h1>

          {data.activeEntry ? (
            <div className="rounded-xl p-4 space-y-3 text-center" style={{ border: "1px solid var(--line)", background: "var(--soft)" }}>
              <div className="text-sm" style={{ color: "var(--ink)" }}>{data.activeEntry.projectName}{data.activeEntry.milestoneTitle ? ` · ${data.activeEntry.milestoneTitle}` : ""}</div>
              <div className="text-3xl font-bold tabular-nums" style={{ color: "var(--navy)" }}>{elapsedLabel(data.activeEntry.clockInAt!, now)}</div>
              <div className="text-xs" style={{ color: "var(--muted-mk)" }}>{t("worker.clockedInSince")} {format(new Date(data.activeEntry.clockInAt!), "HH:mm")}</div>
              {clockOut.error && <p className="text-xs" style={{ color: "var(--red)" }}>{(clockOut.error as Error).message}</p>}
              <button className="btn btn-navy w-full text-base" disabled={clockOut.isPending} onClick={() => clockOut.mutate(data.activeEntry!.id)}>
                {clockOut.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Square className="h-4 w-4 fill-current" />} {locating && clockOut.isPending ? t("worker.locating") : t("worker.clockOut")}
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: "var(--muted-mk)" }}>{t("worker.job")}</label>
                {data.jobs.length === 0 ? <p className="text-sm" style={{ color: "var(--muted-mk)" }}>{t("worker.noJobs")}</p> : (
                  <div className="grid gap-2">
                    {data.jobs.map((j) => (
                      <button
                        key={j.id}
                        onClick={() => { setProjectId(j.id); setMilestoneId(""); }}
                        className="text-left rounded-xl px-3 py-2.5 transition-colors"
                        style={projectId === j.id ? { border: "1px solid var(--navy)", background: "var(--soft)" } : { border: "1px solid var(--line)", background: "#fff" }}
                      >
                        <div className="font-medium text-sm" style={{ color: "var(--navy)" }}>{j.name}</div>
                        {j.address && <div className="text-xs truncate" style={{ color: "var(--muted-mk)" }}>{j.address}</div>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {job && job.milestones.length > 0 && (
                <div className="field">
                  <label htmlFor="worker-phase">{t("worker.phase")}</label>
                  <select id="worker-phase" value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)}>
                    <option value="">{t("worker.anyPhase")}</option>
                    {job.milestones.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                  </select>
                </div>
              )}

              {clockIn.error && <p className="text-xs" style={{ color: "var(--red)" }}>{(clockIn.error as Error).message}</p>}
              {locationOff && <p className="text-[11px] inline-flex items-center gap-1" style={{ color: "var(--yellow-dark)" }}><MapPin className="h-3 w-3" /> {t("worker.locationOff")}</p>}
              <button className="btn btn-navy w-full text-base" disabled={!projectId || clockIn.isPending} onClick={() => clockIn.mutate()}>
                {clockIn.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <MapPin className="h-5 w-5" />} {locating && clockIn.isPending ? t("worker.locating") : t("worker.clockIn")}
              </button>
            </>
          )}
        </section>

        <section className="card p-4 space-y-4">
          <h2 className="text-sm font-bold" style={{ color: "var(--navy)" }}>{t("worker.orManual")}</h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="field">
              <label htmlFor="worker-date">{t("worker.date")}</label>
              <input id="worker-date" type="date" value={date} max={isoDay(new Date())} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: "var(--muted-mk)" }}>{t("worker.hours")}</label>
              <div className="flex items-center rounded-xl h-11 overflow-hidden" style={{ border: "1px solid var(--line)", background: "#fff" }}>
                <button type="button" aria-label={t("a11y.decrease")} className="h-full w-11 flex items-center justify-center" style={{ color: "var(--ink)" }} onClick={() => setHours((h) => Math.max(0.5, Math.round((h - 0.5) * 2) / 2))}><Minus className="h-4 w-4" /></button>
                <input type="number" step="0.5" min="0.5" max="24" aria-label={t("worker.hours")} value={hours} onChange={(e) => setHours(Math.min(24, Math.max(0.5, Number(e.target.value) || 0.5)))} className="flex-1 min-w-0 text-center font-bold text-lg outline-none" style={{ color: "var(--navy)" }} />
                <button type="button" aria-label={t("a11y.increase")} className="h-full w-11 flex items-center justify-center" style={{ color: "var(--ink)" }} onClick={() => setHours((h) => Math.min(24, Math.round((h + 0.5) * 2) / 2))}><Plus className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[4, 6, 8, 10].map((h) => (
              <button
                key={h}
                onClick={() => setHours(h)}
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={hours === h ? { background: "var(--navy)", color: "#fff", border: "1px solid var(--navy)" } : { background: "#fff", border: "1px solid var(--line)", color: "var(--muted-mk)" }}
              >
                {h} h
              </button>
            ))}
          </div>
          <div className="field">
            <label className="sr-only">{t("worker.notePlaceholder")}</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("worker.notePlaceholder")} />
          </div>

          {add.error && <p className="text-xs" style={{ color: "var(--red)" }}>{(add.error as Error).message}</p>}
          <button className="btn w-full text-base" style={saved ? { background: "var(--green-dark)", color: "#fff" } : { background: "var(--navy)", color: "#fff" }} disabled={!projectId || add.isPending} onClick={() => add.mutate()}>
            {add.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : saved ? <CheckCircle2 className="h-5 w-5" /> : null} {saved ? t("worker.saved") : t("worker.submit")}
          </button>
          <p className="text-[11px] text-center" style={{ color: "var(--faint)" }}>{t("worker.approvalHint")}</p>
        </section>

        <section className="card p-4 space-y-2">
          <div className="flex items-center justify-between"><h2 className="text-sm font-bold" style={{ color: "var(--navy)" }}>{t("worker.recent")}</h2><span className="text-xs" style={{ color: "var(--muted-mk)" }}>{t("worker.thisWeek")}: <span className="font-semibold" style={{ color: "var(--ink)" }}>{weekTotal} h</span></span></div>
          {closedEntries.length === 0 ? <p className="text-sm py-3 text-center" style={{ color: "var(--faint)" }}>{t("worker.noEntries")}</p> : (
            <ul className="divide-y" style={{ borderColor: "var(--soft)" }}>
              {closedEntries.map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-2 text-sm" style={{ borderColor: "var(--soft)" }}>
                  <div className="flex-1 min-w-0">
                    <div className="truncate"><span className="font-medium" style={{ color: "var(--ink)" }}>{e.hours} h</span> <span style={{ color: "var(--muted-mk)" }}>· {e.projectName}</span>{e.milestoneTitle ? <span style={{ color: "var(--faint)" }}> · {e.milestoneTitle}</span> : null}</div>
                    <div className="text-[11px]" style={{ color: "var(--faint)" }}>{e.date ? format(day(e.date)!, "EEE d MMM", { locale }) : ""}{e.note ? ` · ${e.note}` : ""}{e.status === "rejected" && e.rejectedReason ? ` · ${e.rejectedReason}` : ""}</div>
                  </div>
                  {e.geofenceFlagged && <span title={t("worker.geofenceFlag")}><MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--yellow-dark)" }} /></span>}
                  <span className={cn("doc-status", e.status === "approved" ? "ok" : e.status === "rejected" ? "danger" : "warn")}>{t(`worker.status.${e.status}`)}</span>
                  {e.status === "submitted" && <button style={{ color: "var(--line)" }} onClick={() => remove.mutate(e.id)}><Trash2 className="h-4 w-4" /></button>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
