// Analytics.dc.html. How the business is doing, for a month, a quarter or the year so far: six figures, revenue by month, quarter or year, the jobs to
// look at, win rate, the average quote, quote to cash, the top clients and where leads come from. States: default, loading, locked (the plan has no analytics),
// plus can't load and offline. Not drawn, for want of data: win rate and margin by job type (quotes and jobs carry no type), the crew-time card (the app doesn't
// track paid hours that aren't on a job), the written captions that read the numbers ("You win more deck jobs than bathrooms"), and the third job's link to its invoice
// (the list holds jobs; an overdue one opens the job).
import { useState } from "react";
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useGetBusinessProfile, useGetSubscription } from "@workspace/api-client-react";
import {
  averageLine, averageQuote, bestCaption, compactMoney, comparisonOf, dataMonth, kpisOf, leadSources, mainFlag, monthName, monthsOf, PERIODS, quoteToCash, revenueBars, topClients, topShare, winRate,
  type Period, type RiskFlag,
} from "@/lib/analytics";
import { analyticsApi, isLocked } from "@/lib/analyticsApi";
import { initialsOf } from "@/lib/group";
import { money, number, percent, type Locale } from "@/lib/format";
import { planName } from "@/lib/inventory";
import { screenHref } from "@/lib/nav";
import { useSession } from "@/lib/useSession";
import type { AvatarTint } from "@/ui/Avatar";
import { AnCard, AnLabel, AreaLine, BigFigure, Caption, CashStack, ClientRow, Columns, HBarRow, LeadHead, RiskRow } from "@/ui/Analytics";
import { Button } from "@/ui/Button";
import { Card, Hairline } from "@/ui/Card";
import { Chip, ChipStrip } from "@/ui/Chip";
import { Banner, Empty, Skeleton } from "@/ui/Feedback";
import { FeatureRow, KpiGrid2 } from "@/ui/Group";
import { Header } from "@/ui/Header";
import { Icon, type IconName, type Tone } from "@/ui/Icon";
import { ScrollPage, Section, Stack } from "@/ui/Layout";
import { SectionHeader } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Tag, type StatusShape, type StatusTone } from "@/ui/Status";
import { Text } from "@/ui/Text";

const AVATARS: AvatarTint[] = [1, 4, 2, 3];
const LOOK: Record<RiskFlag, { icon: IconName; tone: Tone; status: StatusTone; shape: StatusShape }> = {
  over_budget: { icon: "bars", tone: "clay", status: "bad", shape: "alert" },
  overdue_invoices: { icon: "doc", tone: "azure", status: "bad", shape: "alert" },
  behind_schedule: { icon: "clock", tone: "teal", status: "warn", shape: "clock" },
  unbilled_completion: { icon: "receipt", tone: "amber", status: "warn", shape: "clock" },
  billing_gap: { icon: "receipt", tone: "amber", status: "warn", shape: "clock" },
  budget_burn: { icon: "bars", tone: "amber", status: "warn", shape: "clock" },
};

