// Invoice.dc.html. One invoice: its status line, the title and client, the balance card (paid bar; Total / Paid / Due), the customer's
// "I sent it" claim (Confirm received / Not received), the four quick actions, the lines and totals, the client's link, the payments,
// the reminders (the switch is the company's setting) and the activity; the floating bar records a payment (a sheet: amount with
// Full balance, date, reference, method, receipt) or sends the receipt; "more" opens the actions (resend, link, PDF, credit note,
// archive, void). States built: loading, can't load, not found, offline (toasts), draft, open, viewed, late, partly paid, awaiting
// confirmation, paid, void. A void invoice has no bar. Not on the board: confirm sheets for Void.
import { useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiFailure } from "@/lib/api";
import { downloadInvoicePdf } from "@/lib/invoicePdf";
import { dayDate, money, number, shortDate, time, type Locale } from "@/lib/format";
import { tintFor } from "@/lib/clients";
import { initialsOf } from "@/lib/invites";
import {
  claimedAt, eventLine, hasLink, METHOD_ICON, newestFirst, overpaidBy, parseCents, PAY_METHODS, reminderRows, reminderSummary, remindBlock, stateOf, typeKey, type PayMethod,
} from "@/lib/invoices";
import { invoicesApi, type InvoiceFull } from "@/lib/invoicesApi";
import { screenHref } from "@/lib/nav";
import { useRememberOpened } from "@/lib/recents";
import { useSession } from "@/lib/useSession";
import { ActionBar, ACTION_BAR_SPACE } from "@/ui/ActionBar";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Chip } from "@/ui/Chip";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { SelectField, TextField } from "@/ui/Field";
import { Header } from "@/ui/Header";
import { Icon } from "@/ui/Icon";
import { AmountField, BalanceCard, ChoiceField, ClaimBanner, DangerMenuRow, InvoiceLines, InvoiceTitle, LinkCard, QuickGrid, SheetSub, StatusLine, Timeline, ToggleRow, type QuickAction } from "@/ui/Invoices";
import { Section, ScrollPage, Stack } from "@/ui/Layout";
import { MenuList, MenuRow, RowBody, RowList, SectionHeader } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { Status } from "@/ui/Status";
import { Switch } from "@/ui/Switch";
import { Num, Text } from "@/ui/Text";
import type { ColorName } from "@/ui/theme";

