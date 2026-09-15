import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useGetQuoteStats, useListQuotes, useGetBusinessProfile } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format, subMonths, startOfMonth } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { TrendingUp, FileText, DollarSign, CheckCircle2, BarChart3, AlertTriangle, Sparkles, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { hasFeature } from "@/lib/plans";
import { formatCents } from "@/lib/jobs-api";
import { analyticsApi, type CompanyAnalyticsDto, type RiskFlag } from "@/lib/analytics-api";
import { AXIS_TICK, ChartCard, Empty, LegendRow, SERIES, STATUS, TOOLTIP_STYLE, money, moneyShort } from "@/components/charts";
import { JobStatusBadge } from "@/components/jobs/badges";

const formatCurrency = (v: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(v);
const QUOTE_STATUS_COLORS: Record<string, string> = { draft: SERIES.neutral, unlocked: SERIES.actual, pending: "#d97706" };
const PERIODS = [3, 6, 12] as const;

export default function AnalyticsPage() {
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const [months, setMonths] = useState<(typeof PERIODS)[number]>(6);
  const { data: profile } = useGetBusinessProfile();
  const gated = profile ? !hasFeature(profile as never, "analytics_pro") : false;
  const company = useQuery({ queryKey: ["company-analytics", months], queryFn: () => analyticsApi.company(months), enabled: !gated, retry: false });
  const companyGated = gated || (company.error as (Error & { code?: string }) | null)?.code === "PLAN_REQUIRED";

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2"><BarChart3 className="h-8 w-8 text-violet-600" />{t("analytics.title")}</h1>
          <p className="text-slate-500 mt-1">{t("analytics.subtitle")}</p>
        </div>
        <div className="flex gap-1 p-1 bg-muted rounded-xl">
          {PERIODS.map((p) => (
            <button key={p} onClick={() => setMonths(p)} className={cn("px-3 py-1.5 text-sm font-medium rounded-lg transition-all", months === p ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{p} {t("analytics.monthsShort")}</button>
          ))}
        </div>
      </div>

      {companyGated ? <GateCard /> : <BusinessSection data={company.data} isLoading={company.isLoading} locale={locale} />}

      <QuotesSection months={months} locale={locale} />
    </div>
  );
}

// ── Business (Elite) ─────────────────────────────────────────────────────────

function GateCard() {
  const { t } = useLanguage();
  return (
    <div className="rounded-2xl border border-violet-200 dark:border-violet-800/40 bg-violet-50 dark:bg-violet-500/15 p-8 text-center">
      <Sparkles className="h-10 w-10 text-violet-300 mx-auto mb-3" />
      <h3 className="font-bold text-slate-900">{t("analytics.gatedTitle")}</h3>
      <p className="text-sm text-slate-600 mt-1 max-w-lg mx-auto">{t("analytics.gatedDesc")}</p>
      <Link href="/dashboard/billing" className="inline-block mt-4 text-sm font-semibold text-violet-700 hover:underline">{t("analytics.upgrade")}</Link>
    </div>
  );
}

function BusinessSection({ data, isLoading, locale }: { data: CompanyAnalyticsDto | undefined; isLoading: boolean; locale: typeof enCA }) {
  const { t } = useLanguage();
  if (isLoading || !data) return <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>;
  const tot = data.totals;
  const monthLabel = (m: string) => format(new Date(`${m}-01T00:00:00`), "MMM", { locale });
  const monthRows = data.months.map((m) => ({ ...m, label: monthLabel(m.month) }));
  const cashRows = data.cashFlow.map((w) => ({ ...w, label: format(new Date(`${w.week}T00:00:00`), "d MMM", { locale }), inflowCents: w.dueCents + w.overdueCents, outflowNeg: -w.outflowCents }));
  const aging = [
    { key: "current", cents: data.aging.current, color: SERIES.neutral },
    { key: "d1_30", cents: data.aging.d1_30, color: "#d97706" },
    { key: "d31_60", cents: data.aging.d31_60, color: "#ea580c" },
    { key: "d61_90", cents: data.aging.d61_90, color: STATUS.bad },
    { key: "d90_plus", cents: data.aging.d90_plus, color: "#9f1239" },
  ];
  const agingMax = Math.max(1, ...aging.map((a) => a.cents));
  const hasMoney = data.months.some((m) => m.invoicedCents || m.costCents || m.collectedCents);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Tile label={t("analytics.invoiced")} value={formatCents(tot.invoicedCents)} sub={t("analytics.inPeriod")} />
        <Tile label={t("analytics.collected")} value={formatCents(tot.collectedCents)} sub={t("analytics.inPeriod")} tone="text-emerald-600" />
        <Tile label={t("analytics.costs")} value={formatCents(tot.costCents)} sub={t("analytics.confirmedOnly")} />
        <Tile label={t("analytics.grossMargin")} value={tot.marginPercent === null ? "—" : `${tot.marginPercent}%`} sub={formatCents(tot.marginCents)} tone={tot.marginPercent !== null && tot.marginPercent < 15 ? "text-rose-600" : "text-emerald-600"} />
        <Tile label={t("analytics.outstanding")} value={formatCents(tot.outstandingCents)} sub={tot.overdueCents ? `${formatCents(tot.overdueCents)} ${t("analytics.overdue")}` : t("analytics.nothingOverdue")} tone={tot.overdueCents ? "text-rose-600" : undefined} />
        <Tile label={t("analytics.pipeline")} value={formatCents(tot.pipelineCents)} sub={t("analytics.pipelineHint")} tone="text-blue-600" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <ChartCard title={t("analytics.pnl")} subtitle={t("analytics.pnlHint")} className="lg:col-span-2">
          {!hasMoney ? <Empty text={t("analytics.noData")} /> : (
            <>
              <LegendRow items={[{ color: SERIES.invoiced, label: t("analytics.invoiced") }, { color: SERIES.actual, label: t("analytics.costs") }, { color: SERIES.collected, label: t("analytics.collected") }]} />
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={monthRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={moneyShort} tick={AXIS_TICK} axisLine={false} tickLine={false} width={64} />
                  <Tooltip formatter={(v: number, n: string) => [money(v), n]} contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#f8fafc" }} />
                  <Bar dataKey="invoicedCents" name={t("analytics.invoiced")} fill={SERIES.invoiced} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="costCents" name={t("analytics.costs")} fill={SERIES.actual} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Line type="monotone" dataKey="collectedCents" name={t("analytics.collected")} stroke={SERIES.collected} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: SERIES.collected }} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="overflow-x-auto mt-2">
                <table className="w-full text-xs">
                  <thead><tr className="text-slate-400"><th className="text-left font-medium py-1">{t("analytics.month")}</th><th className="text-right font-medium">{t("analytics.invoiced")}</th><th className="text-right font-medium">{t("analytics.costs")}</th><th className="text-right font-medium">{t("analytics.margin")}</th></tr></thead>
                  <tbody>
                    {monthRows.map((m) => (
                      <tr key={m.month} className="border-t border-slate-100"><td className="py-1 text-slate-600">{m.label}</td><td className="text-right text-slate-800">{formatCents(m.invoicedCents)}</td><td className="text-right text-slate-800">{formatCents(m.costCents)}</td><td className={cn("text-right font-medium", m.marginPercent === null ? "text-slate-400" : m.marginPercent < 15 ? "text-rose-600" : "text-emerald-700")}>{m.marginPercent === null ? "—" : `${m.marginPercent}%`}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </ChartCard>

        <ChartCard title={t("invoices.aging.title")} subtitle={`${t("invoices.aging.total")} ${formatCents(data.aging.totalCents)}`}>
          {data.aging.totalCents === 0 ? <Empty text={t("analytics.noReceivables")} /> : (
            <ul className="space-y-2.5">
              {aging.map((a) => (
                <li key={a.key}>
                  <div className="flex justify-between text-xs mb-1"><span className="text-slate-600">{t(`invoices.aging.${a.key}`)}</span><span className="font-medium text-slate-900">{formatCents(a.cents)}</span></div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.round((a.cents / agingMax) * 100)}%`, background: a.color }} /></div>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <ChartCard title={t("analytics.cashFlow")} subtitle={t("analytics.cashFlowHint")} className="lg:col-span-2">
          {cashRows.every((w) => !w.inflowCents && !w.expectedCents && !w.outflowCents) ? <Empty text={t("analytics.noData")} /> : (
            <>
              <LegendRow items={[{ color: SERIES.invoiced, label: t("analytics.invoicesDue") }, { color: "#7dd3fc", label: t("analytics.expectedBillings") }, { color: SERIES.outflow, label: t("analytics.plannedCosts") }, { color: SERIES.collected, label: t("analytics.cumulativeNet") }]} />
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={cashRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} stackOffset="sign">
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={moneyShort} tick={AXIS_TICK} axisLine={false} tickLine={false} width={64} />
                  <ReferenceLine y={0} stroke="#cbd5e1" />
                  <Tooltip formatter={(v: number, n: string) => [money(Math.abs(v)), n]} contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#f8fafc" }} />
                  <Bar dataKey="inflowCents" name={t("analytics.invoicesDue")} stackId="c" fill={SERIES.invoiced} maxBarSize={32} />
                  <Bar dataKey="expectedCents" name={t("analytics.expectedBillings")} stackId="c" fill="#7dd3fc" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="outflowNeg" name={t("analytics.plannedCosts")} stackId="c" fill={SERIES.outflow} radius={[0, 0, 4, 4]} maxBarSize={32} />
                  <Line type="monotone" dataKey="cumulativeCents" name={t("analytics.cumulativeNet")} stroke={SERIES.collected} strokeWidth={2} dot={false} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </>
          )}
        </ChartCard>

        <ChartCard title={t("analytics.risks")} subtitle={t("analytics.risksHint")}>
          {data.jobs.risks.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-sm text-slate-500 gap-1"><CheckCircle2 className="h-6 w-6 text-emerald-500" />{t("analytics.noRisks")}</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.jobs.risks.slice(0, 6).map((r) => (
                <li key={r.id} className="py-2">
                  <Link href={`/dashboard/jobs/${r.id}`} className="text-sm font-medium text-slate-900 hover:text-violet-700 inline-flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-amber-500" />{r.name}</Link>
                  <div className="flex flex-wrap gap-1 mt-1">{r.flags.map((f) => <RiskChip key={f} flag={f} risk={r} />)}</div>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>

      <ChartCard title={t("analytics.jobMargins")} subtitle={t("analytics.jobMarginsHint")} right={<div className="flex flex-wrap gap-1.5">{Object.entries(data.jobs.byStatus).map(([s, n]) => <span key={s} className="text-[11px] rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{n} {t(`jobs.status.${s}`)}</span>)}</div>}>
        {data.jobs.margins.length === 0 ? <Empty text={t("analytics.noJobs")} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-slate-400"><th className="text-left font-medium py-1.5">{t("analytics.job")}</th><th className="text-left font-medium">{t("analytics.status")}</th><th className="text-right font-medium">{t("analytics.valuePreTax")}</th><th className="text-right font-medium">{t("analytics.costs")}</th><th className="text-right font-medium">{t("analytics.margin")}</th><th className="text-right font-medium">{t("analytics.progress")}</th></tr></thead>
              <tbody>
                {data.jobs.margins.map((j) => (
                  <tr key={j.id} className="border-t border-slate-100">
                    <td className="py-2"><Link href={`/dashboard/jobs/${j.id}`} className="font-medium text-slate-900 hover:text-violet-700 inline-flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5 text-slate-400" />{j.name}</Link>{j.clientName && <div className="text-xs text-slate-400">{j.clientName}</div>}</td>
                    <td><JobStatusBadge status={j.status as never} /></td>
                    <td className="text-right text-slate-800">{formatCents(j.subtotalCents)}</td>
                    <td className="text-right text-slate-800">{formatCents(j.costCents)}</td>
                    <td className={cn("text-right font-semibold", j.marginPercent === null ? "text-slate-400" : j.marginPercent < 10 ? "text-rose-600" : j.marginPercent < 20 ? "text-amber-600" : "text-emerald-700")}>{j.marginPercent === null ? "—" : `${j.marginPercent}%`}</td>
                    <td className="text-right text-slate-600">{j.progressPercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>
    </div>
  );
}

function RiskChip({ flag, risk }: { flag: RiskFlag; risk: CompanyAnalyticsDto["jobs"]["risks"][number] }) {
  const { t } = useLanguage();
  const d = risk.detail;
  const extra = flag === "over_budget" ? formatCents(d.overBudgetCents) : flag === "budget_burn" && d.burnPercent !== null ? `${d.burnPercent}%` : flag === "behind_schedule" ? `${d.daysBehind} ${t("analytics.days")}` : flag === "overdue_invoices" ? formatCents(d.overdueCents) : formatCents(d.billingGapCents);
  const bad = flag === "over_budget" || flag === "overdue_invoices" || flag === "behind_schedule";
  return <span className={cn("text-[11px] rounded-full px-2 py-0.5", bad ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800")}>{t(`analytics.flag.${flag}`)} · {extra}</span>;
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-card px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={cn("text-lg font-bold text-slate-900 mt-0.5 truncate", tone)}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

// ── Quotes (all plans) ───────────────────────────────────────────────────────

function QuotesSection({ months, locale }: { months: number; locale: typeof enCA }) {
  const { t } = useLanguage();
  const { data: stats, isLoading: isLoadingStats } = useGetQuoteStats();
  const { data: allQuotes, isLoading: isLoadingQuotes } = useListQuotes();
  const isLoading = isLoadingStats || isLoadingQuotes;

  const monthlyData = (() => {
    if (!allQuotes) return [];
    const now = new Date();
    const buckets = Array.from({ length: months }, (_, i) => {
      const start = startOfMonth(subMonths(now, months - 1 - i));
      const end = startOfMonth(subMonths(now, months - 2 - i));
      return { label: format(start, "MMM", { locale }), start, end, count: 0 };
    });
    for (const q of allQuotes) {
      const created = new Date(q.createdAt);
      for (const m of buckets) if (created >= m.start && created < m.end) { m.count++; break; }
    }
    return buckets;
  })();

  const statusData = stats
    ? [
        { key: "draft", name: t("analytics.quoteStatus.draft"), value: stats.draft },
        { key: "unlocked", name: t("analytics.quoteStatus.unlocked"), value: stats.unlocked },
        { key: "pending", name: t("analytics.quoteStatus.pending"), value: stats.pendingPayment },
      ].filter((d) => d.value > 0)
    : [];

  const statCards = [
    { label: t("analytics.totalQuotes"), value: stats?.total ?? 0, sub: `${stats?.thisMonth ?? 0} ${t("analytics.thisMonth")}`, icon: <FileText className="h-5 w-5 text-violet-500" />, format: (v: number) => String(v) },
    { label: t("analytics.quotedRevenue"), value: stats?.totalRevenue ?? 0, sub: `${formatCurrency(stats?.unlockedRevenue ?? 0)} ${t("analytics.unlockedLower")}`, icon: <DollarSign className="h-5 w-5 text-emerald-500" />, format: formatCurrency },
    { label: t("analytics.averageValue"), value: stats?.avgValue ?? 0, sub: t("analytics.perQuote"), icon: <TrendingUp className="h-5 w-5 text-blue-500" />, format: formatCurrency },
    { label: t("analytics.unlocked"), value: stats?.unlocked ?? 0, sub: stats?.total ? `${Math.round((stats.unlocked / stats.total) * 100)}% ${t("analytics.ofTotal")}` : "—", icon: <CheckCircle2 className="h-5 w-5 text-amber-500" />, format: (v: number) => String(v) },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-slate-900">{t("analytics.quotesSection")}</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, sub, icon, format: fmt }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
                <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center">{icon}</div>
              </div>
              {isLoading ? <Skeleton className="h-8 w-24" /> : (
                <>
                  <div className="text-2xl font-bold text-foreground">{fmt(value)}</div>
                  <div className="text-xs text-muted-foreground mt-1">{sub}</div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <ChartCard title={t("analytics.quotesPerMonth")} className="lg:col-span-2">
          {isLoading ? <Skeleton className="h-48 w-full" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip formatter={(v: number) => [v, t("analytics.quotes")]} contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#f8fafc" }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} fill={SERIES.actual} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={t("analytics.statusBreakdown")}>
          {isLoading ? <Skeleton className="h-48 w-full" /> : statusData.length === 0 ? <Empty text={t("analytics.noData")} /> : (
            <>
              <LegendRow items={statusData.map((s) => ({ color: QUOTE_STATUS_COLORS[s.key] ?? SERIES.neutral, label: `${s.name} (${s.value})` }))} />
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} stroke="#fff" strokeWidth={2}>
                    {statusData.map((entry) => <Cell key={entry.key} fill={QUOTE_STATUS_COLORS[entry.key] ?? SERIES.neutral} />)}
                  </Pie>
                  <Tooltip formatter={(v: number, name: string) => [v, name]} contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            </>
          )}
        </ChartCard>
      </div>

      {stats && stats.recentQuotes.length > 0 && (
        <ChartCard title={t("analytics.recentQuotes")}>
          <div className="divide-y -mx-4 md:-mx-5">
            {stats.recentQuotes.map((q) => (
              <Link key={q.id} href={`/dashboard/quotes/${q.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition-colors">
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{q.clientData?.nome || t("analytics.noClient")}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{format(new Date(q.createdAt), "PP", { locale })}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${q.status === "unlocked" ? "bg-violet-100 text-violet-700" : q.status === "pending_payment" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                    {q.status === "unlocked" ? t("analytics.quoteStatus.unlocked") : q.status === "pending_payment" ? t("analytics.quoteStatus.pending") : t("analytics.quoteStatus.draft")}
                  </span>
                  <span className="font-semibold text-sm">{formatCurrency(q.totale)}</span>
                </div>
              </Link>
            ))}
          </div>
        </ChartCard>
      )}
    </div>
  );
}
