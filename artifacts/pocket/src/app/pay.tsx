// Pay.dc.html: payroll prep. Three tabs: the pay period (status, export, what needs a look, totals, employees, travel claims, subcontractors),
// labour by job, and the rules and export (frequency, overtime, holidays and rates, the export file). Reads /api/pay/*; the worksheet is time to pay,
// not a payroll engine. Not built: pay day (the data has none), a vacation-pay line (the provider adds it), custom holidays (the web app adds them),
// and the board's "Connected" labels on Wagepoint and QuickBooks Payroll (they are import files).
import { useMemo, useState } from "react";
import { RoleTabs } from "@/ui/TabShell";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useGetBusinessProfile } from "@workspace/api-client-react";
import { ApiFailure } from "@/lib/api";
import { tintFor } from "@/lib/clients";
import { jobsApi } from "@/lib/jobsApi";
import { dateRange, money, number, shortDate, type Locale } from "@/lib/format";
import { initialsOf } from "@/lib/invites";
import { screenHref } from "@/lib/nav";
import {
  EARNING_KINDS, PAY_FORMATS, approvedAllowances, burdenPercent, canGoNext, centsFrom, dayAt, earningCodesLine, employeeFlag, firstNames, frequencyOptions, hourlyRate, holidaysInYear, jobCards, labourTotal, lineQty,
  nextHoliday, overtimeRows, percentFrom, periodStatus, totalsOf, upcomingHoliday, warnings, addDays, withAllowances, withCodes, withFormat, withFrequency, withHolidayOff, withPreset, withVacation,
  type EarningKind, type Holiday, type PayFormat, type PayFrequency, type RawSettings,
} from "@/lib/pay";
import { payApi } from "@/lib/payApi";
import { exportPayPeriod } from "@/lib/payExport";
import { teamApi } from "@/lib/teamApi";
import { useSession } from "@/lib/useSession";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Chip, ChipStrip } from "@/ui/Chip";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { AffixField, TextField } from "@/ui/Field";
import { Header, PageTitle } from "@/ui/Header";
import { Icon } from "@/ui/Icon";
import { ScrollPage, Section, Stack } from "@/ui/Layout";
import { MiniButton } from "@/ui/Books";
import { ClaimRow, EmployeeCard, FactRow, JobCard, KpiPair, NoteRow, PeriodCard, PickRowTarget, TotalsCard, ValueRow } from "@/ui/Pay";
import { MenuList, MenuRow, RowList, SectionHeader } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Segmented } from "@/ui/Segmented";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { Switch } from "@/ui/Switch";
import { Tabs } from "@/ui/Tabs";
import { Num, Text } from "@/ui/Text";

const TAB_KEYS = ["period", "jobs", "rules"] as const;
const FORMAT_LOOK: Record<PayFormat, { icon: "doc" | "sync" | "export" | "bank"; tone: "slate" | "teal" | "azure" | "sage" }> = {
  generic: { icon: "doc", tone: "slate" }, wagepoint: { icon: "sync", tone: "teal" }, payworks: { icon: "export", tone: "azure" }, qbo_payroll: { icon: "bank", tone: "sage" },
};
type Edit = "vacation" | "km" | "perDiem" | "holidays" | "codes" | "format" | null;

