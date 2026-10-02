// SetSecurity.dc.html. Sign-in and security: the password (a link by email), Face ID, the second step, where this person is signed in (the others can be signed out,
// one by one or all), what they did lately, "Export my data" and "Delete account" (a password, the word, a code when the second step is on; the account closes in 30 days).
// States: default, two-step off, view only, loading and can't load.
// Not true to the board: "Last changed" for the password (the server doesn't keep it), "Send codes by Text / Authenticator" (the server's second step is the authenticator app
// only), turning two-step on or off and the backup codes (their screens aren't built: Coming soon), Face ID (not in this build), the city and phone name of a device
// (the server keeps the browser and system only), and "Cancel deletion" here (the owner is signed out when it is asked; the email link cancels it).
import { useState } from "react";
import { Redirect, router } from "expo-router";
import { Linking } from "react-native";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiFailure } from "@/lib/api";
import { auth } from "@/lib/auth";
import { dateWithYear, number as num, shortDate, type Locale } from "@/lib/format";
import { comingSoonHref, screenHref } from "@/lib/nav";
import { activityOf, agentParts, deleteReady, othersFirst, type Device } from "@/lib/security";
import { useRole } from "@/lib/useRole";
import { useSession } from "@/lib/useSession";
import { Button } from "@/ui/Button";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { Header } from "@/ui/Header";
import { ScrollPage, Section, Stack } from "@/ui/Layout";
import { Screen } from "@/ui/Screen";
import { SetButton, SetField, SetGroup, SetRow, SetValue } from "@/ui/Settings";
import { InlineBanner, RowStatus, SetTitle } from "@/ui/SettingsPages";
import { DeleteForm, DeleteIntro } from "@/ui/Security";
import { Switch } from "@/ui/Switch";

type Account = {
  ownsProfile: boolean; companyName: string | null; canExport: boolean; canDelete: boolean; graceDays: number;
  pendingDeletion: { scheduledFor: string; daysLeft: number } | null;
  exports: { id: string; status: string; sizeBytes: number | null; expiresAt: string | null; downloadUrl: string | null }[];
};
type AuditEvent = { id: string; action: string; actorId: string | null; userAgent: string | null; createdAt: string };

