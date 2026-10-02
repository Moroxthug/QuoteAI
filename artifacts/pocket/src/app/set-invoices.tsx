// SetInvoices.dc.html. How invoices go out and how clients pay: the next number and the default terms, the number format, the payment terms (On receipt, Net 15,
// Net 30), sending on schedule and the wait, the reminders (3 days before, on the due date, 7 days after, by email, text or both, with a timeline), how clients pay
// (e-Transfer, card through Stripe, cheque), the default deposit and holdback, and late fees. States: default, Stripe not connected, view only, loading, can't load.
// Read by the server: the payment terms, the deposit and holdback (the default payment schedule), sending on schedule and its wait, the "7 days after" reminder (the
// server's reminders after the due date) and texting them, and the e-Transfer address. Saved but not read yet: "3 days before" and "on the due date" (the server
// sends no reminder before a due date), "text only", the e-Transfer and cheque switches, the cheque's payee, the holdback release and late fees. The number format is
// the server's (INV-year-0000) and can't be changed, so its row only shows it.
import { useQuery } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { Linking } from "react-native";
import { useTranslation } from "react-i18next";
import { api, ApiFailure } from "@/lib/api";
import { percent, type Locale } from "@/lib/format";
import { invoicesApi } from "@/lib/invoicesApi";
import { screenHref } from "@/lib/nav";
import { NETS, depositOf, netOf, nextInvoiceNumber, pageOf, scheduleOf, sendDelayDays, withDeposit, withHoldback, withNet } from "@/lib/profile";
import { useProfile } from "@/lib/useProfile";
import { useRole } from "@/lib/useRole";
import { useSession } from "@/lib/useSession";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { Header } from "@/ui/Header";
import { ScrollPage, Section } from "@/ui/Layout";
import { Screen } from "@/ui/Screen";
import { SetButton, SetGroup, SetRow, SetSegment, SetStepper, SetValue } from "@/ui/Settings";
import { NextInvoiceCard, ReminderTimeline, RowStatus, SetTitle } from "@/ui/SettingsPages";
import { Switch } from "@/ui/Switch";

type Stripe = { connected: boolean; available: boolean; chargesEnabled?: boolean };

