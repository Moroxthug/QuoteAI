// Phase 135, Android only: buy, restore and manage a plan with Google Play Billing, on the Plan and billing screen.
// SetPlan.dc.html has no purchase UI (it says "nothing is bought here"), so this is composed from that board's own parts: the Card, Banner, Segmented control, Tag, Button and
// SectionHeader. The price on every card is the string Google Play returns for the account's country; no price is typed anywhere in the app.
import { useMemo, useState } from "react";
import { Linking, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useToast } from "./Feedback";
import { Banner, Empty, Skeleton } from "./Feedback";
import { Button } from "./Button";
import { Card } from "./Card";
import { Section } from "./Layout";
import { SectionHeader } from "./Row";
import { Segmented } from "./Segmented";
import { Tag } from "./Status";
import { Num, Text } from "./Text";
import { getPlayBilling } from "@/lib/playBilling";
import { hasInterval, isPlaySubscriber, isStripeSubscriber, offersFor, termKey, tierOfPlan, type Interval, type PlanOffer } from "@/lib/playPlans";
import { playFlow, usePlayFlow, usePlayPlans } from "@/lib/usePlayBilling";
import type { FlowState } from "@/lib/playPurchaseFlow";
import { number as num, type Locale } from "@/lib/format";

type T = (k: string, o?: Record<string, unknown>) => string;

/** The result of the last purchase or restore, as a banner. Nothing for idle and for the person closing the Play sheet. */
function FlowBanner({ s, t }: { s: FlowState; t: T }) {
  if (s.phase === "done") {
    const tier = tierOfPlan(s.result?.plan);
    return <Banner tone="ok" icon="check" iconTone="sage" lead={tier ? t("state.done.lead", { plan: t(`plan.${tier}`) }) : t("state.doneNoPlan.lead")}>{t("state.done.body")}</Banner>;
  }
  if (s.phase === "restored") return <Banner tone="ok" icon="check" iconTone="sage" lead={t("state.restored.lead")}>{t("state.restored.body")}</Banner>;
  if (s.phase === "nothing") return <Banner tone="info" icon="card" iconTone="azure" lead={t("state.nothing.lead")}>{t("state.nothing.body")}</Banner>;
  if (s.phase === "pending") return <Banner tone="warn" icon="clock" iconTone="amber" lead={t("state.pending.lead")}>{t("state.pending.body")}</Banner>;
  if (s.phase === "failed" && s.error) return <Banner tone="bad" icon="warn" iconTone="rose" lead={t(`state.${s.error}.lead`)}>{t(`state.${s.error}.body`)}</Banner>;
  return null;
}

function OfferCard({ o, t, locale, spots, busy, disabled, onBuy }: { o: PlanOffer; t: T; locale: Locale; spots: number | null; busy: boolean; disabled: boolean; onBuy: () => void }) {
  const name = t(`plan.${o.tier}`);
  return (
    <Card padded style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <Text size={17} weight={600} tracking={-0.025} accessibilityRole="header" style={{ flexShrink: 1 }}>{name}</Text>
        {o.founding ? <Tag accent>{t("founding.tag")}</Tag> : null}
      </View>
      <View accessible accessibilityLabel={`${o.price} ${t(`term.${termKey(o)}`)}`} style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
        <Num size={24} weight={600} tracking={-0.035}>{o.price}</Num>
        <Text size={13.5} color="muted">{t(`term.${termKey(o)}`)}</Text>
      </View>
      {o.founding ? (
        <View style={{ gap: 2 }}>
          <Text size={13.5} color="t2" leading={1.4}>{t("founding.kept")}</Text>
          {spots != null ? <Text size={12.5} color="muted">{t("founding.spots", { n: num(spots, locale) })}</Text> : null}
        </View>
      ) : null}
      <Button kind="primary" size="md" block label={t("subscribe")} accessibilityLabel={t("subscribeTo", { plan: name })} busy={busy ? t("opening") : false} disabled={disabled} onPress={onBuy} />
    </Card>
  );
}

