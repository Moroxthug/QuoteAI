// SetMessaging.dc.html. Texts to clients, leads and crew: the business number and how much of the month's texts and WhatsApp messages are used, the text switches and a test to
// your own phone, WhatsApp (connect with a code, disconnect), its templates, quiet hours, opt-outs and the last messages. States: default, WhatsApp not connected, texts used up,
// view only, loading and can't load.
// Read by the server: texting on or off, the usage, the test, the log, the opt-outs, and WhatsApp's connection. Saved but not read yet: "Lead follow-ups", "Crew reminders",
// "Use it when clients prefer it" and the quiet hours (the times are the board's 9 pm to 8 am and can't be changed there either). The WhatsApp templates have no approval state
// on the server (one shared business number sends them), so their rows carry no status word and open Message templates.
import { useState } from "react";
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiFailure } from "@/lib/api";
import { clientsApi } from "@/lib/clientsApi";
import { number as num, shortDate, time, type Locale } from "@/lib/format";
import { dayFromKey } from "@/lib/assistant";
import { logState, nameByPhone, phoneKey, purposeKey, snippet, waNumber } from "@/lib/messaging";
import { messagingApi } from "@/lib/messagingApi";
import { meterOf } from "@/lib/plan";
import { extraPage } from "@/lib/profile";
import { screenHref } from "@/lib/nav";
import { useProfile } from "@/lib/useProfile";
import { useRole } from "@/lib/useRole";
import { useSession } from "@/lib/useSession";
import { Button } from "@/ui/Button";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { Header } from "@/ui/Header";
import { ScrollPage, Section, Stack } from "@/ui/Layout";
import { NumberCard } from "@/ui/Messaging";
import { PlanMeter } from "@/ui/Plan";
import { Screen } from "@/ui/Screen";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { SetButton, SetField, SetGroup, SetRow, SetValue, SheetNote } from "@/ui/Settings";
import { InlineBanner, RowStatus, SetTitle } from "@/ui/SettingsPages";
import { Switch } from "@/ui/Switch";

type Step = "closed" | "number" | "code";

