import { useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { AlertTriangle, ArrowRight, BellRing, CalendarClock, Check, Download, ExternalLink, Info, Landmark, Loader2, Lock, Pencil, Plus, Receipt, Settings2, Trash2, Undo2, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCan } from "@/hooks/use-role";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { formatCents } from "@/lib/jobs-api";
import {
  complianceApi,
  type ComplianceSettings,
  type DeadlineDto,
  type ReminderDto,
  type ReminderInput,
  type ReminderPresetDto,
  type ReminderRecurrence,
  type Registrations,
} from "@/lib/compliance-api";

// ── Phase 87: /dashboard/compliance ─────────────────────────────────────────
// Every deadline the business has, worked out from how it files; the net
// tax for a period out of its own invoices and receipts; who it paid for
// construction work (T5018); and the renewals it tracks itself. It prepares
// and reminds — the contractor or their accountant files.

const TABS = ["deadlines", "salesTax", "t5018", "reminders"] as const;
type Tab = (typeof TABS)[number];
const TAB_ICONS: Record<Tab, typeof Landmark> = { deadlines: CalendarClock, salesTax: Receipt, t5018: Users, reminders: BellRing };

const dayDate = (s: string) => new Date(`${s}T00:00:00`);
const todayIso = () => format(new Date(), "yyyy-MM-dd");

type Period = { from: string; to: string };

export default function CompliancePage() {
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  useDocumentTitle(t("compliance.title"));
  const search = useSearch();
  const initial = new URLSearchParams(search).get("tab");
  const [tab, setTab] = useState<Tab>(TABS.includes(initial as Tab) ? (initial as Tab) : "deadlines");
  const [period, setPeriod] = useState<Period | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["compliance"], queryFn: complianceApi.overview });

  const openWorksheet = (d: DeadlineDto) => {
    setPeriod({ from: d.periodStart, to: d.periodEnd });
    setTab("salesTax");
  };

  const overdue = data?.enabled ? data.deadlines.filter((d) => d.state === "overdue").length + data.reminders.filter((r) => r.state === "overdue").length : 0;

  return (
    <div className="animate-in fade-in duration-500">
      <div className="page-head">
        <div>
          <h1>{t("compliance.title")}</h1>
          <p className="sub">{t("compliance.subtitle")}</p>
        </div>
      </div>

      <div className="notice info mb-4">
        <Info />
        <span className="grow" style={{ fontWeight: 500 }}>{t("compliance.disclaimer")}</span>
      </div>

      {isLoading && <div className="space-y-3"><Skeleton className="h-16 w-full rounded-[var(--radius-mk)]" /><Skeleton className="h-64 w-full rounded-[var(--radius-mk)]" /></div>}

      {data && !data.enabled && (
        <section className="card">
          <div className="card-foot" style={{ borderTop: "none" }}>
            <div className="flex items-center gap-3 min-w-0">
              <span className="qa-ic navy"><Lock className="h-4 w-4" /></span>
              <span className="text-sm text-slate-600">{t("compliance.locked")}</span>
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
                  <Icon /> {t(`compliance.tab.${k}`)}{k === "deadlines" && overdue ? <span className="cnt">{overdue}</span> : null}
                </button>
              );
            })}
          </div>
          {tab === "deadlines" && <DeadlinesTab deadlines={data.deadlines} reminders={data.reminders} settings={data.settings} registrations={data.registrations} locale={locale} onWorksheet={openWorksheet} onReminders={() => setTab("reminders")} />}
          {tab === "salesTax" && <SalesTaxTab deadlines={data.deadlines} period={period} setPeriod={setPeriod} locale={locale} />}
          {tab === "t5018" && <T5018Tab settings={data.settings} />}
          {tab === "reminders" && <RemindersTab reminders={data.reminders} presets={data.presets} locale={locale} />}
        </>
      )}
    </div>
  );
}

// ── Deadlines ────────────────────────────────────────────────────────────────

type Row =
  | { type: "deadline"; due: string; d: DeadlineDto }
  | { type: "reminder"; due: string; r: ReminderDto };

function StateChip({ state, daysLeft }: { state: string; daysLeft: number }) {
  const { t } = useLanguage();
  if (state === "filed") return <span className="chip chip-green">{t("compliance.state.filed")}</span>;
  if (state === "overdue") return <span className="chip chip-red">{t("compliance.state.overdue").replace("{n}", String(-daysLeft))}</span>;
  if (state === "due_soon") return <span className="chip chip-yellow">{daysLeft === 0 ? t("compliance.state.today") : t("compliance.state.inDays").replace("{n}", String(daysLeft))}</span>;
  return <span className="chip chip-grey">{t("compliance.state.inDays").replace("{n}", String(daysLeft))}</span>;
}