/** Android with Google Play only (the caller checks). Replaces the "managed on quoteai.ca" card for the owner. */
export function PlayPlans() {
  const { t: tr, i18n } = useTranslation();
  const t: T = (k, o) => tr(`pp.${k}`, o) as string;
  const locale: Locale = i18n.language.startsWith("fr") ? "fr-CA" : "en-CA";
  const toast = useToast();
  const flow = usePlayFlow();
  const { catalog, details, loading, failed, retry } = usePlayPlans(true);
  const [interval, setInterval] = useState<Interval>("month");
  const busy = flow.phase === "buying" || flow.phase === "verifying" || flow.phase === "restoring";
  const yearly = catalog ? hasInterval(catalog, "year") : false;
  const offers = useMemo(() => (catalog ? offersFor(catalog, details, yearly ? interval : "month") : []), [catalog, details, interval, yearly]);
  const manage = () => void Linking.openURL(getPlayBilling().manageSubscriptionUrl).catch(() => toast({ message: t("loadFailed.title") }));

  if (loading) return <Section pt={26} px={16} gap={14}><Skeleton height={150} radius={22} /><Skeleton height={150} radius={22} /></Section>;
  if (failed || !catalog || (!isStripeSubscriber(catalog) && !isPlaySubscriber(catalog) && !offersFor(catalog, details, "month").length)) {
    return <Empty icon="warn" iconTone="clay" title={t("loadFailed.title")} body={t("loadFailed.body")} action={t("loadFailed.retry")} onAction={retry} />;
  }

  const banner = <FlowBanner s={flow} t={t} />;

  if (isStripeSubscriber(catalog)) {
    // A website subscriber is told where the plan lives. No button, no link to a payment page.
    return <Section pt={26} px={16} gap={12}><Banner tone="info" icon="lock" iconTone="slate" lead={t("stripe.lead")}>{t("stripe.body")}</Banner></Section>;
  }

  if (isPlaySubscriber(catalog)) {
    return (
      <Section pt={26} px={16} gap={12}>
        {banner}
        <Card padded style={{ gap: 6, alignItems: "center" }}>
          <Text size={16} weight={600} align="center" style={{ marginTop: 4 }}>{t("play.title")}</Text>
          <Text size={13.5} color="muted" align="center" leading={1.4}>{t("play.body")}</Text>
          <View style={{ alignSelf: "stretch", marginTop: 10, gap: 10 }}>
            <Button kind="primary" size="md" block label={t("manage")} onPress={manage} />
            <Button kind="secondary" size="md" block label={t("restore")} busy={flow.phase === "restoring" ? t("restoring") : false} disabled={busy} onPress={() => void playFlow().restore()} />
          </View>
        </Card>
      </Section>
    );
  }

  return (
    <Section pt={26} px={16} gap={14}>
      {banner}
      <View>
        <SectionHeader title={t("title")} />
        {yearly ? <View style={{ paddingBottom: 12 }}><Segmented label={t("interval.label")} options={[t("interval.month"), t("interval.year")]} value={interval === "month" ? 0 : 1} onChange={(i) => setInterval(i === 0 ? "month" : "year")} /></View> : null}
        <View style={{ gap: 12 }}>
          {offers.map((o) => (
            <OfferCard key={`${o.productId}-${o.basePlanId}`} o={o} t={t} locale={locale} spots={catalog.launchSpotsLeft ?? null} busy={flow.phase === "buying" || flow.phase === "verifying"} disabled={busy}
              onBuy={() => void playFlow().buy(o)} />
          ))}
        </View>
      </View>
      <View style={{ gap: 4, paddingHorizontal: 4 }}>
        <Text size={12.5} color="muted" leading={1.45}>{t("legal.renews")}</Text>
        <Text size={12.5} color="muted" leading={1.45}>{t("legal.cancel")}</Text>
        <Text size={12.5} color="muted" leading={1.45}>{t("legal.charged")}</Text>
      </View>
      <Button kind="secondary" size="md" block label={t("restore")} busy={flow.phase === "restoring" ? t("restoring") : false} disabled={busy} onPress={() => void playFlow().restore()} />
    </Section>
  );
}
