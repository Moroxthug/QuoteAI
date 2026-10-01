// Invoices.dc.html. The list opened from Menu: "Outstanding" (an expandable card: the figure, the aging bar and its five buckets;
// open, who owes you oldest first, three figures, Remind all; always, Paid this month and Drafts), search, filter chips, then the
// invoices in Overdue / Waiting on payment / Drafts and scheduled / Paid this month, each row expanding in place and swiping for
// two quick actions. States built: list, no match (the board's empty), no invoices at all, loading, can't load, offline.
// Not on the board but needed by real data: groups "Paid earlier" and "Void". The board's "Job 64% done" / "Pays in 14 days" and the
// "Delivered" marks need data the server does not give the list, so those lines are left out (see lib/invoices.ts).
import { useMemo, useState, type ReactElement, type ReactNode } from "react";
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiFailure } from "@/lib/api";
import { money, shortDate, type Locale } from "@/lib/format";
import { initialsOf } from "@/lib/invites";
import { tintFor } from "@/lib/clients";
import {
  aging, bucketOf, BUCKET_ORDER, draftsTotal, FILTER_ORDER, groupOf, groupTotal, GROUP_ORDER, kindOf, matchesFilter, matchesSearch, mainAction, openByUrgency, outstandingCents, overdueCents, paidThisMonth, payStats,
  remindable, remindBlock, scheduledAt, stateOf, swipeActions, typeKey, type AgingBucket, type InvoiceAction, type InvoiceDto, type InvoiceFilter, type InvoiceGroup, type InvoiceKind,
} from "@/lib/invoices";
import { invoicesApi } from "@/lib/invoicesApi";
import { screenHref } from "@/lib/nav";
import { useSession } from "@/lib/useSession";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Chip, ChipStrip } from "@/ui/Chip";
import { ExpandCard, ExpandScrollView, XcActions, XcButton, XcCaption, XcDivider, XcRow, useExpandOpen } from "@/ui/Expand";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { Header, PageTitle } from "@/ui/Header";
import { Glyph, Icon } from "@/ui/Icon";
import { AgingBar, AgingLegend, FootStats, LIST_BOTTOM, Outstanding, type AgingSegment } from "@/ui/Invoices";
import { Section, Stack } from "@/ui/Layout";
import { MiniFigures } from "@/ui/Numbers";
import { MenuList, MenuRow, RowBody, RowList, SectionHeader, SwipeHint } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Search } from "@/ui/Search";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { Status } from "@/ui/Status";
import { SwipeRow, type SwipeAction } from "@/ui/SwipeRow";
import { Num, Text } from "@/ui/Text";

const BUCKET_LOOK: Record<AgingBucket, Pick<AgingSegment, "tone" | "dim">> = {
  current: { tone: "ok" }, d1_30: { tone: "warn" }, d31_60: { tone: "bad" }, d61_90: { tone: "bad", dim: 0.78 }, d90_plus: { tone: "bad", dim: 0.58 },
};
const ACTION_ICON: Record<InvoiceAction, { icon: SwipeAction["icon"]; iconTone: SwipeAction["iconTone"]; tone: SwipeAction["tone"] }> = {
  remind: { icon: "bell", iconTone: "azure", tone: "info" },
  gotPaid: { icon: "bank", iconTone: "sage", tone: "ok" },
  send: { icon: "send", iconTone: "azure", tone: "info" },
  delete: { icon: "warn", iconTone: "rose", tone: "bad" },
  sendNow: { icon: "send", iconTone: "azure", tone: "info" },
  edit: { icon: "pen", iconTone: "slate", tone: "mute" },
  sendReceipt: { icon: "receipt", iconTone: "amber", tone: "mute" },
  archive: { icon: "box", iconTone: "stone", tone: "mute" },
};

/** What a row shows after you act on it, until the list reloads. */
type Acted = { word: string; tone: "ok" | "info" | "mute"; shape: "check" | "q1" | "off" };

