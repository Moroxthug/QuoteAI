// FirstQuote.dc.html: the guided first quote. Steps: describe (the job, by text; the mic is a stub
// until the recording module is installed), check (the priced quote), send (to yourself or a
// client), done. The stage is remembered per person on the phone, so reopening resumes it.
// Onboarding's last step starts it; the gate does not route here by itself.
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useListClients } from "@workspace/api-client-react";
import { kvGet, kvSet } from "@/lib/kv";
import { money, number, percent, type Locale } from "@/lib/format";
import {
  backStep, elapsedSince, openedKey, parseSent, parseStage, pricedLines, pricedTaxes, qtyDigits, quoteKey, quoteTitle,
  resumeStep, sentKey, stageForStep, stageKey, stepStates, type FirstQuoteStep, type Sent,
} from "@/lib/firstQuote";
import { firstQuoteApi, type FirstQuoteProblem, type FullQuote, type PriceCheck, type Profile } from "@/lib/firstQuoteApi";
import { askForNotifications } from "@/lib/firstQuoteNotify";
import { captureJob } from "@/lib/firstQuoteVoice";
import { useSession } from "@/lib/useSession";
import { TextLink } from "@/ui/Auth";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Banner, useToast, type BannerTone } from "@/ui/Feedback";
import { FqBottomBar, FqChoice, FqElapsed, FqHeader, FqInfoRow, FqJobBox, FqLine, FqOrb, FqQuoteCard, FqQuoteHead, FqRule, FqSteps, FqTotal, FqTry } from "@/ui/FirstQuote";
import { PageTitle } from "@/ui/Header";
import type { IconName, Tone } from "@/ui/Icon";
import { Section, Stack } from "@/ui/Layout";
import { ListRow, RowList, SectionHeader } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Sheet } from "@/ui/Sheet";
import { Status } from "@/ui/Status";
import { Num, Text } from "@/ui/Text";

type Notice = FirstQuoteProblem | "loadFailed";
const BANNER: Record<Notice, { tone: BannerTone; icon: IconName; iconTone: Tone }> = {
  offline: { tone: "warn", icon: "cloud", iconTone: "amber" },
  quota: { tone: "warn", icon: "warn", iconTone: "amber" },
  cannot: { tone: "info", icon: "doc", iconTone: "sky" },
  unlock: { tone: "info", icon: "lock", iconTone: "sky" },
  failed: { tone: "warn", icon: "warn", iconTone: "amber" },
  loadFailed: { tone: "warn", icon: "warn", iconTone: "amber" },
};

type Dest = "me" | "client";
type Client = { name: string; email: string };

