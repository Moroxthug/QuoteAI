import { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { Clock, Loader2, Trash2, CheckCircle2, AlertTriangle, Minus, Plus, MapPin, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
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

  if (isLoading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-navy-600" /></div>;
  if (error || !data) {
    const code = (error as Error & { code?: string })?.code;
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-3">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
          <h1 className="text-lg font-bold text-slate-900">{code === "EXPIRED" ? t("worker.expiredTitle") : t("worker.invalidTitle")}</h1>
          <p className="text-sm text-slate-500">{code === "EXPIRED" ? t("worker.expiredBody") : t("worker.invalidBody")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0"><div className="font-bold text-slate-900 truncate">{data.worker.name}</div><div className="text-xs text-slate-500 truncate">{data.companyName}</div></div>
          <div className="flex items-center gap-3">
            <button className="text-xs text-slate-500" onClick={() => setLang(lang === "fr" ? "en" : "fr")}>{lang === "fr" ? "EN" : "FR"}</button>
            <Logo className="h-5" />
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
          <h1 className="text-base font-bold text-slate-900 inline-flex items-center gap-2"><Clock className="h-4 w-4 text-navy-600" /> {t("worker.clockInOut")}</h1>

          {data.activeEntry ? (
            <div className="rounded-xl border border-navy-200 bg-navy-50 p-4 space-y-3 text-center">
              <div className="text-sm text-slate-600">{data.activeEntry.projectName}{data.activeEntry.milestoneTitle ? ` · ${data.activeEntry.milestoneTitle}` : ""}</div>
              <div className="text-3xl font-bold tabular-nums text-navy-700">{elapsedLabel(data.activeEntry.clockInAt!, now)}</div>
              <div className="text-xs text-slate-500">{t("worker.clockedInSince")} {format(new Date(data.activeEntry.clockInAt!), "HH:mm")}</div>
              {clockOut.error && <p className="text-xs text-rose-600">{(clockOut.error as Error).message}</p>}
              <Button className="w-full h-12 rounded-xl text-base gap-2 bg-slate-900 hover:bg-slate-800" disabled={clockOut.isPending} onClick={() => clockOut.mutate(data.activeEntry!.id)}>
                {clockOut.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Square className="h-4 w-4 fill-current" />} {locating && clockOut.isPending ? t("worker.locating") : t("worker.clockOut")}
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">{t("worker.job")}</label>
                {data.jobs.length === 0 ? <p className="text-sm text-slate-500">{t("worker.noJobs")}</p> : (
                  <div className="grid gap-2">
                    {data.jobs.map((j) => (
                      <button key={j.id} onClick={() => { setProjectId(j.id); setMilestoneId(""); }} className={cn("text-left rounded-xl border px-3 py-2.5 transition-colors", projectId === j.id ? "border-navy-500 bg-navy-50 ring-1 ring-navy-500" : "border-slate-200 bg-white active:bg-slate-50")}>
                        <div className="font-medium text-slate-900 text-sm">{j.name}</div>
                        {j.address && <div className="text-xs text-slate-500 truncate">{j.address}</div>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {job && job.milestones.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">{t("worker.phase")}</label>
                  <select value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
                    <option value="">{t("worker.anyPhase")}</option>
                    {job.milestones.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                  </select>
                </div>
              )}

              {clockIn.error && <p className="text-xs text-rose-600">{(clockIn.error as Error).message}</p>}
              {locationOff && <p className="text-[11px] text-amber-600 inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {t("worker.locationOff")}</p>}
              <Button className="w-full h-12 rounded-xl text-base gap-2" disabled={!projectId || clockIn.isPending} onClick={() => clockIn.mutate()}>
                {clockIn.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <MapPin className="h-5 w-5" />} {locating && clockIn.isPending ? t("worker.locating") : t("worker.clockIn")}
              </Button>
            </>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
          <h2 className="text-sm font-bold text-slate-900">{t("worker.orManual")}</h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">{t("worker.date")}</label>
              <Input type="date" value={date} max={isoDay(new Date())} onChange={(e) => setDate(e.target.value)} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">{t("worker.hours")}</label>
              <div className="flex items-center rounded-xl border border-slate-200 bg-white h-11 overflow-hidden">
                <button className="h-full w-11 flex items-center justify-center text-slate-600 active:bg-slate-100" onClick={() => setHours((h) => Math.max(0.5, Math.round((h - 0.5) * 2) / 2))}><Minus className="h-4 w-4" /></button>
                <input type="number" step="0.5" min="0.5" max="24" value={hours} onChange={(e) => setHours(Math.min(24, Math.max(0.5, Number(e.target.value) || 0.5)))} className="flex-1 min-w-0 text-center font-bold text-lg outline-none" />
                <button className="h-full w-11 flex items-center justify-center text-slate-600 active:bg-slate-100" onClick={() => setHours((h) => Math.min(24, Math.round((h + 0.5) * 2) / 2))}><Plus className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[4, 6, 8, 10].map((h) => <button key={h} onClick={() => setHours(h)} className={cn("rounded-full px-3 py-1 text-xs font-medium border", hours === h ? "bg-navy-600 text-white border-navy-600" : "bg-white border-slate-200 text-slate-600")}>{h} h</button>)}
          </div>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("worker.notePlaceholder")} className="h-11 rounded-xl" />

          {add.error && <p className="text-xs text-rose-600">{(add.error as Error).message}</p>}
          <Button className={cn("w-full h-12 rounded-xl text-base gap-2", saved && "bg-emerald-600 hover:bg-emerald-600")} disabled={!projectId || add.isPending} onClick={() => add.mutate()}>
            {add.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : saved ? <CheckCircle2 className="h-5 w-5" /> : null} {saved ? t("worker.saved") : t("worker.submit")}
          </Button>
          <p className="text-[11px] text-slate-400 text-center">{t("worker.approvalHint")}</p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
          <div className="flex items-center justify-between"><h2 className="text-sm font-bold text-slate-900">{t("worker.recent")}</h2><span className="text-xs text-slate-500">{t("worker.thisWeek")}: <span className="font-semibold text-slate-800">{weekTotal} h</span></span></div>
          {closedEntries.length === 0 ? <p className="text-sm text-slate-400 py-3 text-center">{t("worker.noEntries")}</p> : (
            <ul className="divide-y">
              {closedEntries.map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="truncate"><span className="font-medium text-slate-800">{e.hours} h</span> <span className="text-slate-500">· {e.projectName}</span>{e.milestoneTitle ? <span className="text-slate-400"> · {e.milestoneTitle}</span> : null}</div>
                    <div className="text-[11px] text-slate-400">{e.date ? format(day(e.date)!, "EEE d MMM", { locale }) : ""}{e.note ? ` · ${e.note}` : ""}{e.status === "rejected" && e.rejectedReason ? ` · ${e.rejectedReason}` : ""}</div>
                  </div>
                  {e.geofenceFlagged && <span title={t("worker.geofenceFlag")}><MapPin className="h-3.5 w-3.5 text-amber-500 shrink-0" /></span>}
                  <span className={cn("text-[10px] font-medium rounded px-1.5 py-0.5", e.status === "approved" ? "bg-emerald-100 text-emerald-700" : e.status === "rejected" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800")}>{t(`worker.status.${e.status}`)}</span>
                  {e.status === "submitted" && <button className="text-slate-300 hover:text-rose-500" onClick={() => remove.mutate(e.id)}><Trash2 className="h-4 w-4" /></button>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
