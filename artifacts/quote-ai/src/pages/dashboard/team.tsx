import { localDay } from "@/lib/local-day";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { Users, Clock, Wrench, Plus, KeyRound, Armchair, Trash2, Link2, Copy, Check, X, Download, Loader2, Pencil, UserX, UserCheck, Filter, UserPlus, RotateCw, MapPin, Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCan } from "@/hooks/use-role";
import { formatCents, type TimeEntryDto, type TimeEntryStatus, type UsageUnit } from "@/lib/jobs-api";
import { teamApi, type EquipmentDto, type EquipmentEdit, type EquipmentOwnership, type WorkerDto, type WorkerEdit, type WorkerType } from "@/lib/team-api";
import { teamMembersApi, type TeamMemberDto, type TeamMemberRole } from "@/lib/team-members-api";
import { TimeStatusBadge } from "@/components/jobs/team-tab";
import { PersonAvatar } from "@/components/people/avatar";
import { AccessCodesDialog } from "@/components/team/access-codes";
import { SeatsDialog } from "@/components/team/seats-dialog";
import { peopleApi } from "@/lib/people-api";
import { PaymentReturnNotice } from "@/components/billing/payment-return-notice";

const TABS = ["workers", "time", "equipment", "members"] as const;
type Tab = (typeof TABS)[number];
const TAB_ICONS: Record<Tab, typeof Users> = { workers: Users, time: Clock, equipment: Wrench, members: UserPlus };
const day = (s: string | null) => (s ? new Date(`${s}T00:00:00`) : null);
const isoDay = (d: Date) => localDay(d);

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

      <PaymentReturnNotice />

      <div className="pills mb-4">
        {TABS.map((k) => {
          const Icon = TAB_ICONS[k];
          const count = k === "time" ? (pending?.items.length ?? 0) : 0;
          return (
            <button key={k} type="button" onClick={() => setTab(k)} className={cn("pill", tab === k && "on")}>
              <Icon /> {t(`team.tab.${k}`)}{count ? <span className="cnt">{count}</span> : null}
            </button>
          );
        })}
      </div>

      {isLoading ? <div className="space-y-3"><Skeleton className="h-16 w-full rounded-[var(--radius-mk)]" /><Skeleton className="h-16 w-full rounded-[var(--radius-mk)]" /></div> : null}
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
const can = useCan();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["team-members"] });
  const onError = (e: Error & { code?: string; requiredPlan?: string }) => toast({ title: e.code === "PLAN_REQUIRED" ? t("team.members.planRequired") : e.code === "SEAT_LIMIT" ? t("team.members.seatLimitTitle") : t("jobs.error"), description: e.message, variant: "destructive" });
  const { data, isLoading } = useQuery({ queryKey: ["team-members"], queryFn: teamMembersApi.list });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState<{ url: string; emailed: boolean } | null>(null);
  // Phase 91: access codes, paid seats, and the people's own pages.
  const [codesOpen, setCodesOpen] = useState(false);
  const [seatsOpen, setSeatsOpen] = useState(false);
  const { data: seatInfo } = useQuery({ queryKey: ["seats"], queryFn: peopleApi.seats, staleTime: 30_000 });
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: peopleApi.me, staleTime: 60_000 });

  const resend = useMutation({ mutationFn: (id: string) => teamMembersApi.resend(id), onSuccess: (r) => { refresh(); setInvite(r); }, onError });
  const setStatus = useMutation({ mutationFn: ({ id, status }: { id: string; status: "active" | "suspended" }) => teamMembersApi.update(id, { status }), onSuccess: refresh, onError });
  const remove = useMutation({ mutationFn: (id: string) => teamMembersApi.remove(id), onSuccess: refresh, onError });
  // Phase 72: a member (not the owner) can take themself off this company.
  const { data: orgs } = useQuery({ queryKey: ["team-orgs"], queryFn: teamMembersApi.orgs, staleTime: 60_000 });
  const activeOrg = orgs?.items.find((o) => o.orgId === orgs.activeOrgId);
  const leave = useMutation({ mutationFn: (orgId: string) => teamMembersApi.leave(orgId), onSuccess: () => { queryClient.clear(); window.location.href = "/dashboard"; }, onError });

  const members = data?.items ?? [];
  const seats = data?.seats;

  return (
    <div className="card">
      <div className="toolbar">
        <p className="foot-note m-0">{t("team.members.intro")}</p>
        {/* Phase 93: wraps on a phone (the count and three buttons pushed "Invite member" off a 375 px screen). */}
        <div className="grow flex flex-wrap items-center gap-2">
          {seats && <span className="foot-note" style={{ whiteSpace: "nowrap" }}>{seats.used}/{seats.limit} {t("team.members.seatsUsed")}</span>}
          {can("settings", "full") && seatInfo?.canBuy && <button type="button" className="btn btn-outline-navy btn-sm" onClick={() => setSeatsOpen(true)}><Armchair className="h-4 w-4" /> {t("seats.button")}</button>}
          {can("team", "full") && <button type="button" className="btn btn-outline-navy btn-sm" onClick={() => setCodesOpen(true)}><KeyRound className="h-4 w-4" /> {t("codes.button")}</button>}
          {activeOrg && !activeOrg.isOwn && (
            <button type="button" className="btn btn-outline-navy btn-sm" disabled={leave.isPending} onClick={() => { if (confirm(t("team.members.leaveConfirm").replace("{company}", activeOrg.companyName))) leave.mutate(activeOrg.orgId); }}>
              <UserX className="h-4 w-4" /> {t("team.members.leave")}
            </button>
          )}
          {can("team", "full") && <button type="button" className="btn btn-navy btn-sm" data-invite-member="" onClick={() => setInviteOpen(true)}><Plus className="h-4 w-4" /> {t("team.members.invite")}</button>}
        </div>
      </div>

      {isLoading ? (
        <div className="p-5"><Skeleton className="h-16 w-full rounded-[var(--radius-mk)]" /></div>
      ) : (
        <div className="tbl-wrap" tabIndex={0} role="region" aria-label={t("team.tab.members")}>
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
                <td><Link href="/dashboard/me" className="cell-flex"><PersonAvatar name={me?.person.name} image={me?.person.image} /><span className="min-w-0"><span className="t-strong block">{me?.person.name ?? t("team.members.you")}</span><span className="t-sub">{t("team.members.you")}</span></span></Link></td>
                <td><span className="chip chip-purple">{me ? t(`group.role.${me.current.role}`) : "—"}</span></td>
                <td><span className="chip chip-green">{t("team.members.statusActive")}</span></td>
                <td></td>
              </tr>
              {members.map((m) => (
                m.userId && m.userId === me?.person.id ? null : <MemberRow key={m.id} member={m} onResend={() => resend.mutate(m.id)} onSuspend={() => setStatus.mutate({ id: m.id, status: m.status === "suspended" ? "active" : "suspended" })} onRemove={() => { if (confirm(t("team.members.removeConfirm"))) remove.mutate(m.id); }} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <InviteMemberDialog open={inviteOpen} onOpenChange={setInviteOpen} onInvited={(r) => { refresh(); setInvite(r); }} onError={onError} />
      <MemberInviteLinkDialog invite={invite} onClose={() => setInvite(null)} />
      <AccessCodesDialog open={codesOpen} onOpenChange={setCodesOpen} available={seats ? seats.limit - seats.used : 0} onMade={() => { refresh(); void queryClient.invalidateQueries({ queryKey: ["seats"] }); }} onError={onError} />
      {seatInfo && <SeatsDialog seats={seatInfo} open={seatsOpen} onOpenChange={setSeatsOpen} onError={onError} />}
    </div>
  );
}

function MemberRow({ member, onResend, onSuspend, onRemove }: { member: TeamMemberDto; onResend: () => void; onSuspend: () => void; onRemove: () => void }) {
  const { t } = useLanguage();
const can = useCan();
  const statusLabel = member.status === "active" ? t("team.members.statusActive") : member.status === "suspended" ? t("team.members.statusSuspended") : t("team.members.statusInvited");
  const statusChip = member.status === "active" ? "chip-green" : member.status === "suspended" ? "chip-grey" : "chip-yellow";
  return (
    <tr>
      <td>
        {member.status === "active" && member.userId ? (
          <Link href={`/dashboard/people/${member.userId}`} className="cell-flex">
            <PersonAvatar name={member.name ?? member.email} image={member.image} />
            <span className="min-w-0"><span className="t-strong block">{member.name ?? member.email}</span>{member.name && member.email && <span className="t-sub">{member.email}</span>}</span>
          </Link>
        ) : (
          <span className="cell-flex">
            <PersonAvatar name={member.kind === "code" ? "#" : member.email} />
            <span className="t-strong">{member.kind === "code" && !member.email ? t("codes.pendingRow").replace("{hint}", member.codeHint ?? "") : member.email}</span>
          </span>
        )}
      </td>
      <td><span className="chip chip-purple">{t(`team.members.role.${member.role}`)}</span></td>
      <td><span className={cn("chip", statusChip)}>{statusLabel}</span></td>
      <td onClick={(e) => e.stopPropagation()}>
        {can("team", "full") && <div className="row-act">
          {member.status !== "active" && member.kind === "email" && <button type="button" className="btn btn-sm btn-outline-navy" onClick={onResend}><RotateCw className="h-3.5 w-3.5" /> {t("team.members.resend")}</button>}
          {member.status !== "invited" && (
            <button type="button" className="ic-btn" title={member.status === "suspended" ? t("team.members.reactivate") : t("team.members.suspend")} onClick={onSuspend}>
              {member.status === "suspended" ? <UserCheck /> : <UserX />}
            </button>
          )}
          <button type="button" className="ic-btn danger" title={t("team.members.remove")} onClick={onRemove}><Trash2 /></button>
        </div>}
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
      <DialogContent>
        <DialogHeader><DialogTitle>{t("team.members.dialogTitle")}</DialogTitle><DialogDescription>{t("team.members.dialogDesc")}</DialogDescription></DialogHeader>
        <DialogBody>
          <div className="field"><label htmlFor="invite-member-email">{t("team.members.email")}</label><input id="invite-member-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></div>
          <div className="field">
            <label htmlFor="invite-member-role">{t("team.members.role")}</label>
            <select id="invite-member-role" value={role} onChange={(e) => setRole(e.target.value as TeamMemberRole)}>
              {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{t(`team.members.role.${r}`)}</option>)}
            </select>
          </div>
        </DialogBody>
        <DialogFooter>
          <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => onOpenChange(false)}>{t("jobs.cancel")}</button>
          <button type="button" className="btn btn-sm btn-navy" disabled={!email.trim() || invite.isPending} onClick={() => invite.mutate()}>{invite.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {t("team.members.send")}</button>
        </DialogFooter>
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
      <DialogContent>
        <DialogHeader><DialogTitle>{invite?.emailed ? t("team.members.inviteSent") : t("team.members.inviteNotSent")}</DialogTitle></DialogHeader>
        {invite && (
          <DialogBody>
            <div className="copy-row">
              <input className="inp-sm" readOnly value={invite.url} onFocus={(e) => e.target.select()} />
              <button type="button" className="btn btn-sm btn-outline-navy" onClick={copy}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? t("team.invite.copied") : t("team.invite.copy")}</button>
            </div>
          </DialogBody>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Workers ──────────────────────────────────────────────────────────────────

function WorkersTab({ workers, locale }: { workers: WorkerDto[]; locale: typeof enCA }) {
  const { t } = useLanguage();
const can = useCan();
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
        <p className="foot-note m-0">{t("team.workers.intro")}</p>
        <div className="grow flex items-center gap-2">
          {inactiveCount > 0 && <button type="button" className="text-link" style={{ color: "var(--muted-mk)" }} onClick={() => setShowInactive((v) => !v)}>{showInactive ? t("team.workers.hideInactive") : `${t("team.workers.showInactive")} (${inactiveCount})`}</button>}
          {can("team", "full") && <button type="button" className="btn btn-navy btn-sm" onClick={() => setEditing({ open: true, worker: null })}><Plus className="h-4 w-4" /> {t("team.workers.add")}</button>}
        </div>
      </div>
      {list.length === 0 ? (
        <div className="card-empty">{t("team.workers.empty")}</div>
      ) : (
        <div className="tbl-wrap" tabIndex={0} role="region" aria-label={t("team.tab.workers")}>
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
                    {can("team", "full") && <div className="row-act">
                      {w.active && (
                        w.hasInvite ? (
                          <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => issue.mutate(w)} disabled={issue.isPending} title={`${t("team.workers.linkActiveUntil")} ${w.inviteExpiresAt ? format(new Date(w.inviteExpiresAt), "PP", { locale }) : ""}`}><Link2 className="h-3.5 w-3.5" style={{ color: "var(--green-dark)" }} /> {t("team.workers.newLink")}</button>
                        ) : (
                          <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => issue.mutate(w)} disabled={issue.isPending}><Link2 className="h-3.5 w-3.5" /> {t("team.workers.timeLink")}</button>
                        )
                      )}
                      {w.hasInvite && <button type="button" className="text-link danger" onClick={() => revoke.mutate(w.id)}>{t("team.workers.revoke")}</button>}
                      <button type="button" className="ic-btn" title={t("team.workers.edit")} onClick={() => setEditing({ open: true, worker: w })}><Pencil /></button>
                      <button type="button" className="ic-btn" title={w.active ? t("team.workers.deactivate") : t("team.workers.reactivate")} onClick={() => toggleActive.mutate(w)}>{w.active ? <UserX /> : <UserCheck />}</button>
                      <button type="button" className="ic-btn danger" title={t("team.workers.delete")} onClick={() => { if (confirm(t("team.workers.deleteConfirm"))) remove.mutate(w.id); }}><Trash2 /></button>
                    </div>}
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
  const [form, setForm] = useState({ name: "", role: "", email: "", phone: "", rate: "", type: "employee" as WorkerType, burden: "15", canAddTasks: false, payrollId: "" });
  useEffect(() => {
    if (!open) return;
    setForm({ name: worker?.name ?? "", role: worker?.role === "worker" ? "" : (worker?.role ?? ""), email: worker?.email ?? "", phone: worker?.phone ?? "", rate: worker ? (worker.hourlyRateCents / 100).toFixed(2) : "", type: worker?.workerType ?? "employee", burden: worker ? String(worker.burdenPercent) : "15", canAddTasks: worker?.canAddTasks ?? false, payrollId: worker?.payrollId ?? "" });
  }, [open, worker]);
  const body = (): WorkerEdit & { name: string } => ({ name: form.name.trim(), role: form.role.trim() || "worker", email: form.email.trim() || null, phone: form.phone.trim() || null, hourlyRateCents: Math.round((Number(form.rate) || 0) * 100), workerType: form.type, burdenPercent: Number(form.burden) || 0, canAddTasks: form.canAddTasks, payrollId: form.type === "employee" ? form.payrollId.trim() || null : undefined });
  const save = useMutation({
    mutationFn: () => (worker ? teamApi.updateWorker(worker.id, body()) : teamApi.addWorker(body())),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["workers"] }); onOpenChange(false); },
    onError: (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" }),
  });
  const setType = (type: WorkerType) => setForm((f) => ({ ...f, type, burden: type === "subcontractor" ? "0" : f.burden === "0" ? "15" : f.burden }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>{worker ? t("team.workers.edit") : t("team.workers.add")}</DialogTitle><DialogDescription>{t("team.workers.dialogDesc")}</DialogDescription></DialogHeader>
        <DialogBody>
          <div className="form-grid">
            <div className="field full"><label>{t("team.workers.name")}</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></div>
            <div className="field"><label>{t("team.workers.type")}</label>
              <select value={form.type} onChange={(e) => setType(e.target.value as WorkerType)}><option value="employee">{t("team.type.employee")}</option><option value="subcontractor">{t("team.type.subcontractor")}</option></select>
            </div>
            <div className="field"><label>{t("team.workers.role")}</label><input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder={t("team.workers.rolePlaceholder")} /></div>
            <div className="field"><label>{t("team.workers.rate")}</label><input type="number" step="0.01" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} placeholder="35.00" /></div>
            <div className="field"><label>{t("team.workers.burdenPct")}</label><input type="number" step="0.5" value={form.burden} onChange={(e) => setForm({ ...form, burden: e.target.value })} disabled={form.type === "subcontractor"} /></div>
            <div className="field"><label>{t("team.workers.email")}</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="field"><label>{t("team.workers.phone")}</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            {/* Phase 89: the key the payroll provider's import matches on. */}
            {form.type === "employee" && <div className="field"><label htmlFor="worker-payroll-id">{t("team.workers.payrollId")}</label><input id="worker-payroll-id" value={form.payrollId} maxLength={40} onChange={(e) => setForm({ ...form, payrollId: e.target.value })} placeholder={t("team.workers.payrollIdPlaceholder")} /></div>}
            {/* Phase 86b: opt-in per worker — a crew lead, not every apprentice. */}
            <label className="chk-row full">
              <input type="checkbox" checked={form.canAddTasks} onChange={(e) => setForm({ ...form, canAddTasks: e.target.checked })} />
              <span>{t("team.workers.canAddTasks")}<span className="block text-xs" style={{ color: "var(--muted-mk)" }}>{t("team.workers.canAddTasksHint")}</span></span>
            </label>
          </div>
        </DialogBody>
        <DialogFooter>
          <span className="foot-note">{t("team.workers.burdenHint")}</span>
          <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => onOpenChange(false)}>{t("jobs.cancel")}</button>
          <button type="button" className="btn btn-sm btn-navy" disabled={!form.name.trim() || save.isPending} onClick={() => save.mutate()}>{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {t("jobs.save")}</button>
        </DialogFooter>
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
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>{t("team.invite.title")} — {invite?.worker.name ?? ""}</DialogTitle><DialogDescription>{invite?.emailed ? `${t("team.invite.emailed")} ${invite.worker.email ?? ""}.` : t("team.invite.notEmailed")}</DialogDescription></DialogHeader>
        <DialogBody>
          <div className="copy-row">
            <input className="inp-sm" readOnly value={invite?.url ?? ""} onFocus={(e) => e.target.select()} />
            <button type="button" className="btn btn-sm btn-outline-navy" onClick={copy}>{copied ? <Check className="h-4 w-4" style={{ color: "var(--green-dark)" }} /> : <Copy className="h-4 w-4" />} {copied ? t("team.invite.copied") : t("team.invite.copy")}</button>
          </div>
          <p className="foot-note">{t("team.invite.hint")}</p>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

// ── Time entries ─────────────────────────────────────────────────────────────

function TimeTab({ workers, locale }: { workers: WorkerDto[]; locale: typeof enCA }) {
  const { t } = useLanguage();
const can = useCan();
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
    <div className="stack">
      <div className="card">
        <div className="toolbar" style={{ borderBottom: "none" }}>
          <Filter className="h-4 w-4" style={{ color: "var(--faint)" }} />
          <select aria-label={t("team.time.filterStatus")} value={status} onChange={(e) => setStatus(e.target.value as TimeEntryStatus | "all")} className="inp-sm" style={{ width: "auto" }}>
            <option value="submitted">{t("team.time.filter.submitted")}</option>
            <option value="approved">{t("team.time.filter.approved")}</option>
            <option value="rejected">{t("team.time.filter.rejected")}</option>
            <option value="all">{t("team.time.filter.all")}</option>
          </select>
          <select aria-label={t("team.time.filterWorker")} value={workerId} onChange={(e) => setWorkerId(e.target.value)} className="inp-sm" style={{ width: "auto" }}>
            <option value="">{t("team.time.allWorkers")}</option>
            {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          {status !== "submitted" && (
            <>
              <input type="date" aria-label={t("team.time.filterFrom")} value={from} onChange={(e) => setFrom(e.target.value)} className="inp-sm" style={{ width: 150 }} />
              <span className="foot-note">→</span>
              <input type="date" aria-label={t("team.time.filterTo")} value={to} onChange={(e) => setTo(e.target.value)} className="inp-sm" style={{ width: 150 }} />
            </>
          )}
          {/* Phase 89: wages are the office's (costs:full); the pay period itself lives on /dashboard/pay. */}
          {can("costs", "full") && (
            <div className="grow flex flex-wrap items-center gap-x-4 gap-y-1">
              <a href={teamApi.payrollCsvUrl(from, to)} className="text-link" title={t("team.time.exportHint")}><Download /> {t("team.time.export")} ({from} → {to})</a>
              <Link href="/dashboard/pay" className="text-link"><Wallet /> {t("team.time.payLink")}</Link>
            </div>
          )}
        </div>

        {status === "submitted" && submittedIds.length > 0 && can("jobs", "edit") && (
          <div className="bulk-row" style={{ margin: "0 18px 14px" }}>
            <button type="button" className="text-link" onClick={() => setSelected(new Set(selected.size === submittedIds.length ? [] : submittedIds))}>{selected.size === submittedIds.length ? t("team.time.selectNone") : t("team.time.selectAll")}</button>
            <button type="button" className="btn btn-sm btn-navy" style={{ background: "var(--green)" }} disabled={approveMany.isPending || selected.size === 0} onClick={() => approveMany.mutate([...selected])}><Check className="h-4 w-4" /> {t("team.time.approveSelected")} ({selected.size})</button>
            <button type="button" className="btn btn-sm btn-outline-navy" disabled={approveMany.isPending} onClick={() => approveMany.mutate(submittedIds)}>{t("team.time.approveAll")} ({submittedIds.length})</button>
          </div>
        )}
      </div>

      {isLoading ? <Skeleton className="h-32 w-full rounded-[var(--radius-mk)]" /> : items.length === 0 ? (
        <div className="card dashed card-empty">{status === "submitted" ? t("team.time.nothingToApprove") : t("team.time.empty")}</div>
      ) : (
        <div className="card">
          {grouped.map(([name, entries]) => (
            <section key={name}>
              <div className="te-group"><b>{name}</b><span>· {entries.reduce((s, e) => s + e.hours, 0).toFixed(2)} h · {formatCents(entries.filter((e) => e.status !== "rejected").reduce((s, e) => s + e.costCents, 0))}</span></div>
              {entries.map((e) => (
                <div key={e.id} className={cn("item-row", e.status === "rejected" && "muted")}>
                  {e.status === "submitted" ? (
                    <button type="button" className={cn("chk", selected.has(e.id) && "on")} aria-pressed={selected.has(e.id)} onClick={() => toggle(e.id)}>{selected.has(e.id) && <Check />}</button>
                  ) : <span className="spacer" />}
                  <span className="date">{e.date ? format(day(e.date)!, "d MMM yy", { locale }) : "—"}</span>
                  <div className="grow">
                    <span className="ttl"><Link href={`/dashboard/jobs/${e.projectId}?tab=team`}>{e.projectName}</Link> <span className="dim">· {e.hours} h</span>{e.overtimeHours > 0 ? <span className="dim"> · {t("team.time.overtime").replace("{h}", String(e.overtimeHours))}</span> : null}{e.holidayHours > 0 ? <span className="dim"> · {t("team.time.onHoliday")}</span> : null}{e.milestoneTitle ? <span className="dim"> · {e.milestoneTitle}</span> : null}{e.enteredBy === "worker" ? <span className="by">({t("team.time.byWorker")})</span> : null}</span>
                    {e.note && <span className="sub">{e.note}</span>}
                  </div>
                  {e.geofenceFlagged && <span className="flag" title={t("team.time.geofenceFlag")}><MapPin /></span>}
                  <TimeStatusBadge status={e.status} />
                  <span className="amt" style={{ width: 80, textAlign: "right" }}>{formatCents(e.costCents)}</span>
                  {can("jobs", "edit") && <div className={e.status === "submitted" ? "flex gap-1 shrink-0" : "hover-act"}>
                    {e.status === "submitted" && <button type="button" className="ic-btn ok" title={t("team.time.filter.approved")} onClick={() => setOne.mutate({ id: e.id, status: "approved" })}><Check /></button>}
                    {e.status === "submitted" && <button type="button" className="ic-btn bad" title={t("team.time.filter.rejected")} onClick={() => setOne.mutate({ id: e.id, status: "rejected" })}><X /></button>}
                    {e.status !== "submitted" && <button type="button" className="text-link" style={{ color: "var(--muted-mk)" }} onClick={() => setOne.mutate({ id: e.id, status: "submitted" })}>{t("jobs.team.reopen")}</button>}
                    <button type="button" className="ic-btn danger" onClick={() => del.mutate(e.id)}><Trash2 /></button>
                  </div>}
                </div>
              ))}
            </section>
          ))}
          <div className="card-sum">{t("team.time.total")}: <b>{totals.hours.toFixed(2)} h · {formatCents(totals.cents)}</b></div>
        </div>
      )}
      <p className="foot-note">{t("team.time.hint")}</p>
    </div>
  );
}

// ── Equipment ────────────────────────────────────────────────────────────────

function EquipmentTab() {
  const { t } = useLanguage();
const can = useCan();
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
        <p className="foot-note m-0">{t("team.equipment.intro")}</p>
        <div className="grow">
          {can("team", "full") && <button type="button" className="btn btn-navy btn-sm" onClick={() => setEditing({ open: true, item: null })}><Plus className="h-4 w-4" /> {t("team.equipment.add")}</button>}
        </div>
      </div>
      {isLoading ? <div className="p-5"><Skeleton className="h-24 w-full rounded-[var(--radius-mk)]" /></div> : items.length === 0 ? (
        <div className="card-empty">{t("team.equipment.empty")}</div>
      ) : (
        <div className="tbl-wrap" tabIndex={0} role="region" aria-label={t("team.tab.equipment")}>
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
                    {can("team", "full") && <div className="row-act">
                      <button type="button" className="ic-btn" title={t("team.equipment.edit")} onClick={() => setEditing({ open: true, item: e })}><Pencil /></button>
                      <button type="button" className="text-link" style={{ color: "var(--muted-mk)" }} onClick={() => toggle.mutate(e)}>{e.active ? t("team.workers.deactivate") : t("team.workers.reactivate")}</button>
                      <button type="button" className="ic-btn danger" title={t("team.equipment.deleteConfirm")} onClick={() => { if (confirm(t("team.equipment.deleteConfirm"))) remove.mutate(e.id); }}><Trash2 /></button>
                    </div>}
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
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>{item ? t("team.equipment.edit") : t("team.equipment.add")}</DialogTitle><DialogDescription>{t("team.equipment.dialogDesc")}</DialogDescription></DialogHeader>
        <DialogBody>
          <div className="form-grid">
            <div className="field full"><label>{t("team.equipment.name")}</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("team.equipment.namePlaceholder")} autoFocus /></div>
            <div className="field"><label>{t("team.equipment.ownership")}</label>
              <select value={form.ownership} onChange={(e) => setForm({ ...form, ownership: e.target.value as EquipmentOwnership })}>
                {(["owned", "rented", "financed"] as const).map((o) => <option key={o} value={o}>{t(`team.ownership.${o}`)}</option>)}
              </select>
            </div>
            <div className="field"><label>{t("team.equipment.purchase")}</label><input type="number" step="0.01" value={form.purchase} onChange={(e) => setForm({ ...form, purchase: e.target.value })} /></div>
            <div className="field"><label>{t("team.equipment.rate")}</label><input type="number" step="0.01" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} placeholder="150.00" /></div>
            <div className="field"><label>{t("team.equipment.unit")}</label>
              <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value as UsageUnit })}><option value="day">{t("team.unit.dayLong")}</option><option value="hour">{t("team.unit.hourLong")}</option></select>
            </div>
            {form.ownership === "financed" && (
              <>
                <div className="field"><label>{t("team.equipment.lender")}</label><input value={form.lender} onChange={(e) => setForm({ ...form, lender: e.target.value })} /></div>
                <div className="field"><label>{t("team.equipment.monthly")}</label><input type="number" step="0.01" value={form.monthly} onChange={(e) => setForm({ ...form, monthly: e.target.value })} /></div>
                <div className="field"><label>{t("team.equipment.monthsLeft")}</label><input type="number" value={form.months} onChange={(e) => setForm({ ...form, months: e.target.value })} /></div>
              </>
            )}
            <div className="field full"><label>{t("team.equipment.notes")}</label><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
        </DialogBody>
        <DialogFooter>
          <span className="foot-note">{t("team.equipment.rateHint")}</span>
          <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => onOpenChange(false)}>{t("jobs.cancel")}</button>
          <button type="button" className="btn btn-sm btn-navy" disabled={!form.name.trim() || save.isPending} onClick={() => save.mutate()}>{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {t("jobs.save")}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