export default function Invoice() {
  const { t: tr, i18n } = useTranslation();
  /** This screen's strings are under `invoices.`. */
  const t = (k: string, o?: Record<string, unknown>) => tr(`invoices.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { id, pay } = useLocalSearchParams<{ id?: string; pay?: string }>();
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const toast = useToast();
  const client = useQueryClient();
  const q = useQuery({ queryKey: ["invoice", id], queryFn: () => invoicesApi.get(id!), enabled: signedIn && !!id, retry: 1, staleTime: 15_000 });
  const settings = useQuery({ queryKey: ["invoice-settings"], queryFn: invoicesApi.settings, enabled: signedIn, retry: false, staleTime: 60_000 });
  const [sheet, setSheet] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PayMethod>("etransfer");
  const [reference, setReference] = useState("");
  const [emailReceipt, setEmailReceipt] = useState(true);
  const [saving, setSaving] = useState(false);
  const [claimDenied, setClaimDenied] = useState(false);
  const [recorded, setRecorded] = useState<{ amount: number; method: string; receipt: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const [reminded, setReminded] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [remOn, setRemOn] = useState<boolean | null>(null);
  const [autoOpened, setAutoOpened] = useState(false);
  const data = q.data;
  useRememberOpened(data ? { type: "invoices", id: data.invoice.id, title: data.invoice.number, sub: data.invoice.clientName ?? data.invoice.customer?.name ?? "" } : null);
  const inv = data?.invoice;

  const balance = inv?.balanceCents ?? 0;
  const owing = !!inv && balance > 0 && inv.status !== "draft" && inv.status !== "void";
  const nameOf = (i: InvoiceFull) => i.customer.name || i.clientName || i.number;
  const amt = (cents: number) => number(cents / 100, locale, 2);

  const openPay = (opts?: { claim?: boolean }) => {
    if (!inv) return;
    setAmount(amt(balance));
    setMethod("etransfer");
    setReference(opts?.claim ? nameOf(inv) : "");
    setEmailReceipt(!!(inv.customer.email ?? "").includes("@"));
    setMenu(false);
    setSheet(true);
  };
  // From the list's "Got paid": land with the payment sheet open.
  useEffect(() => {
    if (pay === "1" && inv && !autoOpened && owing) { setAutoOpened(true); openPay(); }
  }, [pay, inv, owing, autoOpened]); // eslint-disable-line react-hooks/exhaustive-deps

  const now = useMemo(() => new Date(), [q.dataUpdatedAt]);

  if (status === "out") return <Redirect href="/" />;
  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("Invoices", t("title"))));
  const header = (number?: string, more?: () => void) => <Header title={number ?? ""} subtle backLabel={t("back")} onBack={back} moreLabel={t("head.moreLabel")} onMore={more} />;

  if (q.isError && !inv) {
    const notFound = q.error instanceof ApiFailure && q.error.status === 404;
    return <Screen>{header()}<Section pt={26} px={16}>{notFound
      ? <Empty icon="receipt" iconTone="slate" title={t("notFound.title")} body={t("notFound.body")} action={t("back")} actionKind="secondary" onAction={back} />
      : <Empty icon="warn" iconTone="clay" title={t("loadFailed.title")} body={t("loadFailed.body")} action={t("loadFailed.retry")} onAction={() => void q.refetch()} />}</Section></Screen>;
  }
  if (!inv || !data) return <Screen>{header()}<Section pt={8} px={16} gap={12}><Skeleton height={150} radius={22} /><Skeleton height={130} radius={22} /><Skeleton height={84} radius={22} /><Skeleton height={220} radius={22} /></Section></Screen>;

  const m = (cents: number) => money(cents / 100, locale);
  const s = stateOf(inv, now);
  const name = nameOf(inv);
  const first = name.trim().split(/\s+/)[0] ?? name;
  const email = (inv.customer.email ?? "").trim();
  const closed = inv.status === "void";
  const draft = inv.status === "draft";
  const paid = inv.status === "paid";
  const pct = locale === "fr-CA" ? " %" : "%";
  const when = (iso: string) => {
    const at = new Date(iso);
    return at.toDateString() === now.toDateString() ? time(at, locale) : shortDate(at, locale);
  };
  const refresh = () => { void client.invalidateQueries({ queryKey: ["invoice", id] }); void client.invalidateQueries({ queryKey: ["invoices"] }); };
  const failure = (e: unknown) => {
    const f = e instanceof ApiFailure ? e : null;
    if (f?.offline) return toast({ message: t("done.offline") });
    if (f?.status === 403) return toast({ message: f.code === "PLAN_REQUIRED" ? t("done.unlock") : t("done.noAccess") });
    if (f?.code === "CUSTOMER_EMAIL_MISSING") return toast({ message: t("done.noEmail", { name }) });
    toast({ message: t("done.failed") });
  };
  /** One call at a time; `then` runs on success. */
  const work = (key: string, call: () => Promise<unknown>, then: () => void) => {
    if (working) return;
    setWorking(key);
    call().then(() => { then(); refresh(); }).catch(failure).finally(() => setWorking(null));
  };

  const link = data.publicUrl;
  const copy = async () => {
    if (!link) return toast({ message: t("toast.noLink") });
    try { if (Platform.OS === "web" && navigator.clipboard) await navigator.clipboard.writeText(link); else await Clipboard.setStringAsync(link); setCopied(true); toast({ message: t("toast.linkCopied") }); } catch { toast({ message: t("done.failed") }); }
  };
  const remind = () => {
    const block = remindBlock(inv, now);
    if (block === "noEmail") return toast({ message: t("done.noEmail", { name }) });
    if (block === "recent") return toast({ message: t("done.recent") });
    work("remind", () => invoicesApi.remind(inv.id), () => { setReminded(true); toast({ message: t("done.reminded") }); });
  };
  const send = () => work("send", () => invoicesApi.send(inv.id), () => { setDone(t("primary.sent", { name: first })); toast({ message: draft ? t("done.sent") : t("toast.resent") }); });
  const receipt = () => work("receipt", () => invoicesApi.receipt(inv.id), () => { setDone(t("done.receipt")); toast({ message: t("done.receipt") }); });
  const pdf = () => {
    if (working) return;
    setWorking("pdf");
    downloadInvoicePdf(inv.id, inv.number).catch(() => toast({ message: t("toast.pdfFailed") })).finally(() => setWorking(null));
  };
  const creditNote = () => router.push(screenHref("CreditNote", t("soon.credit"), { id: inv.id }));

  const typeLabel = inv.type === "progress" && inv.paymentTermLabel ? inv.paymentTermLabel : t(`type.${typeKey(inv.type)}`);
  const sub = [inv.projectName, inv.title && inv.title !== typeLabel ? inv.title : null].filter(Boolean).join(" · ");
  const place = [inv.siteAddress || inv.customer.address, inv.customer.city].filter(Boolean).join(", ");

  const l = (k: string, o?: Record<string, unknown>) => t(`head.line.${k}`, o);
  const viewedPart = inv.viewedAt ? [l("viewed", { date: shortDate(new Date(inv.viewedAt), locale) })] : [];
  const line: { text: string; dot: ColorName } = (() => {
    if (paid) return { text: l("paidOn", { date: shortDate(new Date(inv.paidAt ?? inv.dueDate), locale) }), dot: "ok-dot" };
    if (closed) return { text: l("void"), dot: "faint" };
    if (draft) return { text: s.kind === "scheduled" ? l("scheduled", { date: shortDate(new Date(inv.autoSendAt ?? inv.scheduledFor ?? inv.dueDate), locale) }) : l("draft"), dot: "faint" };
    if (s.kind === "late") return { text: (inv.status === "partially_paid" ? [l("partly"), l("partlyLate", { count: s.late })] : [l("overdue"), ...(s.late > 0 ? [l("days", { count: s.late })] : []), ...viewedPart]).join(" · "), dot: inv.status === "partially_paid" ? "warn-dot" : "bad" };
    if (inv.status === "pending_confirmation") return { text: l("awaiting"), dot: "warn-dot" };
    if (inv.status === "partially_paid") return { text: l("partly"), dot: "warn-dot" };
    if (inv.status === "viewed") return { text: inv.viewedAt ? l("viewedOn", { date: shortDate(new Date(inv.viewedAt), locale) }) : l("sentOn", { date: shortDate(new Date(inv.sentAt ?? inv.issueDate), locale) }), dot: "acc" };
    return { text: l("sentOn", { date: shortDate(new Date(inv.sentAt ?? inv.issueDate), locale) }), dot: "info" };
  })();
  const pillText = s.word === "late" ? (inv.status === "partially_paid" ? t("status.partially_paid") : t("status.overdue")) : s.word === "scheduled" ? t("status.scheduled", { date: shortDate(new Date(inv.autoSendAt ?? inv.scheduledFor ?? inv.dueDate), locale) }) : t(`status.${s.word}`);
  const pillLook = s.word === "late" && inv.status === "partially_paid" ? { tone: "warn" as const, shape: "q3" as const } : s.look;

  const split = (cents: number) => { const v = m(cents); const k = v.search(/[.,]\d\d(?: \$)?$/); return k > 0 ? ([v.slice(0, k), v.slice(k)] as const) : ([v, ""] as const); };
  const [balWhole, balCents] = split(balance);

  const claiming = inv.status === "pending_confirmation" && balance > 0;
  const claimTime = claimedAt(data.events);
  const claimWhen = claimTime ? (claimTime.toDateString() === now.toDateString() ? t("claim.today", { time: time(claimTime, locale) }) : `${shortDate(claimTime, locale)} · ${time(claimTime, locale)}`) : t("claim.today", { time: "" }).replace(/[,\s]+$/, "");

  const quick: QuickAction[] = [
    { key: "resend", label: draft ? t("actions.send") : t("quick.resend"), icon: "send", tone: "violet", onPress: send, busy: paid || closed || working === "send" },
    { key: "remind", label: reminded ? t("quick.reminded") : t("quick.remind"), icon: "bell", tone: "amber", onPress: remind, busy: !owing || reminded || working === "remind" },
    { key: "pdf", label: t("quick.pdf"), icon: "doc", tone: "azure", onPress: pdf, busy: working === "pdf" },
    { key: "credit", label: t("quick.credit"), icon: "receipt", tone: "rose", onPress: creditNote },
  ];

  const lineRows = inv.lines.map((ln, i) => ({
    key: String(i), name: ln.description, amount: m(ln.amountCents),
    detail: ln.quantity !== 1 ? t("lines.detail", { quantity: number(ln.quantity, locale, ln.quantity % 1 ? 2 : 0), unit: m(ln.unitCents) }) : undefined,
  }));
  const totals = [
    { label: t("lines.subtotal"), value: m(inv.subtotalCents) },
    ...(inv.holdbackCents > 0 ? [{ label: t("lines.holdback", { percent: `${inv.holdbackPercent ?? ""}${pct}` }), value: `−${m(inv.holdbackCents)}` }] : []),
    ...(inv.taxLines.length ? inv.taxLines.map((x) => ({ label: x.label, value: m(x.amountCents) })) : inv.taxCents > 0 ? [{ label: t("lines.tax"), value: m(inv.taxCents) }] : []),
  ];

  const methodName = (k: string) => (k in METHOD_ICON || k === "credit_note" ? t(`pays.methods.${k}`) : t("pays.methods.other"));
  const payments = data.payments;

  const reminderOn = remOn ?? settings.data?.automationSettings.invoiceReminders ?? true;
  const rems = reminderRows(inv, data.reminderDays, reminderOn);
  const remSum = reminderSummary(rems, inv.status);
  const remLabel = remSum.kind === "next" ? t("rem.next", { date: shortDate(remSum.at, locale) }) : t(`rem.${remSum.kind}`);
  const flipReminders = (v: boolean) => {
    setRemOn(v);
    invoicesApi.setReminders(v).then(() => void client.invalidateQueries({ queryKey: ["invoice-settings"] })).catch((e: unknown) => { setRemOn(null); const f = e instanceof ApiFailure ? e : null; toast({ message: f?.status === 403 ? t("done.noAccess") : f?.offline ? t("done.offline") : t("rem.saveFailed") }); });
  };

  const events = newestFirst(data.events).map((e) => {
    const x = eventLine(e);
    const method2 = x.method ? methodName(x.method) : "";
    const o = { name: first, to: x.to ?? "", amount: x.amountCents != null ? m(x.amountCents) : "", method: method2, number: x.number ?? inv.number };
    const k = `activity.${x.key}`;
    const needsTo = ["sent", "resent", "auto_sent", "receipt_sent"].includes(x.key);
    const sk = x.key === "reminder_sent" && x.manual ? `${k}.sManual` : `${k}.s`;
    const subText = needsTo && !x.to ? "" : x.key === "payment_recorded" && !x.amountCents ? "" : t(sk, o);
    return { key: e.id, text: t(`${k}.t`, o), when: when(e.createdAt), sub: subText || undefined };
  });

  const amountCents = parseCents(amount);
  const over = overpaidBy(balance, amountCents);
  const savePay = async () => {
    if (amountCents <= 0 || saving) return;
    setSaving(true);
    try {
      await invoicesApi.pay(inv.id, { amountCents, method, reference: reference.trim() || undefined, sendReceipt: emailReceipt && !!email });
      setSheet(false);
      setRecorded({ amount: amountCents, method, receipt: emailReceipt && !!email });
      setClaimDenied(false);
      refresh();
    } catch (e) { failure(e); } finally { setSaving(false); }
  };

  const primary = closed ? null : draft
    ? { label: t("primary.send"), run: send, done: false }
    : paid
      ? { label: t("primary.sendReceipt"), run: receipt, done: false }
      : { label: t("primary.recordPayment"), run: () => openPay(), done: false };
  const recordedLead = recorded ? t("recorded.lead", { amount: m(recorded.amount), method: methodName(recorded.method) }) : "";
  const recordedBody = recorded ? `${t("recorded.body")}${recorded.receipt ? ` · ${t("recorded.receipt", { name: first })}` : ""}` : "";

  const cells = [
    { label: t("balance.total"), value: m(inv.totalCents) },
    { label: t("balance.paid"), value: m(inv.paidCents), color: inv.paidCents > 0 ? ("ok" as const) : undefined },
    { label: t("balance.due"), value: shortDate(new Date(inv.dueDate), locale) },
  ];

  return (
    <Screen floating={primary ? (
      <ActionBar label={done && !working ? done : primary.label} done={!!done} busy={!!working && (working === "send" || working === "receipt")} onPress={primary.run} moreLabel={t("head.moreLabel")} onMore={() => setMenu(true)} />
    ) : undefined}>
      {header(inv.number, closed ? undefined : () => setMenu(true))}
      <ScrollPage bottom={primary ? ACTION_BAR_SPACE : 44}>
        <Section px={20} pt={8}>
          <StatusLine dot={line.dot}>{line.text}</StatusLine>
          <InvoiceTitle title={typeLabel} sub={sub || undefined} />
          <Stack row align="center" gap={10} mt={14}>
            <Avatar initials={initialsOf(name)} tint={tintFor(name)} size={32} />
            <Stack grow>
              <Text size={14.5} weight={500} numberOfLines={1}>{name}</Text>
              {place ? <Text size={12.5} color="muted" numberOfLines={1}>{place}</Text> : null}
            </Stack>
          </Stack>
        </Section>
        <Section delay={50} pt={18} px={16}>
          <BalanceCard label={t("balance.label")} whole={balWhole} cents={balCents} status={<Status tone={pillLook.tone} shape={pillLook.shape}>{pillText}</Status>}
            paidValue={inv.totalCents > 0 ? inv.paidCents / inv.totalCents : 0} bar={t("balance.paidBar", { paid: m(inv.paidCents), total: m(inv.totalCents) })} cells={cells} />
        </Section>
        {claiming && !claimDenied ? (
          <Section delay={80} pt={12} px={16}>
            <ClaimBanner before={t("claim.before")} amount={m(balance)} by={t("claim.by")} sub={t("claim.sub", { name, when: claimWhen })} confirm={t("claim.confirm")} deny={t("claim.deny")}
              onConfirm={() => openPay({ claim: true })} onDeny={() => work("deny", () => invoicesApi.rejectEtransfer(inv.id), () => setClaimDenied(true))} />
          </Section>
        ) : null}
        {claimDenied && !claiming ? (
          <Section pt={12} px={16}><Banner tone="info" icon="send" iconTone="violet" lead={t("claim.denied")}>{t("claim.deniedBody")}</Banner></Section>
        ) : null}
        {recorded ? (
          <Section pt={12} px={16}><Banner tone="ok" icon="check" iconTone="sage" lead={recordedLead}>{recordedBody}</Banner></Section>
        ) : null}
        <Section delay={110} pt={14} px={16}><QuickGrid items={quick} /></Section>
        <Section delay={140} pt={22} px={16}>
          <SectionHeader title={t("lines.title")} link={inv.projectName ? t("lines.fromJob", { job: inv.projectName }) : undefined} />
          {lineRows.length ? <InvoiceLines lines={lineRows} totals={totals} totalLabel={t("lines.total")} total={m(inv.totalCents)} />
            : <Card padded><Text size={13.5} color="muted">{t("lines.none")}</Text></Card>}
        </Section>
        {hasLink(inv) && link ? (
          <Section delay={160} pt={12} px={16}>
            <LinkCard title={t("link.title")} sub={inv.viewedAt ? t("link.opened", { date: shortDate(new Date(inv.viewedAt), locale) }) : t("link.notOpened")} button={copied ? t("link.copied") : t("link.copy")} onPress={() => void copy()} />
          </Section>
        ) : null}
        <Section delay={180} pt={22} px={16}>
          <SectionHeader title={t("pays.title")} link={t("pays.of", { paid: m(inv.paidCents), total: m(inv.totalCents) })} />
          <Card>
            {payments.length ? (
              <RowList>
                {payments.map((p) => {
                  const ic = METHOD_ICON[p.creditNoteId ? "other" : p.method] ?? METHOD_ICON.other!;
                  return <RowBody key={p.id} leading={<Icon name={ic.name} tone={ic.tone} size={26} />} title={methodName(p.creditNoteId ? "credit_note" : p.method)}
                    meta={[dayDate(new Date(p.date), locale), p.reference].filter(Boolean).join(" · ")} trailing={<Num size={14.5} weight={600}>{m(p.amountCents)}</Num>} />;
                })}
              </RowList>
            ) : (
              <Stack row align="center" gap={12} px={16} pt={18} pb={18}>
                <Icon name="card" tone="slate" size={26} />
                <Text size={13.5} color="muted">{t("pays.none")}</Text>
              </Stack>
            )}
          </Card>
        </Section>
        <Section delay={200} pt={22} px={16}>
          <SectionHeader title={t("rem.title")} link={remLabel} />
          <Card>
            <RowList>
              <RowBody title={t("rem.auto")} meta={settings.data?.automationSettings.smsReminders ? t("rem.autoSubSms", { company: inv.contractor.name || "" }) : t("rem.autoSub", { company: inv.contractor.name || "" })}
                trailing={<Switch value={reminderOn} onChange={flipReminders} label={t("rem.auto")} />} />
              {rems.map((r) => (
                <RowBody key={r.days} title={t("rem.when", { count: r.days })} meta={shortDate(r.at, locale)}
                  trailing={<Status tone={r.state === "sent" || r.state === "scheduled" ? "info" : "mute"}>{t(`rem.state.${r.state}`)}</Status>} />
              ))}
            </RowList>
          </Card>
        </Section>
        <Section delay={220} pt={22} px={16}>
          <SectionHeader title={t("activity.title")} />
          <Timeline events={events} />
        </Section>
      </ScrollPage>

      <Sheet open={sheet} onClose={() => setSheet(false)} label={t("sheet.title")} closeLabel={t("sheet.close")}>
        <SheetTitle>{t("sheet.title")}</SheetTitle>
        <Stack px={16} gap={14} pt={0}>
          <SheetSub>{t("sheet.sub", { number: inv.number, amount: m(balance) })}</SheetSub>
          <AmountField label={t("sheet.amount")} value={amount} onChangeText={setAmount} chip={t("sheet.fullBalance")} onChip={() => setAmount(amt(balance))} over={over > 0} prefix="$"
            error={undefined} />
          {over > 0 ? <Banner tone="warn" icon="warn" iconTone="amber" lead={t("sheet.overLead", { amount: m(over) })}>{t("sheet.overBody", { name })}</Banner> : null}
          <Stack row gap={10}>
            <Stack grow><SelectField label={t("sheet.date")} value={new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(now)} chevron={false} mono /></Stack>
            <Stack grow><TextField label={t("sheet.reference")} placeholder={t("sheet.optional")} value={reference} onChangeText={setReference} /></Stack>
          </Stack>
          <ChoiceField label={t("sheet.method")}>
            {PAY_METHODS.map((k) => <Chip key={k} label={t(`pays.methods.${k}`)} selected={method === k} onPress={() => setMethod(k)} />)}
          </ChoiceField>
          <ToggleRow title={t("sheet.receipt")} sub={email ? t("sheet.receiptTo", { email }) : t("sheet.receiptNone")}>
            <Switch value={emailReceipt && !!email} onChange={setEmailReceipt} label={t("sheet.receipt")} disabled={!email} />
          </ToggleRow>
          <Button size="lg" block label={amountCents > 0 ? t("sheet.save", { amount: m(amountCents) }) : t("sheet.enter")} disabled={amountCents <= 0} busy={saving ? t("sheet.saving") : false} onPress={() => void savePay()} />
        </Stack>
        <Stack pt={16} />
      </Sheet>

      <Sheet open={menu} onClose={() => setMenu(false)} label={t("head.moreLabel")} closeLabel={tr("close")}>
        <MenuList>
          {!paid ? <MenuRow icon={<Icon name="send" tone="violet" size={28} />} title={draft ? t("actions.send") : t("menu.resend")} sub={t("menu.resendSub", { name })} chevron={false} onPress={() => { setMenu(false); send(); }} /> : null}
          <MenuRow icon={<Icon name="link" tone="azure" size={28} />} title={t("menu.copyLink")} sub={t("menu.copyLinkSub")} chevron={false} onPress={() => { setMenu(false); void copy(); }} />
          <MenuRow icon={<Icon name="doc" tone="azure" size={28} />} title={t("menu.pdf")} sub={`${inv.number}.pdf`} chevron={false} onPress={() => { setMenu(false); pdf(); }} />
          <MenuRow icon={<Icon name="receipt" tone="rose" size={28} />} title={t("menu.credit")} sub={t("menu.creditSub", { name })} onPress={() => { setMenu(false); creditNote(); }} />
          <MenuRow icon={<Icon name="box" tone="stone" size={28} />} title={t("menu.archive")} sub={t("menu.archiveSub")} chevron={false}
            onPress={() => { setMenu(false); work("archive", () => invoicesApi.archive(inv.id), () => { toast({ message: t("toast.archived") }); router.canGoBack() ? router.back() : router.replace(screenHref("Invoices", t("title"))); }); }} />
          <DangerMenuRow icon={<Icon name="warn" tone="clay" size={28} />} title={t("menu.void")} sub={t("menu.voidSub")} onPress={() => { setMenu(false); setConfirmVoid(true); }} />
        </MenuList>
        <Stack pt={12} />
      </Sheet>

      <Sheet open={confirmVoid} onClose={() => setConfirmVoid(false)} label={t("confirmVoid.title")} closeLabel={tr("close")}>
        <SheetTitle>{t("confirmVoid.title")}</SheetTitle>
        <Stack px={16} gap={12} pt={0}>
          <Text size={14.5} color="t2" leading={1.45}>{t("confirmVoid.body", { number: inv.number })}</Text>
          <Button kind="destructive" block label={t("confirmVoid.action")} busy={working === "void" ? t("sheet.saving") : false}
            onPress={() => work("void", () => invoicesApi.void(inv.id), () => { setConfirmVoid(false); toast({ message: t("toast.voided") }); })} />
          <Button kind="secondary" block label={t("confirmVoid.cancel")} onPress={() => setConfirmVoid(false)} />
        </Stack>
        <Stack pt={16} />
      </Sheet>
    </Screen>
  );
}