function deadlineLabel(t: (k: string) => string, d: Pick<DeadlineDto, "kind" | "tax">): string {
  return t(`compliance.kind.${d.kind}`).replace("{tax}", d.tax);
}

function DeadlinesTab({ deadlines, reminders, settings, registrations, locale, onWorksheet, onReminders }: { deadlines: DeadlineDto[]; reminders: ReminderDto[]; settings: ComplianceSettings; registrations: Registrations; locale: typeof enCA; onWorksheet: (d: DeadlineDto) => void; onReminders: () => void }) {
  const { t } = useLanguage();
  const can = useCan();
  const canFull = can("invoicing", "full");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [setupOpen, setSetupOpen] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["compliance"] });
  const onError = (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" });
  const mark = useMutation({ mutationFn: (d: DeadlineDto) => complianceApi.markFiled(d.kind, d.periodKey), onSuccess: () => { refresh(); toast({ title: t("compliance.markedToast") }); }, onError });
  const unmark = useMutation({ mutationFn: (d: DeadlineDto) => complianceApi.unmarkFiled(d.kind, d.periodKey), onSuccess: refresh, onError });
  const done = useMutation({ mutationFn: (id: string) => complianceApi.reminderDone(id), onSuccess: refresh, onError });

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [...deadlines.map((d) => ({ type: "deadline" as const, due: d.dueDate, d })), ...reminders.map((r) => ({ type: "reminder" as const, due: r.dueDate, r }))];
    return out.sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0));
  }, [deadlines, reminders]);

  const today = todayIso();
  const horizon = format(new Date(Date.now() + 90 * 86_400_000), "yyyy-MM-dd");
  const groups: { key: string; rows: Row[] }[] = [
    { key: "overdue", rows: rows.filter((r) => r.due < today && (r.type === "reminder" || r.d.state !== "filed")) },
    { key: "soon", rows: rows.filter((r) => r.due >= today && r.due <= horizon) },
    { key: "later", rows: rows.filter((r) => r.due > horizon) },
  ];
  const configured = !!(settings.salesTaxFrequency || settings.pstFrequency || settings.t5018);
  const missingNumber = !registrations.gstHstNumber;

  return (
    <div className="stack" style={{ gap: 16 }}>
      {!configured && (
        <div className="notice warn">
          <AlertTriangle />
          <span className="grow">{t("compliance.setupPrompt")}</span>
          {canFull && <span className="actions"><button type="button" className="btn btn-sm btn-navy" onClick={() => setSetupOpen(true)}><Settings2 className="h-4 w-4" /> {t("compliance.setup")}</button></span>}
        </div>
      )}

      <section className="card">
        <div className="card-head">
          <div className="min-w-0">
            <h2><Landmark className="h-4 w-4" /> {t("compliance.registrations")}</h2>
            <p className="sub">
              {[
                registrations.gstHstNumber ? `${registrations.province === "QC" ? "GST" : "GST/HST"} ${registrations.gstHstNumber}` : null,
                registrations.qstNumber ? `QST ${registrations.qstNumber}` : null,
                registrations.pstNumber ? `${registrations.province === "MB" ? "RST" : "PST"} ${registrations.pstNumber}` : null,
              ].filter(Boolean).join(" · ") || t("compliance.noNumbers")}
            </p>
          </div>
          {canFull && configured && <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => setSetupOpen(true)}><Settings2 className="h-4 w-4" /> {t("compliance.setup")}</button>}
        </div>
        {missingNumber && (
          <div className="card-foot">
            <span className="foot-note">{t("compliance.missingNumber")}</span>
            <Link href="/dashboard/settings?tab=business" className="cta-link" style={{ fontSize: 13 }}>{t("compliance.openSettings")} <ArrowRight className="chev" /></Link>
          </div>
        )}
      </section>

      {rows.length === 0 ? (
        <div className="card card-empty">
          {configured ? t("compliance.nothingDue") : t("compliance.emptyUnconfigured")}{" "}
          <button type="button" className="text-link" onClick={onReminders}>{t("compliance.addReminderLink")}</button>
        </div>
      ) : (
        groups.filter((g) => g.rows.length > 0).map((g) => (
          <section key={g.key} className="card">
            <div className="card-head"><div><h2>{t(`compliance.group.${g.key}`)}</h2></div></div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t("compliance.col.due")}</th>
                    <th>{t("compliance.col.what")}</th>
                    <th>{t("compliance.col.status")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((row) => row.type === "deadline" ? (
                    <tr key={row.d.key}>
                      <td className="t-strong" style={{ whiteSpace: "nowrap" }}>{format(dayDate(row.d.dueDate), "PP", { locale })}</td>
                      <td>
                        <span className="t-strong">{deadlineLabel(t, row.d)}</span>
                        <span className="t-sub">
                          {t("compliance.period").replace("{from}", format(dayDate(row.d.periodStart), "d MMM yyyy", { locale })).replace("{to}", format(dayDate(row.d.periodEnd), "d MMM yyyy", { locale }))}
                          {" · "}
                          <a href={row.d.url} target="_blank" rel="noreferrer noopener" className="text-link">{t(`compliance.authority.${row.d.kind === "t5018" ? "t5018" : row.d.authority}`)} <ExternalLink className="h-3 w-3 inline" /></a>
                        </span>
                        {row.d.filedAt && <span className="t-sub">{t("compliance.filedOn").replace("{date}", format(new Date(row.d.filedAt), "PP", { locale }))}{row.d.filedByName ? ` · ${row.d.filedByName}` : ""}</span>}
                      </td>
                      <td><StateChip state={row.d.state} daysLeft={row.d.daysLeft} /></td>
                      <td>
                        <div className="row-act">
                          {row.d.hasWorksheet && <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => onWorksheet(row.d)}><Receipt className="h-3.5 w-3.5" /> {t("compliance.prepare")}</button>}
                          {row.d.kind === "t5018" && <Link href="/dashboard/compliance?tab=t5018" className="btn btn-sm btn-outline-navy"><Users className="h-3.5 w-3.5" /> {t("compliance.prepare")}</Link>}
                          {canFull && (row.d.state === "filed"
                            ? <button type="button" className="text-link" onClick={() => unmark.mutate(row.d)} title={t("compliance.unmark")}><Undo2 className="h-3.5 w-3.5" /> {t("compliance.unmark")}</button>
                            : <button type="button" className="btn btn-sm btn-navy" disabled={mark.isPending} onClick={() => mark.mutate(row.d)}><Check className="h-3.5 w-3.5" /> {t(row.d.kind === "sales_tax_payment" || row.d.kind === "gst_instalment" ? "compliance.markPaid" : "compliance.markFiled")}</button>)}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={row.r.id}>
                      <td className="t-strong" style={{ whiteSpace: "nowrap" }}>{format(dayDate(row.r.dueDate), "PP", { locale })}</td>
                      <td>
                        <span className="t-strong">{row.r.title}</span>
                        <span className="t-sub">
                          {[t(`compliance.reminderKind.${row.r.kind}`), row.r.authority, row.r.reference].filter(Boolean).join(" · ")}
                          {row.r.url && <> · <a href={row.r.url} target="_blank" rel="noreferrer noopener" className="text-link">{t("compliance.open")} <ExternalLink className="h-3 w-3 inline" /></a></>}
                        </span>
                      </td>
                      <td><StateChip state={row.r.state} daysLeft={row.r.daysLeft} /></td>
                      <td>
                        {canFull && <div className="row-act"><button type="button" className="btn btn-sm btn-navy" disabled={done.isPending} onClick={() => done.mutate(row.r.id)}><Check className="h-3.5 w-3.5" /> {t("compliance.done")}</button></div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}

      <SetupDialog open={setupOpen} onOpenChange={setSetupOpen} settings={settings} province={registrations.province} hasPst={!!registrations.pstNumber} />
    </div>
  );
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const lastDayOf = (m: number) => new Date(2025, m, 0).getDate();

function SetupDialog({ open, onOpenChange, settings, province, hasPst }: { open: boolean; onOpenChange: (v: boolean) => void; settings: ComplianceSettings; province: string | null; hasPst: boolean }) {
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ComplianceSettings>({});
  useEffect(() => {
    if (open) setForm({ ...settings, fiscalYearEnd: settings.fiscalYearEnd ?? "12-31" });
  }, [open, settings]);
  const pstProvince = province === "BC" || province === "SK" || province === "MB";
  const save = useMutation({
    mutationFn: () => complianceApi.saveSettings(form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["compliance"] }); queryClient.invalidateQueries({ queryKey: ["agenda"] }); onOpenChange(false); },
    onError: (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" }),
  });
  const fyeMonth = Number((form.fiscalYearEnd ?? "12-31").slice(0, 2));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>{t("compliance.setupTitle")}</DialogTitle><DialogDescription>{t("compliance.setupDesc")}</DialogDescription></DialogHeader>
        <DialogBody>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="c-freq">{t(province === "QC" ? "compliance.freqQc" : "compliance.freq")}</label>
              <select id="c-freq" value={form.salesTaxFrequency ?? ""} onChange={(e) => setForm({ ...form, salesTaxFrequency: (e.target.value || null) as ComplianceSettings["salesTaxFrequency"] })}>
                <option value="">{t("compliance.notRegistered")}</option>
                <option value="monthly">{t("compliance.freq.monthly")}</option>
                <option value="quarterly">{t("compliance.freq.quarterly")}</option>
                <option value="annual">{t("compliance.freq.annual")}</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="c-fye">{t("compliance.fye")}</label>
              <select id="c-fye" value={fyeMonth} onChange={(e) => { const m = Number(e.target.value); setForm({ ...form, fiscalYearEnd: `${String(m).padStart(2, "0")}-${lastDayOf(m)}` }); }}>
                {MONTHS.map((m) => <option key={m} value={m}>{format(new Date(2025, m - 1, lastDayOf(m)), "d MMMM", { locale })}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="c-structure">{t("compliance.structure")}</label>
              <select id="c-structure" value={form.structure ?? ""} onChange={(e) => setForm({ ...form, structure: (e.target.value || null) as ComplianceSettings["structure"] })}>
                <option value="">—</option>
                <option value="sole_proprietor">{t("compliance.structure.sole_proprietor")}</option>
                <option value="partnership">{t("compliance.structure.partnership")}</option>
                <option value="corporation">{t("compliance.structure.corporation")}</option>
              </select>
            </div>
            {pstProvince && (
              <div className="field">
                <label htmlFor="c-pst">{t(province === "MB" ? "compliance.rstFreq" : "compliance.pstFreq")}</label>
                <select id="c-pst" value={form.pstFrequency ?? ""} onChange={(e) => setForm({ ...form, pstFrequency: (e.target.value || null) as ComplianceSettings["pstFrequency"] })} disabled={!hasPst}>
                  <option value="">{t("compliance.notRegistered")}</option>
                  <option value="monthly">{t("compliance.freq.monthly")}</option>
                  <option value="quarterly">{t("compliance.freq.quarterly")}</option>
                  <option value="semiannual">{t("compliance.freq.semiannual")}</option>
                  <option value="annual">{t("compliance.freq.annual")}</option>
                </select>
                {!hasPst && <p className="foot-note" style={{ marginTop: 6 }}>{t("compliance.pstNeedsNumber")}</p>}
              </div>
            )}
            {form.salesTaxFrequency === "annual" && (
              <label className="field full flex items-start gap-2" style={{ fontWeight: 500 }}>
                <input type="checkbox" className="mt-1" checked={!!form.instalments} onChange={(e) => setForm({ ...form, instalments: e.target.checked })} />
                <span>{t("compliance.instalments")}</span>
              </label>
            )}
            <label className="field full flex items-start gap-2" style={{ fontWeight: 500 }}>
              <input type="checkbox" className="mt-1" checked={!!form.t5018} onChange={(e) => setForm({ ...form, t5018: e.target.checked })} />
              <span>{t("compliance.t5018Toggle")}</span>
            </label>
          </div>
        </DialogBody>
        <DialogFooter>
          <span className="foot-note">{t("compliance.setupHint")}</span>
          <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => onOpenChange(false)}>{t("jobs.cancel")}</button>
          <button type="button" className="btn btn-sm btn-navy" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {t("jobs.save")}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Sales tax worksheet ──────────────────────────────────────────────────────

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "ok" | "bad" | "teal" }) {
  return (
    <div className="card stat-card">
      <p className="lbl">{label}</p>
      <p className={cn("val", tone)}>{value}</p>
      {sub && <p className="sub">{sub}</p>}
    </div>
  );
}

function SalesTaxTab({ deadlines, period, setPeriod, locale }: { deadlines: DeadlineDto[]; period: Period | null; setPeriod: (p: Period) => void; locale: typeof enCA }) {
  const { t } = useLanguage();
  const choices = useMemo(() => {
    const seen = new Set<string>();
    return deadlines.filter((d) => d.hasWorksheet && d.periodStart <= todayIso()).filter((d) => {
      const k = `${d.periodStart}:${d.periodEnd}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).reverse();
  }, [deadlines]);
  // Default: the most recent period that has started, or this quarter so far.
  const fallback = useMemo<Period>(() => {
    if (choices[0]) return { from: choices[0].periodStart, to: choices[0].periodEnd };
    const now = new Date();
    const q = Math.floor(now.getMonth() / 3) * 3;
    return { from: format(new Date(now.getFullYear(), q, 1), "yyyy-MM-dd"), to: format(new Date(now.getFullYear(), q + 3, 0), "yyyy-MM-dd") };
  }, [choices]);
  const p = period ?? fallback;
  const { data, isLoading, error } = useQuery({ queryKey: ["worksheet", p.from, p.to], queryFn: () => complianceApi.worksheet(p.from, p.to), retry: false });
  const s = data?.summary;
  const qc = data?.province === "QC";
  const pstLabel = data?.province === "MB" ? "RST" : "PST";

  return (
    <div className="stack" style={{ gap: 16 }}>
      <section className="card">
        <div className="toolbar">
          {choices.length > 0 && (
            <select className="inp-sm" style={{ width: "auto" }} aria-label={t("compliance.pickPeriod")} value={`${p.from}:${p.to}`} onChange={(e) => { const [from, to] = e.target.value.split(":"); if (from && to) setPeriod({ from, to }); }}>
              {!choices.some((c) => c.periodStart === p.from && c.periodEnd === p.to) && <option value={`${p.from}:${p.to}`}>{t("compliance.customPeriod")}</option>}
              {choices.map((c) => <option key={c.key} value={`${c.periodStart}:${c.periodEnd}`}>{`${c.tax} · ${format(dayDate(c.periodStart), "d MMM", { locale })} – ${format(dayDate(c.periodEnd), "d MMM yyyy", { locale })}`}</option>)}
            </select>
          )}
          <label className="flex items-center gap-2 text-sm">{t("compliance.from")}<input type="date" className="inp-sm" style={{ width: 150 }} value={p.from} onChange={(e) => e.target.value && setPeriod({ from: e.target.value, to: p.to })} /></label>
          <label className="flex items-center gap-2 text-sm">{t("compliance.to")}<input type="date" className="inp-sm" style={{ width: 150 }} value={p.to} onChange={(e) => e.target.value && setPeriod({ from: p.from, to: e.target.value })} /></label>
          <div className="grow flex justify-end">
            <a href={complianceApi.worksheetCsvUrl(p.from, p.to)} className="btn btn-sm btn-outline-navy"><Download className="h-4 w-4" /> {t("compliance.csv")}</a>
          </div>
        </div>
      </section>

      {isLoading && <Skeleton className="h-40 w-full rounded-[var(--radius-mk)]" />}
      {error && <div className="card card-empty">{(error as Error).message}</div>}

      {s && data && (
        <>
          <section className="stat-grid">
            <Stat label={t("compliance.line101")} value={formatCents(s.salesCents)} sub={t("compliance.invoiceCount").replace("{n}", String(s.invoiceCount))} />
            <Stat label={qc ? t("compliance.line105qc") : t("compliance.line105")} value={formatCents(s.gstHst.collectedCents)} />
            <Stat label={t("compliance.line108")} value={formatCents(s.gstHst.creditsCents)} tone="teal" />
            <Stat label={t("compliance.line109")} value={formatCents(s.gstHst.netCents)} sub={s.gstHst.netCents < 0 ? t("compliance.refund") : undefined} tone={s.gstHst.netCents < 0 ? "ok" : undefined} />
          </section>
          {(qc || s.qst.collectedCents !== 0 || s.qst.creditsCents !== 0) && (
            <section className="stat-grid">
              <Stat label={t("compliance.qstCollected")} value={formatCents(s.qst.collectedCents)} />
              <Stat label={t("compliance.qstCredits")} value={formatCents(s.qst.creditsCents)} tone="teal" />
              <Stat label={t("compliance.qstNet")} value={formatCents(s.qst.netCents)} sub={s.qst.netCents < 0 ? t("compliance.refund") : undefined} />
              <Stat label={t("compliance.nonRecoverable")} value={formatCents(s.nonRecoverableCents)} />
            </section>
          )}
          {s.pst.collectedCents !== 0 && (
            <div className="notice info"><Info /><span className="grow">{t("compliance.pstCollected").replace("{tax}", pstLabel).replace("{amount}", formatCents(s.pst.collectedCents))}</span></div>
          )}
          {s.warnings.pendingCostCount > 0 && (
            <div className="notice warn"><AlertTriangle /><span className="grow">{t("compliance.warnPending").replace("{n}", String(s.warnings.pendingCostCount)).replace("{amount}", formatCents(s.warnings.pendingTaxCents))}</span></div>
          )}
          {s.warnings.unsplitCostCount > 0 && (
            <div className="notice warn"><AlertTriangle /><span className="grow">{t("compliance.warnUnsplit").replace("{n}", String(s.warnings.unsplitCostCount)).replace("{amount}", formatCents(s.warnings.unsplitTaxCents))}</span></div>
          )}
          {s.warnings.genericTaxCents !== 0 && (
            <div className="notice warn"><AlertTriangle /><span className="grow">{t("compliance.warnGeneric").replace("{amount}", formatCents(s.warnings.genericTaxCents))}</span></div>
          )}

          <section className="card">
            <div className="card-head"><div><h2>{t("compliance.invoicesIssued")}</h2><p className="sub">{t("compliance.invoicesIssuedSub")}</p></div></div>
            {data.invoices.length === 0 ? <div className="card-empty">{t("compliance.noInvoices")}</div> : (
              <div className="tbl-wrap" tabIndex={0} role="region" aria-label={t("compliance.invoicesIssued")}>
                <table className="tbl">
                  <thead><tr><th>{t("compliance.col.date")}</th><th>{t("compliance.col.invoice")}</th><th className="t-amt">{t("compliance.col.preTax")}</th><th className="t-amt">{t("compliance.col.tax")}</th></tr></thead>
                  <tbody>
                    {data.invoices.slice(0, 100).map((inv) => (
                      <tr key={inv.id}>
                        <td>{format(dayDate(inv.day), "PP", { locale })}</td>
                        <td><Link href={`/dashboard/invoices/${inv.id}`} className="t-strong text-link">{inv.number}</Link><span className="t-sub">{inv.customer}</span></td>
                        <td className="t-amt">{formatCents(inv.taxableCents)}</td>
                        <td className="t-amt">{inv.taxLines.map((l) => `${l.code} ${formatCents(l.amountCents)}`).join(" · ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <div className="card-head"><div><h2>{t("compliance.purchases")}</h2><p className="sub">{t("compliance.purchasesSub")}</p></div></div>
            {data.costs.length === 0 ? <div className="card-empty">{t("compliance.noPurchases")}</div> : (
              <div className="tbl-wrap" tabIndex={0} role="region" aria-label={t("compliance.purchases")}>
                <table className="tbl">
                  <thead><tr><th>{t("compliance.col.date")}</th><th>{t("compliance.col.vendor")}</th><th className="t-amt">{t("compliance.col.preTax")}</th><th className="t-amt">{t("compliance.col.credit")}</th></tr></thead>
                  <tbody>
                    {data.costs.slice(0, 100).map((c) => {
                      const b = c.taxBreakdown;
                      const split = (b.GST ?? 0) + (b.HST ?? 0) + (b.QST ?? 0) + (b.PST ?? 0) + (b.RST ?? 0);
                      const counted = c.status === "confirmed" && !(c.taxCents > 0 && split === 0);
                      const credit = (["GST", "HST", "QST"] as const).filter((k) => b[k]).map((k) => `${k} ${formatCents(b[k]!)}`).join(" · ");
                      return (
                        <tr key={c.id}>
                          <td>{format(dayDate(c.day), "PP", { locale })}</td>
                          <td><span className="t-strong">{c.vendor || "—"}</span><span className="t-sub">{c.description}</span></td>
                          <td className="t-amt">{formatCents(c.subtotalCents)}</td>
                          <td className="t-amt">{counted ? credit || "—" : <span className="chip chip-yellow">{c.status !== "confirmed" ? t("compliance.awaitingReview") : t("compliance.notSplit")}</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {(data.costs.length > 100 || data.invoices.length > 100) && <div className="card-foot"><span className="foot-note">{t("compliance.truncated")}</span></div>}
          </section>
        </>
      )}
    </div>
  );
}

// ── T5018 ────────────────────────────────────────────────────────────────────

function T5018Tab({ settings }: { settings: ComplianceSettings }) {
  const { t } = useLanguage();
  const thisYear = new Date().getFullYear();
  // Before the June 30 deadline, last year is the one being prepared.
  const [year, setYear] = useState(new Date().getMonth() < 6 ? thisYear - 1 : thisYear);
  const { data, isLoading } = useQuery({ queryKey: ["t5018", year], queryFn: () => complianceApi.t5018(year) });
  return (
    <div className="stack" style={{ gap: 16 }}>
      {!settings.t5018 && <div className="notice info"><Info /><span className="grow">{t("compliance.t5018Off")}</span></div>}
      <section className="card">
        <div className="toolbar">
          <p className="foot-note m-0">{t("compliance.t5018Intro")}</p>
          <div className="grow flex items-center justify-end gap-2">
            <select className="inp-sm" style={{ width: "auto" }} aria-label={t("compliance.year")} value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {[thisYear, thisYear - 1, thisYear - 2, thisYear - 3].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <a href={complianceApi.t5018CsvUrl(year)} className="btn btn-sm btn-outline-navy"><Download className="h-4 w-4" /> {t("compliance.csv")}</a>
          </div>
        </div>
        {isLoading ? <div className="p-5"><Skeleton className="h-24 w-full" /></div> : !data || data.recipients.length === 0 ? (
          <div className="card-empty">{t("compliance.t5018Empty")}</div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>{t("compliance.col.recipient")}</th><th>{t("compliance.col.entries")}</th><th className="t-amt">{t("compliance.col.preTax")}</th><th className="t-amt">{t("compliance.col.tax")}</th><th className="t-amt">{t("compliance.col.total")}</th><th></th></tr></thead>
              <tbody>
                {data.recipients.map((r) => (
                  <tr key={r.key}>
                    <td><span className="t-strong">{r.name}</span><span className="t-sub">{t(`compliance.source.${r.source}`)}</span></td>
                    <td>{r.entryCount}</td>
                    <td className="t-amt">{formatCents(r.subtotalCents)}</td>
                    <td className="t-amt">{formatCents(r.taxCents)}</td>
                    <td className="t-amt t-strong">{formatCents(r.totalCents)}</td>
                    <td>{r.overThreshold ? <span className="chip chip-teal">{t("compliance.slipLikely")}</span> : <span className="chip chip-grey">{t("compliance.under500")}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="card-foot"><span className="foot-note">{t("compliance.t5018Foot")}</span></div>
      </section>
    </div>
  );
}

// ── Reminders ────────────────────────────────────────────────────────────────

function RemindersTab({ reminders, presets, locale }: { reminders: ReminderDto[]; presets: ReminderPresetDto[]; locale: typeof enCA }) {
  const { t } = useLanguage();
  const can = useCan();
  const canFull = can("invoicing", "full");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<{ open: boolean; reminder: ReminderDto | null }>({ open: false, reminder: null });
  const refresh = () => { queryClient.invalidateQueries({ queryKey: ["compliance"] }); queryClient.invalidateQueries({ queryKey: ["agenda"] }); };
  const onError = (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" });
  const done = useMutation({ mutationFn: (id: string) => complianceApi.reminderDone(id), onSuccess: refresh, onError });
  const remove = useMutation({ mutationFn: (id: string) => complianceApi.deleteReminder(id), onSuccess: refresh, onError });

  return (
    <div className="card">
      <div className="toolbar">
        <p className="foot-note m-0">{t("compliance.remindersIntro")}</p>
        {canFull && <div className="grow flex justify-end"><button type="button" className="btn btn-navy btn-sm" onClick={() => setEditing({ open: true, reminder: null })}><Plus className="h-4 w-4" /> {t("compliance.addReminder")}</button></div>}
      </div>
      {reminders.length === 0 ? <div className="card-empty">{t("compliance.remindersEmpty")}</div> : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>{t("compliance.col.due")}</th><th>{t("compliance.col.what")}</th><th>{t("compliance.col.repeats")}</th><th>{t("compliance.col.status")}</th><th></th></tr></thead>
            <tbody>
              {reminders.map((r) => (
                <tr key={r.id}>
                  <td className="t-strong" style={{ whiteSpace: "nowrap" }}>{format(dayDate(r.dueDate), "PP", { locale })}</td>
                  <td>
                    <span className="t-strong">{r.title}</span>
                    <span className="t-sub">{[t(`compliance.reminderKind.${r.kind}`), r.authority, r.reference].filter(Boolean).join(" · ")}</span>
                  </td>
                  <td>{t(`compliance.recurrence.${r.recurrence}`)}</td>
                  <td><StateChip state={r.state} daysLeft={r.daysLeft} /></td>
                  <td>
                    {canFull && (
                      <div className="row-act">
                        <button type="button" className="btn btn-sm btn-outline-navy" disabled={done.isPending} onClick={() => done.mutate(r.id)}><Check className="h-3.5 w-3.5" /> {t("compliance.done")}</button>
                        <button type="button" className="ic-btn" title={t("compliance.edit")} aria-label={t("compliance.edit")} onClick={() => setEditing({ open: true, reminder: r })}><Pencil /></button>
                        <button type="button" className="ic-btn danger" title={t("compliance.delete")} aria-label={t("compliance.delete")} onClick={() => { if (confirm(t("compliance.deleteConfirm"))) remove.mutate(r.id); }}><Trash2 /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="card-foot"><span className="foot-note">{t("compliance.remindersFoot")}</span></div>
      <ReminderDialog open={editing.open} reminder={editing.reminder} presets={presets} onOpenChange={(v) => setEditing((s) => ({ ...s, open: v }))} />
    </div>
  );
}

const RECURRENCES: ReminderRecurrence[] = ["annual", "quarterly", "monthly", "none"];

function ReminderDialog({ open, reminder, presets, onOpenChange }: { open: boolean; reminder: ReminderDto | null; presets: ReminderPresetDto[]; onOpenChange: (v: boolean) => void }) {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const blank: ReminderInput = { kind: "other", preset: null, title: "", authority: "", reference: "", url: null, dueDate: "", recurrence: "annual", remindDaysBefore: 30, notes: "" };
  const [form, setForm] = useState<ReminderInput>(blank);
  useEffect(() => {
    if (!open) return;
    setForm(reminder ? { kind: reminder.kind, preset: reminder.preset, title: reminder.title, authority: reminder.authority, reference: reminder.reference, url: reminder.url, dueDate: reminder.dueDate, recurrence: reminder.recurrence, remindDaysBefore: reminder.remindDaysBefore, notes: reminder.notes } : blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reminder]);

  const applyPreset = (id: string) => {
    const p = presets.find((x) => x.id === id);
    if (!p) { setForm({ ...form, preset: null }); return; }
    let dueDate = form.dueDate ?? "";
    if (p.usualDate) {
      const y = new Date().getFullYear();
      const candidate = `${y}-${p.usualDate}`;
      dueDate = candidate >= todayIso() ? candidate : `${y + 1}-${p.usualDate}`;
    }
    setForm({ ...form, preset: p.id, kind: p.kind, title: p.title[lang === "fr" ? "fr" : "en"], authority: p.authority, url: p.url, recurrence: p.recurrence, dueDate });
  };
  const preset = presets.find((p) => p.id === form.preset);

  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, title: (form.title ?? "").trim(), url: form.url?.trim() || null };
      return reminder ? complianceApi.updateReminder(reminder.id, body) : complianceApi.addReminder(body);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["compliance"] }); queryClient.invalidateQueries({ queryKey: ["agenda"] }); onOpenChange(false); },
    onError: (e: Error) => toast({ title: t("jobs.error"), description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader><DialogTitle>{reminder ? t("compliance.editReminder") : t("compliance.addReminder")}</DialogTitle><DialogDescription>{t("compliance.reminderDesc")}</DialogDescription></DialogHeader>
        <DialogBody>
          <div className="form-grid">
            {!reminder && (
              <div className="field full">
                <label htmlFor="r-preset">{t("compliance.preset")}</label>
                <select id="r-preset" value={form.preset ?? ""} onChange={(e) => applyPreset(e.target.value)}>
                  <option value="">{t("compliance.presetNone")}</option>
                  {presets.map((p) => <option key={p.id} value={p.id}>{p.title[lang === "fr" ? "fr" : "en"]}</option>)}
                </select>
                {preset?.usualDate && <p className="foot-note" style={{ marginTop: 6 }}>{t("compliance.usualDate")}</p>}
              </div>
            )}
            <div className="field full"><label htmlFor="r-title">{t("compliance.reminderTitle")}</label><input id="r-title" value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="field"><label htmlFor="r-due">{t("compliance.dueDate")}</label><input id="r-due" type="date" value={form.dueDate ?? ""} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
            <div className="field">
              <label htmlFor="r-rec">{t("compliance.col.repeats")}</label>
              <select id="r-rec" value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value as ReminderRecurrence })}>
                {RECURRENCES.map((r) => <option key={r} value={r}>{t(`compliance.recurrence.${r}`)}</option>)}
              </select>
            </div>
            <div className="field"><label htmlFor="r-auth">{t("compliance.authorityLabel")}</label><input id="r-auth" value={form.authority ?? ""} onChange={(e) => setForm({ ...form, authority: e.target.value })} /></div>
            <div className="field"><label htmlFor="r-ref">{t("compliance.reference")}</label><input id="r-ref" value={form.reference ?? ""} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder={t("compliance.referencePlaceholder")} /></div>
            <div className="field"><label htmlFor="r-url">{t("compliance.link")}</label><input id="r-url" type="url" value={form.url ?? ""} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://" /></div>
            <div className="field"><label htmlFor="r-days">{t("compliance.remindDays")}</label><input id="r-days" type="number" min={0} max={180} value={form.remindDaysBefore ?? 30} onChange={(e) => setForm({ ...form, remindDaysBefore: Math.max(0, Math.min(180, Number(e.target.value) || 0)) })} /></div>
            <div className="field full"><label htmlFor="r-notes">{t("compliance.notes")}</label><input id="r-notes" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
        </DialogBody>
        <DialogFooter>
          <button type="button" className="btn btn-sm btn-outline-navy" onClick={() => onOpenChange(false)}>{t("jobs.cancel")}</button>
          <button type="button" className="btn btn-sm btn-navy" disabled={!form.title?.trim() || !form.dueDate || save.isPending} onClick={() => save.mutate()}>{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {t("jobs.save")}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