export default function Pay() {
  const { t, i18n } = useTranslation();
  const m = (k: string, o?: Record<string, unknown>) => t(`py.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { status } = useSession();
  const toast = useToast();
  const client = useQueryClient();
  const signedIn = status === "in" || status === "offline";
  const profile = useGetBusinessProfile({ query: { enabled: signedIn, retry: false } } as never);
  const company = (profile.data as { companyName?: string } | undefined)?.companyName ?? "";

  const [tab, setTab] = useState(0);
  const [date, setDate] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [exportMenu, setExportMenu] = useState<"export" | "default" | null>(null);
  const [edit, setEdit] = useState<Edit>(null);
  const [draft, setDraft] = useState("");
  const [codes, setCodes] = useState<Record<EarningKind, string> | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [sent, setSent] = useState<{ period: string; format: PayFormat } | null>(null);

  const settingsQ = useQuery({ queryKey: ["pay-settings"], queryFn: payApi.settings, enabled: signedIn, retry: 1 });
  const settings = settingsQ.data && settingsQ.data.enabled ? settingsQ.data : null;
  const periodQ = useQuery({ queryKey: ["pay-period", date ?? "default"], queryFn: () => payApi.period(date), enabled: signedIn && !!settings, retry: 1 });
  const workersQ = useQuery({ queryKey: ["team-workers"], queryFn: teamApi.workers, enabled: signedIn && !!settings, retry: 1 });
  const entriesQ = useQuery({ queryKey: ["team-entries"], queryFn: () => teamApi.entries("submitted"), enabled: signedIn && !!settings, retry: 1 });
  const jobsQ = useQuery({ queryKey: ["jobs"], queryFn: jobsApi.list, enabled: signedIn && !!settings && tab === 1, retry: 0 });
  const report = periodQ.data;
  const workers = workersQ.data?.items ?? [];

  const refresh = () => { for (const k of ["pay-settings", "pay-period", "team-workers", "team-entries"]) void client.invalidateQueries({ queryKey: [k] }); };
  const back = () => (router.canGoBack() ? router.back() : router.replace("/menu"));
  const toTeam = () => router.push(screenHref("Team", t("menu.rows.crew.label") as string));
  const holidayName = (h: Holiday) => (h.key ? m(`hol.${h.key}`) : h.name || m("hol.custom"));
  const failed = (settingsQ.isError && !settingsQ.data) || (periodQ.isError && !periodQ.data && !!settings);
  const loading = !failed && ((settingsQ.isPending && !settingsQ.data) || (!!settings && periodQ.isPending && !periodQ.data));
  const locked = !!settingsQ.data && !settingsQ.data.enabled;
  const ready = !!settings && !!report && !failed;

  const save = async (body: RawSettings, opts: { undo?: RawSettings; done?: string } = {}) => {
    setBusy("save");
    try {
      const r = await payApi.saveSettings(body);
      client.setQueryData(["pay-settings"], r);
      void client.invalidateQueries({ queryKey: ["pay-period"] });
      const message = opts.done ?? (r.recomputed && r.recomputedSince ? m("rules.savedRecount", { date: shortDate(dayAt(r.recomputedSince), locale) }) : m("rules.saved"));
      toast(opts.undo ? { message, action: m("undo"), onAction: () => { void payApi.saveSettings(opts.undo!).then((u) => { client.setQueryData(["pay-settings"], u); void client.invalidateQueries({ queryKey: ["pay-period"] }); toast({ message: m("rules.undone") }); }).catch(() => toast({ message: m("rules.failed") })); } } : { message });
      return true;
    } catch { toast({ message: m("rules.failed") }); return false; } finally { setBusy(null); }
  };

  const doExport = async (format: PayFormat) => {
    if (!report) return;
    setExportMenu(null); setBusy("export");
    try {
      const name = await exportPayPeriod(report.period.start, format);
      setSent({ period: report.period.start, format });
      toast({ message: m("export.done", { name }) });
      void client.invalidateQueries({ queryKey: ["pay-period"] });
    } catch (e) { toast({ message: e instanceof ApiFailure && e.status === 403 ? m("locked.title") : m("export.failed") }); } finally { setBusy(null); }
  };
  const review = async (id: string, decision: "approved" | "rejected") => {
    setBusy(id);
    try { await payApi.review(id, decision); toast({ message: decision === "approved" ? m("claims.approvedToast") : m("claims.rejectedToast") }); void client.invalidateQueries({ queryKey: ["pay-period"] }); } catch { toast({ message: m("claims.failed") }); } finally { setBusy(null); }
  };

  const openEdit = (e: Exclude<Edit, null>) => {
    if (!settings) return;
    const eff = settings.effective;
    setInvalid(false);
    if (e === "vacation") setDraft(eff.vacationPayPercent != null ? String(eff.vacationPayPercent) : "");
    if (e === "km") setDraft((eff.allowances.kmRateCents / 100).toFixed(2));
    if (e === "perDiem") setDraft(eff.allowances.perDiemCents ? (eff.allowances.perDiemCents / 100).toFixed(2) : "");
    if (e === "codes") setCodes({ ...eff.earningCodes });
    setEdit(e);
  };
  const saveEdit = async () => {
    if (!settings || !edit) return;
    const raw = settings.settings;
    let next: RawSettings | null = null;
    if (edit === "vacation") { const p = draft.trim() === "" ? 0 : percentFrom(draft); if (p == null) return setInvalid(true); next = withVacation(raw, p); }
    if (edit === "km") { const c = centsFrom(draft); if (c == null) return setInvalid(true); next = withAllowances(raw, { kmRateCents: c }); }
    if (edit === "perDiem") { const c = draft.trim() === "" ? 0 : centsFrom(draft); if (c == null) return setInvalid(true); next = withAllowances(raw, { perDiemCents: c }); }
    if (edit === "codes" && codes) next = withCodes(raw, codes, settings.provinceDefaults.earningCodes);
    if (next && (await save(next, { undo: raw }))) setEdit(null);
  };

  // ── The period tab ──
  const status3 = report ? periodStatus(report) : null;
  const totals = report ? totalsOf(report) : null;
  const pendingNames = useMemo(() => {
    if (!report) return [] as string[];
    const rows = (entriesQ.data?.items ?? []).filter((e) => e.date >= report.period.start && e.date <= report.period.end);
    return firstNames(rows.map((e) => e.workerName ?? ""));
  }, [report, entriesQ.data]);
  const list = useMemo(() => (report && settings ? warnings(report, { pendingNames, holiday: nextHoliday(settings.holidays, report) }) : []), [report, settings, pendingNames]);
  const roleOf = (id: string) => workers.find((w) => w.id === id)?.role ?? "";
  const target = (f: PayFormat) => m(`export.targets.${f}.label`);
  const exportedHere = sent && report && sent.period === report.period.start ? sent.format : null;
  const wagepointHave = report ? report.employees.filter((e) => e.payrollId).length : 0;
  const targetSub = (f: PayFormat) => (f === "wagepoint" ? m("export.targets.wagepoint.sub", { have: wagepointHave, total: report?.employees.length ?? 0 }) : m(`export.targets.${f}.sub`));

  const warnRow = (w: ReturnType<typeof warnings>[number]) => {
    const names = firstNames(w.names).join(", ");
    const fmtName = (f: PayFormat) => (f === "generic" ? "" : target(f));
    const exportFmt = settings!.effective.exportFormat;
    if (w.key === "approve") return <NoteRow key="approve" icon="clock" tone="amber" title={m("warn.approve.title", { count: w.count })} sub={names ? m("warn.approve.sub", { names, hours: number(w.hours ?? 0, locale, 1) }) : m("warn.approve.subNoNames", { hours: number(w.hours ?? 0, locale, 1) })} tag={{ tone: "warn", label: m("warn.approve.tag") }} onPress={toTeam} />;
    if (w.key === "changed") return <NoteRow key="changed" icon="sync" tone="clay" title={m("warn.changed.title", { count: w.count })} sub={m("warn.changed.sub", { names })} tag={{ tone: "warn", label: m("warn.changed.tag") }} />;
    if (w.key === "payroll") return <NoteRow key="payroll" icon="user" tone="rose" title={m("warn.payroll.title", { count: w.count, names })} sub={fmtName(exportFmt) ? m("warn.payroll.sub", { format: fmtName(exportFmt) }) : m("warn.payroll.subGeneric")} tag={{ tone: "bad", label: m("warn.payroll.tag") }} onPress={toTeam} />;
    if (w.key === "rate") return <NoteRow key="rate" icon="user" tone="rose" title={m("warn.rate.title", { count: w.count, names })} sub={m("warn.rate.sub")} tag={{ tone: "bad", label: m("warn.rate.tag") }} onPress={toTeam} />;
    return <NoteRow key="holiday" icon="cal" tone="azure" title={m("warn.holiday.title", { name: holidayName(w.holiday!), date: new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric" }).format(dayAt(w.holiday!.date)).replace(/,/g, "") })} sub={m("warn.holiday.sub")} tag={{ tone: "info", shape: "q1", label: m("warn.holiday.tag") }} />;
  };

  const periodTab = () => {
    if (!report || !settings || !status3 || !totals) return null;
    const eff = report.settings;
    const claims = report.pendingAllowances;
    const approved = approvedAllowances(report);
    const fmtDate = (d: string) => shortDate(dayAt(d), locale);
    const claimSub = (kind: string, qty: number, d: string, job: string | null) => [kind === "mileage" ? m("claims.subKm", { qty: number(qty, locale), date: fmtDate(d) }) : kind === "per_diem" ? m("claims.subDays", { count: qty, qty: number(qty, locale), date: fmtDate(d) }) : m("claims.subOther", { date: fmtDate(d) }), job].filter(Boolean).join(" · ");
    const kindLabel = (k: string) => m(`claims.kind.${k === "mileage" || k === "per_diem" ? k : "other"}`);
    return (
      <>
        <Section pt={16} px={16} delay={0}>
          <PeriodCard label={dateRange(dayAt(report.period.start), dayAt(report.period.end), locale)} sub={m(`period.freq.${eff.frequency}`)}
            prevLabel={m("period.prev")} nextLabel={m("period.next")} canPrev onPrev={() => setDate(report.previousStart)} canNext={canGoNext(report)} onNext={() => setDate(report.nextStart)}
            status={status3.kind === "exported" ? { tone: "ok", shape: "check", label: m("period.status.exported", { date: shortDate(new Date(status3.at), locale) }) } : status3.kind === "ready" ? { tone: "acc", shape: "q2", label: m("period.status.ready") } : { tone: "mute", shape: "draft", label: m("period.status.progress") }}>
            <Button block label={status3.kind === "exported" ? m("export.again") : m("export.button")} busy={busy === "export" ? m("export.working") : false} disabled={report.employees.length === 0} onPress={() => setExportMenu("export")} />
          </PeriodCard>
        </Section>
        {exportedHere ? (
          <Section pt={12} px={16}>
            <Banner tone="ok" icon="check" iconTone="sage" lead={m("export.banner", { target: target(exportedHere) })}>{m("export.bannerBody", { count: totals.employees, amount: money(totals.gross / 100, locale) })}</Banner>
          </Section>
        ) : null}

        <Section delay={60} pt={12} px={16}>
          <Card>
            <RowList>
              {list.length === 0
                ? [<NoteRow key="clear" icon="check" tone="sage" title={m("warn.clear.title")} sub={m("warn.clear.sub")} tag={{ tone: "ok", shape: "check", label: m("warn.clear.tag") }} />]
                : list.map(warnRow)}
            </RowList>
          </Card>
        </Section>

        <Section delay={100} pt={22} px={16}>
          <SectionHeader title={m("totals.title")} link={m("totals.link", { count: totals.employees })} />
          <TotalsCard items={[
            { label: m("totals.gross"), value: money(totals.gross / 100, locale), sub: m("totals.grossSub") },
            { label: m("totals.hours"), value: number(totals.hours, locale, 1), sub: m("totals.hoursSub", { hours: number(totals.overtime, locale, 1) }) },
            { label: m("totals.holiday"), value: money(totals.holiday / 100, locale), sub: totals.holiday > 0 ? m("totals.holidaySub") : m("totals.holidayNone") },
            { label: m("totals.travel"), value: money(totals.travel / 100, locale), sub: totals.claimsWaiting > 0 ? m("totals.claims", { count: totals.claimsWaiting }) : m("totals.travelSub") },
          ]} />
        </Section>

        <Section delay={140} pt={22} px={16}>
          <SectionHeader title={m("employees.title")} link={m("employees.link")} onLink={toTeam} />
          {report.employees.length === 0 ? (
            <Card><Empty icon="users" iconTone="azure" title={m("employees.emptyTitle")} body={m("employees.emptyBody")} /></Card>
          ) : (
            <Stack gap={10}>
              {report.employees.map((e) => {
                const rate = hourlyRate(e);
                const role = roleOf(e.workerId);
                const flag = employeeFlag(e);
                return (
                  <EmployeeCard key={e.workerId} initials={initialsOf(e.name)} tint={tintFor(e.name)} name={e.name}
                    role={rate != null ? (role ? m("employees.role", { role, rate: money(rate / 100, locale) }) : m("employees.rate", { rate: money(rate / 100, locale) })) : role}
                    gross={money(e.grossCents / 100, locale)} hours={`${number(e.hours, locale, 1)} h`} flag={flag ? m(`employees.flag.${flag}`) : undefined}
                    lines={e.lines.map((l, i) => {
                      const q = lineQty(l);
                      const qty = q.kind === "hours" ? m("employees.qty.hours", { hours: number(q.value, locale, 1), rate: money(q.rateCents / 100, locale) })
                        : q.kind === "km" ? m("employees.qty.km", { qty: number(q.value, locale), rate: money(q.rateCents / 100, locale) })
                          : q.kind === "days" ? m("employees.qty.days", { count: q.value, qty: number(q.value, locale), rate: money(q.rateCents / 100, locale) }) : "";
                      return { key: `${l.kind}${i}`, label: m(`employees.kind.${l.kind}`), qty, amount: money(l.amountCents / 100, locale) };
                    })} />
                );
              })}
            </Stack>
          )}
        </Section>

        <Section delay={180} pt={22} px={16}>
          <SectionHeader title={m("claims.title")} link={claims.length > 0 ? m("claims.toApprove", { count: claims.length }) : approved.length > 0 ? m("claims.allDone") : undefined} />
          <Card>
            {claims.length === 0 && approved.length === 0 ? <Stack pt={16} pb={16} px={16}><Text size={13.5} color="muted">{m("claims.empty")}</Text></Stack> : (
              <RowList>
                {claims.map((a) => (
                  <ClaimRow key={a.id} initials={initialsOf(a.workerName)} tint={tintFor(a.workerName)} title={m("claims.name", { name: a.workerName, kind: kindLabel(a.kind) })} sub={claimSub(a.kind, a.quantity, a.date, a.projectName)}
                    amount={money(a.amountCents / 100, locale)} status={{ tone: "warn", label: m("claims.toApproveStatus") }}
                    actions={<><MiniButton variant="accent" label={m("claims.approve")} disabled={busy === a.id} onPress={() => void review(a.id, "approved")} /><MiniButton label={m("claims.reject")} disabled={busy === a.id} onPress={() => void review(a.id, "rejected")} /></>} />
                ))}
                {approved.map((a) => (
                  <ClaimRow key={a.id} initials={initialsOf(a.workerName)} tint={tintFor(a.workerName)} title={m("claims.name", { name: a.workerName, kind: kindLabel(a.kind) })} sub={claimSub(a.kind, a.quantity, a.date, a.projectName)}
                    amount={money(a.amountCents / 100, locale)} status={{ tone: "ok", shape: "check", label: m("claims.approved") }} />
                ))}
              </RowList>
            )}
          </Card>
        </Section>

        {report.subcontractors.length > 0 ? (
          <Section delay={200} pt={22} px={16}>
            <SectionHeader title={m("subs.title")} link={m("subs.link")} />
            <Card>
              <RowList>
                {report.subcontractors.map((s) => {
                  const role = roleOf(s.workerId);
                  return (
                    <Stack key={s.workerId} row align="center" gap={12} px={16} pt={12} pb={12}>
                      <Icon name="user" tone="amber" size={28} />
                      <Stack grow gap={2}>
                        <Text size={14.5} weight={500}>{s.name}</Text>
                        <Text size={12.5} color="muted">{role ? m("subs.sub", { role, hours: number(s.hours, locale, 1) }) : m("subs.subHours", { hours: number(s.hours, locale, 1) })}</Text>
                      </Stack>
                      <Stack align="flex-end" gap={2}>
                        <Num size={14.5} weight={600}>{money(s.amountCents / 100, locale)}</Num>
                        <Text size={11.5} color="muted">{m("subs.bills")}</Text>
                      </Stack>
                    </Stack>
                  );
                })}
              </RowList>
            </Card>
          </Section>
        ) : null}
      </>
    );
  };

  // ── Labour by job ──
  const jobsTab = () => {
    if (!report) return null;
    const cards = jobCards(report.jobs);
    const clientOf = (projectId: string | null) => jobsQ.data?.items.find((j) => j.id === projectId)?.clientName ?? "";
    const burden = burdenPercent(report.jobs);
    const whole = (c: number) => money(c / 100, locale, { cents: false });
    return (
      <>
        <Section pt={16} px={16}>
          <KpiPair items={[
            { label: m("jobs.labour"), value: whole(labourTotal(report.jobs)), sub: dateRange(dayAt(report.period.start), dayAt(report.period.end), locale) },
            { label: m("jobs.hours"), value: number(report.totals.hours, locale, 1), sub: m("jobs.overtime", { hours: number(report.totals.overtimeHours, locale, 1) }) },
          ]} />
        </Section>
        <Section delay={60} pt={20} px={16}>
          <SectionHeader title={m("jobs.byJob")} link={burden != null ? m("jobs.burden", { pct: burden }) : undefined} />
          {cards.length === 0 ? (
            <Card><Empty icon="house" iconTone="teal" title={m("jobs.emptyTitle")} body={m("jobs.emptyBody")} /></Card>
          ) : (
            <Stack gap={10}>
              {cards.map((j) => (
                <JobCard key={j.key} icon={j.projectId ? "house" : "truck"} tone={j.projectId ? "teal" : "slate"} name={j.name || m("jobs.noJob")} client={j.projectId ? clientOf(j.projectId) : ""}
                  cost={whole(j.totalCents)} share={j.share}
                  cells={[
                    { label: m("jobs.cells.hours"), value: number(j.hours, locale, 1) }, { label: m("jobs.cells.overtime"), value: number(j.overtimeHours, locale, 1) }, { label: m("jobs.cells.straight"), value: whole(j.straightCents) },
                    { label: m("jobs.cells.premium"), value: whole(j.premiumCents) }, { label: m("jobs.cells.burden"), value: whole(j.burdenCents) }, { label: m("jobs.cells.travel"), value: whole(j.allowanceCents) },
                  ]} />
              ))}
            </Stack>
          )}
        </Section>
      </>
    );
  };

  // ── Rules and export ──
  const rulesTab = () => {
    if (!settings || !report) return null;
    const eff = settings.effective;
    const raw = settings.settings;
    const province = m(`prov.${eff.province}`);
    const ot = overtimeRows(eff.overtime, eff.holidays.workedMultiplier);
    const mult = (n: number) => number(n, locale, Number.isInteger(n) ? 0 : 1);
    const starts = ot.starts.kind === "weekly" ? m("rules.starts.weekly", { hours: number(ot.starts.hours, locale) }) : ot.starts.kind === "daily" ? m("rules.starts.daily", { hours: number(ot.starts.hours, locale) })
      : ot.starts.kind === "both" ? m("rules.starts.both", { daily: number(ot.starts.daily, locale), weekly: number(ot.starts.weekly, locale) }) : m("rules.starts.none");
    const premium = ot.premium.kind === "double" ? m("rules.premium.double", { hours: number(ot.premium.hours, locale), mult: mult(ot.premium.multiplier) }) : ot.premium.kind === "holiday" ? m("rules.premium.holiday", { mult: mult(ot.premium.multiplier) }) : m("rules.premium.none");
    const freqs = frequencyOptions(eff.frequency);
    const dayName = (d: string) => new Intl.DateTimeFormat(locale, { weekday: "long" }).format(dayAt(d));
    const anchorDay = dayName(eff.anchorDate);
    const endWeekday = dayName(addDays(eff.anchorDate, -1));
    const next = upcomingHoliday(settings.holidays, settings.today);
    const employees = workers.filter((w) => w.active && w.workerType === "employee");
    const have = workersQ.data ? employees.filter((w) => w.payrollId).length : report.employees.filter((e) => e.payrollId).length;
    const total = workersQ.data ? employees.length : report.employees.length;
    const missing = total - have;
    return (
      <>
        <Section pt={16} px={16}>
          <SectionHeader title={m("rules.frequency")} />
          <Card>
            <Stack pt={12} pb={12} px={12} gap={10}>
              <Segmented label={m("rules.frequency")} options={freqs.map((f) => m(`period.freq.${f}`))} value={freqs.indexOf(eff.frequency)}
                onChange={(i) => { const f = freqs[i] as PayFrequency; if (f !== eff.frequency) void save(withFrequency(raw, f), { undo: raw }); }} />
              <Stack px={4}><Text size={12.5} color="muted">{m(`rules.freqNote.${eff.frequency}`, { from: anchorDay, to: endWeekday })}</Text></Stack>
            </Stack>
          </Card>
        </Section>

        <Section delay={50} pt={22} px={16}>
          <SectionHeader title={m("rules.overtime")} />
          <Stack pb={10}>
            <ChipStrip label={m("rules.overtimeLabel")}>
              <Chip label={m("rules.general", { province })} selected={!eff.preset} onPress={() => { if (eff.preset) void save(withPreset(raw, null), { undo: raw }); }} />
              {settings.presets.map((p) => <Chip key={p.key} label={m(`rules.presets.${p.key}`)} selected={eff.preset === p.key} onPress={() => { if (eff.preset !== p.key) void save(withPreset(raw, p), { undo: raw }); }} />)}
            </ChipStrip>
          </Stack>
          <Card>
            <RowList>
              <FactRow label={m("rules.otRows.starts")} value={starts} />
              <FactRow label={m("rules.otRows.rate")} value={m("rules.mult", { mult: mult(ot.multiplier) })} />
              <FactRow label={m("rules.otRows.premium")} value={premium} />
            </RowList>
          </Card>
        </Section>

        <Section delay={100} pt={22} px={16}>
          <SectionHeader title={m("rules.holidaysTitle")} />
          <Card>
            <RowList>
              <ValueRow icon="cal" tone="azure" title={m("rules.rows.stat.label")}
                sub={next ? m("rules.rows.stat.sub", { province, name: holidayName(next), date: shortDate(dayAt(next.date), locale) }) : m("rules.rows.stat.subNone", { province })}
                value={m("rules.rows.stat.value", { count: holidaysInYear(settings.holidays, settings.today) })} onPress={() => setEdit("holidays")} />
              <ValueRow icon="sun" tone="gold" title={m("rules.rows.vacation.label")} sub={m("rules.rows.vacation.sub")}
                value={eff.vacationPayPercent != null ? m("rules.rows.vacation.value", { pct: number(eff.vacationPayPercent, locale, Number.isInteger(eff.vacationPayPercent) ? 0 : 1) }) : m("rules.rows.vacation.none")} onPress={() => openEdit("vacation")} />
              <ValueRow icon="truck" tone="teal" title={m("rules.rows.km.label")} sub={m("rules.rows.km.sub")} value={m("rules.rows.km.value", { amount: money(eff.allowances.kmRateCents / 100, locale) })} onPress={() => openEdit("km")} />
              <ValueRow icon="pin" tone="rose" title={m("rules.rows.perDiem.label")} sub={m("rules.rows.perDiem.sub")}
                value={eff.allowances.perDiemCents > 0 ? m("rules.rows.perDiem.value", { amount: money(eff.allowances.perDiemCents / 100, locale) }) : m("rules.rows.perDiem.none")} onPress={() => openEdit("perDiem")} />
            </RowList>
          </Card>
        </Section>

        <Section delay={150} pt={22} px={16}>
          <SectionHeader title={m("rules.exportTitle")} />
          <Card>
            <RowList>
              <ValueRow icon="export" tone="violet" title={m("rules.exportRows.to.label")} sub={m("rules.exportRows.to.sub", { target: target(eff.exportFormat) })} onPress={() => setExportMenu("default")} />
              <ValueRow icon="code" tone="slate" title={m("rules.exportRows.codes.label")} sub={earningCodesLine(eff.earningCodes)} onPress={() => openEdit("codes")} />
              <ValueRow icon="users" tone="indigo" title={m("rules.exportRows.numbers.label")} sub={m("rules.exportRows.numbers.sub", { have, total })}
                tag={missing > 0 ? { tone: "warn", label: m("rules.exportRows.numbers.tag", { count: missing }) } : undefined} onPress={toTeam} />
            </RowList>
          </Card>
        </Section>
      </>
    );
  };

  const editCopy = edit === "vacation" || edit === "km" || edit === "perDiem" || edit === "holidays" || edit === "codes" || edit === "format" ? m(`rules.edit.${edit}.title`) : "";

  return (
    <Screen floating={<RoleTabs active="pay" />}>
      <Header title="" backLabel={m("back")} onBack={back} moreLabel={m("more")} onMore={ready ? () => setMenu(true) : undefined} />
      <ScrollPage bottom={48} sticky={ready ? [1] : undefined}>
        <Section px={20} gap={6} pb={14}>
          <PageTitle>{m("title")}</PageTitle>
          <Text size={13.5} color="muted">{company ? m("sub", { company }) : m("subNone")}</Text>
        </Section>
        {ready ? <Tabs tabs={TAB_KEYS.map((k) => m(`tabs.${k}`))} active={tab} onChange={setTab} /> : null}
        {locked ? (
          <Section pt={26} px={16}><Empty icon="card" iconTone="amber" title={m("locked.title")} body={m("locked.body")} /></Section>
        ) : failed ? (
          <Section pt={26} px={16}><Empty icon="warn" iconTone="clay" title={m("loadFailed.title")} body={m("loadFailed.body")} action={m("retry")} onAction={refresh} /></Section>
        ) : loading || !ready ? (
          <Section pt={16} px={16} gap={12}><Skeleton height={150} radius={22} /><Skeleton height={190} radius={22} /><Skeleton height={140} radius={22} /></Section>
        ) : tab === 0 ? periodTab() : tab === 1 ? jobsTab() : rulesTab()}
      </ScrollPage>

      <Sheet open={menu} onClose={() => setMenu(false)} label={m("more")} closeLabel={m("close")}>
        <MenuList>
          <MenuRow icon={<Icon name="export" tone="violet" size={28} />} title={m("menu.export")} sub={m("menu.exportSub")} chevron={false} onPress={() => { setMenu(false); setTab(0); setExportMenu("export"); }} />
          <MenuRow icon={<Icon name="users" tone="sage" size={28} />} title={m("menu.team")} sub={m("menu.teamSub")} onPress={() => { setMenu(false); toTeam(); }} />
        </MenuList>
      </Sheet>

      <Sheet open={!!exportMenu} onClose={() => setExportMenu(null)} label={m("export.sheet")} closeLabel={m("close")}>
        <SheetTitle>{exportMenu === "default" ? m("rules.edit.format.title") : m("export.sheet")}</SheetTitle>
        <Stack pb={20}>
          {exportMenu === "default" ? <Stack px={20} pb={8}><Text size={13.5} color="muted">{m("rules.edit.format.body")}</Text></Stack> : null}
          <RowList>
            {PAY_FORMATS.map((f) => (
              <PickRowTarget key={f} icon={FORMAT_LOOK[f].icon} tone={FORMAT_LOOK[f].tone} title={target(f)} sub={targetSub(f)}
                tag={f === (exportMenu === "default" ? settings?.effective.exportFormat : report?.exports[0]?.format ?? settings?.effective.exportFormat) ? m("export.last") : undefined}
                onPress={() => { if (exportMenu === "default" && settings) { setExportMenu(null); void save(withFormat(settings.settings, f), { undo: settings.settings }); } else void doExport(f); }} />
            ))}
          </RowList>
        </Stack>
      </Sheet>

      <Sheet open={edit === "vacation" || edit === "km" || edit === "perDiem"} onClose={() => setEdit(null)} label={editCopy} closeLabel={m("close")}>
        <SheetTitle>{editCopy}</SheetTitle>
        {edit === "vacation" || edit === "km" || edit === "perDiem" ? (
          <Stack px={16} pb={20} gap={14}>
            <Text size={13.5} color="muted" leading={1.4}>{m(`rules.edit.${edit}.body`)}</Text>
            <AffixField label={m(`rules.edit.${edit}.label`)} value={draft} onChangeText={(v) => { setDraft(v); setInvalid(false); }} keyboardType="decimal-pad" autoFocus error={invalid ? m("rules.edit.invalid") : undefined}
              prefix={edit === "vacation" ? undefined : m(`rules.edit.${edit}.prefix`)} suffix={edit === "vacation" ? m("rules.edit.vacation.suffix") : undefined} />
            <Button size="lg" block label={m("save")} busy={busy === "save" ? m("saving") : false} onPress={() => void saveEdit()} />
          </Stack>
        ) : null}
      </Sheet>

      <Sheet open={edit === "codes"} onClose={() => setEdit(null)} label={m("rules.edit.codes.title")} closeLabel={m("close")}>
        <SheetTitle>{m("rules.edit.codes.title")}</SheetTitle>
        {codes ? (
          <Stack px={16} pb={20} gap={12}>
            <Text size={13.5} color="muted" leading={1.4}>{m("rules.edit.codes.body")}</Text>
            {EARNING_KINDS.map((k) => <TextField key={k} label={m(`employees.kind.${k}`)} value={codes[k]} onChangeText={(v) => setCodes({ ...codes, [k]: v })} autoCapitalize="characters" numeric />)}
            <Button size="lg" block label={m("save")} busy={busy === "save" ? m("saving") : false} onPress={() => void saveEdit()} />
          </Stack>
        ) : null}
      </Sheet>

      <Sheet open={edit === "holidays"} onClose={() => setEdit(null)} label={m("rules.edit.holidays.title")} closeLabel={m("close")}>
        <SheetTitle>{m("rules.edit.holidays.title")}</SheetTitle>
        {settings ? (
          <Stack pb={20}>
            <Stack px={20} pb={8}><Text size={13.5} color="muted" leading={1.4}>{m("rules.edit.holidays.body")}</Text></Stack>
            <Card>
              <RowList>
                {[...settings.provinceHolidays, ...settings.holidays.filter((h) => h.custom)].sort((a, b) => a.date.localeCompare(b.date)).filter((h) => h.date >= settings.today.slice(0, 4)).map((h) => {
                  const off = (settings.settings.holidays?.removed ?? []).includes(h.date);
                  return (
                    <Stack key={h.date} row align="center" gap={12} px={16} pt={10} pb={10}>
                      <Stack grow gap={2}>
                        <Text size={14.5} weight={500}>{holidayName(h)}</Text>
                        <Text size={12.5} color="muted">{new Intl.DateTimeFormat(locale, { weekday: "short", year: "numeric", month: "short", day: "numeric" }).format(dayAt(h.date)).replace(/,/g, "")}</Text>
                      </Stack>
                      <Switch value={!off} label={holidayName(h)} disabled={busy === "save"} onChange={(on) => void save(withHolidayOff(settings.settings, h.date, !on))} />
                    </Stack>
                  );
                })}
              </RowList>
            </Card>
          </Stack>
        ) : null}
      </Sheet>
    </Screen>
  );
}

