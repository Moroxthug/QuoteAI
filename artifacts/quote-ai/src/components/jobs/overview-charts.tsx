import { lazy, Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { enCA } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { StatStrip } from "@/components/mobile/stat-strip";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { analyticsApi, type JobAnalyticsDto } from "@/lib/analytics-api";
import { formatCents } from "@/lib/jobs-api";
import { formatCadWhole } from "@/lib/money";
import { ChartCard, Empty, LegendRow, SERIES } from "@/components/charts";

const day = (s: string | null) => (s ? new Date(`${s}T00:00:00`) : null);
const whole = (c: number) => formatCadWhole(c / 100);
const PENDING = "#c4b5fd";

/** The job's analytics, shared by the page's number strip and the Overview tab (one request). */
export const useJobAnalytics = (jobId: string) => useQuery({ queryKey: ["job-analytics", jobId], queryFn: () => analyticsApi.job(jobId) });

/**
 * Overview-tab insights: schedule health and unbilled work, budget vs actual,
 * the cost curve, milestone slips. Phase 106: the projected margin moved to
 * the page's number strip; on a phone the two charts share one card with a
 * switch (one chart at a time), legends under the chart.
 */
export function OverviewCharts({ jobId, locale, jobStatus }: { jobId: string; locale: typeof enCA; jobStatus: string }) {
  const { data, isLoading } = useJobAnalytics(jobId);
  const phone = useMediaQuery("(max-width: 640px)");
  if (isLoading || !data) return <div className="grid md:grid-cols-2 gap-4"><Skeleton className="h-24 rounded-[var(--radius-mk)]" /><Skeleton className="h-24 rounded-[var(--radius-mk)]" /></div>;
  return (
    <div className="stack">
      <HealthStrip data={data} locale={locale} jobStatus={jobStatus} />
      {phone ? <ChartSwitch data={data} locale={locale} /> : (
        <div className="grid lg:grid-cols-2 gap-4">
          <BudgetChart data={data} />
          <CurveChart data={data} locale={locale} />
        </div>
      )}
      {data.schedule.rows.some((r) => r.slipDays > 0) && <SlipList data={data} />}
    </div>
  );
}

function HealthStrip({ data, locale, jobStatus }: { data: JobAnalyticsDto; locale: typeof enCA; jobStatus: string }) {
  const { t } = useLanguage();
  const ev = data.earned;
  const behind = data.schedule.daysBehind;
  const done = jobStatus === "completed";
  const gap = ev.billingGapCents;
  return (
    <StatStrip
      className="j-health"
      items={[
        {
          label: t("analytics.job.schedule"),
          value: done ? t("analytics.job.completed") : behind > 0 ? `${behind} ${t("analytics.job.daysBehind")}` : t("analytics.job.onTrack"),
          tone: done ? "ok" : behind > 0 ? "bad" : "ok",
          sub: data.schedule.forecastEnd && !done ? `${t("analytics.job.forecastEnd")} ${format(day(data.schedule.forecastEnd)!, "PP", { locale })}${behind > 0 && data.schedule.plannedEnd ? ` (${t("analytics.job.planned")} ${format(day(data.schedule.plannedEnd)!, "d MMM", { locale })})` : ""}` : undefined,
        },
        {
          label: t("analytics.job.unbilled"),
          value: formatCents(Math.max(0, gap)),
          tone: gap > 0 ? "warn" : "ok",
          sub: `${t("analytics.job.earned")} ${formatCents(ev.earnedCents)} · ${t("analytics.job.invoicedPreTax")} ${formatCents(ev.invoicedSubtotalCents)}${data.invoices.upcomingCents ? ` · ${t("analytics.job.upcomingTerms")} ${formatCents(data.invoices.upcomingCents)}` : ""}`,
        },
      ]}
    />
  );
}

/** Phone: one chart card, a two-way switch between the charts. */
function ChartSwitch({ data, locale }: { data: JobAnalyticsDto; locale: typeof enCA }) {
  const { t } = useLanguage();
  const [view, setView] = useState<"budget" | "cash">("budget");
  const meta = view === "budget" ? budgetMeta(data, t) : { title: t("analytics.job.costCurve"), subtitle: t("analytics.job.costCurveHint") };
  // The switch is the card's heading (the chart's full title is still there for a screen reader).
  return (
    <section className="card">
      <div className="card-head j-chart-head">
        <h2 className="sr-only">{meta.title}</h2>
        <div className="pills j-chart-switch" role="group" aria-label={t("jobs.m.charts")}>
          {(["budget", "cash"] as const).map((v) => (
            <button key={v} type="button" className={cn("pill", view === v && "on")} aria-pressed={view === v} onClick={() => setView(v)}>
              {t(v === "budget" ? "jobs.m.chartBudget" : "jobs.m.chartCash")}
            </button>
          ))}
        </div>
        <p className="sub">{meta.subtitle}</p>
      </div>
      <div className="act-body">
        {view === "budget" ? <BudgetBars data={data} /> : <CurveBody data={data} locale={locale} compact />}
      </div>
    </section>
  );
}

function budgetMeta(data: JobAnalyticsDto, t: (k: string) => string) {
  return {
    title: t("analytics.job.budgetVsActual"),
    subtitle: `${t("analytics.job.budget")} ${formatCents(data.budgetCents)} · ${t("analytics.job.spent")} ${formatCents(data.costCents)}${data.pendingCostCents ? ` · ${formatCents(data.pendingCostCents)} ${t("analytics.job.pending")}` : ""}`,
  };
}

function BudgetChart({ data }: { data: JobAnalyticsDto }) {
  const { t } = useLanguage();
  const meta = budgetMeta(data, t);
  return (
    <ChartCard title={meta.title} subtitle={meta.subtitle}>
      <BudgetBars data={data} />
    </ChartCard>
  );
}

/**
 * Phase 106: budget vs actual as labelled bars — the category and the two
 * numbers written over each bar, so nothing depends on an axis or a hover.
 * The pale track is the budget, the solid bar what was spent (red past the
 * budget), the lilac tail what waits for review.
 */
function BudgetBars({ data }: { data: JobAnalyticsDto }) {
  const { t } = useLanguage();
  const rows = data.categories.filter((c) => c.plannedCents > 0 || c.actualCents > 0 || c.pendingCents > 0);
  if (rows.length === 0) return <Empty text={t("analytics.noData")} />;
  const scale = Math.max(1, ...rows.map((r) => Math.max(r.plannedCents, r.actualCents + r.pendingCents)));
  const pct = (c: number) => `${Math.min(100, (c / scale) * 100)}%`;
  return (
    <>
      <ul className="bva">
        {rows.map((r) => {
          const over = r.plannedCents > 0 && r.actualCents > r.plannedCents;
          return (
            <li key={r.category}>
              <div className="bva-top">
                <span className="bva-name">{t(`jobs.cost.${r.category}`)}</span>
                <span className="bva-num"><b className={cn(over && "bad")}>{whole(r.actualCents)}</b> / {whole(r.plannedCents)}</span>
              </div>
              <div className="bva-track" aria-hidden="true">
                <i className="bva-plan" style={{ width: pct(r.plannedCents), background: `${SERIES.planned}26` }} />
                <i className="bva-act" style={{ width: pct(r.actualCents), background: over ? "var(--red)" : SERIES.actual }} />
                {r.pendingCents > 0 && <i className="bva-pend" style={{ left: pct(r.actualCents), width: pct(r.pendingCents), background: PENDING }} />}
              </div>
              {r.pendingCents > 0 && <span className="bva-sub">{t("jobs.m.pendingSub").replace("{amount}", whole(r.pendingCents))}</span>}
            </li>
          );
        })}
      </ul>
      <div className="legend-under"><LegendRow items={[{ color: `${SERIES.planned}40`, label: t("analytics.job.budget") }, { color: SERIES.actual, label: t("analytics.job.actual") }, { color: PENDING, label: t("analytics.job.pending") }]} /></div>
    </>
  );
}

function CurveChart({ data, locale }: { data: JobAnalyticsDto; locale: typeof enCA }) {
  const { t } = useLanguage();
  return (
    <ChartCard title={t("analytics.job.costCurve")} subtitle={t("analytics.job.costCurveHint")}>
      <CurveBody data={data} locale={locale} />
    </ChartCard>
  );
}

// Phase 115: the chart itself (and recharts) arrives when it is drawn; the
// skeleton holds its height so the page does not jump.
const LazyCurveBody = lazy(() => import("./overview-curve"));
function CurveBody(props: { data: JobAnalyticsDto; locale: typeof enCA; compact?: boolean }) {
  return (
    <Suspense fallback={<Skeleton className="w-full rounded-lg" style={{ height: props.compact ? 200 : 220 }} />}>
      <LazyCurveBody {...props} />
    </Suspense>
  );
}

function SlipList({ data }: { data: JobAnalyticsDto }) {
  const { t } = useLanguage();
  const rows = data.schedule.rows.filter((r) => r.slipDays > 0);
  return (
    <ChartCard title={t("analytics.job.slips")} subtitle={t("analytics.job.slipsHint")}>
      <div>
        {rows.map((r) => (
          <div key={r.id} className="item-row" style={{ paddingLeft: 0, paddingRight: 0 }}>
            <div className="grow"><span className="ttl">{r.title}</span></div>
            <span className={cn("chip", r.state === "done_late" ? "chip-grey" : "chip-red")}>
              {t(`analytics.job.state.${r.state}`)} · +{r.slipDays} {t("analytics.days")}
            </span>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}