export default function SetInvoices() {
  const { t: tr, i18n } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`si.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const toast = useToast();
  const { profile, q, save } = useProfile();
  const { isOwner } = useRole();
  const stripeQ = useQuery({ queryKey: ["stripe-connect"], queryFn: () => api<Stripe>("/api/invoice-payments/connect/status"), enabled: signedIn, retry: 0, staleTime: 60_000 });
  const listQ = useQuery({ queryKey: ["invoices"], queryFn: invoicesApi.list, enabled: signedIn, retry: 1, staleTime: 15_000 });

  const page = pageOf(profile, "invoices");
  const auto = profile?.automationSettings;
  const schedule = scheduleOf(profile);

  const patch = async (p: Parameters<typeof save>[0]) => {
    const r = await save(p);
    if (!r.ok) toast({ message: r.status === 403 ? t("noAccess") : r.status === 0 ? t("offline") : t("failed") });
    return r.ok;
  };
  const savePage = (p: Record<string, unknown>) => patch({ pocketSettings: { invoices: p } });
  const dep = (v: number) => {
    const s = withDeposit(schedule, v, t("dep.term"));
    if (!s) { toast({ message: t("dep.tooBig") }); return; }
    void patch({ defaultPaymentSchedule: s });
  };

  if (status === "out") return <Redirect href="/" />;

  const loading = q.isPending && !profile;
  const failed = q.isError && !profile;
  const canEdit = isOwner;
  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("Settings", t("title"))));
  const net = netOf(schedule);
  const deposit = depositOf(schedule);
  const autoOn = auto?.autoSendInvoices ?? false;
  const delay = sendDelayDays(auto ?? { invoiceAutoSendAfterHours: 0 });
  const day = (n: number) => (n === 0 ? t("day.same") : n === 1 ? t("day.one", { count: n }) : t("day.other", { count: n }));
  const r1 = page.reminderBefore ?? true;
  const r2 = page.reminderDue ?? true;
  const r3 = auto?.invoiceReminders ?? true;
  const by = page.reminderBy ?? (auto?.smsReminders ? "both" : "email");
  const byIdx = by === "email" ? 0 : by === "sms" ? 1 : 2;
  const holdOn = schedule.holdback.enabled;
  const lateOn = page.lateFeeOn ?? false;
  const rate = page.lateFeeRate ?? 2;
  const after = page.lateFeeAfterDays ?? 30;
  const etr = profile?.etransferEmail ?? profile?.email ?? "";
  const payee = profile?.legalName || profile?.companyName || "";
  const stripe = stripeQ.data;
  const connected = !!stripe?.connected;
  const next = nextInvoiceNumber((listQ.data?.items ?? []).map((i) => i.number), new Date().getFullYear());

  const connect = async () => {
    try {
      const r = await api<{ url: string }>("/api/invoice-payments/connect/onboard", { method: "POST", body: {} });
      void Linking.openURL(r.url);
    } catch (e) { toast({ message: e instanceof ApiFailure && e.status === 0 ? t("offline") : t("failed") }); }
  };

  return (
    <Screen>
      <Header title="" backLabel={t("back")} onBack={back} />
      <ScrollPage bottom={56}>
        <SetTitle title={t("title")} lede={t("lede")} />
        {failed ? (
          <Section pt={26} px={16}><Empty icon="warn" iconTone="clay" title={t("loadFailed.title")} body={t("loadFailed.body")} action={t("retry")} onAction={() => void q.refetch()} /></Section>
        ) : loading ? (
          <Section pt={18} px={16} gap={14}><Skeleton height={90} radius={22} /><Skeleton height={240} radius={22} /><Skeleton height={240} radius={22} /></Section>
        ) : (
          <>
            {!canEdit ? <Section pt={16} px={16}><Banner tone="info" icon="eye" iconTone="sky" lead={t("viewOnly.lead")}>{t("viewOnly.body")}</Banner></Section> : null}
            {stripe && !connected ? (
              <Section pt={16} px={16}><Banner tone="warn" icon="card" iconTone="amber" lead={t("stripeOff.lead")} link={canEdit ? t("stripeOff.link") : undefined} onLink={() => void connect()}>{t("stripeOff.body")}</Banner></Section>
            ) : null}
            <Section delay={40} pt={18} px={16}><NextInvoiceCard label={t("next.label")} number={next} tag={t(`terms.${net}`)} tagNote={t("next.terms")} /></Section>

            <Section delay={80}>
              <SetGroup title={t("g.num")}>
                <SetRow first icon="tag" tone="lilac" label={t("format.label")} sub={t("format.sub")} control={<SetValue value={next} mono />} />
                <SetRow icon="cal" tone="teal" label={t("payTerms.label")} sub={t("payTerms.sub")} below={<SetSegment options={NETS.map((n) => t(`terms.${n}`))} value={NETS.indexOf(net)} onChange={(i) => void patch({ defaultPaymentSchedule: withNet(schedule, NETS[i]!) })} label={t("payTerms.label")} disabled={!canEdit} />} />
                <SetRow icon="send" tone="sky" label={t("auto.label")} sub={t(autoOn ? "auto.on" : "auto.off")} control={<Switch value={autoOn} onChange={(v) => void patch({ automationSettings: { autoSendInvoices: v } })} label={t("auto.label")} disabled={!canEdit} />} />
                {autoOn ? (
                  <SetRow icon="clock" tone="stone" label={t("delay.label")} sub={t("delay.sub")}
                    control={<SetStepper value={day(delay)} onDec={() => void patch({ automationSettings: { invoiceAutoSendAfterHours: Math.max(0, delay - 1) * 24 }, pocketSettings: { invoices: { sendDelayDays: Math.max(0, delay - 1) } } })} onInc={() => void patch({ automationSettings: { invoiceAutoSendAfterHours: Math.min(7, delay + 1) * 24 }, pocketSettings: { invoices: { sendDelayDays: Math.min(7, delay + 1) } } })}
                      decLabel={t("delay.dec")} incLabel={t("delay.inc")} canDec={delay > 0} canInc={delay < 7} disabled={!canEdit} />} />
                ) : null}
              </SetGroup>
            </Section>

            <Section delay={130}>
              <SetGroup title={t("g.rem")} foot={t("remFoot")}>
                <ReminderTimeline marks={[{ label: t("timeline.before"), on: r1 }, { label: t("timeline.due"), on: r2 }, { label: t("timeline.after"), on: r3 }]} />
                <SetRow first icon="bell" tone="amber" label={t("r1.label")} sub={t("r1.sub")} control={<Switch value={r1} onChange={(v) => void savePage({ reminderBefore: v })} label={t("r1.label")} disabled={!canEdit} />} />
                <SetRow icon="cal" tone="teal" label={t("r2.label")} sub={t("r2.sub")} control={<Switch value={r2} onChange={(v) => void savePage({ reminderDue: v })} label={t("r2.label")} disabled={!canEdit} />} />
                <SetRow icon="warn" tone="rose" label={t("r3.label")} sub={t(lateOn ? "r3.subLate" : "r3.sub")} control={<Switch value={r3} onChange={(v) => void patch({ automationSettings: { invoiceReminders: v } })} label={t("r3.label")} disabled={!canEdit} />} />
                <SetRow icon="chat" tone="sky" label={t("by.label")} below={<SetSegment options={[t("by.email"), t("by.sms"), t("by.both")]} value={byIdx} onChange={(i) => { const b = (["email", "sms", "both"] as const)[i]!; void patch({ pocketSettings: { invoices: { reminderBy: b } }, automationSettings: { smsReminders: b !== "email" } }); }} label={t("by.label")} disabled={!canEdit} />} />
              </SetGroup>
            </Section>

            <Section delay={180}>
              <SetGroup title={t("g.pay")}>
                <SetRow first icon="bank" tone="sage" label={t("etr.label")} sub={etr ? t("etr.sub", { email: etr }) : t("etr.subNone")} control={<Switch value={page.payEtransfer ?? true} onChange={(v) => void savePage({ payEtransfer: v })} label={t("etr.label")} disabled={!canEdit} />} />
                {connected ? (
                  <SetRow icon="card" tone="violet" label={t("card.label")} sub={t("card.sub")} control={<RowStatus tone="ok" shape="check">{t("card.connected")}</RowStatus>} onPress={() => router.push(screenHref("Integration", t("card.label")))} />
                ) : (
                  <SetRow icon="card" tone="violet" label={t("card.label")} sub={t("card.notYet")} control={canEdit ? <SetButton label={t("card.connect")} kind="primary" onPress={() => void connect()} /> : undefined} />
                )}
                <SetRow icon="receipt" tone="stone" label={t("chq.label")} sub={payee ? t("chq.sub", { name: payee }) : t("chq.subNone")} control={<Switch value={page.payCheque ?? false} onChange={(v) => void savePage({ payCheque: v })} label={t("chq.label")} disabled={!canEdit} />} />
              </SetGroup>
            </Section>

            <Section delay={230}>
              <SetGroup title={t("g.dep")}>
                <SetRow first icon="percent" tone="amber" label={t("dep.label")} sub={t("dep.sub")}
                  control={<SetStepper value={percent(deposit / 100, locale)} onDec={() => dep(Math.max(0, deposit - 5))} onInc={() => dep(Math.min(50, deposit + 5))} decLabel={t("dep.dec")} incLabel={t("dep.inc")} canDec={deposit > 0} canInc={deposit < 50} disabled={!canEdit} />} />
                <SetRow icon="lock" tone="indigo" label={t("hold.label")} sub={holdOn ? t("hold.on", { pct: schedule.holdback.percent }) : t("hold.off")} control={<Switch value={holdOn} onChange={(v) => void patch({ defaultPaymentSchedule: withHoldback(schedule, v) })} label={t("hold.label")} disabled={!canEdit} />} />
                {holdOn ? <SetRow icon="cal" tone="teal" label={t("hold.release")} sub={t("hold.releaseSub")} control={<SetValue value={t("hold.releaseVal", { days: page.holdbackReleaseDays ?? 60 })} />} /> : null}
              </SetGroup>
            </Section>

            <Section delay={280}>
              <SetGroup title={t("g.late")} foot={lateOn ? t("late.foot") : undefined}>
                <SetRow first icon="warn" tone="rose" label={t("late.label")} sub={t("late.sub")} control={<Switch value={lateOn} onChange={(v) => void savePage({ lateFeeOn: v })} label={t("late.label")} disabled={!canEdit} />} />
                {lateOn ? (
                  <>
                    <SetRow icon="percent" tone="clay" label={t("late.rate")} sub={t("late.rateSub")}
                      control={<SetStepper value={t("late.rateVal", { rate: String(rate).replace(".", i18n.language === "fr" ? "," : ".") })} onDec={() => void savePage({ lateFeeRate: Math.max(0.5, rate - 0.5) })} onInc={() => void savePage({ lateFeeRate: Math.min(5, rate + 0.5) })} decLabel={t("late.dec")} incLabel={t("late.inc")} canDec={rate > 0.5} canInc={rate < 5} disabled={!canEdit} />} />
                    <SetRow icon="clock" tone="amber" label={t("late.after")} sub={t("late.afterSub")}
                      control={<SetStepper value={day(after)} onDec={() => void savePage({ lateFeeAfterDays: Math.max(0, after - 5) })} onInc={() => void savePage({ lateFeeAfterDays: Math.min(60, after + 5) })} decLabel={t("late.dec")} incLabel={t("late.inc")} canDec={after > 0} canInc={after < 60} disabled={!canEdit} />} />
                  </>
                ) : null}
              </SetGroup>
            </Section>
          </>
        )}
      </ScrollPage>
    </Screen>
  );
}
