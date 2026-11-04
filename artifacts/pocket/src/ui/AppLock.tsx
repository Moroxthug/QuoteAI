// SystemStates.dc.html, "App lock and permissions": the lock screen (the lock orb on a lilac glow, "quoteAI is locked", company · email, Unlock with
// Face ID, Sign out and use my password), the sheet offering to turn the lock on, and the sheets shown before the phone asks for the camera, the
// microphone, the location at clock-in or notifications. `AppLockHost` (root layout) puts the lock over everything and opens the offer and the sheets.
import { useEffect, useRef } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePathname } from "expo-router";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { markOffered, setAppLock, setLockSession, startAppLock, unlock, useAppLock } from "@/lib/appLock";
import { useAskFirst, type Ask } from "@/lib/askFirst";
import { offerLock, type Method } from "@/lib/lockRules";
import { useProfile } from "@/lib/useProfile";
import { useSession } from "@/lib/useSession";
import { board } from "@/theme/board";
import { Button } from "./Button";
import { Icon, type IconName, type Tone } from "./Icon";
import { Sheet } from "./Sheet";
import { Text } from "./Text";
import { useTheme } from "./theme";

const useLockT = () => {
  const { t } = useTranslation();
  return (k: string, o?: Record<string, unknown>) => t(`lock.${k}`, o) as string;
};
export const useMethodName = (method: Method): string => useLockT()(`method.${method}`);

function Glow() {
  return (
    <Svg width={280} height={280} style={{ position: "absolute", top: 40, alignSelf: "center" }} pointerEvents="none">
      <Defs>
        <RadialGradient id="lockGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={board.pushHalo} stopOpacity={0.3} />
          <Stop offset="1" stopColor={board.pushHalo} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={280} height={280} fill="url(#lockGlow)" />
    </Svg>
  );
}

/** The lock screen. `framed` draws it as the board's phone frame (the sandbox); in the app it fills the screen. */
export function LockScreen({ company, email, method, onUnlock, onSignOut, framed }: { company: string; email: string; method: Method; onUnlock: () => void; onSignOut: () => void; framed?: boolean }) {
  const t = useLockT();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const name = useMethodName(method);
  return (
    <View accessibilityViewIsModal style={{ flex: framed ? undefined : 1, height: framed ? 440 : undefined, backgroundColor: colors.ground, alignItems: "center", overflow: "hidden",
      ...(framed ? { borderRadius: 34, boxShadow: `0 0 0 1px ${colors.line2}, 0 24px 50px -30px ${colors.shadow}` } : { paddingTop: insets.top, paddingBottom: insets.bottom }) }}>
      <Glow />
      <View style={{ flex: 1 }} />
      <View importantForAccessibility="no-hide-descendants" style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", boxShadow: `0 0 0 1px ${colors.ring}, 0 18px 36px -18px ${colors.shadow}` }}>
        <Icon name="lock" tone="violet" size={44} />
      </View>
      <Text size={21} weight={600} tracking={-0.03} accessibilityRole="header" style={{ marginTop: 22 }}>{t("screen.title")}</Text>
      <Text size={13.5} color="muted" style={{ marginTop: 6 }}>{[company, email].filter(Boolean).join(" · ")}</Text>
      <View style={{ flex: 1 }} />
      <View style={{ width: "100%", paddingHorizontal: 20, paddingBottom: 22, gap: 4 }}>
        <Button block label={t("screen.unlock", { method: name })} icon={<Icon name="face" tone="lilac" size={22} />} onPress={onUnlock} />
        <Button kind="ghost" size="md" block label={t("screen.signOut")} onPress={onSignOut} />
      </View>
    </View>
  );
}

