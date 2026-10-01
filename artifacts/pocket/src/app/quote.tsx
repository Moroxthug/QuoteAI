// Quote.dc.html: the draft a contractor reviews and sends. The status and validity, the title, the client (Change),
// the scope (Edit), the line items (a stepper on measured lines), subtotal, tax and total, the deposit switch,
// "Send by" Email / SMS / WhatsApp, and the floating Preview and Send. Changes save as you make them (700 ms after
// the last tap), the same PUT and totals as the full editor. Once sent the primary reads "Sent to ..."; an accepted
// quote offers Start job. States: loading, can't load, not found, offline, read-only (accepted).
import { useEffect, useMemo, useRef, useState } from "react";
import { Linking, Platform } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getListQuotesQueryKey, useListClients, type Client } from "@workspace/api-client-react";
import { ApiFailure } from "@/lib/api";
import { API_ORIGIN } from "@/lib/session";
import { money, shortDate, type Locale } from "@/lib/format";
import { initialsOf } from "@/lib/invites";
import { screenHref } from "@/lib/nav";
import { canToggleDeposit, defaultChannel, depositAmount, depositTerm, DEFAULT_DEPOSIT_PERCENT, isFixed, maskEmail, maskPhone, recompute, setLineQuantity, stepOf, stepQuantity, toggleDeposit, validEmail, validPhone, type Chapter, type Channel } from "@/lib/quoteMath";
import { quoteApi, type QuoteFull } from "@/lib/quoteApi";
import { jobLine, quoteState, validUntil as validUntilOf, type QuoteState } from "@/lib/quotes";
import { taxName } from "@/lib/quoteBar";
import { tintFor } from "@/lib/clients";
import { useSession } from "@/lib/useSession";
import { ActionBar, ACTION_BAR_SPACE } from "@/ui/ActionBar";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Empty, Skeleton, useToast } from "@/ui/Feedback";
import { TextField } from "@/ui/Field";
import { Header } from "@/ui/Header";
import { Section, ScrollPage, Stack } from "@/ui/Layout";
import { MenuList, MenuRow } from "@/ui/Row";
import { ChannelPicker, DepositCard, LineCard, QuoteHead, ScopeCard, TotalsCard, type QuoteLine } from "@/ui/Quote";
import { Screen } from "@/ui/Screen";
import { Search } from "@/ui/Search";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { Status, type StatusShape, type StatusTone } from "@/ui/Status";
import { Stepper } from "@/ui/Stepper";
import { Switch } from "@/ui/Switch";
import { Text } from "@/ui/Text";
import { Icon } from "@/ui/Icon";
import { Press } from "@/ui/motion";
import { RowBody, RowList, SectionHeader } from "@/ui/Row";
import { Card } from "@/ui/Card";

const STATUS: Record<QuoteState, { tone: StatusTone; shape: StatusShape }> = {
  draft: { tone: "mute", shape: "draft" }, sent: { tone: "info", shape: "q1" }, viewed: { tone: "acc", shape: "q2" }, expiring: { tone: "warn", shape: "clock" },
  accepted: { tone: "ok", shape: "check" }, declined: { tone: "bad", shape: "x" }, expired: { tone: "mute", shape: "off" },
};
const CHANNELS: Channel[] = ["email", "sms", "wa"];
const SAVE_MS = 700;

