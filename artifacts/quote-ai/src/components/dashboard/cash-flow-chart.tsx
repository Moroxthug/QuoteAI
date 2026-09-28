// Phase 115: the cash-flow chart on its own, so recharts (~110 kB gzipped)
// loads only when an Elite account's card has data to draw — not with Today.
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLanguage } from "@/i18n/LanguageContext";
import { AXIS_TICK, SERIES, TOOLTIP_STYLE, money, moneyShort } from "@/components/charts";

export type CashFlowRow = {
  label: string;
  inflowCents: number;
  scheduledCents: number;
  expectedCents: number;
  outflowNeg: number;
  payrollNeg: number;
  cumulativeCents: number;
};

export default function CashFlowChart({ rows }: { rows: CashFlowRow[] }) {
  const { t } = useLanguage();
  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} stackOffset="sign">
        <CartesianGrid vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={moneyShort} tick={AXIS_TICK} axisLine={false} tickLine={false} width={64} />
        <ReferenceLine y={0} stroke="#cbd5e1" />
        <Tooltip formatter={(v: number, n: string) => [money(Math.abs(v)), n]} contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#f8fafc" }} />
        <Bar dataKey="inflowCents" name={t("analytics.invoicesDue")} stackId="c" fill={SERIES.invoiced} maxBarSize={28} />
        <Bar dataKey="scheduledCents" name={t("dashboard.cash.scheduled")} stackId="c" fill="#7dd3fc" maxBarSize={28} />
        <Bar dataKey="expectedCents" name={t("analytics.expectedBillings")} stackId="c" fill="#bae6fd" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="outflowNeg" name={t("analytics.plannedCosts")} stackId="c" fill={SERIES.outflow} maxBarSize={28} />
        <Bar dataKey="payrollNeg" name={t("dashboard.cash.payroll")} stackId="c" fill="#f59e0b" radius={[0, 0, 4, 4]} maxBarSize={28} />
        <Line type="monotone" dataKey="cumulativeCents" name={t("analytics.cumulativeNet")} stroke={SERIES.collected} strokeWidth={2} dot={false} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
