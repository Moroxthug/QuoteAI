import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { enCA } from "date-fns/locale";
import { Plus, Trash2, Check, X, Clock, Wrench, Users, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { jobsApi, formatCents, type JobDetailDto, type TimeEntryDto, type UsageUnit } from "@/lib/jobs-api";
import { teamApi } from "@/lib/team-api";

const day = (s: string | null) => (s ? new Date(`${s}T00:00:00`) : null);
const today = () => new Date().toISOString().slice(0, 10);

export function TimeStatusBadge({ status }: { status: TimeEntryDto["status"] }) {
  const { t } = useLanguage();
  const cls = status === "approved" ? "bg-emerald-100 text-emerald-700" : status === "rejected" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800";
  return <span className={cn("text-[10px] font-medium rounded px-1.5 py-0.5", cls)}>{t(`team.time.status.${status}`)}</span>;
}

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
      <div className="lg:col-span-2 space-y-4">
        {/* Hours */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900 inline-flex items-center gap-2"><Clock className="h-4 w-4 text-violet-600" /> {t("jobs.team.hours")}</h2>
            <div className="text-xs text-slate-500">{approvedHours.toFixed(1)} h {t("jobs.team.approved")} · <span className="font-medium text-slate-800">{formatCents(approvedCents)}</span>{pendingHours.length ? <span className="ml-2 text-amber-700">{pendingHours.length} {t("jobs.team.pending")}</span> : null}</div>
          </div>
          <form className="grid grid-cols-2 xl:grid-cols-[1fr_130px_80px_1fr_auto] gap-2" onSubmit={(e) => { e.preventDefault(); if (time.workerId && time.hours) addTime.mutate({ workerId: time.workerId, date: time.date, hours: Number(time.hours), milestoneId: time.milestoneId || null, note: time.note.trim() }); }}>
            <select value={time.workerId} onChange={(e) => setTime({ ...time, workerId: e.target.value })} className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm col-span-2 xl:col-span-1">
              <option value="">{t("jobs.team.pickWorker")}</option>
              {timeWorkers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <Input type="date" value={time.date} onChange={(e) => setTime({ ...time, date: e.target.value })} className="h-9" />
            <Input type="number" step="0.25" min="0.25" max="24" value={time.hours} onChange={(e) => setTime({ ...time, hours: e.target.value })} placeholder="h" className="h-9" />
            {milestones.length > 0 ? (
              <select value={time.milestoneId} onChange={(e) => setTime({ ...time, milestoneId: e.target.value })} className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm">
                <option value="">{t("jobs.costs.wholeJob")}</option>
                {milestones.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
            ) : (
              <Input value={time.note} onChange={(e) => setTime({ ...time, note: e.target.value })} placeholder={t("jobs.team.notePlaceholder")} className="h-9" />
            )}
            <Button type="submit" size="sm" className="h-9 gap-1 col-span-2 xl:col-span-1" disabled={!time.workerId || !time.hours || addTime.isPending}><Plus className="h-4 w-4" /> {t("jobs.team.logHours")}</Button>
          </form>
          {activeWorkers.length === 0 && <p className="text-xs text-slate-400">{t("jobs.team.noWorkersHint")} <Link href="/dashboard/team" className="text-violet-600 underline">{t("jobs.team.openTeam")}</Link></p>}
          {timeEntries.length === 0 ? <p className="text-sm text-slate-400 py-4 text-center">{t("jobs.team.noHours")}</p> : (
            <ul className="divide-y">
              {timeEntries.map((e) => (
                <li key={e.id} className={cn("flex items-center gap-3 py-2 text-sm group", e.status === "rejected" && "opacity-60")}>
                  <span className="text-xs text-slate-400 w-20 shrink-0">{e.date ? format(day(e.date)!, "d MMM yy", { locale }) : "—"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate"><span className="font-medium text-slate-800">{e.workerName}</span> <span className="text-slate-500">· {e.hours} h</span>{e.milestoneTitle ? <span className="text-slate-400"> · {e.milestoneTitle}</span> : null}</div>
                    {e.note && <div className="text-[11px] text-slate-400 truncate">{e.note}</div>}
                  </div>
                  <TimeStatusBadge status={e.status} />
                  <span className="font-medium whitespace-nowrap w-20 text-right">{e.status === "approved" ? formatCents(e.costCents) : <span className="text-slate-400">{formatCents(e.costCents)}</span>}</span>
                  <div className="flex gap-1 shrink-0">
                    {e.status === "submitted" && <button title={t("jobs.team.approve")} className="h-7 w-7 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center justify-center" onClick={() => setStatus.mutate({ id: e.id, status: "approved" })}><Check className="h-4 w-4" /></button>}
                    {e.status === "submitted" && <button title={t("jobs.team.reject")} className="h-7 w-7 rounded-md bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center" onClick={() => setStatus.mutate({ id: e.id, status: "rejected" })}><X className="h-4 w-4" /></button>}
                    {e.status !== "submitted" && <button title={t("jobs.team.reopen")} className="opacity-0 group-hover:opacity-100 text-xs text-slate-400 hover:text-slate-700 px-1" onClick={() => setStatus.mutate({ id: e.id, status: "submitted" })}>{t("jobs.team.reopen")}</button>}
                    <button className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500" onClick={() => delTime.mutate(e.id)}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Equipment */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900 inline-flex items-center gap-2"><Wrench className="h-4 w-4 text-violet-600" /> {t("jobs.team.equipment")}</h2>
            <div className="text-xs text-slate-500">{t("jobs.team.equipmentCharged")} <span className="font-medium text-slate-800">{formatCents(usageCents)}</span></div>
          </div>
          {activeEquipment.length === 0 ? (
            <p className="text-xs text-slate-400">{t("jobs.team.noEquipmentHint")} <Link href="/dashboard/team?tab=equipment" className="text-violet-600 underline">{t("jobs.team.openTeam")}</Link></p>
          ) : (
            <form className="grid grid-cols-2 xl:grid-cols-[1fr_130px_90px_1fr_auto] gap-2" onSubmit={(e) => { e.preventDefault(); if (usage.equipmentId && usage.quantity && selectedEquipment) addUsage.mutate({ equipmentId: usage.equipmentId, date: usage.date, quantity: Number(usage.quantity), unit: selectedEquipment.usageUnit, note: usage.note.trim() }); }}>
              <select value={usage.equipmentId} onChange={(e) => setUsage({ ...usage, equipmentId: e.target.value })} className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm col-span-2 xl:col-span-1">
                <option value="">{t("jobs.team.pickEquipment")}</option>
                {activeEquipment.map((eq) => <option key={eq.id} value={eq.id}>{eq.name} · {formatCents(eq.usageRateCents)}/{t(`team.unit.${eq.usageUnit}`)}</option>)}
              </select>
              <Input type="date" value={usage.date} onChange={(e) => setUsage({ ...usage, date: e.target.value })} className="h-9" />
              <Input type="number" step="0.5" min="0.25" value={usage.quantity} onChange={(e) => setUsage({ ...usage, quantity: e.target.value })} placeholder={selectedEquipment ? t(`team.unit.${selectedEquipment.usageUnit}`) : "#"} className="h-9" />
              <Input value={usage.note} onChange={(e) => setUsage({ ...usage, note: e.target.value })} placeholder={t("jobs.team.notePlaceholder")} className="h-9" />
              <Button type="submit" size="sm" className="h-9 gap-1 col-span-2 xl:col-span-1" disabled={!usage.equipmentId || !usage.quantity || addUsage.isPending}><Plus className="h-4 w-4" /> {t("jobs.team.logUsage")}</Button>
            </form>
          )}
          {equipmentUsage.length > 0 && (
            <ul className="divide-y">
              {equipmentUsage.map((u) => (
                <li key={u.id} className="flex items-center gap-3 py-2 text-sm group">
                  <span className="text-xs text-slate-400 w-20 shrink-0">{u.date ? format(day(u.date)!, "d MMM yy", { locale }) : "—"}</span>
                  <div className="flex-1 min-w-0 truncate"><span className="font-medium text-slate-800">{u.equipmentName}</span> <span className="text-slate-500">· {u.quantity} {t(`team.unit.${u.unit}`)}</span>{u.note ? <span className="text-slate-400"> · {u.note}</span> : null}</div>
                  <span className="font-medium whitespace-nowrap">{formatCents(u.costCents)}</span>
                  <button className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500" onClick={() => delUsage.mutate(u.id)}><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Assigned */}
      <div className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 inline-flex items-center gap-2"><Users className="h-4 w-4 text-violet-600" /> {t("jobs.team.assigned")}</h3>
            <Link href="/dashboard/team" className="text-xs text-violet-600 hover:underline inline-flex items-center gap-1">{t("jobs.team.openTeam")} <ExternalLink className="h-3 w-3" /></Link>
          </div>
          {assignments.length === 0 ? <p className="text-sm text-slate-400 py-2 text-center">{t("jobs.team.empty")}</p> : (
            <ul className="divide-y">
              {assignments.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2 text-sm group">
                  <div className="h-8 w-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-bold">{a.collaboratorName.slice(0, 2).toUpperCase()}</div>
                  <div className="flex-1 min-w-0"><div className="font-medium text-slate-800 truncate">{a.collaboratorName}</div><div className="text-xs text-slate-400">{a.collaboratorRole}{a.collaboratorHourlyRate ? ` · ${formatCents(a.collaboratorHourlyRate)}/h` : ""}</div></div>
                  <button className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500" onClick={() => unassign.mutate(a.id)}><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          )}
          {available.length > 0 && (
            <div className="flex gap-2 pt-2 border-t">
              <select value={pick} onChange={(e) => setPick(e.target.value)} className="h-9 flex-1 rounded-md border border-slate-200 bg-white px-2 text-sm">
                <option value="">{t("jobs.team.pick")}</option>
                {available.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <Button size="sm" className="h-9" disabled={!pick || assign.isPending} onClick={() => { assign.mutate(pick); setPick(""); }}>{t("jobs.team.assign")}</Button>
            </div>
          )}
          <form className="space-y-2 pt-2 border-t" onSubmit={(e) => { e.preventDefault(); if (name.trim()) addWorker.mutate({ name: name.trim(), hourlyRateCents: rate ? Math.round(Number(rate) * 100) : undefined }); }}>
            <Label className="text-xs text-slate-500">{t("jobs.team.newWorker")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("jobs.team.namePlaceholder")} className="h-9" />
            <Input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder={t("jobs.team.ratePlaceholder")} className="h-9" />
            <Button type="submit" size="sm" variant="outline" className="w-full h-9" disabled={!name.trim() || addWorker.isPending}>{t("jobs.team.addAndAssign")}</Button>
          </form>
          <p className="text-[11px] text-slate-400">{t("jobs.team.assignHint")}</p>
        </section>
      </div>
    </div>
  );
}