export default function Analytics() {
  const { t: tr, i18n } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`an.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const profile = useGetBusinessProfile({ query: { enabled: signedIn, retry: false } } as never);
  const sub = useGetSubscription({ query: { enabled: signedIn, retry: false } } as never);
  const co = useQuery({ queryKey: ["analytics-company"], queryFn: analyticsApi.company, enabled: signedIn, retry: false, staleTime: 30_000 });
  const ins = useQuery({ queryKey: ["analytics-insights"], queryFn: analyticsApi.insights, enabled: signedIn && co.isSuccess, retry: false, staleTime: 30_000 });
  const [period, setPeriod] = useState<Period>("m");

  if (status === "out") return <Redirect href="/" />;

  const m0 = (cents: number) => money(cents / 100, locale, { cents: false });
  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("Menu", tr("menu.back"))));
  const locked = isLocked(co.data);
  const loading = co.isPending && !co.data;
  const failed = co.isError && !co.data;
  const company = ((profile.data as { companyName?: string } | undefined)?.companyName) ?? "";
  const head = <Header title={t("title")} backLabel={t("back")} onBack={back} moreLabel={t("more")} />;

  const a = isLocked(co.data) ? undefined : co.data;
  const latest = a ? dataMonth(a) : null;
  const heading = (period: string) => (
    <Section px={20} pt={8} gap={4}>
      <Text size={24} weight={600} tracking={-0.035} leading={1.2} accessibilityRole="header">{t("heading")}</Text>
      <Text size={13.5} color="muted">{period ? t("sub", { company, period }) : company}</Text>
    </Section>
  );

  // ── Locked ────────────────────────────────────────────────────────────────
  if (locked) {
    const current = (sub.data as { plan?: string } | undefined)?.plan ? planName((sub.data as { plan: string }).plan) : "";
    return (
      <Screen>{head}
        <ScrollPage bottom={40}>
          {heading("")}
          <Section delay={50} pt={18} px={16}>
            <Card>
              <Stack px={20} pt={24} pb={20} align="center">
                <Icon name="bars" tone="azure" size={44} />
                <Text size={21} weight={600} tracking={-0.03} align="center" accessibilityRole="header">{t("locked.title", { plan: "Business" })}</Text>
                <Text size={14.5} color="muted" leading={1.45} align="center">{t("locked.body", { current })}</Text>
                <Stack mt={18} gap={0} align="stretch"><Hairline inset={0} />
                  <FeatureRow icon="bars" tone="azure" label={t("locked.feats.money")} />
                  <FeatureRow icon="star" tone="gold" label={t("locked.feats.win")} />
                  <FeatureRow icon="percent" tone="violet" label={t("locked.feats.margin")} />
                  <FeatureRow icon="users" tone="teal" label={t("locked.feats.crew")} />
                </Stack>
                <Stack row gap={6} mt={16}><Tag accent>Business</Tag><Tag accent>Elite</Tag></Stack>
                <Stack mt={16} align="stretch" gap={10}>
                  <Button label={t("locked.plans")} block onPress={() => router.push(screenHref("SetPlan", t("locked.soon")))} />
                  <Text size={12.5} color="muted" align="center">{t("locked.note")}</Text>
                </Stack>
              </Stack>
            </Card>
          </Section>
          <Section pt={12} px={16}>
            <Card accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ opacity: 0.35 }}>
              <AnCard>
                <Skeleton width={120} height={12} />
                <Stack mt={10}><Skeleton width={150} height={30} /></Stack>
                <Columns label="" bars={[42, 55, 70, 60, 68, 82].map((h, i) => ({ label: "", height: h, on: i === 5 }))} />
              </AnCard>
            </Card>
          </Section>
        </ScrollPage>
      </Screen>
    );
  }

  if (failed || loading || !a || !latest) {
    return (
      <Screen>{head}
        <ScrollPage bottom={40}>
          {heading("")}
          {failed ? (
            <Section pt={26} px={16}><Empty icon="warn" iconTone="clay" title={t("loadFailed.title")} body={t("loadFailed.body")} action={t("retry")} onAction={() => void co.refetch()} /></Section>
          ) : (
            <Section pt={16} px={16} gap={12}>
              <Card accessibilityLabel={t("loading")} accessibilityState={{ busy: true }}>
                {[0, 1, 2].map((r) => (
                  <Stack key={r} row>
                    {[0, 1].map((c) => <Stack key={c} grow px={16} pt={13} pb={13} gap={6}><Skeleton width={64} height={11} /><Skeleton width={96} height={20} /></Stack>)}
                  </Stack>
                ))}
              </Card>
              {[0, 1, 2].map((i) => (
                <AnCard key={i}><Skeleton width={120} height={12} /><Stack mt={10}><Skeleton width={150} height={30} /></Stack><Stack mt={14}><Skeleton height={110} radius={7} /></Stack></AnCard>
              ))}
            </Section>
          )}
        </ScrollPage>
      </Screen>
    );
  }

  // ── The numbers ───────────────────────────────────────────────────────────
  const i = isLocked(ins.data) ? null : ins.data ?? null;
  const months = monthsOf(period, latest);
  const year = Number(latest.slice(0, 4));
  const q = Math.floor((Number(latest.slice(5, 7)) - 1) / 3) + 1;
  const kp = kpisOf(a, period, latest);
  const bars = revenueBars(a, period, latest);
  const maxBar = Math.max(1, ...bars.map((b) => b.cents));
  const shortMonth = (k: string) => monthName(k, locale, "short");
  const barLabel = (b: (typeof bars)[number]) => (period === "m" ? shortMonth(b.key) : period === "q" ? `${t("revenue.quarter", { q: b.index + 1 })}${b.year !== year ? ` ’${String(b.year).slice(2)}` : ""}` : String(b.year));
  const periodLabel = period === "m" ? t("label.m", { month: monthName(latest, locale), year }) : period === "q" ? t("label.q", { q, year, from: shortMonth(months[0]!), to: shortMonth(latest) }) : t("label.y", { year });
  const pct = (n: number) => percent(Math.abs(n) / 100, locale);
  const moved = (c: number | null, yearly: boolean) => (c == null ? "" : Math.abs(c) < 0.5 ? t("kpi.same") : t(c > 0 ? (yearly ? "kpi.upYear" : "kpi.up") : yearly ? "kpi.downYear" : "kpi.down", { pct: pct(c) }));
  const prevName = period === "m" ? monthName(comparisonOf("m", latest)[0]!, locale) : period === "q" ? t("revenue.prevQuarter", { q: q === 1 ? 4 : q - 1 }) : t("revenue.prevYear");
  const cap = bestCaption(bars, period, a, latest);
  const decided = i ? winRate(i, months) : null;
  const avgNow = i ? averageQuote(i, months) : null;
  const line = i ? averageLine(i, bars, period, latest) : [];
  const firstAvg = line.find((p) => p.cents != null);
  const cash = i ? quoteToCash(i, months) : null;
  const clients = i ? topClients(i, months, kp.invoicedCents) : [];
  const leads = i ? leadSources(i, months) : [];
  const risks = a.jobs.risks.slice(0, 3);
  const shareLabel = period === "m" ? monthName(latest, locale) : period === "q" ? t("revenue.quarter", { q }) : String(year);
  const riskSub = (r: (typeof risks)[number]) => {
    const f = mainFlag(r);
    if (f === "over_budget") return r.detail.burnPercent != null ? t("jobs.overPct", { pct: percent(r.detail.burnPercent / 100, locale) }) : t("jobs.overAmt", { amount: m0(r.detail.overBudgetCents) });
    if (f === "budget_burn") return t("jobs.burn", { pct: percent((r.detail.burnPercent ?? 0) / 100, locale) });
    if (f === "behind_schedule") return t("jobs.behind", { count: r.detail.daysBehind });
    if (f === "overdue_invoices") return t("jobs.overdue", { amount: m0(r.detail.overdueCents) });
    return t("jobs.unbilled", { amount: m0(r.detail.billingGapCents) });
  };

  return (
    <Screen>{head}
      <ScrollPage bottom={40}>
        {heading(periodLabel)}
        {co.isError || ins.isError ? <Section pt={12} px={16}><Banner tone="warn" icon="cloud" iconTone="amber" lead={t("offline.lead")}>{t("offline.body")}</Banner></Section> : null}
        <Section delay={40} pt={16}>
          <ChipStrip label={t("periods.label")}>
            {PERIODS.map((p) => <Chip key={p} label={t(`periods.${p}`)} selected={p === period} onPress={() => setPeriod(p)} />)}
          </ChipStrip>
        </Section>

        <Section delay={60} pt={16} px={16}>
          <KpiGrid2 labelSize={11.5} pad={13} items={[
            { label: t("kpi.invoiced"), value: m0(kp.invoicedCents), sub: moved(kp.change, period === "y"), subTone: kp.change != null && Math.abs(kp.change) >= 0.5 ? (kp.change > 0 ? "ok" : "bad") : "muted" },
            { label: t("kpi.collected"), value: m0(kp.collectedCents), sub: kp.collectedShare == null ? "" : t("kpi.ofInvoiced", { pct: percent(kp.collectedShare / 100, locale) }) },
            { label: t("kpi.costs"), value: m0(kp.costCents), sub: t("kpi.costsSub") },
            { label: t("kpi.margin"), value: kp.marginPercent == null ? "–" : percent(kp.marginPercent / 100, locale), sub: kp.keptCents >= 0 ? t("kpi.kept", { amount: m0(kp.keptCents) }) : t("kpi.lost", { amount: m0(-kp.keptCents) }), subTone: kp.keptCents >= 0 ? "ok" : "bad" },
            { label: t("kpi.owed"), value: m0(kp.outstandingCents), sub: kp.overdueCents > 0 ? t("kpi.overdue", { amount: m0(kp.overdueCents) }) : t("kpi.noneOverdue"), subTone: kp.overdueCents > 0 ? "bad" : "muted" },
            { label: t("kpi.toInvoice"), value: m0(kp.toInvoiceCents), sub: t("kpi.notBilled") },
          ]} />
        </Section>

        <Section delay={90} pt={22} px={16}>
          <SectionHeader title={t("revenue.title")} link={t(`revenue.by.${period}`)} />
          <AnCard>
            <AnLabel>{t(`revenue.label.${period}`, { month: monthName(latest, locale), q, year })}</AnLabel>
            <BigFigure value={m0(kp.invoicedCents)} />
            {kp.change != null && Math.abs(kp.change) >= 0.5 ? <Text size={12.5} weight={500} color={kp.change > 0 ? "ok" : "bad"}>{t(kp.change > 0 ? "revenue.up" : "revenue.down", { pct: pct(kp.change), prev: prevName })}</Text> : null}
            <Columns label={t("revenue.aria", { list: bars.map((b) => `${barLabel(b)} ${compactMoney(b.cents, locale)}`).join(", ") })}
              bars={bars.map((b, n) => ({ label: barLabel(b), height: (b.cents / maxBar) * 82, on: n === bars.length - 1, value: n === bars.length - 1 ? compactMoney(b.cents, locale) : undefined }))} />
            {cap ? <Caption>{t(cap === "month" ? "revenue.bestMonth" : "revenue.bestQuarter")}</Caption> : null}
          </AnCard>
        </Section>

        {risks.length ? (
          <Section delay={110} pt={22} px={16}>
            <SectionHeader title={t("jobs.title")} link={t("jobs.link")} onLink={() => router.push(screenHref("Jobs", t("jobs.link")))} />
            <Card>
              {risks.map((r, n) => {
                const f = mainFlag(r);
                const look = LOOK[f];
                return <RiskRow key={r.id} first={n === 0} icon={look.icon} tone={look.tone} name={r.name} sub={riskSub(r)} status={t(`jobs.${f}`)} statusTone={look.status} statusShape={look.shape} onPress={() => router.push(screenHref("Job", r.name, { id: r.id }))} />;
              })}
            </Card>
          </Section>
        ) : null}

        {decided ? (
          <Section delay={130} pt={22} px={16}>
            <SectionHeader title={t("win.title")} link={t("win.link")} onLink={() => router.push(screenHref("Quotes", t("win.link")))} />
            <AnCard>
              <AnLabel>{decided.percent == null ? t("win.none") : t("win.of", { won: decided.won, decided: decided.decided })}</AnLabel>
              {decided.percent != null ? <BigFigure value={percent(decided.percent / 100, locale)} /> : null}
            </AnCard>
          </Section>
        ) : null}

        {i && avgNow != null ? (
          <Section delay={150} pt={12} px={16}>
            <AnCard>
              <AnLabel>{t("avg.title")}</AnLabel>
              <BigFigure value={m0(avgNow)} />
              {firstAvg && firstAvg.cents != null && firstAvg.cents !== avgNow ? (
                <Text size={12.5} color="muted">{t(avgNow > firstAvg.cents ? "avg.upFrom" : "avg.downFrom", { amount: m0(firstAvg.cents), label: barLabel(bars.find((b) => b.key === firstAvg.key)!) })}</Text>
              ) : null}
              <AreaLine values={line.map((p) => p.cents)} labels={bars.map(barLabel)} label={t("avg.aria", { from: m0(firstAvg?.cents ?? avgNow), to: m0(avgNow) })} />
            </AnCard>
          </Section>
        ) : null}

        {cash && cash.total > 0 ? (
          <Section delay={170} pt={22} px={16}>
            <SectionHeader title={t("cash.title")} />
            <AnCard>
              <AnLabel>{t("cash.label")}</AnLabel>
              <BigFigure value={number(cash.total, locale)} unit={t("cash.days")} />
              <CashStack label={t("cash.aria", { a: t("cash.d", { n: cash.accept }), i: t("cash.d", { n: cash.invoice }), p: t("cash.d", { n: cash.paid }) })}
                steps={[
                  { days: t("cash.d", { n: cash.accept }), word: t("cash.accept"), weight: cash.accept, color: "acc" },
                  { days: t("cash.d", { n: cash.invoice }), word: t("cash.invoice"), weight: cash.invoice, color: "warn-dot" },
                  { days: t("cash.d", { n: cash.paid }), word: t("cash.paid"), weight: cash.paid, color: "ok-dot" },
                ]} />
            </AnCard>
          </Section>
        ) : null}

        {clients.length ? (
          <Section delay={190} pt={22} px={16}>
            <SectionHeader title={t("clients.title")} link={t("clients.link")} onLink={() => router.push(screenHref("Clients", t("clients.link")))} />
            <Card>
              {clients.map((c, n) => (
                <ClientRow key={c.clientId} first={n === 0} initials={initialsOf(c.name)} tint={AVATARS[n % AVATARS.length]!} name={c.name} sub={t("clients.sub", { count: c.invoices })} amount={m0(c.cents)}
                  share={t("clients.share", { pct: percent(c.share / 100, locale), label: shareLabel })} onPress={() => router.push(screenHref("Client", c.name, { id: c.clientId }))} />
              ))}
              {clients.length > 1 ? <><Hairline inset={0} /><Stack px={16} pt={12} pb={14}><Text size={13.5} leading={1.45} color="t2">{t("clients.top", { pct: percent(topShare(clients) / 100, locale) })}</Text></Stack></> : null}
            </Card>
          </Section>
        ) : null}

        {leads.length ? (
          <Section delay={210} pt={22} px={16}>
            <SectionHeader title={t("leads.title")} link={t("leads.link")} onLink={() => router.push(screenHref("Leads", t("leads.link")))} />
            <AnCard>
              <LeadHead source={t("leads.source")} share={t("leads.share")} won={t("leads.won")} />
              <Stack gap={4}>
                {leads.map((l, n) => (
                  <HBarRow key={l.source} name={(tr(`an.leads.sources.${l.source}`, { defaultValue: l.source }) as string)} width={l.width} trail={percent(l.share / 100, locale)} value={number(l.won, locale)} hi={n === 0} valueTone={n === 0 ? "ok" : undefined} />
                ))}
              </Stack>
            </AnCard>
          </Section>
        ) : null}
      </ScrollPage>
    </Screen>
  );
}