export default function Quote() {
  const { t, i18n } = useTranslation();
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const toast = useToast();
  const client = useQueryClient();
  const q = useQuery({ queryKey: ["quote", id], queryFn: () => quoteApi.get(id!), enabled: signedIn && !!id, retry: 1, staleTime: 15_000 });
  const sms = useQuery({ queryKey: ["sms-status"], queryFn: quoteApi.smsStatus, enabled: signedIn, retry: false, staleTime: 60_000 });
  const [caps, setCaps] = useState<Chapter[] | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [ask, setAsk] = useState<Channel | null>(null);
  const [dest, setDest] = useState("");
  const [destError, setDestError] = useState<string | undefined>();
  const [scopeOpen, setScopeOpen] = useState(false);
  const [scope, setScope] = useState("");
  const [clientOpen, setClientOpen] = useState(false);
  const [clientTerm, setClientTerm] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [wonOpen, setWonOpen] = useState(false);
  const [wonBusy, setWonBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quote = q.data;
  const clients = useListClients({ query: { queryKey: ["/api/clients"], enabled: clientOpen } } as never);

  useEffect(() => { if (quote && !caps) setCaps(quote.capitoli.map((c) => ({ ...c, voci: c.voci.map((v) => ({ ...v, quantita: Number(v.quantita), prezzoUnitario: Number(v.prezzoUnitario) })) }))); }, [quote, caps]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const live = useMemo(() => (quote && caps ? recompute(caps, Number(quote.ivaPercentuale), quote.sconto?.percentuale ?? 0) : null), [caps, quote]);

  if (status === "out") return <Redirect href="/" />;
  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("Quotes", t("tabs.quotes"))));
  const header = (number?: string) => <Header title={number ?? ""} subtle backLabel={t("quote.back")} onBack={back} moreLabel={t("quote.more")} onMore={quote ? () => setMoreOpen(true) : undefined} />;

  if (q.isError && !quote) {
    const notFound = q.error instanceof ApiFailure && q.error.status === 404;
    return <Screen>{header()}<Section pt={26} px={16}>{notFound
      ? <Empty icon="file" iconTone="slate" title={t("quote.notFound.title")} body={t("quote.notFound.body")} action={t("quote.back")} actionKind="secondary" onAction={back} />
      : <Empty icon="warn" iconTone="clay" title={t("quote.loadFailed.title")} body={t("quote.loadFailed.body")} action={t("quote.loadFailed.retry")} onAction={() => void q.refetch()} />}</Section></Screen>;
  }
  if (!quote || !caps || !live) return <Screen>{header()}<Section pt={8} px={16} gap={12}><Skeleton height={120} radius={22} /><Skeleton height={90} radius={22} /><Skeleton height={300} radius={22} /></Section></Screen>;

  const now = new Date();
  const state = quoteState({ status: quote.status, sentAt: quote.sentAt, acceptedAt: quote.acceptedAt, firstViewedAt: quote.firstViewedAt, declinedAt: quote.declinedAt, validDays: quote.validDays }, now);
  const accepted = state === "accepted";
  const editable = !accepted && !quote.pdfDownloadedAt;
  const m = (n: number) => money(n, locale);
  const number = quote.numeroPreventivoData?.trim() ?? "";
  const title = (quote.titoloPreventivoRiga1 && quote.titoloPreventivoRiga1 !== "Project Quote & Itemized Estimate" ? quote.titoloPreventivoRiga1 : jobLine(quote)) || t("quote.untitled");
  const cd = quote.clientData;
  const email = cd.email?.trim() ?? "";
  const phone = cd.phone?.trim() ?? "";
  const smsOk = !!sms.data?.available && !!sms.data?.smsEnabled;
  const ch: Channel = channel ?? defaultChannel(email, phone, smsOk);
  const validDate = shortDate(validUntilOf(quote.sentAt ?? now.toISOString(), quote.validDays), locale);
  const firstName = cd.nome.trim().split(/\s+/)[0] ?? cd.nome;
  const st = STATUS[state];

  const save = (data: Parameters<typeof quoteApi.update>[1], toastOk = false) =>
    quoteApi.update(quote.id, data).then((r) => { client.setQueryData(["quote", id], r); void client.invalidateQueries({ queryKey: getListQuotesQueryKey() }); if (toastOk) toast({ message: t("quote.toast.saved") }); return r; })
      .catch((e: unknown) => { toast({ message: e instanceof ApiFailure && e.offline ? t("quote.toast.offline") : e instanceof ApiFailure && e.status === 403 ? t("quote.toast.noAccess") : t("quote.toast.saveFailed") }); throw e; });

  const changeLines = (next: Chapter[]) => {
    setCaps(next);
    setSent(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { const r = recompute(next, Number(quote.ivaPercentuale), quote.sconto?.percentuale ?? 0); void save({ capitoli: r.capitoli, subtotale: r.subtotale, ivaValore: r.ivaValore, totale: r.totale, sconto: r.sconto }).catch(() => undefined); }, SAVE_MS);
  };

  const sched = quote.paymentSchedule ?? null;
  const dep = depositTerm(sched);
  const canDep = editable && canToggleDeposit(sched);
  const flipDeposit = () => { if (!sched) return; void save({ paymentSchedule: toggleDeposit(sched, `t${Date.now().toString(36)}`, t("quote.depositLabel")) }).catch(() => undefined); setSent(false); };

  const sendNow = async (to?: string) => {
    const target = to ?? (ch === "email" ? email : phone);
    if (!target) { setDest(""); setDestError(undefined); setAsk(ch); return; }
    if (ch === "wa") return;
    if (ch === "email" ? !validEmail(target) : !validPhone(target)) { setDestError(t(ch === "email" ? "quote.ask.invalidEmail" : "quote.ask.invalidPhone")); setAsk(ch); return; }
    setSending(true);
    try {
      if (timer.current) { clearTimeout(timer.current); const r = recompute(caps, Number(quote.ivaPercentuale), quote.sconto?.percentuale ?? 0); await save({ capitoli: r.capitoli, subtotale: r.subtotale, ivaValore: r.ivaValore, totale: r.totale, sconto: r.sconto }); timer.current = null; }
      if (ch === "email") await quoteApi.sendEmail(quote.id, target, cd.nome); else await quoteApi.sendSms(quote.id, target);
      setSent(true); setAsk(null);
      void client.invalidateQueries({ queryKey: ["quote", id] });
      void client.invalidateQueries({ queryKey: getListQuotesQueryKey() });
    } catch (e) {
      const f = e instanceof ApiFailure ? e : null;
      toast({ message: f?.status === 402 ? t("quote.toast.unlock") : f?.offline ? t("quote.toast.offline") : ch === "sms" ? t("quote.toast.smsFailed") : t("quote.toast.sendFailed") });
    } finally { setSending(false); }
  };

  const primary = accepted
    ? { label: quote.jobId ? t("quote.openJob") : t("quote.startJob"), run: () => router.push(screenHref("JobSetup", t("quote.startJob"))), done: false }
    : { label: sent ? t("quote.sentTo", { name: firstName }) : t("quote.send", { total: m(live.totale) }), run: () => void sendNow(), done: sent };

  const lines: QuoteLine[] = caps.flatMap((c, ci) => c.voci.map((v, vi) => {
    const step = stepOf(v.quantita, v.um);
    const adjustable = editable && !isFixed(v);
    const what = v.descrizione.split("\n")[0]!;
    return {
      key: `${ci}-${vi}`, name: v.descrizione.split("\n")[0]!, detail: [v.um ? `${m(v.prezzoUnitario)} / ${v.um}` : m(v.prezzoUnitario), v.descrizione.split("\n")[1] ?? ""].filter(Boolean).join(" · "),
      amount: m(Math.round(v.quantita * v.prezzoUnitario * 100) / 100),
      fixed: !adjustable ? (isFixed(v) ? t("quote.fixed") : `${v.quantita} ${v.um}`) : undefined,
      stepper: adjustable ? <Stepper value={`${new Intl.NumberFormat(locale).format(v.quantita)} ${v.um}`} decLabel={t("quote.less", { what })} incLabel={t("quote.moreOf", { what })} canDec={v.quantita - step > 0}
        onDec={() => changeLines(setLineQuantity(caps, ci, vi, stepQuantity(v, -1)))} onInc={() => changeLines(setLineQuantity(caps, ci, vi, stepQuantity(v, 1)))} /> : undefined,
    };
  }));
  const legacy: QuoteLine[] = caps.length === 0 ? (quote.items ?? []).map((it, i) => ({ key: `i${i}`, name: it.descrizione, detail: `${it.quantita} ${it.unita}`, amount: m(it.totale) })) : [];

  const taxLabel = quote.taxLines?.length ? quote.taxLines.map((l) => l.label ?? l.code).join(" + ") : taxName(quote.province) ?? t("quote.tax");
  const rate = Math.round(Number(quote.ivaPercentuale) * 1000) / 1000;
  const [whole, cents] = (() => { const s = m(live.totale); const i = s.search(/[.,]\d\d(?: \$)?$/); return i > 0 ? [s.slice(0, i), s.slice(i)] : [s, ""]; })();
  const link = `${API_ORIGIN}/p/${quote.id}`;
  const options = CHANNELS.map((k) => ({
    key: k, label: t(`quote.channels.${k}`),
    sub: k === "email" ? (email ? maskEmail(email) : t("quote.addAddress")) : k === "sms" ? (!smsOk ? t("quote.notSetUp") : phone ? maskPhone(phone) : t("quote.addNumber")) : t("quote.notSetUp"),
  }));

  const pickClients = ((clients.data ?? []) as Client[]).filter((c) => !clientTerm.trim() || `${c.clientName} ${c.indirizzo ?? ""}`.toLowerCase().includes(clientTerm.trim().toLowerCase()));
  const setClient = (c: Client) => {
    void save({ clientData: { nome: c.clientName, indirizzo: c.indirizzo ?? "", email: c.email ?? undefined, phone: c.phone ?? undefined, city: c.city ?? undefined, province: c.province ?? undefined, postalCode: c.postalCode ?? undefined } }).then(() => setClientOpen(false)).catch(() => undefined);
  };

  return (
    <Screen floating={
      <ActionBar label={primary.label} onPress={primary.run} done={primary.done} busy={sending} moreLabel={t("quote.more")} secondary={accepted ? undefined : t("quote.preview")}
        onSecondary={() => void Linking.openURL(`${link}?preview=1`)} onMore={() => setMoreOpen(true)} />}>
      {header(number)}
      <ScrollPage bottom={ACTION_BAR_SPACE}>
        <Section>
          <QuoteHead status={<Status plain tone={st.tone} shape={st.shape}>{t(`quote.status.${state}`)}</Status>} valid={accepted ? t("quote.acceptedOn", { date: shortDate(new Date(quote.acceptedAt ?? now), locale) }) : t("quote.validUntil", { date: validDate })}
            title={title} avatar={<Avatar initials={initialsOf(cd.nome)} tint={tintFor(cd.nome)} size={32} />} client={cd.nome} address={[cd.indirizzo, cd.city].filter(Boolean).join(", ") || undefined}
            changeLabel={editable ? t("quote.change") : undefined} onChange={editable ? () => { setClientTerm(""); setClientOpen(true); } : undefined} />
        </Section>
        <Section delay={70} pt={20} px={16}>
          <ScopeCard title={t("quote.scope")} text={quote.descrizioneGenerale} editLabel={editable ? t("quote.edit") : undefined} onEdit={editable ? () => { setScope(quote.descrizioneGenerale); setScopeOpen(true); } : undefined} />
        </Section>
        <Section delay={140} pt={22} px={16}>
          <SectionHeader title={t("quote.lineItems")} link={editable ? t("quote.addItem") : undefined} onLink={() => router.push(screenHref("QuoteEditor", t("quote.actions.editor"), { id: quote.id }))} />
          <LineCard lines={lines.length ? lines : legacy} />
        </Section>
        <Section delay={210} pt={12} px={16} gap={12}>
          <TotalsCard rows={[{ label: t("quote.subtotal"), value: m(live.subtotale) }, ...(live.sconto ? [{ label: t("quote.discount", { pct: live.sconto.percentuale }), value: `−${m(live.subtotale - live.imponibile)}` }] : []), { label: t("quote.taxLine", { name: taxLabel, rate }), value: m(live.ivaValore) }]} totalLabel={t("quote.total")} whole={whole} cents={cents} />
          {sched && (dep || canDep) ? (
            <DepositCard title={t("quote.deposit", { pct: dep?.value ?? DEFAULT_DEPOSIT_PERCENT })} sub={t("quote.depositSub")} switchNode={<Switch value={!!dep} onChange={() => flipDeposit()} label={t("quote.deposit", { pct: dep?.value ?? DEFAULT_DEPOSIT_PERCENT })} disabled={!canDep} />}
              dueLabel={t("quote.dueOnAcceptance")} due={dep ? m(depositAmount(sched, live.totale) ?? 0) : undefined} />
          ) : null}
        </Section>
        {!accepted ? (
          <Section delay={280} pt={22} px={16}>
            <SectionHeader title={t("quote.sendBy")} />
            <ChannelPicker label={t("quote.sendChannel")} options={options} value={CHANNELS.indexOf(ch)} onChange={(i) => { setChannel(CHANNELS[i]!); setSent(false); }} />
          </Section>
        ) : null}
      </ScrollPage>

      <Sheet open={scopeOpen} onClose={() => setScopeOpen(false)} label={t("quote.scopeSheet.title")} closeLabel={t("close")}>
        <SheetTitle>{t("quote.scopeSheet.title")}</SheetTitle>
        <Stack px={16} gap={12} pt={0}>
          <TextField label={t("quote.scopeSheet.label")} value={scope} onChangeText={setScope} multiline />
          <Button label={t("quote.scopeSheet.save")} disabled={!scope.trim() || scope === quote.descrizioneGenerale} block onPress={() => void save({ descrizioneGenerale: scope.trim() }, true).then(() => setScopeOpen(false)).catch(() => undefined)} />
        </Stack>
        <Stack pt={16} />
      </Sheet>

      <Sheet open={clientOpen} onClose={() => setClientOpen(false)} label={t("quote.clientSheet.title")} closeLabel={t("close")}>
        <SheetTitle>{t("quote.clientSheet.title")}</SheetTitle>
        <Stack px={16} pt={0} gap={8}>
          <Search label={t("quote.clientSheet.search")} placeholder={t("quote.clientSheet.search")} value={clientTerm} onChangeText={setClientTerm} autoCorrect={false} />
          {pickClients.length === 0 ? <Text size={13.5} color="muted" align="center">{t("quote.clientSheet.none")}</Text> : (
            <Card><RowList>{pickClients.slice(0, 8).map((c) => (
              <Press key={c.id} onPress={() => setClient(c)} accessibilityRole="button" accessibilityLabel={c.clientName}>
                <RowBody leading={<Avatar initials={initialsOf(c.clientName)} tint={tintFor(c.clientName)} />} title={c.clientName} meta={[c.indirizzo, c.city].filter(Boolean).join(", ")} />
              </Press>
            ))}</RowList></Card>
          )}
        </Stack>
        <Stack pt={16} />
      </Sheet>

      <Sheet open={!!ask} onClose={() => setAsk(null)} label={t(ask === "sms" ? "quote.ask.titleSms" : "quote.ask.titleEmail")} closeLabel={t("close")}>
        <SheetTitle>{t(ask === "sms" ? "quote.ask.titleSms" : "quote.ask.titleEmail")}</SheetTitle>
        <Stack px={16} gap={12} pt={0}>
          <TextField label={t(ask === "sms" ? "quote.ask.phone" : "quote.ask.email")} value={dest} onChangeText={(v) => { setDest(v); setDestError(undefined); }} error={destError}
            keyboardType={ask === "sms" ? "phone-pad" : "email-address"} autoCapitalize="none" autoCorrect={false} numeric={ask === "sms"} />
          <Button label={t("quote.ask.send")} busy={sending ? t("quote.sending") : false} disabled={!dest.trim()} block onPress={() => { setChannel(ask); void sendNow(dest.trim()); }} />
        </Stack>
        <Stack pt={16} />
      </Sheet>

      <Sheet open={wonOpen} onClose={() => setWonOpen(false)} label={t("quote.confirmWon.title")} closeLabel={t("close")}>
        <SheetTitle>{t("quote.confirmWon.title")}</SheetTitle>
        <Stack px={20} pt={6} gap={16} pb={12}>
          <Text color="muted" leading={1.45}>{t("quote.confirmWon.body")}</Text>
          <Button label={t("quote.confirmWon.confirm")} busy={wonBusy && t("quote.confirmWon.confirm")} block onPress={() => { setWonBusy(true); quoteApi.markWon(quote.id).then((q) => { client.setQueryData(["quote", quote.id], q); void client.invalidateQueries({ queryKey: getListQuotesQueryKey() }); setWonOpen(false); toast({ message: t("quote.confirmWon.done") }); }).catch(() => toast({ message: t("quote.confirmWon.failed") })).finally(() => setWonBusy(false)); }} />
        </Stack>
      </Sheet>
      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} label={t("quote.more")} closeLabel={t("close")}>
        <MenuList>
          <MenuRow icon={<Icon name="pen" tone="indigo" size={28} />} title={t("quote.actions.editor")} onPress={() => { setMoreOpen(false); router.push(screenHref("QuoteEditor", t("quote.actions.editor"), { id: quote.id })); }} />
          <MenuRow icon={<Icon name="link" tone="sky" size={28} />} title={t("quote.actions.copyLink")} chevron={false} onPress={() => { setMoreOpen(false); void (Platform.OS === "web" && navigator.clipboard ? navigator.clipboard.writeText(link) : Clipboard.setStringAsync(link)).then(() => toast({ message: t("quote.actions.linkCopied") })); }} />
          <MenuRow icon={<Icon name="ruler" tone="amber" size={28} />} title={t("quote.actions.priceCheck")} onPress={() => { setMoreOpen(false); router.push(screenHref("PriceCheck", t("quote.actions.priceCheck"), { id: quote.id })); }} />
          {state !== "draft" && state !== "accepted" ? <MenuRow icon={<Icon name="check" tone="sage" size={28} />} title={t("quote.actions.markWon")} chevron={false} onPress={() => { setMoreOpen(false); setWonOpen(true); }} /> : null}
          <MenuRow icon={<Icon name="doc" tone="slate" size={28} />} title={t("quote.actions.duplicate")} chevron={false} onPress={() => { setMoreOpen(false); void quoteApi.duplicate(quote.id).then((d) => { toast({ message: t("quote.toast.duplicated") }); void client.invalidateQueries({ queryKey: getListQuotesQueryKey() }); router.replace(screenHref("Quote", t("quote.actions.editor"), { id: d.id })); }).catch(() => toast({ message: t("quote.toast.saveFailed") })); }} />
          <MenuRow icon={<Icon name="box" tone="stone" size={28} />} title={t("quote.actions.archive")} chevron={false} onPress={() => { setMoreOpen(false); void quoteApi.archive(quote.id).then(() => { toast({ message: t("quote.toast.archived") }); void client.invalidateQueries({ queryKey: getListQuotesQueryKey() }); back(); }).catch(() => toast({ message: t("quote.toast.saveFailed") })); }} />
        </MenuList>
        <Stack pt={12} />
      </Sheet>
    </Screen>
  );
}

export type { QuoteFull };
