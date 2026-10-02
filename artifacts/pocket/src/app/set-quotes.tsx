// SetQuotes.dc.html. The defaults of every new quote (valid for, deposit, Good / Better / Best, an email when it is accepted), the follow-up steps (Day 2, 5 and 10
// after sending: each on or off, its message, and "Send me a test"), the first follow-up for a new lead, the terms and exclusions printed on every quote, and
// asking for a review when a job is done (the wait, the Google and HomeStars links). States: default, view only, loading and can't load.
// Read by the server: valid for, the deposit, the email on acceptance, the follow-up days (as the days between messages), the lead follow-up, asking for a review
// and its wait and links. Saved but not read yet: Good / Better / Best, the text of the follow-up messages and the terms. "Send me a test" sends the server's
// generic test text to the company's phone, not the step's own message.
import { useEffect, useState } from "react";
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { ApiFailure, api } from "@/lib/api";
import { gapsOf, stepsOf, type Step } from "@/lib/followups";
import { pageOf, scheduleOf, depositOf, withDeposit } from "@/lib/profile";
import { screenHref } from "@/lib/nav";
import { percent, type Locale } from "@/lib/format";
import { useProfile } from "@/lib/useProfile";
import { useRole } from "@/lib/useRole";
import { useSession } from "@/lib/useSession";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { Button } from "@/ui/Button";
import { TextField } from "@/ui/Field";
import { Header } from "@/ui/Header";
import { ScrollPage, Section, Stack } from "@/ui/Layout";
import { Card } from "@/ui/Card";
import { Screen } from "@/ui/Screen";
import { SetGroup, SetRow, SetStepper, SetValue } from "@/ui/Settings";
import { FollowupSteps, MessageBubble, SetTitle, TermsField } from "@/ui/SettingsPages";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { Switch } from "@/ui/Switch";

type LinkKey = "googleReviewUrl" | "homeStarsProfileUrl";