export default function SetSecurity() {
  const { t: tr, i18n } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`sy.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { status, user, signOut } = useSession();
  const signedIn = status === "in" || status === "offline";
  const toast = useToast();
  const client = useQueryClient();
  const { isOwner, role } = useRole();
  const devicesQ = useQuery({ queryKey: ["auth-devices"], queryFn: async () => { const r = await auth.devices(); if (!r.ok) throw new Error(r.problem); return r.data; }, enabled: signedIn, retry: 1, staleTime: 15_000 });
  const accountQ = useQuery({ queryKey: ["account"], queryFn: () => api<Account>("/api/account"), enabled: signedIn, retry: 1, staleTime: 30_000 });
  const auditQ = useQuery({ queryKey: ["audit-mine"], queryFn: () => api<{ events: AuditEvent[] }>("/api/security/audit-log"), enabled: signedIn, retry: 0, staleTime: 60_000 });
  const [lastOut, setLastOut] = useState("");
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  if (status === "out") return <Redirect href="/" />;

  const soon = (title: string) => router.push(comingSoonHref(title));
  const dev = devicesQ.data;
  const acct = accountQ.data;
  const twoStep = !!dev?.twoStep;
  const loading = devicesQ.isPending && !dev;
  const failed = devicesQ.isError && !dev;
  const canEdit = isOwner || role === "admin";
  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("Settings", t("title"))));
  const word = t("del.word");
  const days = acct?.graceDays ?? 30;

  const nameOf = (d: Device) => {
    const p = agentParts(d.agent);
    if (!p) return t("devices.unknown");
    return p.browser && p.system ? t("devices.on", { browser: p.browser, system: p.system }) : p.browser || p.system;
  };
  const agoOf = (iso: string) => {
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return "";
    const mins = Math.max(0, Math.round((Date.now() - at.getTime()) / 60_000));
    if (mins < 1) return t("devices.when.now");
    if (mins < 60) return t("devices.when.min", { count: mins });
    if (mins < 24 * 60) return t("devices.when.hour", { count: Math.round(mins / 60) });
    return dateWithYear(at, new Date(), locale);
  };

  const signOutOne = async (d: Device) => {
    const r = await auth.revokeDevice(d.token);
    if (!r.ok) { toast({ message: r.problem === "offline" ? t("toast.offline") : t("toast.failed") }); return; }
    setLastOut(nameOf(d));
    void client.invalidateQueries({ queryKey: ["auth-devices"] });
  };
  const signOutAll = async () => {
    const r = await auth.revokeOthers();
    if (!r.ok) { toast({ message: r.problem === "offline" ? t("toast.offline") : t("toast.failed") }); return; }
    setLastOut(t("devices.everyone"));
    void client.invalidateQueries({ queryKey: ["auth-devices"] });
  };

  const latest = acct?.exports[0];
  const onExport = async () => {
    setExporting(true);
    try {
      await api("/api/account/export", { method: "POST", body: { language: i18n.language === "fr" ? "fr" : "en" } });
      toast({ message: t("toast.exportSent") });
      await client.invalidateQueries({ queryKey: ["account"] });
    } catch (e) {
      toast({ message: e instanceof ApiFailure ? (e.status === 429 ? t("data.limited") : e.status === 403 ? t("data.ownerOnly") : e.status === 0 ? t("toast.offline") : t("toast.failed")) : t("toast.failed") });
    }
    setExporting(false);
  };

  const onDelete = async () => {
    if (!deleteReady(typed, password, twoStep, code, word)) return;
    setBusy(true);
    try {
      const r = await api<{ scheduledFor: string }>("/api/account", { method: "DELETE", body: { password, code: twoStep ? code : undefined, language: i18n.language === "fr" ? "fr" : "en" } });
      toast({ message: t("del.scheduled", { date: shortDate(new Date(r.scheduledFor), locale) }) });
      await signOut();
      router.replace("/");
    } catch (e) {
      const bad = e instanceof ApiFailure ? e : null;
      toast({ message: bad?.code === "INVALID_PASSWORD" ? t("del.badPassword") : bad?.code === "INVALID_TWO_FACTOR" || bad?.code === "TWO_FACTOR_REQUIRED" ? t("del.badCode") : bad?.status === 0 ? t("toast.offline") : t("toast.failed") });
    }
    setBusy(false);
  };

  const activity = user ? activityOf(auditQ.data?.events ?? [], user.id) : [];
  const others = dev ? othersFirst(dev.items) : [];
  const here = dev?.items.find((d) => d.here);
  const closesOn = acct?.pendingDeletion ? shortDate(new Date(acct.pendingDeletion.scheduledFor), locale) : "";
  const exportSize = latest?.sizeBytes ? `${num(Math.max(1, Math.round(latest.sizeBytes / 1_048_576)), locale)} ${i18n.language === "fr" ? "Mo" : "MB"}` : "";

  return (
    <Screen>
      <Header title="" backLabel={t("back")} onBack={back} />
      <ScrollPage bottom={56}>
        <SetTitle title={t("title")} lede={t("lede", { name: user?.name ?? "", email: user?.email ?? "" })} />
        {!canEdit && !loading ? <InlineBanner><Banner tone="info" icon="lock" iconTone="slate" lead={t("readOnly.lead")}>{t("readOnly.body")}</Banner></InlineBanner> : null}
        {closesOn ? <InlineBanner><Banner tone="bad" icon="warn" iconTone="rose" lead={t("closing.lead", { date: closesOn })}>{t("closing.body")}</Banner></InlineBanner> : null}
        {dev && !twoStep ? <InlineBanner><Banner tone="warn" icon="shield" iconTone="amber" lead={t("twoOff.lead")} link={t("twoOff.link")} onLink={() => router.push(screenHref("SetTwoStep", t("sign.setup.label")))}>{t("twoOff.body")}</Banner></InlineBanner> : null}

        {loading ? (
          <Section pt={16} px={16} gap={14}><Skeleton height={200} radius={22} /><Skeleton height={160} radius={22} /></Section>
        ) : failed ? (
          <Empty icon="warn" iconTone="clay" title={t("loadFailed.title")} body={t("loadFailed.body")} action={t("loadFailed.retry")} onAction={() => void devicesQ.refetch()} />
        ) : (
          <>
            <Section delay={60}>
              <SetGroup title={t("sign.title")}>
                <SetRow first icon="key" tone="violet" label={t("sign.password.label")} sub={t("sign.password.sub")} control={<SetValue value={t("sign.password.value")} chevron />} onPress={() => router.push({ pathname: "/forgot-password", params: { email: user?.email ?? "" } })} />
                <SetRow icon="face" tone="slate" label={t("sign.face.label")} sub={t("sign.face.sub")} control={<Switch value={false} onChange={() => toast({ message: t("sign.face.soon") })} label={t("sign.face.label")} />} />
                <SetRow icon="shield" tone="indigo" label={t("sign.two.label")} sub={twoStep ? t("sign.two.on") : t("sign.two.off")} control={<RowStatus tone={twoStep ? "ok" : "warn"} shape={twoStep ? "check" : "alert"}>{twoStep ? t("sign.two.onWord") : t("sign.two.offWord")}</RowStatus>} />
                {twoStep
                  ? <SetRow icon="list" tone="stone" label={t("sign.backup.label")} sub={t("sign.backup.sub")} control={<SetValue value="" chevron />} onPress={() => router.push(screenHref("SetTwoStep", t("sign.backup.label")))} />
                  : <SetRow icon="shield" tone="amber" label={t("sign.setup.label")} sub={t("sign.setup.sub")} control={<SetValue value="" chevron />} onPress={() => router.push(screenHref("SetTwoStep", t("sign.setup.label")))} />}
              </SetGroup>
            </Section>

            <Section delay={120}>
              <SetGroup title={t("devices.title")} foot={lastOut ? t("devices.footOut", { what: lastOut }) : t("devices.foot")}>
                <SetRow first icon="phone" tone="violet" label={t("devices.here")} sub={here && agentParts(here.agent) ? nameOf(here) : t("devices.hereSub")} control={<RowStatus tone="ok" shape="live">{t("devices.active")}</RowStatus>} />
                {others.map((d) => <SetRow key={d.token} icon="globe" tone="azure" label={nameOf(d)} sub={agoOf(d.at)} control={<SetButton label={t("devices.signOut")} onPress={() => void signOutOne(d)} />} />)}
              </SetGroup>
              <Stack px={16} pt={10}><Button kind="secondary" size="md" block disabled={others.length === 0} label={others.length === 0 ? t("devices.only") : t("devices.all")} onPress={() => void signOutAll()} /></Stack>
            </Section>

            {activity.length ? (
              <Section delay={180}>
                <SetGroup title={t("activity.title")}>
                  {activity.map((a, i) => {
                    const p = agentParts(a.agent);
                    return <SetRow key={a.id} first={i === 0} icon={a.kind === "login" ? "globe" : a.kind === "twoOn" || a.kind === "twoOff" ? "shield" : "key"} tone={a.kind === "login" ? "azure" : "indigo"} label={t(`activity.${a.kind}`)} sub={p ? [p.browser, p.system].filter(Boolean).join(" · ") : t("activity.here")} control={<SetValue value={shortDate(new Date(a.at), locale)} mono />} />;
                  })}
                </SetGroup>
              </Section>
            ) : null}

            <Section delay={240}>
              <SetGroup title={t("data.title")} foot={t("data.foot")}>
                {latest?.downloadUrl
                  ? <SetRow first icon="export" tone="sage" label={t("data.ready")} sub={t("data.readySub", { size: exportSize, date: latest.expiresAt ? shortDate(new Date(latest.expiresAt), locale) : "" })} control={<SetButton kind="primary" label={t("data.download")} onPress={() => void Linking.openURL(latest.downloadUrl!)} />} />
                  : exporting
                    ? <SetRow first icon="export" tone="stone" label={t("data.label")} sub={t("data.prep")} control={<RowStatus tone="info" shape="q1">{t("data.prepWord")}</RowStatus>} />
                    : <SetRow first icon="export" tone="stone" label={t("data.label")} sub={latest?.status === "failed" ? t("data.failed") : t("data.sub")} control={<SetButton label={t("data.button")} onPress={() => void onExport()} disabled={!acct?.canExport} />} />}
              </SetGroup>
            </Section>

            {isOwner ? (
              <Section delay={300}>
                <SetGroup title={t("del.title")}>
                  <DeleteIntro body={t("del.body", { company: acct?.companyName ?? "" })} steps={tr("sy.del.grace", { returnObjects: true, days, date: closesOn || shortDate(new Date(Date.now() + days * 86_400_000), locale) }) as unknown as { t: string; s: string }[]}
                    openLabel={open ? undefined : t("del.open")} onOpen={() => setOpen(true)} />
                  {open ? (
                    <DeleteForm hint={twoStep ? t("del.codeHint") : undefined} keep={t("del.keep")} go={t("del.go", { days })} canGo={deleteReady(typed, password, twoStep, code, word) && !busy}
                      onKeep={() => { setOpen(false); setTyped(""); setPassword(""); setCode(""); }} onGo={() => void onDelete()}>
                      <SetField first icon="key" tone="violet" label={t("del.password")} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" autoCapitalize="none" />
                      <SetField icon="warn" tone="clay" label={t("del.type", { word })} value={typed} onChangeText={setTyped} placeholder={word} autoCapitalize="characters" autoCorrect={false} mono />
                      {twoStep ? <SetField icon="shield" tone="indigo" label={t("del.code")} value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" mono /> : null}
                    </DeleteForm>
                  ) : null}
                </SetGroup>
              </Section>
            ) : null}
          </>
        )}
      </ScrollPage>
    </Screen>
  );
}
