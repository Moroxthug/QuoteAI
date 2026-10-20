// Free quotes. SystemStates.dc.html has no state for it, so it is composed from the board's own parts:
//  - the counter is the Trial banner (accent banner, gift icon) with a "See plans" link; one left turns it to the warning tone;
//  - "used" is the Locked-by-plan card (lock, title, body, a status word) with the Quota card's "reached" meter ("3 of 3 used. You can still edit and send."), in a sheet
//    (choose in a sheet) with the primary action "See plans" and a secondary "Not now".
// No prices, no purchase: the action goes to the plan screen that every other plan link uses.
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { bannerKey } from "@/lib/allowance";
import { closeFreeQuotesGate, useFreeQuotesGate } from "@/lib/freeQuotesGate";
import { number, type Locale } from "@/lib/format";
import { screenHref } from "@/lib/nav";
import { useAllowance } from "@/lib/useAllowance";
import { playBillingAvailable } from "@/lib/usePlayBilling";
import { Button } from "./Button";
import { Banner } from "./Feedback";
import { Stack } from "./Layout";
import { Icon } from "./Icon";
import { PlanMeter, PlanMeters } from "./Plan";
import { Sheet, SheetTitle } from "./Sheet";
import { Status } from "./Status";
import { Text } from "./Text";

const useLocale = (): { t: (k: string, o?: Record<string, unknown>) => string; locale: Locale } => {
  const { t, i18n } = useTranslation();
  return { t: (k, o) => t(`fq.${k}`, o) as string, locale: i18n.language.startsWith("fr") ? "fr-CA" : "en-CA" };
};

const toPlans = (title: string) => router.push(screenHref("SetPlan", title));

/** "2 of 3 free quotes left." for an account that isn't paid. Nothing for a paid account, or when the allowance can't be read. */
export function FreeQuotesBanner({ pt = 0 }: { /** Space above, only when the banner shows. */ pt?: number }) {
  const { t, locale } = useLocale();
  const { state } = useAllowance();
  const key = bannerKey(state);
  if (state.kind === "none" || !key) return null;
  const vars = { left: number(state.left, locale), limit: number(state.limit, locale) };
  const tone = state.kind === "counting" ? "acc" : "warn";
  return (
    <Stack pt={pt} px={16}>
    <Banner tone={tone} icon="gift" iconTone={state.kind === "counting" ? "clay" : "amber"} lead={t(`banner.${key}.lead`, vars)} link={t("banner.link")} onLink={() => toPlans(t("locked.soon"))}>
      {t(`banner.${key}.body`)}
    </Banner>
    </Stack>
  );
}

/** The "free quotes used" sheet. One for the whole app, opened by a 402 FREE_QUOTES_USED from any quote creation. */
export function FreeQuotesGate() {
  const { t, locale } = useLocale();
  const gate = useFreeQuotesGate();
  const { state } = useAllowance();
  const limit = gate.limit ?? (state.kind === "none" ? null : state.limit);
  const n = (v: number | null) => (v == null ? "" : number(v, locale));
  const used = gate.used ?? limit;
  return (
    <Sheet open={gate.open} onClose={closeFreeQuotesGate} label={t("locked.label")} closeLabel={t("locked.close")}>
      <SheetTitle>{t("locked.title", { limit: n(limit) })}</SheetTitle>
      <View style={{ paddingHorizontal: 20, gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 14 }}>
          <Icon name="lock" tone="slate" size={36} />
          <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
            <Text size={13.5} color="muted" leading={1.45}>{t("locked.body")}</Text>
            <Status tone="bad" shape="alert">{t("locked.status")}</Status>
          </View>
        </View>
        <PlanMeters>
          {[<PlanMeter key="m" label={t("locked.meter")} used={n(used)} total={n(limit)} of={t("locked.of")} value={1} level="full" sub={t("locked.keep")} />]}
        </PlanMeters>
        <View style={{ gap: 10, paddingTop: 4, paddingBottom: 16 }}>
          <Button label={t("locked.plans")} block onPress={() => { closeFreeQuotesGate(); toPlans(t("locked.soon")); }} />
          <Button kind="secondary" label={t("locked.later")} block onPress={closeFreeQuotesGate} />
          {playBillingAvailable() ? null : <Text size={12.5} color="muted" align="center">{t("locked.note")}</Text>}
        </View>
      </View>
    </Sheet>
  );
}
