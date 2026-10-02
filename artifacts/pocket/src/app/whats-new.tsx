// WhatsNew.dc.html. The sheet that opens over Home once after an update: the version, a short demonstration of the swipe, four things that are new, "Got it" and "All release notes"
// (Help). Release notes are the board's four lines for this version.
import { useEffect } from "react";
import { router, Stack } from "expo-router";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { markSeen, appVersion } from "@/lib/whatsNewSync";
import { shortVersion } from "@/lib/whatsNew";
import { screenHref } from "@/lib/nav";
import { Button } from "@/ui/Button";
import { Sheet } from "@/ui/Sheet";
import { BigTitle, Feature, FeatureList, SheetActions, SheetBody, SwipeDemo, VersionTag } from "@/ui/WhatsNew";

const FEATURES = [{ icon: "bell", tone: "amber" }, { icon: "list", tone: "violet" }, { icon: "camera", tone: "sage" }, { icon: "eye", tone: "azure" }] as const;

export default function WhatsNew() {
  const { t: tr } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`wn.${k}`, o) as string;
  const version = shortVersion(appVersion());
  useEffect(() => { void markSeen(); }, []);
  const close = () => (router.canGoBack() ? router.back() : router.replace("/home"));
  const feats = tr("wn.feats", { returnObjects: true }) as unknown as string[][];
  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ presentation: "transparentModal", animation: "fade" }} />
      <Sheet open onClose={close} label={t("label", { version })} closeLabel={t("close")}>
        <SheetBody>
          <SwipeDemo tile={t("demo.tile")} who={t("demo.who")} number={t("demo.number")} amount={t("demo.amount")} late={t("demo.late")} />
          <VersionTag label={t("version")} version={version} />
          <BigTitle>{t("title")}</BigTitle>
          <FeatureList>{FEATURES.map((f, i) => <Feature key={f.icon} icon={f.icon} tone={f.tone} title={feats[i]![0]!} text={feats[i]![1]!} />)}</FeatureList>
          <SheetActions>
            <Button size="lg" block label={t("got")} onPress={close} />
            <Button kind="ghost" block label={t("all")} onPress={() => { close(); setTimeout(() => router.push(screenHref("HelpCentre", t("all"))), 0); }} />
          </SheetActions>
        </SheetBody>
      </Sheet>
    </View>
  );
}