export default function SetQuotes() {
  const { t: tr, i18n } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`sq.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { status } = useSession();
  const toast = useToast();
  const { profile, q, save } = useProfile();
  const { isOwner } = useRole();
  const [active, setActive] = useState(0);
  const [terms, setTerms] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ i: number; text: string } | null>(null);
  const [linkOpen, setLinkOpen] = useState<LinkKey | null>(null);
  const [link, setLink] = useState("");
  const [linkBad, setLinkBad] = useState(false);

  const page = pageOf(profile, "quotes");
  const auto = profile?.automationSettings;
  const steps: Step[] = stepsOf(auto?.quoteFollowupDays ?? [], page);
  const stepTpl = (i: number) => tr(`sq.step.${Math.min(i, 2)}`, { returnObjects: true }) as { name: string; via: string; when: string; msg: string };
  const messages = steps.map((_, i) => page.followupMessages?.[i] ?? stepTpl(i).msg);
  const termsText = terms ?? page.terms ?? t("termsDefault");

  useEffect(() => { setMsg(null); }, [active]);

  const patchProfile = async (patch: Parameters<typeof save>[0]) => {
    const r = await save(patch);
    if (!r.ok) toast({ message: r.status === 403 ? t("noAccess") : r.status === 0 ? t("offline") : t("failed") });
    return r.ok;
  };
  const savePage = (p: Record<string, unknown>) => patchProfile({ pocketSettings: { quotes: p } });
  const saveSteps = (next: Step[]) => patchProfile({
    pocketSettings: { quotes: { followupDays: next.map((s) => s.day), followupOn: next.map((s) => s.on) } },
    automationSettings: { quoteFollowupDays: gapsOf(next) },
  });
  const dep = (v: number) => {
    const s = withDeposit(scheduleOf(profile), v, t("dep.term"));
    if (!s) { toast({ message: t("dep.tooBig") }); return; }
    void patchProfile({ defaultPaymentSchedule: s });
  };

  if (status === "out") return <Redirect href="/" />;

  const loading = q.isPending && !profile;
  const failed = q.isError && !profile;
  const canEdit = isOwner;
  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("Settings", t("title"))));
  const valid = profile?.quoteValidDays ?? 30;
  const deposit = depositOf(scheduleOf(profile));
  const lead = auto?.leadFollowupDays?.[0] ?? 1;
  const wait = auto?.reviewRequestDelayDays ?? 3;
  const reviewsOn = profile?.sendReviewRequests ?? true;
  const cur = steps[Math.min(active, steps.length - 1)] ?? steps[0]!;
  const ci = Math.min(active, steps.length - 1);
  const tpl = stepTpl(ci);
  const dayWord = (s: Step) => t("steps.day", { n: s.day });
  const same = (n: number) => (n === 0 ? t("lead.same") : t("lead.days", { count: n }));
  const shortLink = (u: string | null | undefined) => (u ? u.replace(/^https?:\/\//, "").replace(/\/$/, "") : "");

  const sendTest = async () => {
    try {
      await api("/api/sms/test", { method: "POST", body: { lang: i18n.language === "fr" ? "fr" : "en" } });
      toast({ message: t("tested") });
    } catch (e) {
      const code = e instanceof ApiFailure ? e.code : undefined;
      toast({ message: code === "NO_PHONE" ? t("testNoPhone") : code === "NOT_CONFIGURED" ? t("testOff") : e instanceof ApiFailure && e.status === 0 ? t("offline") : t("testFailed") });
    }
  };

  const openLink = (k: LinkKey) => { setLink(profile?.[k] ?? ""); setLinkBad(false); setLinkOpen(k); };
  const saveLink = async () => {
    const v = link.trim();
    if (v && !/^https?:\/\/\S+\.\S+/.test(v)) { setLinkBad(true); return; }
    if (await patchProfile({ [linkOpen!]: v || null } as never)) setLinkOpen(null);
  };

  return (
    <Screen>
      <Header title="" backLabel={t("back")} onBack={back} />
      <ScrollPage bottom={56}>
        <SetTitle title={t("title")} lede={t("lede")} />
        {failed ? (
          <Section pt={26} px={16}><Empty icon="warn" iconTone="clay" title={t("loadFailed.title")} body={t("loadFailed.body")} action={t("retry")} onAction={() => void q.refetch()} /></Section>
        ) : loading ? (
          <Section pt={18} px={16} gap={14}><Skeleton height={250} radius={22} /><Skeleton height={380} radius={22} /></Section>
        ) : (
          <>
            {!canEdit ? <Section pt={16} px={16}><Banner tone="info" icon="eye" iconTone="sky" lead={t("viewOnly.lead")}>{t("viewOnly.body")}</Banner></Section> : null}

            <Section delay={60}>
              <SetGroup title={t("g.def")} first>
                <SetRow first icon="clock" tone="teal" label={t("valid.label")} sub={t("valid.sub")}
                  control={<SetStepper value={t("valid.unit", { count: valid })} onDec={() => void patchProfile({ quoteValidDays: Math.max(5, valid - 5) })} onInc={() => void patchProfile({ quoteValidDays: Math.min(90, valid + 5) })} decLabel={t("valid.dec")} incLabel={t("valid.inc")} canDec={valid > 5} canInc={valid < 90} disabled={!canEdit} />} />
                <SetRow icon="percent" tone="amber" label={t("dep.label")} sub={t("dep.sub")}
                  control={<SetStepper value={percent(deposit / 100, locale)} onDec={() => dep(Math.max(0, deposit - 5))} onInc={() => dep(Math.min(50, deposit + 5))} decLabel={t("dep.dec")} incLabel={t("dep.inc")} canDec={deposit > 0} canInc={deposit < 50} disabled={!canEdit} />} />
                <SetRow icon="bars" tone="violet" label={t("gbb.label")} sub={t("gbb.sub")} control={<Switch value={page.goodBetterBest ?? true} onChange={(v) => void savePage({ goodBetterBest: v })} label={t("gbb.label")} disabled={!canEdit} />} />
                <SetRow icon="mail" tone="sky" label={t("accMail.label")} sub={t("accMail.sub")} control={<Switch value={auto?.notifyOnQuoteAccepted ?? true} onChange={(v) => void patchProfile({ automationSettings: { notifyOnQuoteAccepted: v } })} label={t("accMail.label")} disabled={!canEdit} />} />
              </SetGroup>
            </Section>

            <Section delay={110}>
              <SetGroup title={t("g.fu")} foot={t("foot")}>
                <Stack px={16} pt={16}>
                  <FollowupSteps label={t("steps.tabs")} active={ci} onPick={setActive} steps={steps.map((s, i) => ({ day: dayWord(s), name: stepTpl(i).name, on: s.on }))} />
                  <MessageBubble when={tpl.when} via={tpl.via} label={t("msgLabel", { day: dayWord(cur) })} value={msg?.i === ci ? msg.text : messages[ci] ?? ""} onChange={(text) => setMsg({ i: ci, text })} hint={t("hint")} test={t("test")} onTest={() => void sendTest()} disabled={!canEdit} />
                  {msg?.i === ci && msg.text !== (messages[ci] ?? "") ? (
                    <Stack pb={14}><Button size="sm" label={t("rev.save")} onPress={() => { const m = steps.map((_, i) => (i === ci ? msg.text : messages[i] ?? "")); void savePage({ followupMessages: m }).then(() => setMsg(null)); }} /></Stack>
                  ) : null}
                </Stack>
                <SetRow icon="bell" tone="amber" label={t("send.label", { day: dayWord(cur).toLowerCase() })} sub={tpl.name}
                  control={<Switch value={cur.on} onChange={(v) => void saveSteps(steps.map((s, i) => (i === ci ? { ...s, on: v } : s)))} label={t("send.label", { day: dayWord(cur).toLowerCase() })} disabled={!canEdit} />} />
                <SetRow icon="funnel" tone="teal" label={t("lead.label")} sub={t("lead.sub")}
                  control={<SetStepper value={same(lead)} onDec={() => void patchProfile({ automationSettings: { leadFollowupDays: [Math.max(0, lead - 1) || 1] } })} onInc={() => void patchProfile({ automationSettings: { leadFollowupDays: [Math.min(7, lead + 1)] } })} decLabel={t("lead.dec")} incLabel={t("lead.inc")} canDec={lead > 1} canInc={lead < 7} disabled={!canEdit} />} />
              </SetGroup>
            </Section>

            <Section delay={170}>
              <SetGroup title={t("g.terms")} foot={t("termsFoot")}>
                <TermsField label={t("termsLabel")} value={termsText} onChange={setTerms} onBlur={() => { if (terms !== null && terms !== (page.terms ?? t("termsDefault"))) void savePage({ terms }); }} disabled={!canEdit} />
              </SetGroup>
            </Section>

            <Section delay={230}>
              <SetGroup title={t("g.reviews")} foot={reviewsOn ? t("rev.foot") : undefined}>
                <SetRow first icon="star" tone="gold" label={t("rev.label")} sub={t("rev.sub")} control={<Switch value={reviewsOn} onChange={(v) => void patchProfile({ sendReviewRequests: v })} label={t("rev.label")} disabled={!canEdit} />} />
                {reviewsOn ? (
                  <>
                    <SetRow icon="clock" tone="amber" label={t("rev.wait")} sub={t("rev.waitSub")}
                      control={<SetStepper value={same(wait)} onDec={() => void patchProfile({ automationSettings: { reviewRequestDelayDays: Math.max(0, wait - 1) } })} onInc={() => void patchProfile({ automationSettings: { reviewRequestDelayDays: Math.min(14, wait + 1) } })} decLabel={t("rev.dec")} incLabel={t("rev.inc")} canDec={wait > 0} canInc={wait < 14} disabled={!canEdit} />} />
                    <SetRow icon="globe" tone="azure" label={t("rev.google")} sub={t("rev.linkSub")} control={<SetValue value={shortLink(profile?.googleReviewUrl) || t("rev.notSet")} chevron />} onPress={canEdit ? () => openLink("googleReviewUrl") : undefined} />
                    <SetRow icon="house" tone="clay" label={t("rev.homestars")} sub={t("rev.linkSub")} control={<SetValue value={profile?.homeStarsProfileUrl ? t("rev.added") : t("rev.notSet")} chevron />} onPress={canEdit ? () => openLink("homeStarsProfileUrl") : undefined} />
                  </>
                ) : null}
              </SetGroup>
            </Section>
          </>
        )}
      </ScrollPage>

      <Sheet open={linkOpen !== null} onClose={() => setLinkOpen(null)} label={t("rev.sheetTitle")} closeLabel={t("close")}>
        <Stack px={16} pb={30} gap={12}>
          <SheetTitle>{t(linkOpen === "homeStarsProfileUrl" ? "rev.homestars" : "rev.google")}</SheetTitle>
          <Card padded><TextField label={t("rev.field")} value={link} onChangeText={(v) => { setLink(v); setLinkBad(false); }} keyboardType="url" autoCapitalize="none" autoCorrect={false} error={linkBad ? t("rev.invalid") : undefined} /></Card>
          <Button label={t("rev.save")} block onPress={() => void saveLink()} />
        </Stack>
      </Sheet>
    </Screen>
  );
}

