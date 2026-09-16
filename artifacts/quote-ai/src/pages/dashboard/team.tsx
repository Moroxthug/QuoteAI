import { useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { Users, Clock, Wrench, Plus, Trash2, Link2, Copy, Check, X, Download, Loader2, Pencil, UserX, UserCheck, Filter, UserPlus, RotateCw, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { formatCents, type TimeEntryDto, type TimeEntryStatus, type UsageUnit } from "@/lib/jobs-api";
import { teamApi, type EquipmentDto, type EquipmentEdit, type EquipmentOwnership, type WorkerDto, type WorkerEdit, type WorkerType } from "@/lib/team-api";
import { teamMembersApi, type TeamMemberDto, type TeamMemberRole } from "@/lib/team-members-api";
import { TimeStatusBadge } from "@/components/jobs/team-tab";

const TABS = ["workers", "time", "equipment", "members"] as const;
type Tab = (typeof TABS)[number];
const TAB_ICONS: Record<Tab, typeof Users> = { workers: Users, time: Clock, equipment: Wrench, members: UserPlus };
const day = (s: string | null) => (s ? new Date(`${s}T00:00:00`) : null);
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/**
 * /dashboard/team — worker register (rates, burden, magic links), the
 * company-wide time-entry approval queue with payroll CSV export, and the
 * equipment register.
 */
export default function TeamPage() {
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const search = useSearch();
  const initial = new URLSearchParams(search).get("tab");
  const [tab, setTab] = useState<Tab>(TABS.includes(initial as Tab) ? (initial as Tab) : "workers");
  const { data: workers, isLoading } = useQuery({ queryKey: ["workers"], queryFn: teamApi.workers });
  const { data: pending } = useQuery({ queryKey: ["time-entries", "submitted"], queryFn: () => teamApi.timeEntries({ status: "submitted" }) });

  return (
    <div className="animate-in fade-in duration-500">
      <div className="page-head">
        <div>
          <h1>{t("team.title")}</h1>
          <p className="sub">{t("team.subtitle")}</p>
        </div>
      </div>

      <div className="pills mb-4">
        {TABS.map((k) => {
          const Icon = TAB_ICONS[k];
          const count = k === "time" ? (pending?.items.length ?? 0) : 0;
          return (
            <button key={k} type="button" onClick={() => setTab(k)} className={cn("pill inline-flex items-center gap-1.5", tab === k && "on")}>
              <Icon className="h-3.5 w-3.5" /> {t(`team.tab.${k}`)}{count ? <span className="text-[10px] bg-amber-200 text-amber-900 rounded-full px-1.5">{count}</span> : null}
            </button>
          );
        })}
      </div>

      {isLoading ? <div className="space-y-3"><Skeleton className="h-16 w-full rounded-[var(--radius)]" /><Skeleton className="h-16 w-full rounded-[var(--radius)]" /></div> : null}
      {tab === "workers" && workers && <WorkersTab workers={workers.items} locale={locale} />}
      {tab === "time" && <TimeTab workers={workers?.items ?? []} locale={locale} />}
      {tab === "equipment" && <EquipmentTab />}
      {tab === "members" && <MembersTab />}
    </div>
  );
}

// ── Team members (Phase 7: logins, not workers logging hours) ──────────────

const ROLE_OPTIONS: TeamMemberRole[] = ["admin", "office", "foreman", "viewer"];

function MembersTab() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["team-members"] });
  const onError = (e: Error & { code?: string; requiredPlan?: string }) => toast({ title: e.code === "PLAN_REQUIRED" ? t("team.members.planRequired") : e.code === "SEAT_LIMIT" ? t("team.members.seatLimitTitle") : t("jobs.error"), description: e.message, variant: "destructive" });
  const { data, isLoading } = useQuery({ queryKey: ["team-members"], queryFn: teamMembersApi.list });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState<{ url: string; emailed: boolean } | null>(null);

  const resend = useMutation({ mutationFn: (id: string) => teamMembersApi.resend(id), onSuccess: (r) => { refresh(); setInvite(r); }, onError });
  const setStatus = useMutation({ mutationFn: ({ id, status }: { id: string; status: "active" | "suspended" }) => teamMembersApi.update(id, { status }), onSuccess: refresh, onError });
  const remove = useMutation({ mutationFn: (id: string) => teamMembersApi.remove(id), onSuccess: refresh, onError });

  const members = data?.items ?? [];
  const seats = data?.seats;

  return (
    <div className="card">
      <div className="toolbar">
        <p className="text-sm text-slate-500 m-0">{t("team.members.intro")}</p>
        <div className="grow flex items-center gap-2">
          {seats && <span className="foot-note">{seats.used}/{seats.included} {t("team.members.seatsUsed")}</span>}
          <button type="button" className="btn btn-navy btn-sm" onClick={() => setInviteOpen(true)}><Plus className="h-4 w-4" /> {t("team.members.invite")}</button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-5"><Skeleton className="h-16 w-full rounded-[var(--radius)]" /></div>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>{t("team.col.member")}</th>
                <th>{t("team.col.role")}</th>
                <th>{t("team.col.status")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span className="cell-flex"><span className="avat" style={{ background: "var(--navy)", color: "#fff" }}>YOU</span><span className="t-strong">{t("team.members.you")}</span></span></td>
                <td><span className="chip chip-purple">{t("team.members.role.admin")}</span></td>
                <td><span className="chip chip-green">{t("team.members.statusActive")}</span></td>
                <td></td>
              </tr>
              {members.map((m) => (
                <MemberRow key={m.id} member={m} onResend={() => resend.mutate(m.id)} onSuspend={() => setStatus.mutate({ id: m.id, status: m.status === "suspended" ? "active" : "suspended" })} onRemove={() => { if (confirm(t("team.members.removeConfirm"))) remove.mutate(m.id); }} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <InviteMemberDialog open={inviteOpen} onOpenChange={setInviteOpen} onInvited={(r) => { refresh(); setInvite(r); }} onError={onError} />
      <MemberInviteLinkDialog invite={invite} onClose={() => setInvite(null)} />
    </div>
  );
}

function MemberRow({ member, onResend, onSuspend, onRemove }: { member: TeamMemberDto; onResend: () => void; onSuspend: () => void; onRemove: () => void }) {
  const { t } = useLanguage();
  const statusLabel = member.status === "active" ? t("team.members.statusActive") : member.status === "suspended" ? t("team.members.statusSuspended") : t("team.members.statusInvited");
  const statusChip = member.status === "active" ? "chip-green" : member.status === "suspended" ? "chip-grey" : "chip-yellow";
  return (
    <tr>
      <td>
        <span className="cell-flex">
          <span className="avat">{member.email.slice(0, 2).toUpperCase()}</span>
          <span className="t-strong">{member.email}</span>
        </span>
      </td>
      <td><span className="chip chip-purple">{t(`team.members.role.${member.role}`)}</span></td>
      <td><span className={cn("chip", statusChip)}>{statusLabel}</span></td>
      <td onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1.5 justify-end">
          {member.status !== "active" && <Button size="sm" variant="outline" className="h-8 gap-1" onClick={onResend}><RotateCw className="h-3.5 w-3.5" /> {t("team.members.resend")}</Button>}
          {member.status !== "invited" && (
            <button className="h-8 w-8 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center" title={member.status === "suspended" ? t("team.members.reactivate") : t("team.members.suspend")} onClick={onSuspend}>
              {member.status === "suspended" ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
            </button>
          )}
          <button className="h-8 w-8 rounded-md text-slate-300 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center" title={t("team.members.remove")} onClick={onRemove}><Trash2 className="h-4 w-4" /></button>
        </div>
      </td>
    </tr>
  );
}

function InviteMemberDialog({ open, onOpenChange, onInvited, onError }: { open: boolean; onOpenChange: (v: boolean) => void; onInvited: (r: { url: string; emailed: boolean }) => void; onError: (e: Error & { code?: string; requiredPlan?: string }) => void }) {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamMemberRole>("office");
  useEffect(() => { if (open) { setEmail(""); setRole("office"); } }, [open]);
  const invite = useMutation({
    mutationFn: () => teamMembersApi.invite(email.trim(), role),
    onSuccess: (r) => { onOpenChange(false); onInvited(r); },
    onError,
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{t("team.members.dialogTitle")}</DialogTitle><DialogDescription>{t("team.members.dialogDesc")}</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>{t("team.members.email")}</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></div>
          <div className="space-y-1">
            <Label>{t("team.members.role")}</Label>
            <select value={role} onChange={(e) => setRole(e.target.value as TeamMemberRole)} className="h-10 w-full rounded-md border border-slate-200 bg-card px-2 text-sm">
              {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{t(`team.members.role.${r}`)}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => onOpenChange(false)}>{t("jobs.cancel")}</Button><Button disabled={!email.trim() || invite.isPending} onClick={() => invite.mutate()} className="gap-2">{invite.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {t("team.members.send")}</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MemberInviteLinkDialog({ invite, onClose }: { invite: { url: string; emailed: boolean } | null; onClose: () => void }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(invite!.url); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <Dialog open={!!invite} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{invite?.emailed ? t("team.members.inviteSent") : t("team.members.inviteNotSent")}</DialogTitle></DialogHeader>
        {invite && (
          <div className="flex items-center gap-2">
            <Input readOnly value={invite.url} className="text-xs" />
            <Button size="sm" variant="outline" onClick={copy} className="gap-1 shrink-0">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? t("team.invite.copied") : t("team.invite.copy")}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Workers ──────────────────────────────────────────────────────────────────

function WorkersTab({ workers, locale }: { workers: WorkerDto[]; locale: typeof enCA }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["workers"] });
  const onError = (e: Error & { code?: string }) => toast({ title: e.code === "PLAN_REQUIRED" ? t("team.planRequired") : t("jobs.error"), description: e.message, variant: "destructive" });
  const [editing, setEditing] = useState<{ open: boolean; worker: WorkerDto | null }>({ open: false, worker: null });
  const [invite, setInvite] = useState<{ worker: WorkerDto; url: string; emailed: boolean } | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const issue = useMutation({ mutationFn: (w: WorkerDto) => teamApi.invite(w.id, !!w.email), onSuccess: (r, w) => { refresh(); setInvite({ worker: w, url: r.url, emailed: r.emailed }); }, onError });
  const revoke = useMutation({ mutationFn: (id: string) => teamApi.revokeInvite(id), onSuccess: refresh, onError });
  const toggleActive = useMutation({ mutationFn: (w: WorkerDto) => teamApi.updateWorker(w.id, { active: !w.active }), onSuccess: refresh, onError });
  const remove = useMutation({ mutationFn: (id: string) => teamApi.deleteWorker(id), onSuccess: (r) => { refresh(); if (r.deactivated) toast({ title: t("team.workers.deactivatedInstead") }); }, onError });

  const list = workers.filter((w) => showInactive || w.active);
  const inactiveCount = workers.filter((w) => !w.active).length;

  return (
    <div className="card">
      <div className="toolbar">
        <p className="text-sm text-slate-500 m-0">{t("team.workers.intro")}</p>
        <div className="grow flex items-center gap-2">
          {inactiveCount > 0 && <button className="text-xs text-slate-500 hover:text-slate-800" onClick={() => setShowInactive((v) => !v)}>{showInactive ? t("team.workers.hideInactive") : `${t("team.workers.showInactive")} (${inactiveCount})`}</button>}
          <button type="button" className="btn btn-navy btn-sm" onClick={() => setEditing({ open: true, worker: null })}><Plus className="h-4 w-4" /> {t("team.workers.add")}</button>
        </div>
      </div>
      {list.length === 0 ? (
        <div className="p-10 text-center text-sm text-slate-500">{t("team.workers.empty")}</div>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>{t("team.col.member")}</th>
                <th>{t("team.col.rate")}</th>
                <th>{t("team.workers.thisMonth")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((w) => (
                <tr key={w.id} className={cn(!w.active && "opacity-60")}>
                  <td>
                    <span className="cell-flex">
                      <span className="avat">{w.name.slice(0, 2).toUpperCase()}</span>
                      <span>
                        <span className="t-strong">{w.name}</span>
                        <span className="t-sub">
                          {t(`team.type.${w.workerType}`)}{w.role && w.role !== "worker" ? ` · ${w.role}` : ""}{w.email ? ` · ${w.email}` : ""}{!w.active ? ` · ${t("team.workers.inactive")}` : ""}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="t-amt">
                    {formatCents(Math.round(w.hourlyRateCents * (1 + w.burdenPercent / 100)))}/h
                  </td>
                  <td>
                    {w.hoursThisMonth.toFixed(1)} h
                    {w.pendingCount > 0 && <span className="chip chip-yellow" style={{ marginLeft: 8 }}>{w.pendingCount} {t("team.workers.toApprove")}</span>}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5 justify-end">
                      {w.active && (
                        w.hasInvite ? (
                          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => issue.mutate(w)} disabled={issue.isPending} title={`${t("team.workers.linkActiveUntil")} ${w.inviteExpiresAt ? format(new Date(w.inviteExpiresAt), "PP", { locale }) : ""}`}><Link2 className="h-3.5 w-3.5 text-emerald-600" /> {t("team.workers.newLink")}</Button>
                        ) : (
                          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => issue.mutate(w)} disabled={issue.isPending}><Link2 className="h-3.5 w-3.5" /> {t("team.workers.timeLink")}</Button>
                        )
                      )}
                      {w.hasInvite && <button className="text-xs text-slate-400 hover:text-rose-600 px-1" onClick={() => revoke.mutate(w.id)}>{t("team.workers.revoke")}</button>}
                      <button className="h-8 w-8 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center" title={t("team.workers.edit")} onClick={() => setEditing({ open: true, worker: w })}><Pencil className="h-4 w-4" /></button>
                      <button className="h-8 w-8 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center" title={w.active ? t("team.workers.deactivate") : t("team.workers.reactivate")} onClick={() => toggleActive.mutate(w)}>{w.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}</button>
                      <button className="h-8 w-8 rounded-md text-slate-300 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center" title={t("team.workers.delete")} onClick={() => { if (confirm(t("team.workers.deleteConfirm"))) remove.mutate(w.id); }}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="card-foot"><span className="foot-note">{t("team.workers.burdenHint")}</span></div>

      <WorkerDialog worker={editing.worker} open={editing.open} onOpenChange={(v) => setEditing((s) => ({ ...s, open: v }))} />
      <InviteDialog invite={invite} onClose={() => setInvite(null)} />
    </div>
  );
}

function WorkerDialog({ worker, open, onOpenChange }: { worker: WorkerDto | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", role: "", email: "", phone: "", rate: "", type: "employee" as WorkerType, burden: "15" });
  useEffect(() => {
    if (!open) return;
    setForm({ name: worker?.name ?? "", role: worker?.role === "worker" ? "" : (worker?.role ?? ""), email: worker?.email ?? "", phone: worker?.phone ?? "", rate: worker ? (worker.hourlyRateCents / 100).toFixed(2) : "", type: worker?.workerType ?? "employee", burden: worker ? String(worker.burdenPercent) : "15" });
  }, [open, worker]);
  const body = (): WorkerEdit & { name: string } => ({ name: form.name.trim(), role: form.role.trim() || "worker", email: form.email.trim() || null, phone: form.phone.trim() || null, hourlyRateCents: Math.round((Number(form.rate) || 0) * 100), workerType: form.type, burdenPercent: Number(form.burden) || 0 });
  const save = useMutation({
    mutationFn: () => (worker ? teamApi.updateWorker(worker.id, body()) : teamApi.addWorker(body())),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["workers"] }); onOpenChange(false); },
    onError: (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" }),
  });
  const setType = (type: WorkerType) => setForm((f) => ({ ...f, type, burden: type === "subcontractor" ? "0" : f.burden === "0" ? "15" : f.burden }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{worker ? t("team.workers.edit") : t("team.workers.add")}</DialogTitle><DialogDescription>{t("team.workers.dialogDesc")}</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2"><Label>{t("team.workers.name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></div>
            <div className="space-y-1"><Label>{t("team.workers.type")}</Label>
              <select value={form.type} onChange={(e) => setType(e.target.value as WorkerType)} className="h-10 w-full rounded-md border border-slate-200 bg-card px-2 text-sm"><option value="employee">{t("team.type.employee")}</option><option value="subcontractor">{t("team.type.subcontractor")}</option></select>
            </div>
            <div className="space-y-1"><Label>{t("team.workers.role")}</Label><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder={t("team.workers.rolePlaceholder")} /></div>
            <div className="space-y-1"><Label>{t("team.workers.rate")}</Label><Input type="number" step="0.01" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} placeholder="35.00" /></div>
            <div className="space-y-1"><Label>{t("team.workers.burdenPct")}</Label><Input type="number" step="0.5" value={form.burden} onChange={(e) => setForm({ ...form, burden: e.target.value })} disabled={form.type === "subcontractor"} /></div>
            <div className="space-y-1"><Label>{t("team.workers.email")}</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-1"><Label>{t("team.workers.phone")}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
          <p className="text-[11px] text-slate-400">{t("team.workers.burdenHint")}</p>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => onOpenChange(false)}>{t("jobs.cancel")}</Button><Button disabled={!form.name.trim() || save.isPending} onClick={() => save.mutate()} className="gap-2">{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {t("jobs.save")}</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InviteDialog({ invite, onClose }: { invite: { worker: WorkerDto; url: string; emailed: boolean } | null; onClose: () => void }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(invite!.url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked: the field is selectable */ } };
  return (
    <Dialog open={!!invite} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{t("team.invite.title")} — {invite?.worker.name ?? ""}</DialogTitle><DialogDescription>{invite?.emailed ? `${t("team.invite.emailed")} ${invite.worker.email ?? ""}.` : t("team.invite.notEmailed")}</DialogDescription></DialogHeader>
        <div className="flex gap-2">
          <Input readOnly value={invite?.url ?? ""} onFocus={(e) => e.target.select()} className="text-xs" />
          <Button variant="outline" className="gap-1 shrink-0" onClick={copy}>{copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />} {copied ? t("team.invite.copied") : t("team.invite.copy")}</Button>
        </div>
        <p className="text-[11px] text-slate-400">{t("team.invite.hint")}</p>
      </DialogContent>
    </Dialog>
  );
}

// ── Time entries ─────────────────────────────────────────────────────────────

function TimeTab({ workers, locale }: { workers: WorkerDto[]; locale: typeof enCA }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const now = new Date();
  const [status, setStatus] = useState<TimeEntryStatus | "all">("submitted");
  const [workerId, setWorkerId] = useState("");
  const [from, setFrom] = useState(isoDay(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(isoDay(now));
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const params = { status: status === "all" ? undefined : status, workerId: workerId || undefined, from: status === "submitted" ? undefined : from, to: status === "submitted" ? undefined : to };
  const { data, isLoading } = useQuery({ queryKey: ["time-entries", params], queryFn: () => teamApi.timeEntries(params) });
  const refresh = () => { queryClient.invalidateQueries({ queryKey: ["time-entries"] }); queryClient.invalidateQueries({ queryKey: ["workers"] }); setSelected(new Set()); };
  const onError = (e: Error & { code?: string }) => toast({ title: e.code === "PLAN_REQUIRED" ? t("team.planRequired") : t("jobs.error"), description: e.message, variant: "destructive" });
  const setOne = useMutation({ mutationFn: ({ id, status }: { id: string; status: TimeEntryStatus }) => teamApi.updateTimeEntry(id, { status }), onSuccess: refresh, onError });
  const approveMany = useMutation({ mutationFn: (ids: string[]) => teamApi.approveMany(ids), onSuccess: (r) => { refresh(); toast({ title: `${r.approved} ${t("team.time.approvedToast")}` }); }, onError });
  const del = useMutation({ mutationFn: (id: string) => teamApi.deleteTimeEntry(id), onSuccess: refresh, onError });

  const items = data?.items ?? [];
  const totals = useMemo(() => ({ hours: items.reduce((s, e) => s + e.hours, 0), cents: items.filter((e) => e.status !== "rejected").reduce((s, e) => s + e.costCents, 0) }), [items]);
  const grouped = useMemo(() => {
    const m = new Map<string, TimeEntryDto[]>();
    for (const e of items) { const k = e.workerName ?? "?"; m.set(k, [...(m.get(k) ?? []), e]); }
    return [...m.entries()];
  }, [items]);
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const submittedIds = items.filter((e) => e.status === "submitted").map((e) => e.id);

  return (
    <div className="space-y-4">
      <div className="card">
      <div className="toolbar" style={{ borderBottom: "none" }}>
        <Filter className="h-4 w-4 text-slate-400" />
        <select value={status} onChange={(e) => setStatus(e.target.value as TimeEntryStatus | "all")} className="h-9 rounded-md border border-slate-200 bg-card px-2 text-sm">
          <option value="submitted">{t("team.time.filter.submitted")}</option>
          <option value="approved">{t("team.time.filter.approved")}</option>
          <option value="rejected">{t("team.time.filter.rejected")}</option>
          <option value="all">{t("team.time.filter.all")}</option>
        </select>
        <select value={workerId} onChange={(e) => setWorkerId(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-card px-2 text-sm">
          <option value="">{t("team.time.allWorkers")}</option>
          {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        {status !== "submitted" && (
          <>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" />
            <span className="text-slate-400 text-sm">→</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-40" />
          </>
        )}
        <div className="flex-1" />
        <a href={teamApi.payrollCsvUrl(from, to)} className="inline-flex items-center gap-1 text-sm text-navy-700 hover:underline" title={t("team.time.exportHint")}><Download className="h-4 w-4" /> {t("team.time.export")} ({from} → {to})</a>
      </div>
      </div>

      {status === "submitted" && submittedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button className="text-xs text-slate-500 hover:text-slate-800" onClick={() => setSelected(new Set(selected.size === submittedIds.length ? [] : submittedIds))}>{selected.size === submittedIds.length ? t("team.time.selectNone") : t("team.time.selectAll")}</button>
          <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 gap-1" disabled={approveMany.isPending || selected.size === 0} onClick={() => approveMany.mutate([...selected])}><Check className="h-4 w-4" /> {t("team.time.approveSelected")} ({selected.size})</Button>
          <Button size="sm" variant="outline" className="h-8" disabled={approveMany.isPending} onClick={() => approveMany.mutate(submittedIds)}>{t("team.time.approveAll")} ({submittedIds.length})</Button>
        </div>
      )}

      {isLoading ? <Skeleton className="h-32 w-full rounded-[var(--radius)]" /> : items.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-dashed border-slate-200 bg-card p-10 text-center text-sm text-slate-500">{status === "submitted" ? t("team.time.nothingToApprove") : t("team.time.empty")}</div>
      ) : (
        <div className="space-y-3">
          {grouped.map(([name, entries]) => (
            <section key={name} className="rounded-[var(--radius)] border border-slate-200 bg-card overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-sm"><span className="font-semibold text-slate-900">{name}</span><span className="text-slate-500">· {entries.reduce((s, e) => s + e.hours, 0).toFixed(2)} h · {formatCents(entries.filter((e) => e.status !== "rejected").reduce((s, e) => s + e.costCents, 0))}</span></div>
              <ul className="divide-y">
                {entries.map((e) => (
                  <li key={e.id} className={cn("flex items-center gap-3 px-4 py-2 text-sm group", e.status === "rejected" && "opacity-60")}>
                    {e.status === "submitted" ? <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} className="h-4 w-4 accent-navy-600" /> : <span className="w-4" />}
                    <span className="text-xs text-slate-400 w-20 shrink-0">{e.date ? format(day(e.date)!, "d MMM yy", { locale }) : "—"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="truncate"><Link href={`/dashboard/jobs/${e.projectId}?tab=team`} className="font-medium text-slate-800 hover:text-navy-700">{e.projectName}</Link> <span className="text-slate-500">· {e.hours} h</span>{e.milestoneTitle ? <span className="text-slate-400"> · {e.milestoneTitle}</span> : null}{e.enteredBy === "worker" ? <span className="text-[10px] text-slate-400 ml-1">({t("team.time.byWorker")})</span> : null}</div>
                      {e.note && <div className="text-[11px] text-slate-400 truncate">{e.note}</div>}
                    </div>
                    {e.geofenceFlagged && <span title={t("team.time.geofenceFlag")}><MapPin className="h-3.5 w-3.5 text-amber-500 shrink-0" /></span>}
                    <TimeStatusBadge status={e.status} />
                    <span className="font-medium whitespace-nowrap w-20 text-right">{formatCents(e.costCents)}</span>
                    <div className="flex gap-1 shrink-0">
                      {e.status === "submitted" && <button className="h-7 w-7 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center justify-center" onClick={() => setOne.mutate({ id: e.id, status: "approved" })}><Check className="h-4 w-4" /></button>}
                      {e.status === "submitted" && <button className="h-7 w-7 rounded-md bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center" onClick={() => setOne.mutate({ id: e.id, status: "rejected" })}><X className="h-4 w-4" /></button>}
                      {e.status !== "submitted" && <button className="opacity-0 group-hover:opacity-100 text-xs text-slate-400 hover:text-slate-700 px-1" onClick={() => setOne.mutate({ id: e.id, status: "submitted" })}>{t("jobs.team.reopen")}</button>}
                      <button className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500" onClick={() => del.mutate(e.id)}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <div className="text-sm text-right text-slate-600">{t("team.time.total")}: <span className="font-semibold text-slate-900">{totals.hours.toFixed(2)} h · {formatCents(totals.cents)}</span></div>
        </div>
      )}
      <p className="text-[11px] text-slate-400">{t("team.time.hint")}</p>
    </div>
  );
}

// ── Equipment ────────────────────────────────────────────────────────────────

function EquipmentTab() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["equipment"], queryFn: teamApi.equipment });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["equipment"] });
  const onError = (e: Error & { code?: string }) => toast({ title: e.code === "PLAN_REQUIRED" ? t("team.planRequired") : t("jobs.error"), description: e.message, variant: "destructive" });
  const [editing, setEditing] = useState<{ open: boolean; item: EquipmentDto | null }>({ open: false, item: null });
  const toggle = useMutation({ mutationFn: (e: EquipmentDto) => teamApi.updateEquipment(e.id, { active: !e.active }), onSuccess: refresh, onError });
  const remove = useMutation({ mutationFn: (id: string) => teamApi.deleteEquipment(id), onSuccess: (r) => { refresh(); if (r.deactivated) toast({ title: t("team.equipment.deactivatedInstead") }); }, onError });
  const items = data?.items ?? [];
  const monthlyOverhead = items.filter((e) => e.active && e.ownership === "financed").reduce((s, e) => s + (e.financing.monthlyPaymentCents ?? 0), 0);

  return (
    <div className="card">
      <div className="toolbar">
        <p className="text-sm text-slate-500 m-0">{t("team.equipment.intro")}</p>
        <div className="grow">
          <button type="button" className="btn btn-navy btn-sm" onClick={() => setEditing({ open: true, item: null })}><Plus className="h-4 w-4" /> {t("team.equipment.add")}</button>
        </div>
      </div>
      {isLoading ? <div className="p-5"><Skeleton className="h-24 w-full rounded-[var(--radius)]" /></div> : items.length === 0 ? (
        <div className="p-10 text-center text-sm text-slate-500">{t("team.equipment.empty")}</div>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>{t("team.equipment.name")}</th>
                <th>{t("team.equipment.ownership")}</th>
                <th>{t("team.equipment.rate")}</th>
                <th>{t("team.equipment.chargedThisMonth")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id} className={cn(!e.active && "opacity-60")}>
                  <td>
                    <span className="cell-flex">
                      <span className="cell-ic"><Wrench className="h-4 w-4" /></span>
                      <span>
                        <span className="t-strong">{e.name}</span>
                        {!e.active && <span className="t-sub">{t("team.workers.inactive")}</span>}
                      </span>
                    </span>
                  </td>
                  <td>
                    <span className="chip chip-grey">{t(`team.ownership.${e.ownership}`)}</span>
                    {e.ownership === "financed" && e.financing.monthlyPaymentCents ? (
                      <div className="t-sub">{formatCents(e.financing.monthlyPaymentCents)}/{t("team.equipment.month")}{e.financing.remainingMonths ? ` · ${e.financing.remainingMonths} ${t("team.equipment.monthsLeft")}` : ""}</div>
                    ) : null}
                  </td>
                  <td className="t-amt">{formatCents(e.usageRateCents)}/{t(`team.unit.${e.usageUnit}`)}</td>
                  <td>{formatCents(e.usageCentsThisMonth)}</td>
                  <td onClick={(ev) => ev.stopPropagation()}>
                    <div className="flex items-center gap-1.5 justify-end">
                      <button className="h-8 w-8 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center" onClick={() => setEditing({ open: true, item: e })}><Pencil className="h-4 w-4" /></button>
                      <button className="text-xs text-slate-400 hover:text-slate-800 px-1" onClick={() => toggle.mutate(e)}>{e.active ? t("team.workers.deactivate") : t("team.workers.reactivate")}</button>
                      <button className="h-8 w-8 rounded-md text-slate-300 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center" onClick={() => { if (confirm(t("team.equipment.deleteConfirm"))) remove.mutate(e.id); }}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="card-foot">
        <span className="foot-note">{t("team.equipment.hint")}</span>
        {monthlyOverhead > 0 && <span className="foot-note">{t("team.equipment.overhead")} {formatCents(monthlyOverhead)}/{t("team.equipment.month")}</span>}
      </div>
      <EquipmentDialog item={editing.item} open={editing.open} onOpenChange={(v) => setEditing((s) => ({ ...s, open: v }))} />
    </div>
  );
}

function EquipmentDialog({ item, open, onOpenChange }: { item: EquipmentDto | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", ownership: "owned" as EquipmentOwnership, purchase: "", rate: "", unit: "day" as UsageUnit, lender: "", monthly: "", months: "", notes: "" });
  useEffect(() => {
    if (!open) return;
    setForm({ name: item?.name ?? "", ownership: item?.ownership ?? "owned", purchase: item?.purchaseCents ? (item.purchaseCents / 100).toFixed(2) : "", rate: item ? (item.usageRateCents / 100).toFixed(2) : "", unit: item?.usageUnit ?? "day", lender: item?.financing.lender ?? "", monthly: item?.financing.monthlyPaymentCents ? (item.financing.monthlyPaymentCents / 100).toFixed(2) : "", months: item?.financing.remainingMonths ? String(item.financing.remainingMonths) : "", notes: item?.notes ?? "" });
  }, [open, item]);
  const body = (): EquipmentEdit & { name: string } => ({ name: form.name.trim(), ownership: form.ownership, purchaseCents: Math.round((Number(form.purchase) || 0) * 100), usageRateCents: Math.round((Number(form.rate) || 0) * 100), usageUnit: form.unit, notes: form.notes.trim(), financing: form.ownership === "financed" ? { lender: form.lender.trim() || undefined, monthlyPaymentCents: Math.round((Number(form.monthly) || 0) * 100) || undefined, remainingMonths: Number(form.months) || undefined } : {} });
  const save = useMutation({
    mutationFn: () => (item ? teamApi.updateEquipment(item.id, body()) : teamApi.addEquipment(body())),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["equipment"] }); onOpenChange(false); },
    onError: (e: Error & { code?: string }) => toast({ title: e.code === "PLAN_REQUIRED" ? t("team.planRequired") : t("jobs.error"), description: e.message, variant: "destructive" }),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{item ? t("team.equipment.edit") : t("team.equipment.add")}</DialogTitle><DialogDescription>{t("team.equipment.dialogDesc")}</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2"><Label>{t("team.equipment.name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("team.equipment.namePlaceholder")} autoFocus /></div>
            <div className="space-y-1"><Label>{t("team.equipment.ownership")}</Label>
              <select value={form.ownership} onChange={(e) => setForm({ ...form, ownership: e.target.value as EquipmentOwnership })} className="h-10 w-full rounded-md border border-slate-200 bg-card px-2 text-sm">
                {(["owned", "rented", "financed"] as const).map((o) => <option key={o} value={o}>{t(`team.ownership.${o}`)}</option>)}
              </select>
            </div>
            <div className="space-y-1"><Label>{t("team.equipment.purchase")}</Label><Input type="number" step="0.01" value={form.purchase} onChange={(e) => setForm({ ...form, purchase: e.target.value })} /></div>
            <div className="space-y-1"><Label>{t("team.equipment.rate")}</Label><Input type="number" step="0.01" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} placeholder="150.00" /></div>
            <div className="space-y-1"><Label>{t("team.equipment.unit")}</Label>
              <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value as UsageUnit })} className="h-10 w-full rounded-md border border-slate-200 bg-card px-2 text-sm"><option value="day">{t("team.unit.dayLong")}</option><option value="hour">{t("team.unit.hourLong")}</option></select>
            </div>
            {form.ownership === "financed" && (
              <>
                <div className="space-y-1"><Label>{t("team.equipment.lender")}</Label><Input value={form.lender} onChange={(e) => setForm({ ...form, lender: e.target.value })} /></div>
                <div className="space-y-1"><Label>{t("team.equipment.monthly")}</Label><Input type="number" step="0.01" value={form.monthly} onChange={(e) => setForm({ ...form, monthly: e.target.value })} /></div>
                <div className="space-y-1"><Label>{t("team.equipment.monthsLeft")}</Label><Input type="number" value={form.months} onChange={(e) => setForm({ ...form, months: e.target.value })} /></div>
              </>
            )}
            <div className="space-y-1 col-span-2"><Label>{t("team.equipment.notes")}</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <p className="text-[11px] text-slate-400">{t("team.equipment.rateHint")}</p>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => onOpenChange(false)}>{t("jobs.cancel")}</Button><Button disabled={!form.name.trim() || save.isPending} onClick={() => save.mutate()} className="gap-2">{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {t("jobs.save")}</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

