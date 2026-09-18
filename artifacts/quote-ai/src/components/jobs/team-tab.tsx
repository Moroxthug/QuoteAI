import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { enCA } from "date-fns/locale";
import { Plus, Trash2, Check, X, Clock, Wrench, Users, ExternalLink, MapPin, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { jobsApi, formatCents, type JobDetailDto, type TimeEntryDto, type UsageUnit } from "@/lib/jobs-api";
import { teamApi } from "@/lib/team-api";

const day = (s: string | null) => (s ? new Date(`${s}T00:00:00`) : null);
const today = () => new Date().toISOString().slice(0, 10);

export function TimeStatusBadge({ status }: { status: TimeEntryDto["status"] }) {
  const { t } = useLanguage();
  const cls = status === "approved" ? "chip-green" : status === "rejected" ? "chip-red" : "chip-yellow";
  return <span className={cn("chip", cls)}>{t(`team.time.status.${status}`)}</span>;
}

/** Compact `.field` control for the inline log-hours / log-usage forms. */
const tight = { padding: "8px 12px", fontSize: 13.5 } as const;

/**
 * Team tab of a job: who is assigned, hours logged on this job (approve /
 * reject / add), and equipment usage. Rates and the worker register live on
 * /dashboard/team.
 */
export function TeamTab({ data, locale }: { data: JobDetailDto; locale: typeof enCA }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { job, assignments, timeEntries, equipmentUsage, milestones } = data;
  const { data: workers } = useQuery({ queryKey: ["workers"], queryFn: teamApi.workers });
  const { data: equipment } = useQuery({ queryKey: ["equipment"], queryFn: teamApi.equipment });
  const refresh = () => { queryClient.invalidateQueries({ queryKey: ["job", job.id] }); queryClient.invalidateQueries({ queryKey: ["workers"] }); queryClient.invalidateQueries({ queryKey: ["time-entries"] }); };
  const onError = (e: Error & { code?: string }) => toast({ title: e.code === "PLAN_REQUIRED" ? t("jobs.planRequired") : t("jobs.error"), description: e.message, variant: "destructive" });

  const assign = useMutation({ mutationFn: (workerId: string) => jobsApi.assign(job.id, { workerId }), onSuccess: refresh, onError });
  const unassign = useMutation({ mutationFn: (aid: string) => jobsApi.unassign(job.id, aid), onSuccess: refresh, onError });
  const addWorker = useMutation({ mutationFn: (v: { name: string; hourlyRateCents?: number }) => teamApi.addWorker(v), onSuccess: async (r) => { await assign.mutateAsync(r.worker.id); setName(""); setRate(""); }, onError });
  const setStatus = useMutation({ mutationFn: ({ id, status }: { id: string; status: TimeEntryDto["status"] }) => teamApi.updateTimeEntry(id, { status }), onSuccess: refresh, onError });
  const delTime = useMutation({ mutationFn: (id: string) => teamApi.deleteTimeEntry(id), onSuccess: refresh, onError });
  const addTime = useMutation({ mutationFn: (v: { workerId: string; date: string; hours: number; milestoneId: string | null; note: string }) => jobsApi.addTimeEntry(job.id, v), onSuccess: () => { refresh(); setTime({ ...time, hours: "", note: "" }); }, onError });
  const addUsage = useMutation({ mutationFn: (v: { equipmentId: string; date: string; quantity: number; unit: UsageUnit; note: string }) => jobsApi.addEquipmentUsage(job.id, v), onSuccess: () => { refresh(); setUsage({ ...usage, quantity: "", note: "" }); }, onError });
  const delUsage = useMutation({ mutationFn: (uid: string) => jobsApi.deleteEquipmentUsage(job.id, uid), onSuccess: refresh, onError });
  const [locating, setLocating] = useState(false);
  const setLocation = useMutation({
    mutationFn: (v: { latitude: number | null; longitude: number | null }) => jobsApi.update(job.id, v),
    onSuccess: refresh,
    onError,
  });
  const setRadius = useMutation({ mutationFn: (v: number | null) => jobsApi.update(job.id, { geofenceRadiusMeters: v }), onSuccess: refresh, onError });
  const useMyLocation = () => {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocating(false); setLocation.mutate({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }); },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const [name, setName] = useState("");
  const [rate, setRate] = useState("");
  const [pick, setPick] = useState("");
  const [time, setTime] = useState({ workerId: "", date: today(), hours: "", milestoneId: "", note: "" });
  const [usage, setUsage] = useState({ equipmentId: "", date: today(), quantity: "", note: "" });

  const activeWorkers = (workers?.items ?? []).filter((w) => w.active);
  const available = activeWorkers.filter((w) => !assignments.some((a) => a.collaboratorId === w.id));
  const timeWorkers = assignments.length ? activeWorkers.filter((w) => assignments.some((a) => a.collaboratorId === w.id)) : activeWorkers;
  const activeEquipment = (equipment?.items ?? []).filter((e) => e.active);
  const pendingHours = timeEntries.filter((e) => e.status === "submitted");
  const approvedCents = timeEntries.filter((e) => e.status === "approved").reduce((s, e) => s + e.costCents, 0);
  const approvedHours = timeEntries.filter((e) => e.status === "approved").reduce((s, e) => s + e.hours, 0);
  const usageCents = equipmentUsage.reduce((s, u) => s + u.costCents, 0);
  const selectedEquipment = activeEquipment.find((e) => e.id === usage.equipmentId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 stack">
        {/* Hours */}
        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="inline-flex items-center gap-2"><Clock className="h-4 w-4" /> {t("jobs.team.hours")}</h2>
              <p className="sub">{approvedHours.toFixed(1)} h {t("jobs.team.approved")} · {formatCents(approvedCents)}{pendingHours.length ? <span style={{ color: "var(--yellow-dark)" }}> · {pendingHours.length} {t("jobs.team.pending")}</span> : null}</p>
            </div>
          </div>
          <form className="grid grid-cols-2 xl:grid-cols-[1fr_140px_80px_1fr_auto] gap-2 px-[22px] py-4" style={{ borderBottom: "1px solid var(--soft)" }} onSubmit={(e) => { e.preventDefault(); if (time.workerId && time.hours) addTime.mutate({ workerId: time.workerId, date: time.date, hours: Number(time.hours), milestoneId: time.milestoneId || null, note: time.note.trim() }); }}>
            <div className="field col-span-2 xl:col-span-1">
              <select value={time.workerId} onChange={(e) => setTime({ ...time, workerId: e.target.value })} style={tight}>
                <option value="">{t("jobs.team.pickWorker")}</option>
                {timeWorkers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="field"><input type="date" value={time.date} onChange={(e) => setTime({ ...time, date: e.target.value })} style={tight} /></div>
            <div className="field"><input type="number" step="0.25" min="0.25" max="24" value={time.hours} onChange={(e) => setTime({ ...time, hours: e.target.value })} placeholder="h" style={tight} /></div>
            {milestones.length > 0 ? (
              <div className="field">
                <select value={time.milestoneId} onChange={(e) => setTime({ ...time, milestoneId: e.target.value })} style={tight}>
                  <option value="">{t("jobs.costs.wholeJob")}</option>
                  {milestones.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
              </div>
            ) : (
              <div className="field"><input value={time.note} onChange={(e) => setTime({ ...time, note: e.target.value })} placeholder={t("jobs.team.notePlaceholder")} style={tight} /></div>
            )}
            <button type="submit" className="btn btn-sm btn-navy col-span-2 xl:col-span-1" disabled={!time.workerId || !time.hours || addTime.isPending}><Plus className="h-4 w-4" /> {t("jobs.team.logHours")}</button>
          </form>
          {activeWorkers.length === 0 && <p className="field-hint px-[22px] pt-3">{t("jobs.team.noWorkersHint")} <Link href="/dashboard/team" className="text-link">{t("jobs.team.openTeam")}</Link></p>}
          {timeEntries.length === 0 ? <div className="card-empty">{t("jobs.team.noHours")}</div> : (
            <div>
              {timeEntries.map((e) => (
                <div key={e.id} className={cn("item-row", e.status === "rejected" && "muted")}>
                  <span className="date">{e.date ? format(day(e.date)!, "d MMM yy", { locale }) : "—"}</span>
                  <div className="grow">
                    <span className="ttl"><b>{e.workerName}</b> <span style={{ color: "var(--muted-mk)" }}>· {e.hours} h</span>{e.milestoneTitle ? <span style={{ color: "var(--faint)" }}> · {e.milestoneTitle}</span> : null}</span>
                    {e.note && <span className="sub">{e.note}</span>}
                  </div>
                  {e.geofenceFlagged && <span title={t("team.time.geofenceFlag")}><MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--yellow-dark)" }} /></span>}
                  <TimeStatusBadge status={e.status} />
                  <span className={cn("amt w-20 text-right", e.status !== "approved" && "faint")}>{formatCents(e.costCents)}</span>
                  <div className="flex gap-1 shrink-0 items-center">
                    {e.status === "submitted" && <button type="button" title={t("jobs.team.approve")} className="ic-btn ok" onClick={() => setStatus.mutate({ id: e.id, status: "approved" })}><Check /></button>}
                    {e.status === "submitted" && <button type="button" title={t("jobs.team.reject")} className="ic-btn bad" onClick={() => setStatus.mutate({ id: e.id, status: "rejected" })}><X /></button>}
                    <div className="hover-act">
                      {e.status !== "submitted" && <button type="button" title={t("jobs.team.reopen")} className="text-link" style={{ fontSize: 12 }} onClick={() => setStatus.mutate({ id: e.id, status: "submitted" })}>{t("jobs.team.reopen")}</button>}
                      <button type="button" className="ic-btn danger" onClick={() => delTime.mutate(e.id)}><Trash2 /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Equipment */}
        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="inline-flex items-center gap-2"><Wrench className="h-4 w-4" /> {t("jobs.team.equipment")}</h2>
              <p className="sub">{t("jobs.team.equipmentCharged")} {formatCents(usageCents)}</p>
            </div>
          </div>
          {activeEquipment.length === 0 ? (
            <p className="field-hint px-[22px] py-4">{t("jobs.team.noEquipmentHint")} <Link href="/dashboard/team?tab=equipment" className="text-link">{t("jobs.team.openTeam")}</Link></p>
          ) : (
            <form className="grid grid-cols-2 xl:grid-cols-[1fr_140px_90px_1fr_auto] gap-2 px-[22px] py-4" style={{ borderBottom: equipmentUsage.length ? "1px solid var(--soft)" : undefined }} onSubmit={(e) => { e.preventDefault(); if (usage.equipmentId && usage.quantity && selectedEquipment) addUsage.mutate({ equipmentId: usage.equipmentId, date: usage.date, quantity: Number(usage.quantity), unit: selectedEquipment.usageUnit, note: usage.note.trim() }); }}>
              <div className="field col-span-2 xl:col-span-1">
                <select value={usage.equipmentId} onChange={(e) => setUsage({ ...usage, equipmentId: e.target.value })} style={tight}>
                  <option value="">{t("jobs.team.pickEquipment")}</option>
                  {activeEquipment.map((eq) => <option key={eq.id} value={eq.id}>{eq.name} · {formatCents(eq.usageRateCents)}/{t(`team.unit.${eq.usageUnit}`)}</option>)}
                </select>
              </div>
              <div className="field"><input type="date" value={usage.date} onChange={(e) => setUsage({ ...usage, date: e.target.value })} style={tight} /></div>
              <div className="field"><input type="number" step="0.5" min="0.25" value={usage.quantity} onChange={(e) => setUsage({ ...usage, quantity: e.target.value })} placeholder={selectedEquipment ? t(`team.unit.${selectedEquipment.usageUnit}`) : "#"} style={tight} /></div>
              <div className="field"><input value={usage.note} onChange={(e) => setUsage({ ...usage, note: e.target.value })} placeholder={t("jobs.team.notePlaceholder")} style={tight} /></div>
              <button type="submit" className="btn btn-sm btn-navy col-span-2 xl:col-span-1" disabled={!usage.equipmentId || !usage.quantity || addUsage.isPending}><Plus className="h-4 w-4" /> {t("jobs.team.logUsage")}</button>
            </form>
          )}
          {equipmentUsage.length > 0 && (
            <div>
              {equipmentUsage.map((u) => (
                <div key={u.id} className="item-row">
                  <span className="date">{u.date ? format(day(u.date)!, "d MMM yy", { locale }) : "—"}</span>
                  <div className="grow"><span className="ttl"><b>{u.equipmentName}</b> <span style={{ color: "var(--muted-mk)" }}>· {u.quantity} {t(`team.unit.${u.unit}`)}</span>{u.note ? <span style={{ color: "var(--faint)" }}> · {u.note}</span> : null}</span></div>
                  <span className="amt">{formatCents(u.costCents)}</span>
                  <div className="hover-act"><button type="button" className="ic-btn danger" onClick={() => delUsage.mutate(u.id)}><Trash2 /></button></div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Assigned */}
      <div className="stack">
        <section className="card">
          <div className="card-head">
            <div><h2 className="inline-flex items-center gap-2"><Users className="h-4 w-4" /> {t("jobs.team.assigned")}</h2></div>
            <Link href="/dashboard/team" className="text-link">{t("jobs.team.openTeam")} <ExternalLink /></Link>
          </div>
          {assignments.length === 0 ? <div className="card-empty">{t("jobs.team.empty")}</div> : (
            <div>
              {assignments.map((a) => (
                <div key={a.id} className="item-row">
                  <span className="avat">{a.collaboratorName.slice(0, 2)}</span>
                  <div className="grow"><b className="ttl">{a.collaboratorName}</b><span className="sub">{a.collaboratorRole}{a.collaboratorHourlyRate ? ` · ${formatCents(a.collaboratorHourlyRate)}/h` : ""}</span></div>
                  <div className="hover-act"><button type="button" className="ic-btn danger" onClick={() => unassign.mutate(a.id)}><Trash2 /></button></div>
                </div>
              ))}
            </div>
          )}
          {available.length > 0 && (
            <div className="flex gap-2 px-[22px] py-4" style={{ borderTop: "1px solid var(--soft)" }}>
              <div className="field flex-1">
                <select value={pick} onChange={(e) => setPick(e.target.value)} style={tight}>
                  <option value="">{t("jobs.team.pick")}</option>
                  {available.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <button type="button" className="btn btn-sm btn-navy" disabled={!pick || assign.isPending} onClick={() => { assign.mutate(pick); setPick(""); }}>{t("jobs.team.assign")}</button>
            </div>
          )}
          <form className="stack px-[22px] py-4" style={{ gap: 8, borderTop: "1px solid var(--soft)" }} onSubmit={(e) => { e.preventDefault(); if (name.trim()) addWorker.mutate({ name: name.trim(), hourlyRateCents: rate ? Math.round(Number(rate) * 100) : undefined }); }}>
            <div className="field">
              <label>{t("jobs.team.newWorker")}</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("jobs.team.namePlaceholder")} style={tight} />
            </div>
            <div className="field"><input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder={t("jobs.team.ratePlaceholder")} style={tight} /></div>
            <button type="submit" className="btn btn-sm btn-outline-navy w-full" disabled={!name.trim() || addWorker.isPending}>{t("jobs.team.addAndAssign")}</button>
            <p className="field-hint">{t("jobs.team.assignHint")}</p>
          </form>
        </section>

        {/* Geofence */}
        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="inline-flex items-center gap-2"><MapPin className="h-4 w-4" /> {t("jobs.team.geofenceTitle")}</h2>
              <p className="sub">{t("jobs.team.geofenceHint")}</p>
            </div>
          </div>
          <div className="act-body stack" style={{ gap: 12 }}>
            <button type="button" className="btn btn-sm btn-outline-navy w-full" disabled={locating} onClick={useMyLocation}>
              {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />} {job.latitude ? t("jobs.team.updateLocation") : t("jobs.team.useMyLocation")}
            </button>
            {job.latitude && job.longitude && (
              <div className="field">
                <label>{t("jobs.team.radiusLabel")}</label>
                <select value={job.geofenceRadiusMeters ?? ""} onChange={(e) => setRadius.mutate(e.target.value ? Number(e.target.value) : null)} style={tight}>
                  <option value="">{t("jobs.team.radiusOff")}</option>
                  {[100, 250, 500, 1000, 2000].map((r) => <option key={r} value={r}>{r} m</option>)}
                </select>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
