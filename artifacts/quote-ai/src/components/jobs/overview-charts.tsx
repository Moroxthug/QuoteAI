import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { enCA } from "date-fns/locale";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, CheckCircle2, Clock, TrendingDown, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { analyticsApi, type JobAnalyticsDto } from "@/lib/analytics-api";
import { formatCents } from "@/lib/jobs-api";
import { AXIS_TICK, ChartCard, Empty, LegendRow, SERIES, STATUS, TOOLTIP_STYLE, money, moneyShort } from "@/components/charts";

const day = (s: string | null) => (s ? new Date(`${s}T00:00:00`) : null);

/** Overview-tab insights: margin & schedule health, budget vs actual, cost curve, milestone slips. */
export function OverviewCharts({ jobId, locale, jobStatus }: { jobId: string; locale: typeof enCA; jobStatus: string }) {
  const { data, isLoading } = useQuery({ queryKey: ["job-analytics", jobId], queryFn: () => analyticsApi.job(jobId) });
  if (isLoading || !data) return <div className="grid md:grid-cols-3 gap-3"><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-24 rounded-2xl" /></div>;
  return (
    <div className="space-y-4">
      <HealthStrip data={data} locale={locale} jobStatus={jobStatus} />
      <div className="grid lg:grid-cols-2 gap-4">
        <BudgetChart data={data} />
        <CurveChart data={data} locale={locale} />
      </div>
      {data.schedule.rows.some((r) => r.slipDays > 0) && <SlipList data={data} />}
    </div>
  );
}

function HealthStrip({ data, locale, jobStatus }: { data: JobAnalyticsDto; locale: typeof enCA; jobStatus: string }) {
  const { t } = useLanguage();
  const ev = data.earned;
  const marginTone = ev.projectedMarginPercent === null ? "" : ev.projectedMarginPercent < 10 ? "text-rose-600" : ev.projectedMarginPercent < 20 ? "text-amber-600" : "text-emerald-600";
  const behind = data.schedule.daysBehind;
  const done = jobStatus === "completed";
  const gap = ev.billingGapCents;
  return (
    <div className="grid md:grid-cols-3 gap-3">
      <Tile
        icon={ev.projectedMarginPercent !== null && ev.projectedMarginPercent < 10 ? <TrendingDown className="h-4 w-4 text-rose-500" /> : <TrendingUp className="h-4 w-4 text-emerald-500" />}
        label={t("analytics.job.projectedMargin")}
        value={ev.projectedMarginPercent === null ? "—" : `${ev.projectedMarginPercent}%`}
        tone={marginTone}
        sub={ev.projectedFinalCostCents !== null ? `${t("analytics.job.projectedCost")} ${formatCents(ev.projectedFinalCostCents)}${ev.costPerformance !== null ? ` · CPI ${ev.costPerformance}` : ""}` : t("analytics.job.noCostsYet")}
      />
      <Tile
        icon={done ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : behind > 0 ? <AlertTriangle className="h-4 w-4 text-rose-500" /> : <Clock className="h-4 w-4 text-emerald-500" />}
        label={t("analytics.job.schedule")}
        value={done ? t("analytics.job.completed") : behind > 0 ? `${behind} ${t("analytics.job.daysBehind")}` : t("analytics.job.onTrack")}
        tone={done ? "text-emerald-600" : behind > 0 ? "text-rose-600" : "text-emerald-600"}
        sub={data.schedule.forecastEnd && !done ? `${t("analytics.job.forecastEnd")} ${format(day(data.schedule.forecastEnd)!, "PP", { locale })}${behind > 0 && data.schedule.plannedEnd ? ` (${t("analytics.job.planned")} ${format(day(data.schedule.plannedEnd)!, "d MMM", { locale })})` : ""}` : undefined}
      />
      <Tile
        icon={gap > 0 ? <AlertTriangle className="h-4 w-4 text-amber-500" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
        label={t("analytics.job.unbilled")}
        value={gap > 0 ? formatCents(gap) : formatCents(0)}
        tone={gap > 0 ? "text-amber-600" : "text-emerald-600"}
        sub={`${t("analytics.job.earned")} ${formatCents(ev.earnedCents)} · ${t("analytics.job.invoicedPreTax")} ${formatCents(ev.invoicedSubtotalCents)}${data.invoices.upcomingCents ? ` · ${t("analytics.job.upcomingTerms")} ${formatCents(data.invoices.upcomingCents)}` : ""}`}
      />
    </div>
  );
}

function Tile({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-card px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs text-slate-500">{icon}{label}</div>
      <div className={cn("text-lg font-bold text-slate-900 mt-0.5", tone)}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">{sub}</div>}
    </div>
  );
}

function BudgetChart({ data }: { data: JobAnalyticsDto }) {
  const { t } = useLanguage();
  const rows = data.categories.filter((c) => c.plannedCents > 0 || c.actualCents > 0 || c.pendingCents > 0).map((c) => ({ ...c, name: t(`jobs.cost.${c.category}`) }));
  return (
    <ChartCard title={t("analytics.job.budgetVsActual")} subtitle={`${t("analytics.job.budget")} ${formatCents(data.budgetCents)} · ${t("analytics.job.spent")} ${formatCents(data.costCents)}${data.pendingCostCents ? ` · ${formatCents(data.pendingCostCents)} ${t("analytics.job.pending")}` : ""}`}>
      {rows.length === 0 ? <Empty text={t("analytics.noData")} /> : (
        <>
          <LegendRow items={[{ color: SERIES.planned, label: t("analytics.job.budget") }, { color: SERIES.actual, label: t("analytics.job.actual") }, { color: "#c4b5fd", label: t("analytics.job.pending") }]} />
          <ResponsiveContainer width="100%" height={Math.max(160, rows.length * 44)}>
            <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }} barGap={2}>
              <CartesianGrid horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" tickFormatter={moneyShort} tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={96} tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number, n: string) => [money(v), n]} contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#f8fafc" }} />
              <Bar dataKey="plannedCents" name={t("analytics.job.budget")} fill={SERIES.planned} radius={[0, 4, 4, 0]} barSize={10} />
              <Bar dataKey="actualCents" name={t("analytics.job.actual")} stackId="a" barSize={10}>
                {rows.map((r) => <Cell key={r.category} fill={r.plannedCents > 0 && r.actualCents > r.plannedCents ? STATUS.bad : SERIES.actual} />)}
              </Bar>
              <Bar dataKey="pendingCents" name={t("analytics.job.pending")} stackId="a" fill="#c4b5fd" radius={[0, 4, 4, 0]} barSize={10} />
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
    </ChartCard>
  );
}

