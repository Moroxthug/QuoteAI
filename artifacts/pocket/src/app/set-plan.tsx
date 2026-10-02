// SetPlan.dc.html. Plan and billing: the plan and its state (with the date it renews), a meter for each thing it counts this month (logins, quotes or open jobs, receipt
// scans, texts), what it includes (a lock and the tier's tag for what it doesn't), the billing rows and the card that sends the owner to quoteai.ca. Nothing is bought or
// changed here. States: default, a plan below Business (the locked list), usage only (a member), loading and can't load.
// Not built yet: "Payment failed" and "Changed Sep 14" (the server doesn't keep a failed payment or when the plan last changed: the failed payment arrives with Dunning),
// the card's brand and last four digits, and the names under the logins meter.
import { Redirect, router } from "expo-router";
import { Linking } from "react-native";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { dayFromKey } from "@/lib/assistant";
import { number as num, shortDate, type Locale } from "@/lib/format";
import { PLANS_URL, featureRows, meterOf, type Meter } from "@/lib/plan";
import { screenHref } from "@/lib/nav";
import { useRole } from "@/lib/useRole";
import { useSession } from "@/lib/useSession";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { Header } from "@/ui/Header";
import { ScrollPage, Section } from "@/ui/Layout";
import { IncludedList, PlanCard, PlanMeter, PlanMeters, WebCard } from "@/ui/Plan";
import { Screen } from "@/ui/Screen";
import { SetGroup, SetRow, SetValue } from "@/ui/Settings";
import { InlineBanner, RowStatus, SetTitle } from "@/ui/SettingsPages";
import { SectionHeader } from "@/ui/Row";

type Overview = {
  plan: string; name: string; status: string | null; active: boolean; interval: string; periodEnd: string | null; coveredBy: string | null; resetsOn: string;
  logins: Meter; quotes: Meter | null; openJobs: Meter | null; receiptScans: Meter | null; texts: Meter | null; features: string[];
};

export default function SetPlan() {
  const { t: tr, i18n } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`pl.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { status, user } = useSession();
  const signedIn = status === "in" || status === "offline";
  const toast = useToast();
  const { isOwner } = useRole();
  const q = useQuery({ queryKey: ["plan-overview"], queryFn: () => api<Overview>("/api/plan/overview"), enabled: signedIn, retry: 1, staleTime: 30_000 });
  const profileQ = useQuery({ queryKey: ["company-name"], queryFn: () => api<{ companyName?: string }>("/api/business-profile"), enabled: signedIn, retry: 0, staleTime: 120_000 });

  if (status === "out") return <Redirect href="/" />;

  const o = q.data;
  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("Settings", t("title"))));
  const open = () => void Linking.openURL(PLANS_URL).catch(() => toast({ message: t("toast.failed") }));
  const resets = o ? shortDate(dayFromKey(o.resetsOn), locale) : "";
  const n = (v: number) => num(v, locale);

  const meter = (label: string, m: Meter, sub: (level: "ok" | "near" | "full") => string) => {
    const { value, level } = meterOf(m);
    return <PlanMeter key={label} label={label} used={n(m.used)} total={n(m.limit)} of={t("of")} value={value} level={level} sub={sub(level)} />;
  };
  const monthly = (level: "ok" | "near" | "full") => (level === "full" ? t("meters.full", { date: resets }) : level === "near" ? t("meters.almost", { date: resets }) : t("meters.resets", { date: resets }));

  const meters = o ? [
    meter(t("meters.logins"), o.logins, (l) => (l === "full" ? t("meters.loginsFull") : t("meters.loginsSub", { count: o.logins.used }))),
    ...(o.quotes ? [meter(t("meters.quotes"), o.quotes, monthly)] : []),
    ...(o.openJobs ? [meter(t("meters.openJobs"), o.openJobs, (l) => (l === "full" ? t("meters.jobsFull") : l === "near" ? t("meters.jobsNear") : ""))] : []),
    ...(o.texts ? [meter(t("meters.texts"), o.texts, monthly)] : []),
    ...(o.receiptScans ? [meter(t("meters.scans"), o.receiptScans, monthly)] : []),
  ] : [];

  const rows = o ? featureRows(o.features, { quotes: o.quotes, openJobs: o.openJobs, logins: o.logins.limit }) : [];
  const included = rows.map((r) => ({ id: r.id, text: t(`row.${r.id}`, { count: r.count }), locked: !r.included, tag: r.included ? undefined : t(`tier.${r.tier}`) }));
  const state = !o ? null : o.active ? <RowStatus tone="ok" shape="live">{t("state.active")}</RowStatus> : <RowStatus tone="mute" shape="off">{o.plan === "free" ? t("state.none") : t("state.ended")}</RowStatus>;
  const figures = o ? [
    { label: o.active ? t("renews") : t("ends"), value: o.periodEnd ? shortDate(new Date(o.periodEnd), locale) : "—" },
    { label: t("logins"), value: t("loginsOf", { used: n(o.logins.used), limit: n(o.logins.limit) }) },
  ] : [];

  return (
    <Screen>
      <Header title="" backLabel={t("back")} onBack={back} />
      <ScrollPage bottom={56}>
        <SetTitle title={t("title")} lede={profileQ.data?.companyName ?? ""} />
        {o && !isOwner ? <InlineBanner><Banner tone="info" icon="lock" iconTone="slate" lead={t("member.lead")}>{t("member.body")}</Banner></InlineBanner> : null}
        {o?.coveredBy ? <InlineBanner><Banner tone="info" icon="tier2" iconTone="azure" lead={t("covered.lead")}>{t("covered.body")}</Banner></InlineBanner> : null}
        {q.isPending && !o ? (
          <Section pt={18} px={16} gap={14}><Skeleton height={130} radius={22} /><Skeleton height={260} radius={22} /></Section>
        ) : !o ? (
          <Empty icon="warn" iconTone="clay" title={t("loadFailed.title")} body={t("loadFailed.body")} action={t("loadFailed.retry")} onAction={() => void q.refetch()} />
        ) : (
          <>
            <Section delay={40} pt={18} px={16}><PlanCard label={t("yourPlan")} name={o.name} state={state} figures={figures} /></Section>
            <Section delay={90} pt={26} px={16}>
              <SectionHeader title={t("usage")} />
              <PlanMeters>{meters}</PlanMeters>
            </Section>
            {included.length ? (
              <Section delay={140} pt={26} px={16}>
                <SectionHeader title={o.plan === "monthly_business" || o.plan === "monthly_elite" ? t("included", { plan: o.name }) : t("on", { plan: o.name })} />
                <IncludedList rows={included} />
              </Section>
            ) : null}
            {isOwner ? (
              <>
                <Section delay={190}>
                  <SetGroup title={t("billing")}>
                    {o.active ? <SetRow first icon="card" tone="violet" label={t("bill.method")} sub={t("bill.methodSub")} /> : null}
                    <SetRow first={!o.active} icon="receipt" tone="stone" label={t("bill.receipts")} sub={t("bill.receiptsSub", { email: user?.email ?? "" })} control={<SetValue value={o.interval === "year" ? t("bill.yearly") : t("bill.monthly")} />} />
                  </SetGroup>
                </Section>
                <Section delay={240} pt={18} px={16}><WebCard title={t("web.title")} sub={t("web.sub")} button={t("web.open")} onOpen={open} /></Section>
              </>
            ) : (
              <Section delay={190} pt={18} px={16}><WebCard title={t("web.title")} sub={t("web.subMember")} button={t("web.open")} onOpen={open} /></Section>
            )}
          </>
        )}
      </ScrollPage>
    </Screen>
  );
}
