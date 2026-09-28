// Phase 115: the job's cost curve on its own, so recharts (~110 kB gzipped)
// loads when the Overview draws the chart — not with the job page.
import { format } from "date-fns";
import type { enCA } from "date-fns/locale";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLanguage } from "@/i18n/LanguageContext";
import type { JobAnalyticsDto } from "@/lib/analytics-api";
import { AXIS_TICK, Empty, LegendRow, SERIES, TOOLTIP_STYLE, money, moneyShort } from "@/components/charts";

const day = (s: string) => new Date(`${s}T00:00:00`);

export default function CurveBody({ data, locale, compact }: { data: JobAnalyticsDto; locale: typeof enCA; compact?: boolean }) {
  const { t } = useLanguage();
  const rows = data.curve.map((p) => ({ ...p, label: format(day(p.week), "d MMM", { locale }) }));
  const hasBudget = data.budgetCents > 0;
  if (rows.length < 2) return <Empty text={t("analytics.noData")} />;
  return (
    <>
      <ResponsiveContainer width="100%" height={compact ? 200 : 220}>
        <LineChart data={rows} margin={{ top: 8, right: compact ? 4 : 12, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={compact ? 32 : 24} />
          <YAxis tickFormatter={moneyShort} tick={AXIS_TICK} axisLine={false} tickLine={false} width={compact ? 44 : 64} tickCount={compact ? 4 : 5} />
          <Tooltip formatter={(v: number, n: string) => [money(v), n]} contentStyle={TOOLTIP_STYLE} />
          {hasBudget && <Line type="monotone" dataKey="plannedCents" name={t("analytics.job.plannedSpend")} stroke={SERIES.planned} strokeWidth={2} strokeDasharray="4 4" dot={false} isAnimationActive={false} />}
          <Line type="monotone" dataKey="actualCents" name={t("analytics.job.actualCosts")} stroke={SERIES.actual} strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="invoicedCents" name={t("analytics.invoiced")} stroke={SERIES.invoiced} strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="collectedCents" name={t("analytics.collected")} stroke={SERIES.collected} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
      <div className="legend-under"><LegendRow items={[{ color: SERIES.actual, label: t("analytics.job.actualCosts") }, ...(hasBudget ? [{ color: SERIES.planned, label: t("analytics.job.plannedSpend"), dashed: true }] : []), { color: SERIES.invoiced, label: t("analytics.invoiced") }, { color: SERIES.collected, label: t("analytics.collected") }]} /></div>
    </>
  );
}
