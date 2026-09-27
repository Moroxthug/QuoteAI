import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { AlertTriangle, CalendarDays, Camera, Car, ChevronDown, ChevronRight, Clock, CloudUpload, Loader2, MapPin, MessageSquareText, Phone, Square, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { workerApi, type WorkerPageDto } from "@/lib/team-api";
import { Logo } from "@/components/logo";
import { OfflineBar } from "@/components/pwa/offline-bar";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { runOrQueue, enqueue, useOutbox } from "@/lib/offline/outbox";
import { ActionSheet } from "@/components/mobile/action-sheet";
import { BottomSheet } from "@/components/mobile/bottom-sheet";
import { StickyActionBar } from "@/components/mobile/sticky-action-bar";
import { WorkerToday, mapsUrl } from "@/components/crew/worker-today";
import { WorkerChanges } from "@/components/crew/worker-changes";
import { FieldReportCard } from "@/components/crew/field-report";
import { TravelCard } from "@/components/crew/travel-card";
import { ManualHoursForm, WorkerHoursList, isoDay } from "@/components/crew/worker-hours";

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

type Block = { id: string; startsAt: string; endsAt: string; allDay: boolean; notes: string };

/** Today's shift that is on now, else the next one today, else the first — with its job. */
function currentShift(data: WorkerPageDto, now: number) {
  const all = data.todayJobs.flatMap((job) => job.blocks.map((b) => ({ job, b })));
  return (
    all.find(({ b }) => !b.allDay && new Date(b.startsAt).getTime() <= now && new Date(b.endsAt).getTime() > now) ??
    all.find(({ b }) => new Date(b.endsAt).getTime() > now) ??
    all[0] ??
    null
  );
}

type Sheet = null | "job" | "report" | "hours" | "travel";

/**
 * Public worker time-entry page. No login: the magic-link token identifies
 * the worker. Built for a phone on site — pick the job, tap the hours, done.
 *
 * Phase 77: works with no signal. Clock in/out and hours go through the
 * offline outbox (src/lib/offline/outbox.ts) — a tap is saved on the phone
 * with its real time and replayed on reconnect; a clock-in that has not
 * synced yet still shows its running timer here and can be clocked out.
 *
 * Phase 86: the crew's app — today's jobs, tasks, the schedule, "report from
 * site" (a photo, a blocker, materials used), which also queues offline.
 *
 * Phase 108: one screen, not four. **Now** comes first — the shift that is on
 * (or next), its address one tap to Maps, the site contact and the gate code,
 * and Clock in / out as the big button. Then today's tasks as a checklist,
 * what is coming up, and the week's hours. Report and Photo are docked at the
 * bottom and open a sheet; hours by hand and travel are behind ⋯. "Since you
 * last looked" is a count chip in the header, and the company switch (two
 * group companies) is the company name in the header.
 */
export default function WorkerTimePage() {
  const { token: linkToken } = useParams<{ token: string }>();
  // Phase 90: the same person on another group company's crew — one link, a company switch.
  // `<link>~<workerId>` is what the API reads; the choice survives a reload through ?as=.
  const [asWorker, setAsWorker] = useState<string | null>(() => new URLSearchParams(window.location.search).get("as"));
  const token = linkToken && asWorker ? `${linkToken}~${asWorker}` : linkToken;
  const { t, lang, setLang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["worker", token], queryFn: () => workerApi.get(token!), enabled: !!token, retry: false });
  useEffect(() => { if (data?.language) setLang(data.language); }, [data?.language, setLang]);

  const [projectId, setProjectId] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [locating, setLocating] = useState(false);
  const [locationOff, setLocationOff] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [sheet, setSheet] = useState<Sheet>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const switchCompany = (c: { workerId: string; primary: boolean }) => {
    const next = c.primary ? null : c.workerId;
    setAsWorker(next);
    setProjectId("");
    setMilestoneId("");
    const u = new URL(window.location.href);
    if (next) u.searchParams.set("as", next);
    else u.searchParams.delete("as");
    window.history.replaceState(null, "", u.toString());
  };
  useDocumentTitle(`${t("worker.clockInOut")} · ${data?.companyName ?? "QuoteAI"}`);

  const outbox = useOutbox(token);
  // A clock-in saved on this phone that the server has not seen yet (and no queued clock-out for it).
  const pendingClockIn = useMemo(() => {
    const rows = outbox.rows.filter((r) => r.status === "pending");
    return rows.find((r) => r.op.kind === "worker.clockIn" && !rows.some((o) => o.op.kind === "worker.clockOut" && o.op.entryClientRef === r.id)) ?? null;
  }, [outbox.rows]);
  const pendingOp = pendingClockIn?.op.kind === "worker.clockIn" ? pendingClockIn.op : null;
  const running = !!(pendingOp || data?.activeEntry);
  // The timer and "which shift is on" move with the clock.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const shift = data ? currentShift(data, now) : null;
  // What the Now card is about before anyone picks: today's shift, else the only job.
  const suggested = shift?.job.id ?? (data?.jobs.length === 1 ? data.jobs[0]!.id : "");
  useEffect(() => { if (!projectId && suggested) setProjectId(suggested); }, [projectId, suggested]);

  const jobName = (id: string) => data?.jobs.find((j) => j.id === id)?.name ?? "";

  const clockIn = useMutation({
    mutationFn: async () => {
      setLocating(true);
      const loc = await getLocation();
      setLocating(false);
      setLocationOff(!loc);
      const at = new Date().toISOString();
      const op = { kind: "worker.clockIn" as const, token: token!, projectId, milestoneId: milestoneId || null, lat: loc?.lat, lng: loc?.lng, at };
      return runOrQueue(op, { scope: token!, label: `${t("worker.clockIn")} · ${jobName(projectId)}` }, (clientRef) => workerApi.clockIn(token!, { projectId, milestoneId: milestoneId || null, lat: loc?.lat, lng: loc?.lng, at, clientRef }));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["worker", token] }),
  });
  const clockOut = useMutation({
    mutationFn: async (target: { entryId: string } | { entryClientRef: string }) => {
      setLocating(true);
      const loc = await getLocation();
      setLocating(false);
      const at = new Date().toISOString();
      const label = `${t("worker.clockOut")} · ${"entryId" in target ? (data?.activeEntry?.projectName ?? "") : jobName(pendingOp?.projectId ?? "")}`;
      // The clock-in itself is still queued: the clock-out must follow it in the same queue.
      if ("entryClientRef" in target) return { queued: true as const, row: await enqueue({ kind: "worker.clockOut", token: token!, entryClientRef: target.entryClientRef, lat: loc?.lat, lng: loc?.lng, at }, { scope: token!, label }) };
      return runOrQueue({ kind: "worker.clockOut", token: token!, entryId: target.entryId, lat: loc?.lat, lng: loc?.lng, at }, { scope: token!, label }, () => workerApi.clockOut(token!, { entryId: target.entryId, lat: loc?.lat, lng: loc?.lng, at }));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["worker", token] }),
  });

  if (isLoading) return <div className="doc-shell flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--navy)" }} /></div>;
  if (error || !data) {
    const code = (error as Error & { code?: string })?.code;
    const offline = code === "OFFLINE" || error instanceof TypeError;
    return (
      <div className="doc-shell flex items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-3">
          {offline ? <WifiOff className="h-10 w-10 mx-auto" style={{ color: "var(--muted-mk)" }} /> : <AlertTriangle className="h-10 w-10 mx-auto" style={{ color: "var(--yellow-dark)" }} />}
          <h1 className="text-lg font-bold" style={{ color: "var(--navy)" }}>{offline ? t("worker.offlineTitle") : code === "EXPIRED" ? t("worker.expiredTitle") : t("worker.invalidTitle")}</h1>
          <p className="text-sm" style={{ color: "var(--muted-mk)" }}>{offline ? t("worker.offlineBody") : code === "EXPIRED" ? t("worker.expiredBody") : t("worker.invalidBody")}</p>
          {offline && <button type="button" className="btn btn-navy" onClick={() => window.location.reload()}>{t("offline.retry")}</button>}
        </div>
      </div>
    );
  }

  // The job the Now card is about: the running clock's, else the one picked (or suggested).
  const nowJobId = pendingOp?.projectId ?? data.activeEntry?.projectId ?? projectId;
  const nowJob = data.jobs.find((j) => j.id === nowJobId) ?? null;
  const nowToday = data.todayJobs.find((j) => j.id === nowJobId) ?? null;
  const nowBlock: Block | null = shift && shift.job.id === nowJobId ? shift.b : (nowToday?.blocks[0] ?? null);
  const address = nowToday?.address || nowJob?.address || null;
  const hm = (iso: string) => format(new Date(iso), "H:mm", { locale });
  const blockTime = (b: Block) => (b.allDay ? t("worker.allDay") : `${hm(b.startsAt)}–${hm(b.endsAt)}`);
  const phaseTitle = (pid: string, mid: string | null | undefined) => (mid ? data.jobs.find((j) => j.id === pid)?.milestones.find((m) => m.id === mid)?.title ?? "" : "");
  const defaultJobId = data.activeEntry?.projectId ?? (nowJobId || null);
  // Today's shifts on the Now job are in the Now card; the list below is what comes after.
  const nowBlockIds = new Set((nowToday?.blocks ?? []).map((b) => b.id));
  const comingUp = data.schedule.filter((b) => !nowBlockIds.has(b.id) && new Date(b.endsAt).getTime() > now);
  const travelOn = !!data.travel && (data.travel.km || data.travel.perDiem);
  const current = data.companies.find((c) => c.current);

  const eyebrow = running ? t("worker.m.onTheClock") : nowBlock ? `${t("worker.today")} · ${blockTime(nowBlock)}` : t("worker.m.now");

  return (
    <div className="doc-shell">
      <header className="doc-head">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-bold truncate text-base" style={{ color: "var(--navy)" }}>{data.worker.name}</h1>
            {data.companies.length > 1 ? (
              <ActionSheet
                title={t("worker.companies")}
                align="start"
                actions={data.companies.map((c) => ({ label: c.current ? `${c.companyName} · ${t("worker.m.current")}` : c.companyName, disabled: c.current, onSelect: () => switchCompany(c) }))}
                trigger={
                  <button type="button" className="w-company" aria-label={`${t("worker.m.switchCompany")} — ${current?.companyName ?? data.companyName}`}>
                    <span className="truncate">{data.companyName}</span> <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  </button>
                }
              />
            ) : (
              <div className="text-xs truncate" style={{ color: "var(--muted-mk)" }}>{data.companyName}</div>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <WorkerChanges token={token!} changes={data.changes} upTo={data.changesUpTo} />
            <button type="button" className="w-lang" onClick={() => setLang(lang === "fr" ? "en" : "fr")} aria-label={lang === "fr" ? "English" : "Français"}>{lang === "fr" ? "EN" : "FR"}</button>
            <Logo className="h-5 hide-phone" />
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        <OfflineBar scope={token} />

        {/* ── Now ─────────────────────────────────────────────────────── */}
        <section className={cn("card w-now", running && "on")} aria-labelledby="w-now-h">
          <p className="w-now-eyebrow">{running && <span className="w-live" aria-hidden="true" />}{eyebrow}</p>
          {data.jobs.length === 0 && !running ? (
            <p className="text-sm" style={{ color: "var(--muted-mk)" }}>{t("worker.noJobs")}</p>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <h2 id="w-now-h" className="w-now-title">
                  {pendingOp ? jobName(pendingOp.projectId) : data.activeEntry ? data.activeEntry.projectName : nowJob?.name ?? t("crew.pickJob")}
                  {(() => {
                    const ph = pendingOp ? phaseTitle(pendingOp.projectId, pendingOp.milestoneId) : data.activeEntry ? data.activeEntry.milestoneTitle : phaseTitle(projectId, milestoneId);
                    return ph ? <span className="w-now-phase">{ph}</span> : null;
                  })()}
                </h2>
                {!running && data.jobs.length > 1 && (
                  <button type="button" className="text-link shrink-0 mt-1" onClick={() => setSheet("job")}>{t("worker.m.changeJob")}</button>
                )}
              </div>

              {running && (
                <div className="w-timer">
                  <span className="w-timer-n">{elapsedLabel(pendingOp?.at ?? data.activeEntry!.clockInAt!, now)}</span>
                  <span className="w-timer-s">{t("worker.clockedInSince")} {format(new Date(pendingOp?.at ?? data.activeEntry!.clockInAt!), "HH:mm")}</span>
                  {pendingOp && <span className="w-timer-s inline-flex items-center gap-1" style={{ color: "var(--teal-dark)" }}><CloudUpload className="h-3 w-3" /> {t("worker.pendingSync")}</span>}
                </div>
              )}

              {(address || nowToday?.contact || (nowToday?.blocks ?? []).some((b) => b.notes)) && (
                <ul className="w-now-rows">
                  {address && (
                    <li>
                      <a className="w-now-row" href={mapsUrl(address)} target="_blank" rel="noopener noreferrer">
                        <MapPin aria-hidden="true" /> <span className="grow">{address}</span> <span className="w-now-go">{t("worker.m.maps")}<ChevronRight aria-hidden="true" /></span>
                      </a>
                    </li>
                  )}
                  {nowToday?.contact?.phone && (
                    <li>
                      <a className="w-now-row" href={`tel:${nowToday.contact.phone.replace(/[^\d+]/g, "")}`}>
                        <Phone aria-hidden="true" /> <span className="grow">{t("crew.call")} {nowToday.contact.name}</span> <ChevronRight className="w-now-chev" aria-hidden="true" />
                      </a>
                    </li>
                  )}
                  {nowToday?.contact && !nowToday.contact.phone && (
                    <li className="w-now-row static"><Phone aria-hidden="true" /> <span className="grow">{t("crew.siteContact")}: {nowToday.contact.name}</span></li>
                  )}
                  {(nowToday?.blocks ?? []).filter((b) => b.notes).map((b) => (
                    <li key={b.id} className="w-now-note">{b.notes}</li>
                  ))}
                </ul>
              )}

              {!running && nowJob && nowJob.milestones.length > 0 && (
                <div className="field">
                  <label htmlFor="worker-phase">{t("worker.phase")}</label>
                  <select id="worker-phase" value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)}>
                    <option value="">{t("worker.anyPhase")}</option>
                    {nowJob.milestones.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                  </select>
                </div>
              )}

              {running ? (
                <>
                  {clockOut.error && <p className="text-xs" role="alert" style={{ color: "var(--red)" }}>{(clockOut.error as Error).message}</p>}
                  <button type="button" className="btn btn-navy w-full w-big" disabled={clockOut.isPending} onClick={() => clockOut.mutate(pendingOp ? { entryClientRef: pendingClockIn!.id } : { entryId: data.activeEntry!.id })}>
                    {clockOut.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Square className="h-4 w-4 fill-current" />} {locating && clockOut.isPending ? t("worker.locating") : t("worker.clockOut")}
                  </button>
                </>
              ) : (
                <>
                  {clockIn.error && <p className="text-xs" role="alert" style={{ color: "var(--red)" }}>{(clockIn.error as Error).message}</p>}
                  {locationOff && <p className="text-[11px] inline-flex items-center gap-1" style={{ color: "var(--yellow-dark)" }}><MapPin className="h-3 w-3" /> {t("worker.locationOff")}</p>}
                  <button type="button" className="btn btn-navy w-full w-big" disabled={!projectId || clockIn.isPending} onClick={() => clockIn.mutate()}>
                    {clockIn.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Clock className="h-5 w-5" />} {locating && clockIn.isPending ? t("worker.locating") : t("worker.clockIn")}
                  </button>
                </>
              )}
            </>
          )}
        </section>

        <WorkerToday token={token!} jobs={data.todayJobs} canAddTasks={data.worker.canAddTasks} nowJobId={nowJobId || null} />

        {comingUp.length > 0 && (
          <section className="card p-4 space-y-1" aria-labelledby="w-next-h">
            <h2 id="w-next-h" className="text-sm font-bold inline-flex items-center gap-2" style={{ color: "var(--navy)" }}><CalendarDays className="h-4 w-4" /> {t("worker.m.comingUp")}</h2>
            <ul className="divide-y" style={{ borderColor: "var(--soft)" }}>
              {comingUp.slice(0, 5).map((b) => {
                const s = new Date(b.startsAt);
                return (
                  <li key={b.id} className="py-2 text-sm" style={{ borderColor: "var(--soft)" }}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold" style={{ color: isoDay(s) === data.today ? "var(--teal-dark)" : "var(--ink)" }}>{isoDay(s) === data.today ? t("worker.today") : format(s, "EEE d MMM", { locale })}</span>
                      <span className="text-xs tabular-nums" style={{ color: "var(--muted-mk)" }}>{blockTime(b)}</span>
                    </div>
                    <div className="truncate" style={{ color: "var(--navy)" }}>{b.label}{b.milestoneTitle ? ` · ${b.milestoneTitle}` : ""}</div>
                    {b.address && <div className="text-xs truncate" style={{ color: "var(--muted-mk)" }}>{b.address}</div>}
                    {b.notes && <div className="text-xs" style={{ color: "var(--muted-mk)" }}>{b.notes}</div>}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <WorkerHoursList token={token!} entries={data.entries} jobs={data.jobs} />

        <InstallPrompt compact />

        <StickyActionBar label={t("worker.m.actions")}>
          <ActionSheet
            actions={[
              { label: t("worker.m.hoursByHand"), icon: Clock, onSelect: () => setSheet("hours") },
              travelOn && { label: t("crew.travel.title"), icon: Car, onSelect: () => setSheet("travel") },
            ]}
          />
          {data.jobs.length > 0 && (
            <>
              <button type="button" className="btn btn-outline-navy secondary" onClick={() => photoInput.current?.click()}>
                <Camera className="h-4 w-4" /> {t("worker.m.photo")}
              </button>
              <button type="button" className="btn btn-navy" data-primary-action onClick={() => { setPhoto(null); setSheet("report"); }}>
                <MessageSquareText className="h-4 w-4" /> {t("worker.m.report")}
              </button>
            </>
          )}
        </StickyActionBar>
        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            e.target.value = "";
            if (!f) return;
            setPhoto(f);
            setSheet("report");
          }}
        />
      </main>

      <BottomSheet open={sheet === "job"} onOpenChange={(o) => !o && setSheet(null)} title={t("worker.m.pickJob")} flush>
        <ul className="lrows" role="radiogroup" aria-label={t("worker.job")}>
          {data.jobs.map((j) => (
            <li key={j.id}>
              <button
                type="button"
                role="radio"
                aria-checked={projectId === j.id}
                className={cn("lrow", projectId === j.id && "on")}
                onClick={() => { setProjectId(j.id); setMilestoneId(""); setSheet(null); }}
              >
                <span className="lrow-main">
                  <span className="lrow-title">{j.name}</span>
                  {j.address && <span className="lrow-meta">{j.address}</span>}
                </span>
                {data.todayJobs.some((x) => x.id === j.id) && <span className="chip chip-teal">{t("worker.today")}</span>}
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>

      <BottomSheet open={sheet === "report"} onOpenChange={(o) => { if (!o) { setSheet(null); setPhoto(null); } }} title={t("crew.reportTitle")}>
        <FieldReportCard bare token={token!} jobs={data.jobs} defaultJobId={defaultJobId} reports={data.reports} initialPhoto={photo} onSent={() => { setSheet(null); setPhoto(null); }} />
      </BottomSheet>

      <BottomSheet open={sheet === "hours"} onOpenChange={(o) => !o && setSheet(null)} title={t("worker.m.hoursByHand")}>
        <ManualHoursForm token={token!} jobs={data.jobs} defaultJobId={defaultJobId} onSaved={() => setSheet(null)} />
      </BottomSheet>

      {data.travel && (
        <BottomSheet open={sheet === "travel"} onOpenChange={(o) => !o && setSheet(null)} title={t("crew.travel.title")}>
          <TravelCard bare token={token!} jobs={data.jobs} today={data.today} defaultJobId={defaultJobId} travel={data.travel} allowances={data.allowances} />
        </BottomSheet>
      )}
    </div>
  );
}
