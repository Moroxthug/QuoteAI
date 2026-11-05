// Continue with Apple / Google, shared by the start screen, Sign in and Sign up. Draws nothing until the server has
// turned a provider on (lib/socialSignIn.ts). Success goes through "/", which decides between onboarding and Home.
import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { auth, type AuthProblem, type SocialMethods } from "@/lib/auth";
import { shownMethods, type Provider } from "@/lib/socialRules";
import { signInWith } from "@/lib/socialSignIn";
import { useSession } from "@/lib/useSession";
import { appleMark, googleMark } from "@/theme/brandMarks";
import { OrDivider } from "./Auth";
import { Button } from "./Button";
import { Banner, type BannerTone } from "./Feedback";
import type { IconName, Tone } from "./Icon";
import { useTheme } from "./theme";

type Line = "offline" | "twoStep" | "notLinked" | "cancelled" | "closed" | "failed";
const LINE: Record<Line, { tone: BannerTone; icon: IconName; iconTone: Tone }> = {
  offline: { tone: "warn", icon: "cloud", iconTone: "amber" },
  twoStep: { tone: "info", icon: "lock", iconTone: "sky" },
  notLinked: { tone: "info", icon: "mail", iconTone: "sky" },
  cancelled: { tone: "warn", icon: "clock", iconTone: "amber" },
  closed: { tone: "acc", icon: "lock", iconTone: "violet" },
  failed: { tone: "warn", icon: "warn", iconTone: "amber" },
};
const lineFor = (p: AuthProblem): Line => (p === "offline" || p === "twoStep" || p === "notLinked" || p === "cancelled" || p === "closed" ? p : "failed");

function Mark({ provider }: { provider: Provider }) {
  const { colors } = useTheme();
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      {provider === "apple" ? <Path fill={colors.ink} d={appleMark} /> : googleMark.map((p) => <Path key={p.fill} fill={p.fill} d={p.d} />)}
    </Svg>
  );
}

/** `orBelow`: an "or" rule under the buttons, for a form that follows them. It goes when there are no buttons. */
export function SocialButtons({ orBelow = false }: { orBelow?: boolean }) {
  const { t } = useTranslation();
  const { refresh } = useSession();
  const [methods, setMethods] = useState<SocialMethods>({ google: null, apple: false });
  const [busy, setBusy] = useState<Provider | null>(null);
  const [line, setLine] = useState<Line | null>(null);

  useEffect(() => {
    let live = true;
    void auth.socialMethods().then((m) => { if (live) setMethods(m); });
    return () => { live = false; };
  }, []);

  async function go(p: Provider) {
    if (busy) return;
    setBusy(p);
    setLine(null);
    const r = await signInWith(p, methods);
    if (r?.ok) {
      await refresh();
      setBusy(null);
      router.replace("/");
      return;
    }
    setBusy(null);
    if (r) setLine(lineFor(r.problem));
  }

  const shown = shownMethods(methods, Platform.OS);
  if (shown.length === 0) return null;
  const banner = line ? LINE[line] : null;
  return (
    <View style={{ gap: 10 }}>
      {line && banner ? <Banner tone={banner.tone} icon={banner.icon} iconTone={banner.iconTone} lead={t(`auth.social.${line}.lead`)}>{t(`auth.social.${line}.text`)}</Banner> : null}
      {shown.map((p) => <Button key={p} size="lg" kind="secondary" label={t(`auth.${p}`)} busy={busy === p ? t("auth.opening") : false} block onPress={() => void go(p)} icon={<Mark provider={p} />} />)}
      {orBelow ? <View style={{ paddingTop: 8 }}><OrDivider label={t("auth.or")} /></View> : null}
    </View>
  );
}