export default function Invoices() {
  const { t: tr, i18n } = useTranslation();
  /** This screen's strings are under `invoices.`. */
  const t = (k: string, o?: Record<string, unknown>) => tr(`invoices.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const toast = useToast();
  const client = useQueryClient();
  const insets = useSafeAreaInsets();
  const q = useQuery({ queryKey: ["invoices"], queryFn: invoicesApi.list, enabled: signedIn, retry: 1, staleTime: 15_000 });
  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState<InvoiceFilter>("all");
  const [swiped, setSwiped] = useState<string | null>(null);
  const [acted, setActed] = useState<Record<string, Acted>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [remindedAll, setRemindedAll] = useState(0);
  const [deleting, setDeleting] = useState<InvoiceDto | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const items = q.data?.items;
  const now = useMemo(() => new Date(), [q.dataUpdatedAt]);

  const rows = useMemo(() => (items ?? []).map((i) => ({ i, kind: kindOf(i, now) })), [items, now]);
  const shown = useMemo(() => rows.filter((r) => matchesFilter(r.kind, filter) && matchesSearch(r.i, term)), [rows, filter, term]);
  const groups = useMemo(() => GROUP_ORDER.map((g) => {
    const list = shown.filter((r) => groupOf(r.i, now) === g).map((r) => r.i);
    return { key: g, list, total: groupTotal(g, list) };
  }).filter((g) => g.list.length), [shown, now]);

  if (status === "out") return <Redirect href="/" />;

  const all = items ?? [];
  const m = (cents: number, withCents = true) => money(cents / 100, locale, { cents: withCents });
  const d = (iso: string) => shortDate(new Date(iso), locale);
  const open = (i: InvoiceDto, extra?: Record<string, string>) => router.push(screenHref("Invoice", t("title"), { id: i.id, ...extra }));
  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("Menu", tr("menu.rows.invoices.label"))));
  const dunning = () => router.push(screenHref("Dunning", t("soon.dunning")));
  const newInvoice = () => router.push(screenHref("NewInvoice", t("soon.newInvoice")));
  const refresh = () => client.invalidateQueries({ queryKey: ["invoices"] });
  const nameOf = (i: InvoiceDto) => i.clientName || i.customer.name || i.number;

  const failure = (e: unknown, i?: InvoiceDto) => {
    const f = e instanceof ApiFailure ? e : null;
    if (f?.offline) return toast({ message: t("done.offline") });
    if (f?.status === 403) return toast({ message: f.code === "PLAN_REQUIRED" ? t("done.unlock") : t("done.noAccess") });
    if (f?.code === "CUSTOMER_EMAIL_MISSING" && i) return toast({ message: t("done.noEmail", { name: nameOf(i) }) });
    toast({ message: t("done.failed") });
  };
  /** One call at a time per invoice; marks the row with what happened. */
  const act = (i: InvoiceDto, call: () => Promise<unknown>, ok: { toast: string; look?: Acted; undo?: () => void }) => {
    if (busy[i.id]) return;
    setBusy((b) => ({ ...b, [i.id]: true }));
    call().then(() => {
      if (ok.look) setActed((a) => ({ ...a, [i.id]: ok.look! }));
      toast({ message: ok.toast, action: ok.undo ? t("done.undo") : undefined, onAction: ok.undo });
      void refresh();
    }).catch((e: unknown) => failure(e, i)).finally(() => setBusy((b) => ({ ...b, [i.id]: false })));
  };

  const remind = (i: InvoiceDto) => {
    const block = remindBlock(i, now);
    if (block === "noEmail") return toast({ message: t("done.noEmail", { name: nameOf(i) }) });
    if (block === "recent") return toast({ message: t("done.recent") });
    act(i, () => invoicesApi.remind(i.id), { toast: t("done.reminded"), look: { word: t("done.reminded"), tone: "info", shape: "q1" } });
  };
  const send = (i: InvoiceDto) => act(i, () => invoicesApi.send(i.id), { toast: t("done.sent"), look: { word: t("status.sent"), tone: "info", shape: "q1" } });
  const archive = (i: InvoiceDto) => act(i, () => invoicesApi.archive(i.id), {
    toast: t("done.archived"), look: { word: t("done.archived"), tone: "mute", shape: "off" },
    undo: () => { void invoicesApi.restore(i.id).then(() => { setActed((a) => { const n = { ...a }; delete n[i.id]; return n; }); void refresh(); }).catch((e: unknown) => failure(e, i)); },
  });
  const receipt = (i: InvoiceDto) => act(i, () => invoicesApi.receipt(i.id), { toast: t("done.receipt"), look: { word: t("done.receipt"), tone: "ok", shape: "check" } });
  const sendAll = async () => {
    const list = remindable(all, now);
    if (!list.length) return toast({ message: t("done.nobody") });
    let n = 0;
    for (const i of list) { try { await invoicesApi.remind(i.id); n++; } catch (e) { if (n === 0) { failure(e, i); return; } } }
    setRemindedAll(n);
    toast({ message: t("done.remindedMany", { count: n }) });
    void refresh();
  };

  const run = (a: InvoiceAction, i: InvoiceDto) => {
    setSwiped(null);
    switch (a) {
      case "remind": return remind(i);
      case "gotPaid": return open(i, { pay: "1" });
      case "send": case "sendNow": return send(i);
      case "delete": return setDeleting(i);
      case "edit": return router.push(screenHref("InvoiceEdit", t("soon.edit"), { id: i.id }));
      case "sendReceipt": return receipt(i);
      case "archive": return archive(i);
    }
  };
  const swipesFor = (i: InvoiceDto, kind: InvoiceKind): SwipeAction[] => swipeActions(kind).map((a) => ({ key: a, label: t(`actions.${a}`), ...ACTION_ICON[a], onPress: () => run(a, i) }));

  const wordOf = (i: InvoiceDto): { text: string; tone: Parameters<typeof Status>[0]["tone"]; shape: Parameters<typeof Status>[0]["shape"] } => {
    const a = acted[i.id];
    if (a) return { text: a.word, tone: a.tone, shape: a.shape };
    const s = stateOf(i, now);
    const sched = scheduledAt(i, now);
    const text = s.word === "late" ? (s.late > 0 ? t("status.late", { count: s.late }) : t("status.overdue")) : s.word === "scheduled" ? t("status.scheduled", { date: sched ? shortDate(sched, locale) : "" }) : t(`status.${s.word}`);
    return { text, tone: s.look.tone, shape: s.look.shape };
  };
  const typeLabel = (i: InvoiceDto) => (i.type === "progress" && i.paymentTermLabel ? i.paymentTermLabel : t(`type.${typeKey(i.type)}`));
  const datesOf = (i: InvoiceDto, kind: InvoiceKind) => {
    const due = d(i.dueDate);
    if (kind === "paid") return t("dates.issuedPaid", { issued: d(i.issueDate), paid: i.paidAt ? d(i.paidAt) : due });
    if (kind === "void") return t("dates.voided", { date: d(i.voidedAt ?? i.createdAt ?? i.issueDate) });
    if (kind === "draft") return t("dates.createdDue", { created: d(i.createdAt ?? i.issueDate), due });
    if (kind === "scheduled") return i.holdbackPercent ? t("dates.heldDue", { percent: `${i.holdbackPercent}${locale === "fr-CA" ? " %" : "%"}`, due }) : t("dates.createdDue", { created: d(i.createdAt ?? i.issueDate), due });
    return t("dates.issuedDue", { issued: d(i.issueDate), due });
  };

  const mainFor = (i: InvoiceDto, kind: InvoiceKind): { label: string; onPress: () => void; done: boolean } | null => {
    const a = mainAction(kind);
    if (!a) return null;
    const a2 = acted[i.id];
    const label = a === "gotPaid" ? t("actions.recordPayment") : a === "edit" ? t("actions.edit") : t(`actions.${a}`);
    return { label: a2 ? a2.word : label, onPress: () => run(a, i), done: !!a2 };
  };

  const num = (i: InvoiceDto) => <Num size={14.5} weight={600}>{m(i.totalCents)}</Num>;
  const stat = (i: InvoiceDto, kind: InvoiceKind) => {
    const s = stateOf(i, now);
    if (kind === "late") return [{ label: t("detail.stat.balance"), value: m(i.balanceCents, false) }, { label: t("detail.stat.late"), value: t("detail.days", { count: s.late }) }, { label: t("detail.stat.reminders"), value: String(i.reminderCount) }];
    if (kind === "open" && i.paidCents > 0) {
      const left = Math.max(0, Math.ceil((new Date(i.dueDate).getTime() - now.getTime()) / 86_400_000));
      return [{ label: t("detail.stat.paid"), value: `${Math.round((i.paidCents / Math.max(1, i.totalCents)) * 100)}${locale === "fr-CA" ? " %" : "%"}` }, { label: t("detail.stat.dueIn"), value: t("detail.days", { count: left }) }, { label: t("detail.stat.reminders"), value: String(i.reminderCount) }];
    }
    return [];
  };
  const detail = (i: InvoiceDto, kind: InvoiceKind): ReactElement[] => {
    const out: ReactElement[] = [];
    const add = (key: string, title: string, sub?: string, right?: ReactNode) => out.push(<XcRow key={key} first={out.length === 0} title={title} sub={sub} right={right} />);
    const email = (i.customer.email ?? "").trim();
    if (kind === "draft") {
      add("created", t("detail.created", { date: d(i.createdAt ?? i.issueDate) }), t("detail.createdSub"), <Status plain tone="mute" shape="draft">{t("detail.notSent")}</Status>);
      add("due", t("detail.dueRow", { date: d(i.dueDate) }), t("detail.dueRowSub"));
    } else if (kind === "scheduled") {
      const at = scheduledAt(i, now);
      add("sends", t("detail.sends", { date: at ? shortDate(at, locale) : "" }), t("detail.sendsSub"), <Status plain tone="info" shape="clock">{t("status.scheduled", { date: at ? shortDate(at, locale) : "" })}</Status>);
      add("due", t("detail.dueRow", { date: d(i.dueDate) }), t("detail.dueRowSub"));
    } else if (kind === "void") {
      add("void", t("detail.voidedRow", { date: d(i.voidedAt ?? i.issueDate) }), undefined, <Status plain tone="mute" shape="off">{t("status.void")}</Status>);
    } else {
      if (i.sentAt) add("sent", t("detail.sent", { date: d(i.sentAt) }), email ? t("detail.sentTo", { email }) : t("detail.sentBy"));
      if (kind === "paid") {
        add("paid", t("detail.paidFull"), t("detail.paidFullSub", { date: i.paidAt ? d(i.paidAt) : "" }), <><Num size={14.5} weight={600}>{m(i.totalCents)}</Num><Status plain tone="ok" shape="check">{t("status.paid")}</Status></>);
      } else {
        if (i.viewedAt) add("viewed", t("detail.viewed", { date: d(i.viewedAt) }), t("detail.viewedSub"), <Status plain tone="acc" shape="q2">{t("status.viewed")}</Status>);
        if (i.reminderCount > 0) add("rem", t("detail.reminders", { count: i.reminderCount }), i.lastReminderAt ? t("detail.remindersSub", { date: d(i.lastReminderAt) }) : undefined);
        if (i.paidCents > 0) {
          add("sofar", t("detail.paidSoFar"), undefined, <Num size={14.5} weight={600}>{m(i.paidCents)}</Num>);
          add("bal", t("detail.balance"), t("detail.balanceSub", { date: d(i.dueDate) }), <><Num size={14.5} weight={600}>{m(i.balanceCents)}</Num><Status plain tone="warn" shape="q3">{t("status.partially_paid")}</Status></>);
        } else add("pay", t("detail.payments"), t("detail.paymentsNone"), <Num size={14.5} weight={600}>{m(0)}</Num>);
      }
    }
    return out;
  };

  const owed = rows.filter((r) => r.kind === "late" || r.kind === "open");
  const outC = outstandingCents(all);
  const overC = overdueCents(all, now);
  const buckets = aging(all, now);
  const segs: AgingSegment[] = BUCKET_ORDER.map((b) => ({ key: b, amount: buckets[b], ...BUCKET_LOOK[b] }));
  const split = (cents: number) => { const s = m(cents); const k = s.search(/[.,]\d\d(?: \$)?$/); return k > 0 ? [s.slice(0, k), s.slice(k)] as const : [s, ""] as const; };
  const [outWhole, outCents] = split(outC);
  const month = paidThisMonth(all, now);
  const drafts = draftsTotal(all, now);
  const ps = payStats(all, now);
  const lateList = remindable(all, now);
  const pct = (v: number | null) => (v == null ? "–" : `${Math.round(v * 100)}${locale === "fr-CA" ? " %" : "%"}`);
  const dueLine = (i: InvoiceDto, kind: InvoiceKind) => {
    const s = stateOf(i, now);
    if (kind === "late") return t("list.bucketOf", { number: i.number, bucket: t(`list.buckets.${bucketOf(s.late)}`) });
    if (i.status === "partially_paid") return t("list.halfPaid", { number: i.number, percent: `${Math.round((i.paidCents / Math.max(1, i.totalCents)) * 100)}${locale === "fr-CA" ? " %" : "%"}`, date: d(i.dueDate) });
    if (s.word === "viewed") return t("list.viewedDue", { number: i.number, date: d(i.dueDate) });
    return t("list.dueOn", { number: i.number, date: d(i.dueDate) });
  };

  const loading = q.isPending && !q.data;
  const failed = q.isError && !q.data;
  const remindMain = remindedAll > 0 ? t("list.remindedAll", { count: remindedAll }) : t("list.remindAll", { count: lateList.length });

  return (
    <Screen>
      <Header title="" backLabel={t("back")} onBack={back} moreLabel={t("more")} onMore={() => setMoreOpen(true)} />
      <ExpandScrollView contentContainerStyle={{ paddingBottom: LIST_BOTTOM + insets.bottom }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Section px={20} pt={4} row align="center" justify="space-between" gap={12}>
          <PageTitle>{t("title")}</PageTitle>
          <Button size="sm" label={t("newInvoice")} icon={<Glyph name="plus" size={14} weight={2.4} color="on-inv" />} onPress={newInvoice} />
        </Section>
        {failed ? (
          <Section pt={26} px={16}><Empty icon="warn" iconTone="clay" title={t("list.loadFailed.title")} body={t("list.loadFailed.body")} action={t("list.loadFailed.retry")} onAction={() => void q.refetch()} /></Section>
        ) : loading ? (
          <Section pt={16} px={16} gap={12}><Skeleton height={230} radius={22} /><Skeleton height={44} radius={14} /><Skeleton height={300} radius={22} /></Section>
        ) : all.length === 0 ? (
          <Section pt={26} px={16}><Empty icon="receipt" iconTone="amber" title={t("list.none.title")} body={t("list.none.body")} action={t("list.none.action")} onAction={newInvoice} /></Section>
        ) : (
          <>
            {q.isError ? <Section pt={12} px={16}><Banner tone="info" icon="warn" iconTone="amber" lead={t("list.offline")} /></Section> : null}
            <Section delay={50} pt={16} px={16}>
              <ExpandCard id="kpi" label={t("list.glance")} chevronTop={24}
                head={<>
                  <Outstanding label={t("list.outstanding")} whole={outWhole} cents={outCents}
                    right={overC > 0 ? <Status tone="bad" shape="alert">{t("list.overdue", { amount: m(overC, false) })}</Status> : undefined} />
                  <AgingBar segments={segs} label={t("list.aging", { buckets: BUCKET_ORDER.map((b) => `${t(`list.buckets.${b}`)} ${m(buckets[b], false)}`).join(", ") })} />
                  <AgingLegend items={segs.map((s) => ({ ...s, label: t(`list.buckets.${s.key as AgingBucket}`), value: m(s.amount, false) }))} />
                </>}
                foot={<FootStats items={[
                  { label: t("list.paidMonth"), value: m(month.cents, false), sub: t("list.payments", { count: month.count }), subTone: "ok" },
                  { label: t("list.drafts"), value: m(drafts.cents, false), sub: t("list.notSent", { count: drafts.count }) },
                ]} />}>
                <XcDivider />
                <XcCaption>{t("list.whoOwes")}</XcCaption>
                {openByUrgency(owed.map((r) => r.i), now).slice(0, 5).map((i, n) => {
                  const kind = kindOf(i, now);
                  const a = acted[i.id];
                  const s = stateOf(i, now);
                  return (
                    <XcRow key={i.id} first={n === 0} title={nameOf(i)}
                      sub={<>
                        <Text size={12.5} color="muted" leading={1.35}>{dueLine(i, kind)}</Text>
                        <Stack pt={4}><Status plain tone={kind === "late" ? "bad" : "ok"} shape={kind === "late" ? "alert" : "check"}>{kind === "late" ? (s.late > 0 ? t("status.late", { count: s.late }) : t("status.overdue")) : t("list.notDue")}</Status></Stack>
                      </>}
                      right={<>
                        <Num size={14.5} weight={600}>{m(i.balanceCents)}</Num>
                        {kind === "late" ? <XcButton label={a ? a.word : t("actions.remind")} tone={a ? "done" : "primary"} onPress={() => remind(i)} /> : null}
                      </>} />
                  );
                })}
                <MiniFigures items={[{ label: t("list.stats.avg"), value: ps.avgDays == null ? "–" : t("detail.days", { count: ps.avgDays }) }, { label: t("list.stats.onTime"), value: pct(ps.onTime) }, { label: t("list.stats.late"), value: String(ps.late) }]} />
                <XcActions link={t("list.openReminders")} onLink={dunning} main={remindMain} onMain={() => void sendAll()} mainDone={remindedAll > 0} />
              </ExpandCard>
            </Section>
            <Section delay={90} pt={14} px={16}>
              <Search label={t("list.searchLabel")} placeholder={t("list.searchPlaceholder")} value={term} onChangeText={setTerm} autoCorrect={false} />
            </Section>
            <Section delay={120} pt={12}>
              <ChipStrip label={t("list.filter")}>
                {FILTER_ORDER.map((f) => <Chip key={f} label={t(`list.filters.${f}`)} count={rows.filter((r) => matchesFilter(r.kind, f)).length} selected={filter === f} onPress={() => setFilter(f)} />)}
              </ChipStrip>
            </Section>
            {groups.map((grp, gi) => (
              <Section key={grp.key} delay={150} pt={20} px={16}>
                <SectionHeader title={t(`list.groups.${grp.key as InvoiceGroup}`)} link={m(grp.total)} />
                <Card style={{ overflow: "visible" }}>
                  <RowList>
                    {grp.list.map((i, n) => {
                      const kind = kindOf(i, now);
                      const w = wordOf(i);
                      const main = mainFor(i, kind);
                      const stats = stat(i, kind);
                      return (
                        <InvoiceRow key={i.id} id={i.id} swiped={swiped === i.id} onSwipe={(o) => setSwiped(o ? i.id : null)} actions={swipesFor(i, kind)} label={`${nameOf(i)}, ${i.number}`}
                          head={<RowBody leading={<Avatar initials={initialsOf(nameOf(i))} tint={tintFor(nameOf(i))} />} title={nameOf(i)}
                            meta={`${i.number} · ${typeLabel(i)}`} note={datesOf(i, kind)}
                            trailing={<>{num(i)}<Status tone={w.tone} shape={w.shape}>{w.text}</Status></>} />}>
                          <XcDivider />
                          {detail(i, kind)}
                          {stats.length ? <MiniFigures items={stats} /> : null}
                          <XcActions link={t("actions.openInvoice")} onLink={() => open(i)} main={main?.label} onMain={main?.onPress} mainDone={main?.done} />
                        </InvoiceRow>
                      );
                    })}
                  </RowList>
                </Card>
                {gi === 0 ? <SwipeHint>{t("list.swipeHint")}</SwipeHint> : null}
              </Section>
            ))}
            {groups.length === 0 ? (
              <Section delay={150} pt={26} px={16}>
                <Empty icon="search" iconTone="slate" title={t("list.empty.title")} body={t("list.empty.body")} action={t("list.empty.clear")} actionKind="secondary" onAction={() => { setTerm(""); setFilter("all"); }} />
              </Section>
            ) : null}
          </>
        )}
      </ExpandScrollView>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} label={t("more")} closeLabel={tr("close")}>
        <MenuList>
          <MenuRow icon={<Icon name="bell" tone="amber" size={28} />} title={t("list.remindAll", { count: lateList.length })} chevron={false} onPress={() => { setMoreOpen(false); void sendAll(); }} />
          <MenuRow icon={<Icon name="clock" tone="azure" size={28} />} title={t("list.openReminders")} onPress={() => { setMoreOpen(false); dunning(); }} />
        </MenuList>
        <Stack pt={12} />
      </Sheet>

      <Sheet open={!!deleting} onClose={() => setDeleting(null)} label={t("confirmDelete.title")} closeLabel={tr("close")}>
        <SheetTitle>{t("confirmDelete.title")}</SheetTitle>
        <Stack px={16} gap={12} pt={0}>
          <Text size={14.5} color="t2" leading={1.45}>{deleting ? t("confirmDelete.body", { number: deleting.number, client: nameOf(deleting) }) : ""}</Text>
          <Button kind="destructive" block label={t("confirmDelete.action")} onPress={() => { const i = deleting; setDeleting(null); if (i) act(i, () => invoicesApi.remove(i.id), { toast: t("done.deleted") }); }} />
          <Button kind="secondary" block label={t("confirmDelete.cancel")} onPress={() => setDeleting(null)} />
        </Stack>
        <Stack pt={16} />
      </Sheet>
    </Screen>
  );
}

/** An invoice row: the expandable card inside a swipe row, which stays still while the card is open. */
function InvoiceRow({ id, label, head, swiped, onSwipe, actions, children }: { id: string; label: string; head: ReactNode; swiped: boolean; onSwipe: (open: boolean) => void; actions: SwipeAction[]; children: ReactNode }) {
  const expanded = useExpandOpen(id);
  return (
    <SwipeRow card={false} open={swiped && !expanded} onOpenChange={onSwipe} locked={expanded} actions={actions} accessibilityLabel={label}>
      <ExpandCard id={id} variant="row" list="invoices" label={label} head={head}>{children}</ExpandCard>
    </SwipeRow>
  );
}