export default function SetMessaging() {
  const { t: tr, i18n } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`sm.${k}`, o) as string;
  const lang: "en" | "fr" = i18n.language === "fr" ? "fr" : "en";
  const locale: Locale = lang === "fr" ? "fr-CA" : "en-CA";
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const toast = useToast();
  const client = useQueryClient();
  const { isOwner, role } = useRole();
  const canEdit = isOwner || role === "admin";
  const { profile, save } = useProfile();
  const smsQ = useQuery({ queryKey: ["sms-status"], queryFn: messagingApi.sms, enabled: signedIn, retry: 1, staleTime: 15_000 });
  const waQ = useQuery({ queryKey: ["wa-status"], queryFn: messagingApi.wa, enabled: signedIn, retry: 0, staleTime: 15_000 });
  const usageQ = useQuery({ queryKey: ["usage-summary"], queryFn: messagingApi.usage, enabled: signedIn, retry: 0, staleTime: 30_000 });
  const logQ = useQuery({ queryKey: ["sms-log"], queryFn: () => messagingApi.log(5), enabled: signedIn, retry: 0, staleTime: 15_000 });
  const outQ = useQuery({ queryKey: ["sms-optouts"], queryFn: messagingApi.optOuts, enabled: signedIn, retry: 0, staleTime: 30_000 });
  const clientsQ = useQuery({ queryKey: ["clients-overview"], queryFn: clientsApi.overview, enabled: signedIn, retry: 0, staleTime: 60_000 });
  const [tested, setTested] = useState(false);
  const [step, setStep] = useState<Step>("closed");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [optOpen, setOptOpen] = useState(false);

  if (status === "out") return <Redirect href="/" />;

  const sms = smsQ.data;
  const wa = waQ.data;
  const page = extraPage(profile, "messaging");
  const flag = (k: string, d: boolean) => (typeof page[k] === "boolean" ? (page[k] as boolean) : d);
  const names = nameByPhone(clientsQ.data?.items ?? []);
  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("Settings", t("title"))));
  const nextMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
  const resets = shortDate(nextMonth, locale);
  const usedUp = !!sms && sms.usage.allowance !== null && sms.usage.used >= sms.usage.allowance;
  const n = (v: number) => num(v, locale);

  const fail = (e: unknown, fallback = "toast.failed") => toast({ message: e instanceof ApiFailure ? (e.status === 0 ? t("toast.offline") : e.status === 403 ? t("toast.noAccess") : t(fallback)) : t(fallback) });
  const savePage = async (p: Record<string, unknown>) => {
    const r = await save({ pocketSettings: { messaging: p } });
    if (!r.ok) toast({ message: r.status === 403 ? t("toast.noAccess") : r.status === 0 ? t("toast.offline") : t("toast.failed") });
  };
  const setSms = async (on: boolean) => {
    try { await messagingApi.saveSms({ smsEnabled: on }); await client.invalidateQueries({ queryKey: ["sms-status"] }); } catch (e) { fail(e); }
  };
  const onTest = async () => {
    try { await messagingApi.test(lang); setTested(true); toast({ message: t("toast.testSent", { phone: sms?.ownPhone ?? "" }) }); void client.invalidateQueries({ queryKey: ["sms-log"] }); }
    catch (e) {
      const bad = e instanceof ApiFailure ? e : null;
      toast({ message: bad?.status === 0 ? t("toast.offline") : bad?.status === 400 ? t("toast.testNoPhone") : bad?.status === 503 ? t("toast.testOff") : bad?.status === 402 ? t("toast.testUsedUp") : t("toast.testFailed") });
    }
  };

  const sendCode = async () => {
    const number = waNumber(phone);
    if (!number) { toast({ message: t("wa.badNumber") }); return; }
    setBusy(true);
    try { await messagingApi.waConnect(number); setPhone(number); setCode(""); setStep("code"); }
    catch (e) {
      const bad = e instanceof ApiFailure ? e : null;
      toast({ message: bad?.status === 503 ? t("wa.unavailable") : bad?.status === 409 ? t("wa.taken") : bad?.status === 403 ? t("wa.planOnly") : bad?.status === 400 ? t("wa.badNumber") : bad?.status === 0 ? t("toast.offline") : t("toast.failed") });
    }
    setBusy(false);
  };
  const verify = async () => {
    setBusy(true);
    try { await messagingApi.waVerify(phone, code.trim()); setStep("closed"); toast({ message: t("wa.connected") }); await client.invalidateQueries({ queryKey: ["wa-status"] }); }
    catch (e) {
      const bad = e instanceof ApiFailure ? e : null;
      toast({ message: bad?.status === 0 ? t("toast.offline") : /expired/i.test(bad?.message ?? "") ? t("wa.expired") : bad?.status === 400 ? t("wa.badCode") : t("toast.failed") });
    }
    setBusy(false);
  };
  const disconnect = async () => {
    try { await messagingApi.waDisconnect(); toast({ message: t("wa.disconnected") }); await client.invalidateQueries({ queryKey: ["wa-status"] }); } catch (e) { fail(e); }
  };

  const loading = smsQ.isPending && !sms;
  const failed = smsQ.isError && !sms;
  const waOn = !!wa?.connected;
  const texts = sms && sms.usage.allowance !== null ? { ...meterOf({ used: sms.usage.used, limit: sms.usage.allowance }), used: sms.usage.used, limit: sms.usage.allowance } : null;
  const waUse = usageQ.data?.whatsappMessages;
  const waMeter = waOn && waUse && waUse.allowance ? { ...meterOf({ used: waUse.used, limit: waUse.allowance }), used: waUse.used, limit: waUse.allowance } : null;
  const meters = [
    ...(texts ? [<PlanMeter key="t" label={t("meters.texts")} used={n(texts.used)} total={n(texts.limit)} of={t("of")} value={texts.value} level={texts.level} sub={texts.level === "full" ? t("meters.usedUp", { date: resets }) : t("meters.resets", { date: resets })} />] : []),
    ...(waMeter ? [<PlanMeter key="w" label={t("meters.wa")} used={n(waMeter.used)} total={n(waMeter.limit)} of={t("of")} value={waMeter.value} level={waMeter.level} sub={waMeter.level === "full" ? t("meters.usedUp", { date: resets }) : t("meters.resets", { date: resets })} />] : []),
  ];
  const state = !sms ? null : !sms.available || !sms.smsEnabled ? <RowStatus tone="mute" shape="off">{t("number.off")}</RowStatus> : usedUp ? <RowStatus tone="warn" shape="pause">{t("number.paused")}</RowStatus> : <RowStatus tone="ok" shape="live">{t("number.active")}</RowStatus>;
  const day = (h: number) => time(new Date(2026, 0, 1, h, 0), locale);
  const logRows = logQ.data?.items ?? [];
  const optOuts = outQ.data?.items ?? [];
  const nameOf = (p: string) => names.get(phoneKey(p)) ?? p;

  return (
    <Screen>
      <Header title="" backLabel={t("back")} onBack={back} />
      <ScrollPage bottom={56}>
        <SetTitle title={t("title")} lede={t("lede")} />
        {!canEdit && sms ? <InlineBanner><Banner tone="info" icon="lock" iconTone="slate" lead={t("readOnly.lead")}>{t("readOnly.body")}</Banner></InlineBanner> : null}
        {usedUp ? <InlineBanner><Banner tone="bad" icon="warn" iconTone="rose" lead={t("usedUp.lead", { date: resets })}>{t("usedUp.body")}</Banner></InlineBanner> : null}
        {sms && !sms.available ? <InlineBanner><Banner tone="info" icon="chat" iconTone="sky" lead={t("unavailable.lead")}>{t("unavailable.body")}</Banner></InlineBanner> : null}

        {loading ? (
          <Section pt={18} px={16} gap={14}><Skeleton height={190} radius={22} /><Skeleton height={200} radius={22} /></Section>
        ) : failed || !sms ? (
          <Empty icon="warn" iconTone="clay" title={t("loadFailed.title")} body={t("loadFailed.body")} action={t("loadFailed.retry")} onAction={() => void smsQ.refetch()} />
        ) : (
          <>
            <Section delay={40} pt={18} px={16}>
              <NumberCard label={t("number.label")} number={sms.fromNumberHint ?? t("number.none")} sub={profile?.companyName || sms.identityLine} state={state}>{meters}</NumberCard>
            </Section>

            <Section delay={80}>
              <SetGroup title={t("texts.title")}>
                <SetRow first icon="chat" tone="sky" label={t("texts.sms.label")} sub={usedUp ? t("texts.sms.paused", { date: resets }) : t("texts.sms.sub")}
                  control={<Switch value={sms.smsEnabled && !usedUp} onChange={(v) => void setSms(v)} label={t("texts.sms.label")} disabled={!canEdit} />} />
                <SetRow icon="funnel" tone="teal" label={t("texts.leadFu.label")} sub={t("texts.leadFu.sub")} control={<Switch value={flag("leadFu", true)} onChange={(v) => void savePage({ leadFu: v })} label={t("texts.leadFu.label")} disabled={!canEdit} />} />
                <SetRow icon="users" tone="amber" label={t("texts.crew.label")} sub={t("texts.crew.sub")} control={<Switch value={flag("crewRem", true)} onChange={(v) => void savePage({ crewRem: v })} label={t("texts.crew.label")} disabled={!canEdit} />} />
                <SetRow icon="send" tone="indigo" label={t("texts.test.label")} sub={sms.ownPhone ? t("texts.test.sub", { phone: sms.ownPhone }) : t("texts.test.noPhone")}
                  control={<SetButton label={tested ? t("texts.test.sent") : t("texts.test.button")} onPress={() => void onTest()} disabled={!canEdit || !sms.ownPhone || !sms.available} />} />
              </SetGroup>
            </Section>

            <Section delay={130}>
              <SetGroup title={t("wa.title")} foot={waOn ? undefined : t("wa.foot")}>
                {waOn ? (
                  <>
                    <SetRow first icon="chat" tone="sage" label={t("wa.label")} sub={t("wa.subOn", { phone: wa?.phoneNumber ?? "" })} control={<RowStatus tone="ok" shape="check">{t("wa.on")}</RowStatus>} />
                    <SetRow icon="send" tone="teal" label={t("wa.pref.label")} sub={t("wa.pref.sub")} control={<Switch value={flag("waPref", true)} onChange={(v) => void savePage({ waPref: v })} label={t("wa.pref.label")} disabled={!canEdit} />} />
                    <SetRow icon="link" tone="slate" label={t("wa.disconnect.label")} sub={t("wa.disconnect.sub")} control={<SetButton label={t("wa.disconnect.button")} onPress={() => void disconnect()} disabled={!canEdit} />} />
                  </>
                ) : (
                  <>
                    <SetRow first icon="chat" tone="sage" label={t("wa.label")} sub={t("wa.subOff")} control={<RowStatus tone="mute" shape="off">{t("wa.off")}</RowStatus>} />
                    <SetRow icon="phone" tone="violet" label={t("wa.connect.label")} sub={t("wa.connect.sub")} control={<SetButton kind="primary" label={t("wa.connect.button")} onPress={() => { setStep("number"); setPhone(""); setCode(""); }} disabled={!canEdit} />} />
                  </>
                )}
              </SetGroup>
            </Section>

            {waOn ? (
              <Section delay={170}>
                <SetGroup title={t("templates.title")} foot={t("templates.foot")}>
                  {(["quote:doc:violet", "invoice:receipt:amber", "way:truck:teal", "review:star:gold", "lead:funnel:rose"] as const).map((spec, i) => {
                    const [k, icon, tone] = spec.split(":") as [string, "doc", "violet"];
                    const row = tr(`sm.templates.${k}`, { returnObjects: true }) as unknown as string[];
                    return <SetRow key={k} first={i === 0} icon={icon} tone={tone} label={row[0]!} sub={row[1]} control={<SetValue value="" chevron />} onPress={() => router.push(screenHref("MessageTemplates", t("templates.title")))} />;
                  })}
                </SetGroup>
              </Section>
            ) : null}

            <Section delay={210}>
              <SetGroup title={t("quiet.title")}>
                <SetRow first icon="moon" tone="indigo" label={t("quiet.label")} sub={t("quiet.sub")} control={<Switch value={flag("quiet", true)} onChange={(v) => void savePage({ quiet: v })} label={t("quiet.label")} disabled={!canEdit} />} />
                <SetRow icon="clock" tone="slate" label={t("quiet.from")} sub={t("quiet.fromSub")} control={<SetValue value={day(21)} mono />} />
                <SetRow icon="sun" tone="amber" label={t("quiet.until")} sub={t("quiet.untilSub")} control={<SetValue value={day(8)} mono />} />
              </SetGroup>
            </Section>

            <Section delay={250}>
              <SetGroup title={t("optOut.title")} foot={t("optOut.foot")}>
                <SetRow first icon="shield" tone="sage" label={t("optOut.stop")} sub={t("optOut.stopSub")} control={<SetValue value={t("optOut.always")} />} />
                <SetRow icon="users" tone="stone" label={t("optOut.list")} sub={t("optOut.listSub")} control={<SetValue value={t("optOut.count", { count: optOuts.length })} chevron />} onPress={() => setOptOpen(true)} />
              </SetGroup>
            </Section>

            <Section delay={290}>
              <SetGroup title={t("log.title")}>
                {logRows.length === 0 ? <SetRow first icon="chat" tone="slate" label={t("log.none")} /> : logRows.map((m, i) => {
                  const s = logState(m);
                  const at = time(new Date(m.createdAt), locale);
                  const sub = m.direction === "inbound" ? `“${snippet(m.body)}” · ${at}` : `${t(`log.purpose.${purposeKey(m.purpose)}`)} · ${at}`;
                  return <SetRow key={m.id} first={i === 0} icon="user" tone={i % 3 === 0 ? "violet" : i % 3 === 1 ? "teal" : "amber"} label={nameOf(m.phone)} sub={sub} control={<RowStatus tone={s.tone} shape={s.shape}>{t(`log.states.${s.word}`)}</RowStatus>} />;
                })}
              </SetGroup>
            </Section>
          </>
        )}
      </ScrollPage>

      <Sheet open={step !== "closed"} onClose={() => setStep("closed")} label={t("wa.sheet.title")} closeLabel={t("close")}>
        <Stack px={16} pb={30} gap={12}>
          <SheetTitle>{t("wa.sheet.title")}</SheetTitle>
          {step === "number" ? (
            <>
              <SheetNote>{t("wa.sheet.numberSub")}</SheetNote>
              <SetField first icon="phone" tone="violet" label={t("wa.sheet.number")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" mono />
              <Button size="lg" block label={t("wa.sheet.send")} disabled={busy || !waNumber(phone)} onPress={() => void sendCode()} />
            </>
          ) : (
            <>
              <SheetNote>{t("wa.sheet.codeSub", { phone })}</SheetNote>
              <SetField first icon="shield" tone="indigo" label={t("wa.sheet.code")} value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" mono />
              <Button size="lg" block label={t("wa.sheet.verify")} disabled={busy || code.trim().length < 6} onPress={() => void verify()} />
              <Button kind="secondary" size="md" block label={t("wa.sheet.back")} onPress={() => setStep("number")} />
            </>
          )}
        </Stack>
      </Sheet>

      <Sheet open={optOpen} onClose={() => setOptOpen(false)} label={t("optOut.sheet")} closeLabel={t("close")}>
        <Stack px={16} pb={30} gap={12}>
          <SheetTitle>{t("optOut.sheet")}</SheetTitle>
          <SheetNote>{optOuts.length ? t("optOut.sheetSub") : t("optOut.none")}</SheetNote>
          {optOuts.length ? (
            <SetGroup>
              {optOuts.map((o, i) => <SetRow key={o.e164} first={i === 0} icon="user" tone="stone" label={nameOf(o.phone)} sub={`${o.source === "manual" ? t("optOut.manual") : t("optOut.stopWord")} · ${shortDate(new Date(o.at), locale)}`} />)}
            </SetGroup>
          ) : null}
        </Stack>
      </Sheet>
    </Screen>
  );
}