export default function FirstQuote() {
  const { t, i18n } = useTranslation();
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const toast = useToast();
  const { user } = useSession();
  const userId = user?.id ?? null;
  const email = user?.email ?? "";

  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<FirstQuoteStep>("describe");
  const [text, setText] = useState("");
  const [quote, setQuote] = useState<FullQuote | null>(null);
  const [check, setCheck] = useState<PriceCheck | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dest, setDest] = useState<Dest>("me");
  const [client, setClient] = useState<Client | null>(null);
  const [picker, setPicker] = useState(false);
  const [writing, setWriting] = useState(false);
  const [listening, setListening] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<Sent | null>(null);
  const [notif, setNotif] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const openedAt = useRef<number | null>(null);

  const remember = useCallback((next: FirstQuoteStep) => {
    if (userId) void kvSet(stageKey(userId), stageForStep(next));
  }, [userId]);
  const go = useCallback((next: FirstQuoteStep) => {
    setStep(next);
    setNotice(null);
    remember(next);
  }, [remember]);

  // Resume: the stage, the quote the guide wrote and (when it went out) what the done step shows.
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    void (async () => {
      const [stageRaw, quoteId, sentRaw, openedRaw] = await Promise.all([kvGet(stageKey(userId)), kvGet(quoteKey(userId)), kvGet(sentKey(userId)), kvGet(openedKey(userId))]);
      if (!alive) return;
      const opened = Number(openedRaw);
      if (Number.isFinite(opened) && opened > 0) openedAt.current = opened;
      else { openedAt.current = Date.now(); void kvSet(openedKey(userId), String(openedAt.current)); }
      void firstQuoteApi.profile().then((r) => { if (alive && r.ok) setProfile(r.data); });
      const savedSent = parseSent(sentRaw);
      const first = resumeStep(parseStage(stageRaw), !!quoteId, savedSent);
      if (first === "done") { setSent(savedSent); setStep("done"); setReady(true); return; }
      if (first === "check" && quoteId) {
        const q = await firstQuoteApi.quote(quoteId);
        if (!alive) return;
        if (q.ok) {
          setQuote(q.data);
          setStep("check");
          void firstQuoteApi.priceCheck(quoteId).then((c) => { if (alive && c.ok) setCheck(c.data); });
        } else {
          setNotice("loadFailed");
        }
      }
      setReady(true);
    })();
    return () => { alive = false; };
  }, [userId]);

  async function write() {
    if (writing || !text.trim()) return;
    setWriting(true);
    setNotice(null);
    const r = await firstQuoteApi.create(text.trim(), profile);
    setWriting(false);
    if (!r.ok) { setNotice(r.problem); return; }
    setQuote(r.data);
    setCheck(null);
    if (userId) void kvSet(quoteKey(userId), r.data.id);
    go("check");
    void firstQuoteApi.priceCheck(r.data.id).then((c) => { if (c.ok) setCheck(c.data); });
  }

  async function mic() {
    if (listening) return;
    setListening(true);
    const r = await captureJob();
    setListening(false);
    if (r.ok) setText((cur) => (cur.trim() ? `${cur.trim()} ${r.text}` : r.text));
    else toast({ message: t("firstQuote.describe.micOff") });
  }

  const recipient = dest === "me" ? { email, name: undefined as string | undefined } : client ? { email: client.email, name: client.name } : null;

  async function send() {
    if (sending || !quote) return;
    if (!recipient) { setPicker(true); return; }
    setSending(true);
    setNotice(null);
    const r = await firstQuoteApi.send(quote.id, recipient.email, recipient.name);
    if (!r.ok) { setSending(false); setNotice(r.problem); return; }
    const created = await firstQuoteApi.accountCreatedAt();
    const done: Sent = { email: recipient.email, elapsed: elapsedSince(created, openedAt.current, Date.now()) };
    if (userId) await kvSet(sentKey(userId), JSON.stringify(done));
    setSent(done);
    setSending(false);
    go("done");
  }

  async function turnOn() {
    const r = await askForNotifications();
    if (r.ok) setNotif(true);
    else toast({ message: t("firstQuote.done.notifyOff") });
  }

  const skip = () => {
    if (userId) void kvSet(stageKey(userId), "done");
    router.replace("/home");
  };
  const changeLine = () => router.push({ pathname: "/coming-soon", params: { title: t("firstQuote.quoteEditor") } });
  const back = backStep(step);

  if (!ready) return <Screen><FqHeader backLabel={t("firstQuote.back")} /></Screen>;

  const states = stepStates(step);
  const steps = (t("firstQuote.steps", { returnObjects: true }) as { name: string; sub: string }[]).map((s, i) => ({
    ...s, n: i + 1, state: states[i]!, sr: t(`firstQuote.stepSr.${states[i]!}`),
  }));
  const province = profile?.province && `firstQuote.provinces.${profile.province}`;
  const provinceName = province && i18n.exists(province) ? t(province) : null;
  const heading = step === "describe"
    ? { title: t("firstQuote.describe.title"), sub: t("firstQuote.describe.sub") }
    : step === "check"
      ? { title: t("firstQuote.check.title"), sub: provinceName ? t("firstQuote.check.sub", { province: provinceName }) : t("firstQuote.check.subNoProvince") }
      : { title: t("firstQuote.send.title"), sub: t("firstQuote.send.sub") };

  const banner = notice ? BANNER[notice] : null;
  const bannerRow = notice && banner ? (
    <Section px={16} pt={14}>
      <Banner tone={banner.tone} icon={banner.icon} iconTone={banner.iconTone} lead={t(`firstQuote.banner.${notice}.lead`)}>
        {t(`firstQuote.banner.${notice}.text`)}
      </Banner>
    </Section>
  ) : null;

  const sendLabel = dest === "me" ? t("firstQuote.send.sendToMe") : client ? t("firstQuote.send.sendToClient", { name: client.name }) : t("firstQuote.send.chooseClient");

  return (
    <Screen>
      <FqHeader onBack={back ? () => go(back) : undefined} backLabel={t("firstQuote.back")} skip={step === "done" ? undefined : t("firstQuote.skip")} onSkip={skip} />
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        {step !== "done" ? (
          <>
            <Section px={20} pt={12} gap={8}>
              <PageTitle>{heading.title}</PageTitle>
              <Text color="muted" leading={1.45}>{heading.sub}</Text>
            </Section>
            <Section delay={50} px={16} pt={18}>
              <FqSteps steps={steps} label={t("firstQuote.stepsLabel")} />
            </Section>
            {bannerRow}
          </>
        ) : null}

        {step === "describe" ? (
          <Section delay={90} px={16} pt={22} gap={12}>
            <FqJobBox value={text} onChange={(v) => { setText(v); setNotice(null); }} label={t("firstQuote.describe.label")} placeholder={t("firstQuote.describe.placeholder")}
              hint={listening ? t("firstQuote.describe.hintListening") : text ? t("firstQuote.describe.characters", { count: text.length }) : t("firstQuote.describe.hintIdle")}
              micLabel={t("firstQuote.describe.mic")} onMic={() => void mic()} listening={listening} />
            {!text ? <FqTry label={t("firstQuote.describe.try")} onPress={() => setText(t("firstQuote.describe.trySample"))} /> : null}
          </Section>
        ) : null}

        {step === "check" && quote ? (
          <Section delay={90} px={16} pt={22}>
            <FqQuoteCard>
                <FqQuoteHead title={quoteTitle(quote)} sub={quote.numeroPreventivoData ?? undefined} status={<Status tone="mute" shape="draft">{t("firstQuote.check.draft")}</Status>} />
              <Stack pt={8}>
                {pricedLines(quote).map((l, i) => (
                  <FqLine key={i} first={i === 0} name={l.name} amount={money(l.total, locale)}
                    sub={l.unit || l.qty !== 1 ? t("firstQuote.check.lineSub", { qty: number(l.qty, locale, qtyDigits(l.qty)), unit: l.unit, price: money(l.unitPrice, locale) }).trim() : undefined} />
                ))}
              </Stack>
              <FqRule />
              <FqTotal label={t("firstQuote.check.subtotal")} value={money(quote.subtotale ?? 0, locale)} />
              {quote.sconto && quote.sconto.importoScontato > 0 ? (
                <FqTotal label={t("firstQuote.check.discount", { rate: percent(quote.sconto.percentuale / 100, locale, rateDigits(quote.sconto.percentuale)) })} value={`-${money(quote.sconto.importoScontato, locale)}`} />
              ) : null}
              {pricedTaxes(quote).map((x, i) => {
                const rate = percent(x.rate / 100, locale, rateDigits(x.rate));
                return <FqTotal key={i} label={x.label ? `${x.label} ${rate}` : t("firstQuote.check.tax", { rate })} value={money(x.amount, locale)} />;
              })}
              <FqTotal big label={t("firstQuote.check.total")} value={money(quote.totale ?? 0, locale)} />
            </FqQuoteCard>
            {check && check.references > 0 && check.linesChecked > 0 ? (
              <Stack pt={12}>
                {check.findings.length === 0 ? (
                  <Banner tone="ok" icon="check" iconTone="sage" lead={t("firstQuote.check.ok.lead")}>{t("firstQuote.check.ok.text")}</Banner>
                ) : (
                  <Banner tone="warn" icon="warn" iconTone="amber" lead={t("firstQuote.check.review.lead")}>{t("firstQuote.check.review.text", { count: check.findings.length })}</Banner>
                )}
              </Stack>
            ) : null}
            <Stack row justify="center" pt={18} pb={6}>
              <TextLink label={t("firstQuote.check.change")} size={14.5} weight={600} color="ink" onPress={changeLine} />
            </Stack>
          </Section>
        ) : null}

        {step === "send" && quote ? (
          <Section delay={90} px={16} pt={22}>
            <SectionHeader title={t("firstQuote.send.sendIt")} />
            <Card accessibilityRole="radiogroup" accessibilityLabel={t("firstQuote.send.sendIt")}>
              <FqChoice first icon="user" tone="violet" title={t("firstQuote.send.me")} sub={email} selected={dest === "me"} onPress={() => setDest("me")} />
              <FqChoice icon="users" tone="teal" title={client ? client.name : t("firstQuote.send.client")} sub={client ? client.email : t("firstQuote.send.clientSub")} selected={dest === "client"}
                onPress={() => { setDest("client"); if (!client) setPicker(true); }} />
            </Card>
            <Stack pt={12}>
              <Card>
                <FqInfoRow icon="doc" tone="indigo" title={quoteTitle(quote)} sub={t("firstQuote.send.pdf")} trailing={<Num size={15} weight={600}>{money(quote.totale ?? 0, locale)}</Num>} />
              </Card>
            </Stack>
          </Section>
        ) : null}

        {step === "done" ? (
          <>
            <Section justify="center" align="center" pt={30}><FqOrb label={t("firstQuote.done.title")} /></Section>
            <Section delay={40} px={24} pt={26} gap={8} align="center">
              <Text size={28} weight={600} tracking={-0.04} align="center" accessibilityRole="header">{t("firstQuote.done.title")}</Text>
              <Text color="muted" leading={1.5} align="center" style={{ maxWidth: 300 }}>
                {sent && sent.email.toLowerCase() !== email.toLowerCase() ? t("firstQuote.done.bodyClient", { email: sent.email }) : t("firstQuote.done.body", { email: sent?.email ?? email })}
              </Text>
            </Section>
            <Section delay={80} px={16} pt={26} gap={12}>
              {sent?.elapsed ? (
                <FqElapsed label={t("firstQuote.done.fromSignUp")} sub={t("firstQuote.done.mostAfter")} value={sent.elapsed} />
              ) : null}
              <Card>
                <FqInfoRow wrap minHeight={68} icon="bell" tone="amber" title={t("firstQuote.done.know")} sub={t("firstQuote.done.knowSub")}
                  trailing={notif ? <Status tone="ok">{t("firstQuote.done.on")}</Status> : <Button size="sm" kind="secondary" label={t("firstQuote.done.turnOn")} onPress={() => void turnOn()} />} />
              </Card>
            </Section>
          </>
        ) : null}
        <Stack pb={24} />
      </ScrollView>

      <FqBottomBar>
        {step === "describe" ? (
          <Button size="lg" block label={t("firstQuote.describe.write")} busy={writing ? t("firstQuote.describe.writing") : false} disabled={!text.trim()} onPress={() => void write()} />
        ) : null}
        {step === "check" ? <Button size="lg" block label={t("firstQuote.check.looksRight")} onPress={() => go("send")} /> : null}
        {step === "send" ? <Button size="lg" block label={sendLabel} busy={sending ? t("firstQuote.send.sending") : false} onPress={() => void send()} /> : null}
        {step === "done" ? <Button size="lg" block label={t("firstQuote.done.home")} onPress={() => router.replace("/home")} /> : null}
      </FqBottomBar>

      <ClientSheet open={picker} onClose={() => { setPicker(false); if (!client) setDest("me"); }}
        onPick={(c) => { setClient(c); setDest("client"); setPicker(false); }} />
    </Screen>
  );
}

