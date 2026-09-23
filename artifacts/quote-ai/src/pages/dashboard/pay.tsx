import { useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { AlertTriangle, ArrowRight, Briefcase, ChevronLeft, ChevronRight, CircleCheck, Download, Info, Loader2, Lock, Plus, Settings2, Trash2, Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useCan, useRole } from "@/hooks/use-role";
import { useMediaQuery } from "@/hooks/use-media-query";
import { formatCents, jobsApi } from "@/lib/jobs-api";
import { teamApi } from "@/lib/team-api";
import {
  payApi,
  EARNING_KINDS,
  HOLIDAY_PAY_METHODS,
  PAY_EXPORT_FORMATS,
  PAY_FREQUENCIES,
  type AllowanceKind,
  type EmployeePayDto,
  type HolidayDto,
  type PayExportFormat,
  type PayPeriodDto,
  type PaySettings,
  type PaySettingsDto,
} from "@/lib/pay-api";

// ── Phase 89: /dashboard/pay ────────────────────────────────────────────────
// Everything before payroll: the pay period's hours split by the province's
// overtime rules, statutory holiday pay, travel and per diem, labour by job,
// and the file the payroll provider imports. Deductions, remittances and T4s
// stay with the provider — this page never pretends otherwise.

const TABS = ["period", "jobs", "settings"] as const;
type Tab = (typeof TABS)[number];
const TAB_ICONS: Record<Tab, typeof Wallet> = { period: Wallet, jobs: Briefcase, settings: Settings2 };

const day = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`);
const hrs = (n: number | null) => (n == null ? "—" : n.toFixed(2));
const toCents = (s: string) => Math.round((Number(s) || 0) * 100);
const dollars = (c: number) => (c / 100).toFixed(2);

type Enabled = Extract<PaySettingsDto, { enabled: true }>;

export default function PayPage() {
  const { t } = useLanguage();
  useDocumentTitle(t("pay.title"));
  const search = useSearch();
  const initial = new URLSearchParams(search).get("tab");
  const [tab, setTab] = useState<Tab>(TABS.includes(initial as Tab) ? (initial as Tab) : "period");
  // Wages are the office's (costs:full); a foreman is told so instead of asking and being refused.
  const { loaded: roleLoaded } = useRole();
  const allowed = useCan()("costs", "full");
  const { data, isLoading, error } = useQuery({ queryKey: ["pay-settings"], queryFn: payApi.settings, retry: false, enabled: roleLoaded && allowed });

  return (
    <div className="animate-in fade-in duration-500">
      <div className="page-head">
        <div>
          <h1>{t("pay.title")}</h1>
          <p className="sub">{t("pay.subtitle")}</p>
        </div>
      </div>

      {(!roleLoaded || (allowed && isLoading)) && <div className="space-y-3"><Skeleton className="h-12 w-full rounded-[var(--radius-mk)]" /><Skeleton className="h-64 w-full rounded-[var(--radius-mk)]" /></div>}

      {roleLoaded && (!allowed || error) && <div className="notice info"><Info /><span className="grow">{!allowed || (error as Error & { status?: number }).status === 403 ? t("pay.notYourRole") : (error as Error).message}</span></div>}

      {data && !data.enabled && (
        <section className="card">
          <div className="card-foot" style={{ borderTop: "none" }}>
            <div className="flex items-center gap-3 min-w-0">
              <span className="qa-ic navy"><Lock className="h-4 w-4" /></span>
              <span className="text-sm text-slate-600">{t("pay.locked")}</span>
            </div>
            <Link href="/dashboard/billing" className="cta-link" style={{ fontSize: 13.5 }}>{t("dashboard.calendar.upgrade")} <ArrowRight className="chev" /></Link>
          </div>
        </section>
      )}

      {data?.enabled && (
        <>
          <div className="pills mb-4">
            {TABS.map((k) => {
              const Icon = TAB_ICONS[k];
              return (
                <button key={k} type="button" onClick={() => setTab(k)} className={cn("pill", tab === k && "on")}>
                  <Icon /> {t(`pay.tab.${k}`)}
                </button>
              );
            })}
          </div>
          {tab === "period" && <PeriodTab settings={data} onSettings={() => setTab("settings")} />}
          {tab === "jobs" && <JobsTab />}
          {tab === "settings" && <SettingsTab data={data} />}
        </>
      )}
    </div>
  );
}

function useHolidayName() {
  const { t } = useLanguage();
  return (h: { key: string | null; name: string | null }) => (h.key ? t(`pay.holiday.${h.key}`) : (h.name ?? "—"));
}

/** The period being looked at, shared by the worksheet and the jobs tab (the URL keeps it across tabs). */
function usePeriod() {
  const [date, setDate] = useState<string | undefined>(() => new URLSearchParams(window.location.search).get("date") ?? undefined);
  const query = useQuery({ queryKey: ["pay-period", date ?? "default"], queryFn: () => payApi.period(date), retry: false });
  const go = (d: string) => {
    setDate(d);
    const u = new URL(window.location.href);
    u.searchParams.set("date", d);
    window.history.replaceState(null, "", u.toString());
  };
  return { ...query, go };
}

function PeriodNav({ data, go }: { data: PayPeriodDto; go: (d: string) => void }) {
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const label = `${format(day(data.period.start), "d MMM", { locale })} – ${format(day(data.period.end), "d MMM yyyy", { locale })}`;
  return (
    <div className="flex items-center gap-2">
      <button type="button" className="ic-btn" aria-label={t("pay.prevPeriod")} onClick={() => go(data.previousStart)}><ChevronLeft /></button>
      <span className="t-strong" style={{ whiteSpace: "nowrap" }}>{label}</span>
      <button type="button" className="ic-btn" aria-label={t("pay.nextPeriod")} onClick={() => go(data.nextStart)}><ChevronRight /></button>
      {data.isCurrent && <span className="chip chip-teal">{t("pay.current")}</span>}
    </div>
  );
}

// ── The period ───────────────────────────────────────────────────────────────

function PeriodTab({ settings, onSettings }: { settings: Enabled; onSettings: () => void }) {
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const queryClient = useQueryClient();
  const holidayName = useHolidayName();
  const { data, isLoading, error, go } = usePeriod();
  const [fmt, setFmt] = useState<PayExportFormat>(settings.effective.exportFormat);
  const [adding, setAdding] = useState<EmployeePayDto | null | "new">(null);
  useEffect(() => setFmt(settings.effective.exportFormat), [settings.effective.exportFormat]);
  // The download itself records the export; refresh the "exported" notices once it has had a moment to land.
  const afterExport = () => window.setTimeout(() => queryClient.invalidateQueries({ queryKey: ["pay-period"] }), 1500);
  const needsIds = fmt === "wagepoint" || fmt === "payworks";

  return (
    <div className="stack" style={{ gap: 16 }}>
      <section className="card">
        <div className="toolbar" style={{ flexWrap: "wrap", rowGap: 10 }}>
          {data ? <PeriodNav data={data} go={go} /> : <Skeleton className="h-8 w-56" />}
          <div className="grow flex flex-wrap items-center justify-end gap-2">
            <select className="inp-sm" style={{ width: "auto" }} aria-label={t("pay.export.format")} value={fmt} onChange={(e) => setFmt(e.target.value as PayExportFormat)}>
              {PAY_EXPORT_FORMATS.map((f) => <option key={f} value={f}>{t(`pay.format.${f}`)}</option>)}
            </select>
            {data && <a className="btn btn-sm btn-navy" href={payApi.exportUrl(data.period.start, fmt)} onClick={afterExport}><Download className="h-4 w-4" /> {t("pay.export.download")}</a>}
          </div>
        </div>
      </section>

      {isLoading && <Skeleton className="h-64 w-full rounded-[var(--radius-mk)]" />}
      {error && <div className="card card-empty">{(error as Error).message}</div>}

      {data && (
        <>
          {data.pending.count > 0 && (
            <div className="notice warn"><AlertTriangle /><span className="grow">{t("pay.pending").replace("{n}", String(data.pending.count)).replace("{h}", hrs(data.pending.hours))}</span><span className="actions"><Link href="/dashboard/team?tab=time" className="btn btn-sm btn-outline-navy">{t("pay.review")}</Link></span></div>
          )}
          {data.changedSinceExport.length > 0 && (
            <div className="notice warn"><AlertTriangle /><span className="grow">{t("pay.changedSinceExport").replace("{names}", data.changedSinceExport.join(", "))}</span></div>
          )}
          {data.exports[0] && data.changedSinceExport.length === 0 && (
            <div className="notice ok"><CircleCheck /><span className="grow">{t("pay.exported").replace("{format}", t(`pay.format.${data.exports[0].format}`)).replace("{date}", format(new Date(data.exports[0].exportedAt), "PPp", { locale })).replace("{name}", data.exports[0].exportedByName || "—")}</span></div>
          )}
          {needsIds && data.warnings.missingPayrollId.length > 0 && (
            <div className="notice info"><Info /><span className="grow">{t("pay.missingIds").replace("{names}", data.warnings.missingPayrollId.join(", "))}</span><span className="actions"><button type="button" onClick={onSettings} className="btn btn-sm btn-outline-navy">{t("pay.setIds")}</button></span></div>
          )}
          {data.warnings.zeroRate.length > 0 && (
            <div className="notice warn"><AlertTriangle /><span className="grow">{t("pay.zeroRate").replace("{names}", data.warnings.zeroRate.join(", "))}</span></div>
          )}
          {data.holidays.length > 0 && (
            <div className="notice info"><Info /><span className="grow">{t("pay.holidaysInPeriod").replace("{list}", data.holidays.map((h) => `${holidayName(h)} (${format(day(h.date), "d MMM", { locale })})`).join(", "))}</span></div>
          )}
          {fmt === "qbo_payroll" && <div className="notice info"><Info /><span className="grow">{t("pay.qboNote")}</span></div>}

          <section className="stat-grid">
            <Stat label={t("pay.stat.gross")} value={formatCents(data.totals.grossCents)} sub={data.employees.length === 1 ? t("pay.stat.employee") : t("pay.stat.employees").replace("{n}", String(data.employees.length))} />
            <Stat label={t("pay.stat.hours")} value={hrs(data.totals.hours)} sub={t("pay.stat.overtime").replace("{h}", hrs(data.totals.overtimeHours))} />
            <Stat label={t("pay.stat.holiday")} value={formatCents(data.totals.holidayCents)} />
            <Stat label={t("pay.stat.allowances")} value={formatCents(data.totals.allowanceCents)} />
          </section>

          {data.employees.length === 0 ? (
            <div className="card dashed card-empty">{t("pay.empty")}</div>
          ) : (
            data.employees.map((p) => <EmployeeCard key={p.workerId} p={p} onAdd={() => setAdding(p)} />)
          )}
          <div><button type="button" className="btn btn-sm btn-outline-navy" onClick={() => setAdding("new")}><Plus className="h-4 w-4" /> {t("pay.allowance.add")}</button></div>

          {data.subcontractors.length > 0 && (
            <section className="card">
              <div className="card-head"><div><h2>{t("pay.subs.title")}</h2><p className="sub">{t("pay.subs.sub")}</p></div></div>
              <div className="tbl-wrap" tabIndex={0} role="region" aria-label={t("pay.subs.title")}>
                <table className="tbl">
                  <thead><tr><th>{t("pay.col.name")}</th><th className="t-amt">{t("pay.col.hours")}</th><th className="t-amt">{t("pay.col.straight")}</th></tr></thead>
                  <tbody>{data.subcontractors.map((s) => <tr key={s.workerId}><td>{s.name}</td><td className="t-amt">{hrs(s.hours)}</td><td className="t-amt">{formatCents(s.amountCents)}</td></tr>)}</tbody>
                </table>
              </div>
            </section>
          )}
          <p className="foot-note">{t("pay.disclaimer")}</p>
          <AllowanceDialog target={adding} period={data} onClose={() => setAdding(null)} />
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card stat-card">
      <p className="lbl">{label}</p>
      <p className="val">{value}</p>
      {sub && <p className="sub">{sub}</p>}
    </div>
  );
}

function EmployeeCard({ p, onAdd }: { p: EmployeePayDto; onAdd: () => void }) {
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const holidayName = useHolidayName();
  const remove = useMutation({
    mutationFn: (id: string) => payApi.deleteAllowance(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pay-period"] }),
    onError: (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" }),
  });
  const missed = p.holidays.filter((h) => h.cents == null);
  // On a phone the table would push the amount off to the right; each line stacks instead.
  const phone = useMediaQuery("(max-width: 640px)");
  const qty = (l: EmployeePayDto["lines"][number]) => (l.hours != null ? `${hrs(l.hours)} h` : l.kind === "mileage" ? `${hrs(l.quantity)} km` : hrs(l.quantity));
  return (
    <section className="card">
      <div className="card-head">
        <div className="min-w-0">
          <h2 className="truncate">{p.name}</h2>
          <p className="sub">{p.payrollId ? `${t("pay.payrollNo")} ${p.payrollId}` : t("pay.noPayrollNo")}{p.jobs.length ? ` · ${p.jobs.join(", ")}` : ""}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="t-amt t-strong" style={{ fontSize: 17 }}>{formatCents(p.grossCents)}</span>
          <button type="button" className="ic-btn" aria-label={t("pay.allowance.addFor").replace("{name}", p.name)} title={t("pay.allowance.add")} onClick={onAdd}><Plus /></button>
        </div>
      </div>
      {phone ? (
        <ul aria-label={t("pay.linesFor").replace("{name}", p.name)} style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {p.lines.map((l, i) => (
            <li key={`${l.kind}-${l.rateCents}-${i}`} className="flex items-start gap-3" style={{ borderTop: "1px solid var(--soft)", padding: "10px 16px" }}>
              <div className="grow min-w-0">
                <p className="t-strong" style={{ margin: 0 }}>{t(`pay.earning.${l.kind}`)} <code className="text-xs">{l.code}</code></p>
                <p className="t-sub" style={{ margin: 0 }}>{qty(l)} × {formatCents(l.rateCents)}{!l.taxable ? ` · ${t("pay.nonTaxable")}` : ""}</p>
              </div>
              <span className="t-amt" style={{ whiteSpace: "nowrap" }}>{formatCents(l.amountCents)}</span>
            </li>
          ))}
        </ul>
      ) : (
      <div className="tbl-wrap" tabIndex={0} role="region" aria-label={t("pay.linesFor").replace("{name}", p.name)}>
        <table className="tbl">
          <thead><tr><th>{t("pay.col.earning")}</th><th>{t("pay.col.code")}</th><th className="t-amt">{t("pay.col.hoursQty")}</th><th className="t-amt">{t("pay.col.rate")}</th><th className="t-amt">{t("pay.col.amount")}</th></tr></thead>
          <tbody>
            {p.lines.map((l, i) => (
              <tr key={`${l.kind}-${l.rateCents}-${i}`}>
                <td>{t(`pay.earning.${l.kind}`)}{!l.taxable && <span className="t-sub">{t("pay.nonTaxable")}</span>}</td>
                <td><code>{l.code}</code></td>
                <td className="t-amt">{qty(l)}</td>
                <td className="t-amt">{formatCents(l.rateCents)}</td>
                <td className="t-amt">{formatCents(l.amountCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
      {(missed.length > 0 || p.allowances.length > 0) && (
        <div className="card-foot" style={{ display: "block" }}>
          {missed.map((h) => (
            <p key={h.date} className="foot-note m-0">{t("pay.noHolidayPay").replace("{holiday}", holidayName(h)).replace("{reason}", t(`pay.reason.${h.reason}`))}</p>
          ))}
          {p.allowances.length > 0 && (
            <ul style={{ margin: missed.length ? "8px 0 0" : 0, padding: 0, listStyle: "none" }}>
              {p.allowances.map((a) => (
                <li key={a.id} className="flex items-center gap-2 text-sm" style={{ padding: "2px 0" }}>
                  <span className="text-slate-500" style={{ whiteSpace: "nowrap" }}>{format(day(a.date), "d MMM", { locale })}</span>
                  <span className="grow min-w-0 truncate">{t(`pay.earning.${a.kind}`)}{a.kind === "mileage" ? ` · ${a.quantity} km` : a.kind === "per_diem" ? ` · ${a.quantity} ×` : ""}{a.projectName ? ` · ${a.projectName}` : ""}{a.note ? ` · ${a.note}` : ""}</span>
                  <span className="t-amt">{formatCents(a.amountCents)}</span>
                  <button type="button" className="ic-btn danger" aria-label={t("pay.allowance.remove")} disabled={remove.isPending} onClick={() => remove.mutate(a.id)}><Trash2 /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function AllowanceDialog({ target, period, onClose }: { target: EmployeePayDto | null | "new"; period: PayPeriodDto; onClose: () => void }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const open = target !== null;
  const workers = useQuery({ queryKey: ["pay-workers"], queryFn: payApi.workers, enabled: open });
  const jobs = useQuery({ queryKey: ["jobs"], queryFn: jobsApi.list, enabled: open });
  const employees = (workers.data?.workers ?? []).filter((w) => w.workerType === "employee" && w.active);
  const s = period.settings.allowances;
  const [form, setForm] = useState({ workerId: "", date: "", kind: "mileage" as AllowanceKind, quantity: "", amount: "", projectId: "", note: "" });
  useEffect(() => {
    if (!open) return;
    const date = period.today >= period.period.start && period.today <= period.period.end ? period.today : period.period.end;
    setForm({ workerId: target && target !== "new" ? target.workerId : "", date, kind: "mileage", quantity: "", amount: "", projectId: "", note: "" });
  }, [open, target, period]);
  const rate = form.kind === "mileage" ? s.kmRateCents : form.kind === "per_diem" ? s.perDiemCents : toCents(form.amount);
  const qty = form.kind === "other" ? 1 : Number(form.quantity) || 0;
  const save = useMutation({
    mutationFn: () => payApi.addAllowance({ workerId: form.workerId, date: form.date, kind: form.kind, quantity: qty, rateCents: form.kind === "other" ? toCents(form.amount) : undefined, projectId: form.projectId || null, note: form.note.trim() || undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["pay-period"] }); onClose(); },
    onError: (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" }),
  });
  const valid = form.workerId && form.date && qty > 0 && (form.kind !== "other" || toCents(form.amount) > 0);
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("pay.allowance.title")}</DialogTitle><DialogDescription>{t("pay.allowance.desc")}</DialogDescription></DialogHeader>
        <DialogBody>
          <div className="form-grid">
            <div className="field full"><label htmlFor="al-worker">{t("pay.allowance.worker")}</label>
              <select id="al-worker" value={form.workerId} onChange={(e) => setForm({ ...form, workerId: e.target.value })}>
                <option value="">—</option>
                {employees.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="field"><label htmlFor="al-kind">{t("pay.allowance.kind")}</label>
              <select id="al-kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as AllowanceKind })}>
                {(["mileage", "per_diem", "other"] as const).map((k) => <option key={k} value={k}>{t(`pay.earning.${k}`)}</option>)}
              </select>
            </div>
            <div className="field"><label htmlFor="al-date">{t("pay.allowance.date")}</label><input id="al-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            {form.kind !== "other" ? (
              <div className="field"><label htmlFor="al-qty">{form.kind === "mileage" ? t("pay.allowance.km") : t("pay.allowance.days")}</label><input id="al-qty" type="number" min="0" step={form.kind === "mileage" ? "1" : "0.5"} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
            ) : (
              <div className="field"><label htmlFor="al-amount">{t("pay.allowance.amount")}</label><input id="al-amount" type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            )}
            <div className="field"><label htmlFor="al-job">{t("pay.allowance.job")}</label>
              <select id="al-job" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
                <option value="">{t("pay.allowance.noJob")}</option>
                {(jobs.data?.items ?? []).filter((j) => !j.archivedAt).map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
            </div>
            <div className="field full"><label htmlFor="al-note">{t("pay.allowance.note")}</label><input id="al-note" maxLength={300} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
          </div>
          {form.kind !== "other" && (
            <p className="foot-note" style={{ marginTop: 10 }}>
              {rate > 0 ? t("pay.allowance.total").replace("{rate}", formatCents(rate)).replace("{total}", formatCents(Math.round(qty * rate))) : t("pay.allowance.noRate")}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <button type="button" className="btn btn-sm btn-outline-navy" onClick={onClose}>{t("jobs.cancel")}</button>
          <button type="button" className="btn btn-sm btn-navy" disabled={!valid || rate <= 0 || save.isPending} onClick={() => save.mutate()}>{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {t("jobs.save")}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Labour by job ────────────────────────────────────────────────────────────

function JobsTab() {
  const { t } = useLanguage();
  const { data, isLoading, error, go } = usePeriod();
  return (
    <div className="stack" style={{ gap: 16 }}>
      <section className="card"><div className="toolbar">{data ? <PeriodNav data={data} go={go} /> : <Skeleton className="h-8 w-56" />}<p className="foot-note m-0 grow">{t("pay.jobs.intro")}</p></div></section>
      {isLoading && <Skeleton className="h-64 w-full rounded-[var(--radius-mk)]" />}
      {error && <div className="card card-empty">{(error as Error).message}</div>}
      {data && (data.jobs.length === 0 ? <div className="card dashed card-empty">{t("pay.empty")}</div> : (
        <section className="card">
          <div className="tbl-wrap" tabIndex={0} role="region" aria-label={t("pay.tab.jobs")}>
            <table className="tbl">
              <thead><tr><th>{t("pay.col.job")}</th><th className="t-amt">{t("pay.col.hours")}</th><th className="t-amt">{t("pay.col.overtime")}</th><th className="t-amt">{t("pay.col.straight")}</th><th className="t-amt">{t("pay.col.premium")}</th><th className="t-amt">{t("pay.col.burden")}</th><th className="t-amt">{t("pay.col.allowances")}</th><th className="t-amt">{t("pay.col.total")}</th></tr></thead>
              <tbody>
                {data.jobs.map((j) => (
                  <tr key={j.projectId ?? "none"}>
                    <td>{j.projectId ? <Link href={`/dashboard/jobs/${j.projectId}`} className="t-strong text-link">{j.name ?? "—"}</Link> : <span className="t-sub">{t("pay.jobs.noJob")}</span>}</td>
                    <td className="t-amt">{hrs(j.hours)}</td>
                    <td className="t-amt">{j.overtimeHours ? hrs(j.overtimeHours) : "—"}</td>
                    <td className="t-amt">{formatCents(j.straightCents)}</td>
                    <td className="t-amt">{j.premiumCents ? formatCents(j.premiumCents) : "—"}</td>
                    <td className="t-amt">{formatCents(j.burdenCents)}</td>
                    <td className="t-amt">{j.allowanceCents ? formatCents(j.allowanceCents) : "—"}</td>
                    <td className="t-amt t-strong">{formatCents(j.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-foot"><span className="foot-note">{t("pay.jobs.foot").replace("{holiday}", formatCents(data.totals.holidayCents))}</span></div>
        </section>
      ))}
    </div>
  );
}

// ── Settings ─────────────────────────────────────────────────────────────────

const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));
const str = (n: number | null | undefined) => (n == null ? "" : String(n));

function SettingsTab({ data }: { data: Enabled }) {
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const holidayName = useHolidayName();
  const e = data.effective;
  const [form, setForm] = useState(() => formFrom(data));
  useEffect(() => setForm(formFrom(data)), [data]);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const body = (): PaySettings => ({
    frequency: form.frequency,
    ...(form.frequency === "weekly" || form.frequency === "biweekly" ? { anchorDate: form.anchorDate } : {}),
    weekStartsOn: form.weekStartsOn,
    overtime: form.ownOvertime ? { dailyHours: numOrNull(form.daily), dailyDoubleHours: numOrNull(form.double), weeklyHours: numOrNull(form.weekly), multiplier: Number(form.multiplier) || 1.5, doubleMultiplier: Number(form.doubleMultiplier) || 2 } : null,
    averaging: form.averaging ? { weeks: Number(form.avgWeeks) || 2, startDate: form.avgStart } : null,
    holidays: {
      ...(form.method !== data.provinceDefaults.holidays.method ? { method: form.method } : {}),
      ...(Number(form.workedMultiplier) !== data.provinceDefaults.holidays.workedMultiplier ? { workedMultiplier: Number(form.workedMultiplier) } : {}),
      ...(Number(form.minDaysWorked) !== data.provinceDefaults.holidays.minDaysWorked ? { minDaysWorked: Number(form.minDaysWorked) } : {}),
      ...(Number(form.minEmployedDays) !== data.provinceDefaults.holidays.minEmployedDays ? { minEmployedDays: Number(form.minEmployedDays) } : {}),
      added: form.added,
      removed: form.removed,
    },
    allowances: { kmRateCents: toCents(form.km), perDiemCents: toCents(form.perDiem) },
    exportFormat: form.exportFormat,
    earningCodes: Object.fromEntries(EARNING_KINDS.filter((k) => form.codes[k] && form.codes[k] !== data.provinceDefaults.earningCodes[k]).map((k) => [k, form.codes[k]])),
  });

  const save = useMutation({
    mutationFn: () => payApi.saveSettings(body()),
    onSuccess: (r) => {
      queryClient.setQueryData(["pay-settings"], r);
      queryClient.invalidateQueries({ queryKey: ["pay-period"] });
      toast({ title: t("pay.settings.saved"), description: r.recomputed ? t("pay.settings.recomputed").replace("{n}", String(r.recomputed)).replace("{date}", format(day(r.recomputedSince!), "PP", { locale })) : undefined });
    },
    onError: (err: Error) => toast({ title: t("jobs.error"), description: err.message, variant: "destructive" }),
  });

  const [newHoliday, setNewHoliday] = useState({ date: "", name: "" });
  const provinceDates = data.provinceHolidays;
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, i) => format(new Date(2026, 0, 4 + i), "EEEE", { locale })), [locale]);
  const d = data.provinceDefaults.overtime;
  const describe = (o: typeof d) => [o.dailyHours != null ? t("pay.settings.ruleDaily").replace("{h}", String(o.dailyHours)) : null, o.dailyDoubleHours != null ? t("pay.settings.ruleDouble").replace("{h}", String(o.dailyDoubleHours)) : null, o.weeklyHours != null ? t("pay.settings.ruleWeekly").replace("{h}", String(o.weeklyHours)) : null].filter(Boolean).join(" · ");

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="notice info"><Info /><span className="grow">{t("pay.settings.intro").replace("{province}", e.province)}</span></div>

      <section className="card">
        <div className="card-head"><div><h2>{t("pay.settings.periods")}</h2></div></div>
        <div className="p-5 form-grid">
          <div className="field"><label htmlFor="ps-freq">{t("pay.settings.frequency")}</label>
            <select id="ps-freq" value={form.frequency} onChange={(ev) => set({ frequency: ev.target.value as typeof form.frequency })}>
              {PAY_FREQUENCIES.map((f) => <option key={f} value={f}>{t(`pay.frequency.${f}`)}</option>)}
            </select>
          </div>
          {(form.frequency === "weekly" || form.frequency === "biweekly") && (
            <div className="field"><label htmlFor="ps-anchor">{t("pay.settings.anchor")}</label><input id="ps-anchor" type="date" value={form.anchorDate} onChange={(ev) => set({ anchorDate: ev.target.value })} /></div>
          )}
          <div className="field"><label htmlFor="ps-week">{t("pay.settings.weekStarts")}</label>
            <select id="ps-week" value={form.weekStartsOn} onChange={(ev) => set({ weekStartsOn: Number(ev.target.value) })}>
              {weekdays.map((w, i) => <option key={i} value={i}>{w}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-head"><div><h2>{t("pay.settings.overtime")}</h2><p className="sub">{t("pay.settings.provinceRule").replace("{province}", e.province).replace("{rule}", describe(d))}</p></div></div>
        <div className="p-5 stack" style={{ gap: 12 }}>
          <label className="chk-row"><input type="checkbox" checked={!form.ownOvertime} onChange={(ev) => set({ ownOvertime: !ev.target.checked })} /><span>{t("pay.settings.useProvince").replace("{province}", e.province)}</span></label>
          {form.ownOvertime && (
            <div className="form-grid" style={{ padding: 0 }}>
              <div className="field"><label htmlFor="ps-daily">{t("pay.settings.dailyHours")}</label><input id="ps-daily" type="number" min="1" step="0.5" value={form.daily} placeholder={t("pay.settings.none")} onChange={(ev) => set({ daily: ev.target.value })} /></div>
              <div className="field"><label htmlFor="ps-double">{t("pay.settings.doubleHours")}</label><input id="ps-double" type="number" min="1" step="0.5" value={form.double} placeholder={t("pay.settings.none")} onChange={(ev) => set({ double: ev.target.value })} /></div>
              <div className="field"><label htmlFor="ps-weekly">{t("pay.settings.weeklyHours")}</label><input id="ps-weekly" type="number" min="1" step="0.5" value={form.weekly} placeholder={t("pay.settings.none")} onChange={(ev) => set({ weekly: ev.target.value })} /></div>
              <div className="field"><label htmlFor="ps-mult">{t("pay.settings.multiplier")}</label><input id="ps-mult" type="number" min="1" step="0.25" value={form.multiplier} onChange={(ev) => set({ multiplier: ev.target.value })} /></div>
              <div className="field"><label htmlFor="ps-dmult">{t("pay.settings.doubleMultiplier")}</label><input id="ps-dmult" type="number" min="1" step="0.25" value={form.doubleMultiplier} onChange={(ev) => set({ doubleMultiplier: ev.target.value })} /></div>
            </div>
          )}
          <label className="chk-row"><input type="checkbox" checked={form.averaging} onChange={(ev) => set({ averaging: ev.target.checked })} /><span>{t("pay.settings.averaging")}<span className="block text-xs" style={{ color: "var(--muted-mk)" }}>{t("pay.settings.averagingHint")}</span></span></label>
          {form.averaging && (
            <div className="form-grid" style={{ padding: 0 }}>
              <div className="field"><label htmlFor="ps-avgw">{t("pay.settings.avgWeeks")}</label><input id="ps-avgw" type="number" min="2" max="12" value={form.avgWeeks} onChange={(ev) => set({ avgWeeks: ev.target.value })} /></div>
              <div className="field"><label htmlFor="ps-avgs">{t("pay.settings.avgStart")}</label><input id="ps-avgs" type="date" value={form.avgStart} onChange={(ev) => set({ avgStart: ev.target.value })} /></div>
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-head"><div><h2>{t("pay.settings.holidays")}</h2><p className="sub">{t("pay.settings.holidaysSub")}</p></div></div>
        <div className="p-5 stack" style={{ gap: 12 }}>
          <div className="form-grid" style={{ padding: 0 }}>
            <div className="field"><label htmlFor="ps-method">{t("pay.settings.method")}</label>
              <select id="ps-method" value={form.method} onChange={(ev) => set({ method: ev.target.value as typeof form.method })}>
                {HOLIDAY_PAY_METHODS.map((m) => <option key={m} value={m}>{t(`pay.method.${m}`)}</option>)}
              </select>
            </div>
            <div className="field"><label htmlFor="ps-wm">{t("pay.settings.workedMultiplier")}</label><input id="ps-wm" type="number" min="1" step="0.25" value={form.workedMultiplier} onChange={(ev) => set({ workedMultiplier: ev.target.value })} /></div>
            <div className="field"><label htmlFor="ps-mdw">{t("pay.settings.minDaysWorked")}</label><input id="ps-mdw" type="number" min="0" max="30" value={form.minDaysWorked} onChange={(ev) => set({ minDaysWorked: ev.target.value })} /></div>
            <div className="field"><label htmlFor="ps-med">{t("pay.settings.minEmployedDays")}</label><input id="ps-med" type="number" min="0" max="365" value={form.minEmployedDays} onChange={(ev) => set({ minEmployedDays: ev.target.value })} /></div>
          </div>
          <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
            <legend className="t-strong" style={{ marginBottom: 6 }}>{t("pay.settings.holidayList")}</legend>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", columns: "260px 2" }}>
              {provinceDates.map((h: HolidayDto) => (
                <li key={h.date} style={{ breakInside: "avoid" }}>
                  <label className="chk-row"><input type="checkbox" checked={!form.removed.includes(h.date)} onChange={(ev) => set({ removed: ev.target.checked ? form.removed.filter((x) => x !== h.date) : [...form.removed, h.date] })} /><span>{format(day(h.date), "EEE d MMM yyyy", { locale })} — {holidayName(h)}</span></label>
                </li>
              ))}
              {form.added.map((h) => (
                <li key={`add-${h.date}`} style={{ breakInside: "avoid" }} className="flex items-center gap-2">
                  <span className="text-sm">{format(day(h.date), "EEE d MMM yyyy", { locale })} — {h.name}</span>
                  <button type="button" className="ic-btn danger" aria-label={t("pay.settings.removeHoliday").replace("{name}", h.name)} onClick={() => set({ added: form.added.filter((x) => x.date !== h.date) })}><Trash2 /></button>
                </li>
              ))}
            </ul>
          </fieldset>
          <div className="flex flex-wrap items-end gap-2">
            <div className="field" style={{ margin: 0 }}><label htmlFor="ps-hd">{t("pay.settings.addDate")}</label><input id="ps-hd" type="date" value={newHoliday.date} onChange={(ev) => setNewHoliday({ ...newHoliday, date: ev.target.value })} /></div>
            <div className="field" style={{ margin: 0 }}><label htmlFor="ps-hn">{t("pay.settings.addName")}</label><input id="ps-hn" maxLength={80} value={newHoliday.name} onChange={(ev) => setNewHoliday({ ...newHoliday, name: ev.target.value })} /></div>
            <button type="button" className="btn btn-sm btn-outline-navy" disabled={!newHoliday.date || !newHoliday.name.trim()} onClick={() => { set({ added: [...form.added.filter((x) => x.date !== newHoliday.date), { date: newHoliday.date, name: newHoliday.name.trim() }] }); setNewHoliday({ date: "", name: "" }); }}><Plus className="h-4 w-4" /> {t("pay.settings.addHoliday")}</button>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-head"><div><h2>{t("pay.settings.allowances")}</h2></div></div>
        <div className="p-5 form-grid">
          <div className="field"><label htmlFor="ps-km">{t("pay.settings.kmRate")}</label><input id="ps-km" type="number" min="0" step="0.01" value={form.km} onChange={(ev) => set({ km: ev.target.value })} /></div>
          <div className="field"><label htmlFor="ps-pd">{t("pay.settings.perDiem")}</label><input id="ps-pd" type="number" min="0" step="0.01" value={form.perDiem} onChange={(ev) => set({ perDiem: ev.target.value })} /></div>
        </div>
      </section>

      <section className="card">
        <div className="card-head"><div><h2>{t("pay.settings.export")}</h2><p className="sub">{t("pay.settings.exportSub")}</p></div></div>
        <div className="p-5 form-grid">
          <div className="field full"><label htmlFor="ps-fmt">{t("pay.settings.defaultFormat")}</label>
            <select id="ps-fmt" value={form.exportFormat} onChange={(ev) => set({ exportFormat: ev.target.value as PayExportFormat })}>
              {PAY_EXPORT_FORMATS.map((f) => <option key={f} value={f}>{t(`pay.format.${f}`)}</option>)}
            </select>
          </div>
          {EARNING_KINDS.map((k) => (
            <div key={k} className="field"><label htmlFor={`ps-code-${k}`}>{t(`pay.earning.${k}`)}</label><input id={`ps-code-${k}`} maxLength={30} value={form.codes[k]} onChange={(ev) => set({ codes: { ...form.codes, [k]: ev.target.value } })} /></div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-sm btn-navy" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {t("pay.settings.save")}</button>
        {(form.ownOvertime || form.averaging || form.method !== data.provinceDefaults.holidays.method) && (
          <button type="button" className="text-link" onClick={() => { const h = data.provinceDefaults.holidays; set({ ownOvertime: false, averaging: false, method: h.method, workedMultiplier: String(h.workedMultiplier), minDaysWorked: String(h.minDaysWorked), minEmployedDays: String(h.minEmployedDays) }); }}>{t("pay.settings.resetRules")}</button>
        )}
        <p className="foot-note m-0 grow">{t("pay.settings.saveHint")}</p>
      </div>

      <PayrollNumbers />
      <p className="foot-note">{t("pay.disclaimer")}</p>
    </div>
  );
}

function formFrom(data: Enabled) {
  const e = data.effective;
  const s = data.settings;
  return {
    frequency: e.frequency,
    anchorDate: e.anchorDate,
    weekStartsOn: e.weekStartsOn,
    ownOvertime: !e.overtimeIsDefault,
    daily: str(e.overtime.dailyHours),
    double: str(e.overtime.dailyDoubleHours),
    weekly: str(e.overtime.weeklyHours),
    multiplier: String(e.overtime.multiplier),
    doubleMultiplier: String(e.overtime.doubleMultiplier),
    averaging: !!e.averaging,
    avgWeeks: String(e.averaging?.weeks ?? 2),
    avgStart: e.averaging?.startDate ?? e.anchorDate,
    method: e.holidays.method,
    workedMultiplier: String(e.holidays.workedMultiplier),
    minDaysWorked: String(e.holidays.minDaysWorked),
    minEmployedDays: String(e.holidays.minEmployedDays),
    added: s.holidays?.added ?? [],
    removed: s.holidays?.removed ?? [],
    km: dollars(e.allowances.kmRateCents),
    perDiem: dollars(e.allowances.perDiemCents),
    exportFormat: e.exportFormat,
    codes: { ...e.earningCodes },
  };
}

/** Payroll numbers in one place, rather than opening each worker. */
function PayrollNumbers() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["pay-workers"], queryFn: payApi.workers });
  const [draft, setDraft] = useState<Record<string, string>>({});
  const employees = (data?.workers ?? []).filter((w) => w.workerType === "employee");
  const save = useMutation({
    mutationFn: async () => {
      for (const w of employees) {
        const v = draft[w.id];
        if (v !== undefined && v.trim() !== (w.payrollId ?? "")) await teamApi.updateWorker(w.id, { payrollId: v.trim() || null });
      }
    },
    onSuccess: () => { setDraft({}); queryClient.invalidateQueries({ queryKey: ["pay-workers"] }); queryClient.invalidateQueries({ queryKey: ["pay-period"] }); queryClient.invalidateQueries({ queryKey: ["workers"] }); toast({ title: t("pay.settings.saved") }); },
    onError: (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" }),
  });
  if (!employees.length) return null;
  const dirty = employees.some((w) => draft[w.id] !== undefined && draft[w.id]!.trim() !== (w.payrollId ?? ""));
  return (
    <section className="card">
      <div className="card-head"><div><h2>{t("pay.ids.title")}</h2><p className="sub">{t("pay.ids.sub")}</p></div></div>
      {/* Its inputs take focus themselves, so no scroll region of its own. */}
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>{t("pay.col.name")}</th><th>{t("pay.ids.number")}</th></tr></thead>
          <tbody>
            {employees.map((w) => (
              <tr key={w.id}>
                <td>{w.name}{!w.active && <span className="t-sub">{t("pay.ids.inactive")}</span>}</td>
                <td><input className="inp-sm" style={{ width: 180 }} aria-label={t("pay.ids.numberFor").replace("{name}", w.name)} maxLength={40} value={draft[w.id] ?? w.payrollId ?? ""} onChange={(e) => setDraft({ ...draft, [w.id]: e.target.value })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card-foot"><span className="foot-note">{t("pay.ids.hint")}</span><button type="button" className="btn btn-sm btn-navy" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {t("jobs.save")}</button></div>
    </section>
  );
}
