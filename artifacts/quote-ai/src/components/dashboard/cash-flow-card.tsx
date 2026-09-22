// Phase 79 — "Cash — next 60 days" on the dashboard home. Elite (analytics_pro):
// the same engine as the analytics page chart plus scheduled drafts and the
// payroll run-rate. Pro/Starter subscribers see a one-line locked card;
// free/trial accounts see nothing (they already get the upgrade banners).
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format } from "date-fns";
import { enCA, frCA } from "date-fns/locale";
import { AlertTriangle, ArrowRight, Lock, Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/jobs-api";
import { cashFlowApi } from "@/lib/analytics-api";
import { AXIS_TICK, LegendRow, SERIES, TOOLTIP_STYLE, money, moneyShort } from "@/components/charts";

export function CashFlowCard({ plan, isActive }: { plan: string | null | undefined; isActive: boolean | undefined }) {
  const { t, lang } = useLanguage();
  const locale = lang === "fr" ? frCA : enCA;
  const elite = !!isActive && plan === "monthly_elite";
  const outlook = useQuery({ queryKey: ["cash-flow-outlook"], queryFn: () => cashFlowApi.outlook(), enabled: elite, retry: false, staleTime: 60_000 });

  if (!isActive) return null;
  if (!elite) {
    return (
      <section className="card" style={{ marginTop: 16 }}>
        <div className="card-foot" style={{ borderTop: "none" }}>
          <div className="flex items-center gap-3 min-w-0">
            <span className="qa-ic navy"><Lock className="h-4 w-4" /></span>
            <div className="min-w-0">
              <b className="block text-sm text-navy-900">{t("dashboard.cash.title")}</b>
              <span className="block text-xs text-slate-500">{t("dashboard.cash.locked")}</span>
            </div>
          </div>
          <Link href="/dashboard/billing" className="cta-link" style={{ fontSize: 13.5 }}>{t("dashboard.cash.upgrade")} <ArrowRight className="chev" /></Link>
        </div>
      </section>
    );
  }
  if (outlook.isLoading) return <Skeleton className="h-64 w-full rounded-[var(--radius)]" style={{ marginTop: 16 }} />;
  const data = outlook.data;
  if (!data) return null;

  const rows = data.weeks.map((w) => ({
    ...w,
    label: format(new Date(`${w.week}T00:00:00`), "d MMM", { locale }),
    inflowCents: w.dueCents + w.overdueCents,
    outflowNeg: -w.outflowCents,
    payrollNeg: -w.payrollCents,
  }));
  const empty = rows.every((w) => !w.inflowCents && !w.scheduledCents && !w.expectedCents && !w.outflowCents && !w.payrollCents);
  const s = data.sources;
  const sourceBits = [
    s.openInvoices > 0 ? t("dashboard.cash.src.invoices").replace("{n}", String(s.openInvoices)) : null,
    s.scheduledInvoices > 0 ? t("dashboard.cash.src.scheduled").replace("{n}", String(s.scheduledInvoices)) : null,
    s.upcomingTerms > 0 ? t("dashboard.cash.src.terms").replace("{n}", String(s.upcomingTerms)) : null,
    s.activeJobs > 0 ? t("dashboard.cash.src.jobs").replace("{n}", String(s.activeJobs)) : null,
    s.payrollWeeklyCents > 0 ? t("dashboard.cash.src.payroll").replace("{amount}", formatCents(s.payrollWeeklyCents)) : null,
  ].filter((x): x is string => !!x);
  const low = data.totals.lowestCumulativeCents;
  const lowWeek = data.totals.lowestWeek ? format(new Date(`${data.totals.lowestWeek}T00:00:00`), "d MMM", { locale }) : "";

  return (
    <section className="card" style={{ marginTop: 16 }} data-testid="cash-flow-card">
      <div className="card-head">
        <div>
          <h2 className="flex items-center gap-2"><Wallet className="h-4 w-4" style={{ color: "var(--faint)" }} /> {t("dashboard.cash.title")}</h2>
          <p className="sub">{sourceBits.length ? sourceBits.join(" · ") : t("dashboard.cash.noSources")}</p>
        </div>
        <Link href="/dashboard/analytics" className="cta-link" style={{ fontSize: 13.5 }}>{t("dashboard.cash.details")} <ArrowRight className="chev" /></Link>
      </div>
      <div className="act-body">
        <div className="grid grid-cols-3 gap-3 mb-3">
          <Mini label={t("dashboard.cash.in")} value={formatCents(data.totals.inCents)} tone="good" />
          <Mini label={t("dashboard.cash.out")} value={formatCents(data.totals.outCents)} tone="neutral" />
          <Mini label={t("dashboard.cash.net")} value={`${data.totals.netCents < 0 ? "−" : ""}${formatCents(Math.abs(data.totals.netCents))}`} tone={data.totals.netCents < 0 ? "bad" : "good"} />
        </div>
        {empty ? (
          <p className="text-sm text-slate-500 py-6 text-center">{t("dashboard.cash.empty")}</p>
        ) : (
          <>
            <LegendRow items={[{ color: SERIES.invoiced, label: t("analytics.invoicesDue") }, { color: "#7dd3fc", label: t("dashboard.cash.scheduledAndTerms") }, { color: SERIES.outflow, label: t("analytics.plannedCosts") }, { color: "#f59e0b", label: t("dashboard.cash.payroll") }, { color: SERIES.collected, label: t("analytics.cumulativeNet") }]} />
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
          </>
        )}
      </div>
      <div className="card-foot">
        {low < 0 ? (
          <span className="text-sm font-semibold text-rose-700 inline-flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" />{t("dashboard.cash.lowPoint").replace("{amount}", formatCents(-low)).replace("{week}", lowWeek)}</span>
        ) : (
          <span className="text-sm font-semibold text-emerald-700">{t("dashboard.cash.stays")}</span>
        )}
        {data.budgetAlerts.length > 0 && (
          <span className="text-sm text-slate-600 inline-flex flex-wrap items-center gap-1.5">
            {t("dashboard.cash.budgetAlerts").replace("{n}", String(data.budgetAlerts.length))}
            {data.budgetAlerts.slice(0, 3).map((j) => (
              <Link key={j.id} href={`/dashboard/jobs/${j.id}`} className={cn("chip", j.level === 100 ? "chip-red" : "chip-yellow")}>{j.name} · {j.pct} %</Link>
            ))}
          </span>
        )}
      </div>
    </section>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone: "good" | "bad" | "neutral" }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 min-w-0">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 truncate">{label}</div>
      <div className={cn("text-base font-extrabold tabular-nums truncate", tone === "good" && "text-emerald-700", tone === "bad" && "text-rose-700", tone === "neutral" && "text-navy-900")}>{value}</div>
    </div>
  );
}