function CurveChart({ data, locale }: { data: JobAnalyticsDto; locale: typeof enCA }) {
  const { t } = useLanguage();
  const rows = data.curve.map((p) => ({ ...p, label: format(day(p.week)!, "d MMM", { locale }) }));
  const hasBudget = data.budgetCents > 0;
  return (
    <ChartCard title={t("analytics.job.costCurve")} subtitle={t("analytics.job.costCurveHint")}>
      {rows.length < 2 ? <Empty text={t("analytics.noData")} /> : (
        <>
          <LegendRow items={[{ color: SERIES.actual, label: t("analytics.job.actualCosts") }, ...(hasBudget ? [{ color: SERIES.planned, label: t("analytics.job.plannedSpend"), dashed: true }] : []), { color: SERIES.invoiced, label: t("analytics.invoiced") }, { color: SERIES.collected, label: t("analytics.collected") }]} />
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis tickFormatter={moneyShort} tick={AXIS_TICK} axisLine={false} tickLine={false} width={64} />
              <Tooltip formatter={(v: number, n: string) => [money(v), n]} contentStyle={TOOLTIP_STYLE} />
              {hasBudget && <Line type="monotone" dataKey="plannedCents" name={t("analytics.job.plannedSpend")} stroke={SERIES.planned} strokeWidth={2} strokeDasharray="4 4" dot={false} isAnimationActive={false} />}
              <Line type="monotone" dataKey="actualCents" name={t("analytics.job.actualCosts")} stroke={SERIES.actual} strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="invoicedCents" name={t("analytics.invoiced")} stroke={SERIES.invoiced} strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="collectedCents" name={t("analytics.collected")} stroke={SERIES.collected} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </ChartCard>
  );
}

function SlipList({ data }: { data: JobAnalyticsDto }) {
  const { t } = useLanguage();
  const rows = data.schedule.rows.filter((r) => r.slipDays > 0);
  return (
    <ChartCard title={t("analytics.job.slips")} subtitle={t("analytics.job.slipsHint")}>
      <ul className="divide-y divide-slate-100">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="truncate text-slate-800">{r.title}</span>
            <span className={cn("shrink-0 text-xs font-medium rounded-full px-2 py-0.5", r.state === "done_late" ? "bg-slate-100 text-slate-600" : "bg-rose-100 text-rose-700")}>
              {t(`analytics.job.state.${r.state}`)} · +{r.slipDays} {t("analytics.days")}
            </span>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}