/** Digits a rate needs: 13 -> 0, 9.975 -> 3. */
function rateDigits(rate: number): number {
  return Math.min(3, String(rate).split(".")[1]?.length ?? 0);
}

/** "Choose a client": the contacts that have an email address, in a sheet. */
function ClientSheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (c: Client) => void }) {
  const { t } = useTranslation();
  const { data, isLoading } = useListClients({ query: { enabled: open } as never });
  const clients = ((data as { clientName: string; email?: string | null }[] | undefined) ?? []).filter((c) => !!c.email);
  return (
    <Sheet open={open} onClose={onClose} label={t("firstQuote.send.pickTitle")} closeLabel={t("firstQuote.send.pickClose")}>
      <Stack px={16} pb={16}>
        <SectionHeader title={t("firstQuote.send.pickTitle")} />
        {clients.length ? (
          <Card>
            <RowList>
              {clients.slice(0, 20).map((c) => (
                <ListRow key={c.email!} title={c.clientName} meta={c.email!} onPress={() => onPick({ name: c.clientName, email: c.email! })} />
              ))}
            </RowList>
          </Card>
        ) : isLoading ? null : (
          <Text size={13.5} color="muted" leading={1.45}>{t("firstQuote.send.pickNone")}</Text>
        )}
      </Stack>
    </Sheet>
  );
}