/** A sheet's body: the halo with its icon, a title, a line, Not now and the main action (the offer and the four permission sheets). */
export function AskBody({ icon, tone, title, body, later, go, onLater, onGo }: { icon: IconName; tone: Tone; title: string; body: string; later: string; go: string; onLater: () => void; onGo: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ paddingTop: 12, paddingHorizontal: 18, paddingBottom: 16, alignItems: "center" }}>
      <View importantForAccessibility="no-hide-descendants" style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.soft, alignItems: "center", justifyContent: "center", boxShadow: `0 0 0 1px ${colors.ring}` }}>
        <Icon name={icon} tone={tone} size={34} />
      </View>
      <Text size={17} weight={600} tracking={-0.02} align="center" accessibilityRole="header" style={{ marginTop: 14 }}>{title}</Text>
      <Text size={13.5} color="muted" leading={1.45} align="center" style={{ marginTop: 6, maxWidth: 280 }}>{body}</Text>
      <View style={{ flexDirection: "row", gap: 8, width: "100%", marginTop: 18 }}>
        <View style={{ flex: 1 }}><Button kind="secondary" block label={later} onPress={onLater} /></View>
        <View style={{ flex: 1 }}><Button block label={go} onPress={onGo} /></View>
      </View>
    </View>
  );
}

/** A sheet drawn in place, as the board shows it (the sandbox). */
export function SheetFrame({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 28, boxShadow: `0 0 0 1px ${colors.ring}, 0 20px 50px -24px ${colors.shadow}` }}>
      <View style={{ alignItems: "center", paddingTop: 8, paddingBottom: 6 }}><View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: colors.line2 }} /></View>
      {children}
    </View>
  );
}

export const ASK_ICON: Record<Ask, { icon: IconName; tone: Tone }> = {
  camera: { icon: "camera", tone: "sky" }, mic: { icon: "mic", tone: "violet" }, location: { icon: "pin", tone: "clay" }, notifications: { icon: "bell", tone: "violet" },
};

/** Root layout: the lock over everything, the one-time offer on Home, and the "before the phone asks" sheet. */
export function AppLockHost() {
  const t = useLockT();
  const { status, user, signOut } = useSession();
  const lock = useAppLock();
  const { profile } = useProfile();
  const ask = useAskFirst();
  const path = usePathname();
  const prev = useRef(status);

  useEffect(() => { void startAppLock(); }, []);
  useEffect(() => {
    const isIn = status === "in" || status === "offline";
    if (status !== "loading") setLockSession(isIn, prev.current === "out");
    prev.current = status;
  }, [status]);

  const signedIn = status === "in" || status === "offline";
  const name = t(`method.${lock.method}`);
  const offer = lock.ready && path === "/home" && offerLock({ signedIn, available: lock.available, enabled: lock.enabled, offered: lock.offered });
  const unlockNow = () => void unlock(t("screen.prompt"), t("screen.cancel"));
  // Face ID comes up by itself when the lock shows.
  useEffect(() => { if (lock.locked) unlockNow(); }, [lock.locked]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {lock.locked && signedIn ? (
        <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}>
          <LockScreen company={profile?.companyName ?? ""} email={user?.email ?? ""} method={lock.method} onUnlock={unlockNow} onSignOut={() => void signOut()} />
        </View>
      ) : null}
      <Sheet open={!!offer && !lock.locked} onClose={() => void markOffered()} label={t("offer.label")} closeLabel={t("offer.close")}>
        <AskBody icon="face" tone="violet" title={t("offer.title", { method: name })} body={t("offer.body")} later={t("offer.later")} go={t("offer.on")}
          onLater={() => void markOffered()} onGo={() => void setAppLock(true, t("screen.prompt"), t("screen.cancel")).then((ok) => { if (!ok) void markOffered(); })} />
      </Sheet>
      <Sheet open={!!ask} onClose={() => ask?.answer(false)} label={ask ? t(`ask.${ask.kind}.title`) : ""} closeLabel={t("ask.close")}>
        {ask ? <AskBody {...ASK_ICON[ask.kind]} title={t(`ask.${ask.kind}.title`)} body={t(`ask.${ask.kind}.body`)} later={t("ask.later")} go={t("ask.go")} onLater={() => ask.answer(false)} onGo={() => ask.answer(true)} /> : null}
      </Sheet>
    </>
  );
}
