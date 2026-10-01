// Quotes.dc.html. The tab: the three figures (an expandable card), search, filter chips, then the
// quotes grouped This week / Earlier, each row expanding in place and swiping for two quick actions.
// States built: list, no match (the board's empty), no quotes at all, loading, can't load, offline.
// The board's Viewed / Declined need the server to record them; Expired and "Expires ..." are
// worked out from the 30 days a quote is valid (lib/quotes.ts).
import { useMemo, useState, type ReactElement, type ReactNode } from "react";
import { View } from "react-native";
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { getListQuotesQueryKey, useArchiveQuote, useDuplicateQuote, useListQuotes, useRestoreQuote, type QuoteSummary } from "@workspace/api-client-react";
import { money, monthLong, shortDate, weekdayShort, type Locale } from "@/lib/format";
import { initialsOf } from "@/lib/invites";
import { screenHref } from "@/lib/nav";
import { FILTER_ORDER, daysLeft, glance, groupOf, jobLine, matchesFilter, matchesSearch, quoteNumber, quoteState, validUntil, type QuoteFilter, type QuoteGroup, type QuoteState } from "@/lib/quotes";
import { useSession } from "@/lib/useSession";
import { Avatar, type AvatarTint } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Chip, ChipStrip } from "@/ui/Chip";
import { ExpandCard, ExpandScrollView, XcActions, XcButton, XcCaption, XcDivider, XcRow, useExpandOpen } from "@/ui/Expand";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { IconButton, TabHeader } from "@/ui/Header";
import { Glyph } from "@/ui/Icon";
import { Section } from "@/ui/Layout";
import { Figures, MiniFigures } from "@/ui/Numbers";
import { RowBody, RowList, SectionHeader, SwipeHint } from "@/ui/Row";
import { Search } from "@/ui/Search";
import { Status, type StatusShape, type StatusTone } from "@/ui/Status";
import { SwipeRow, type SwipeAction } from "@/ui/SwipeRow";
import { TAB_BAR_SPACE } from "@/ui/TabBar";
import { TabScreen } from "@/ui/TabShell";
import { Num, Text } from "@/ui/Text";

const STATUS: Record<QuoteState, { tone: StatusTone; shape: StatusShape }> = {
  draft: { tone: "mute", shape: "draft" },
  sent: { tone: "info", shape: "q1" },
  expiring: { tone: "warn", shape: "clock" },
  viewed: { tone: "acc", shape: "q2" },
  accepted: { tone: "ok", shape: "check" },
  declined: { tone: "bad", shape: "x" },
  expired: { tone: "mute", shape: "off" },
};
const numOf = (q: QuoteSummary) => quoteNumber(q);
const TINTS: AvatarTint[] = [1, 2, 3, 4, 5];

export default function Quotes() {
  const { t, i18n } = useTranslation();
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { status } = useSession();
  const toast = useToast();
  const client = useQueryClient();
  const quotes = useListQuotes({ query: { enabled: status === "in" || status === "offline", retry: 1 } } as never);
  const duplicate = useDuplicateQuote();
  const archive = useArchiveQuote();
  const restore = useRestoreQuote();
  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState<QuoteFilter>("all");
  const [swiped, setSwiped] = useState<string | null>(null);
  const now = useMemo(() => new Date(), [quotes.dataUpdatedAt]);
  const all = (quotes.data ?? []) as QuoteSummary[];

  const rows = useMemo(() => all.map((q) => ({ q, state: quoteState(q, now) })), [all, now]);
  const shown = useMemo(() => rows.filter((r) => matchesFilter(r.state, filter) && matchesSearch(r.q, term)), [rows, filter, term]);
  const groups = useMemo(() => (["week", "earlier"] as QuoteGroup[]).map((g) => {
    const items = shown.filter((r) => groupOf(r.q, now) === g).sort((a, b) => +new Date(b.q.updatedAt) - +new Date(a.q.updatedAt));
    return { key: g, items, total: items.reduce((n, r) => n + r.q.totale, 0) };
  }).filter((g) => g.items.length), [shown, now]);
  const g = useMemo(() => glance(all, now), [all, now]);

  if (status === "out") return <Redirect href="/" />;

  const m = (v: number, cents = true) => money(v, locale, { cents });
  const open = (id: string) => router.push(screenHref("Quote", t("quotes.actions.openQuote"), { id }));
  const newQuote = () => router.push(screenHref("NewQuote", t("quotes.newQuote")));
  const refresh = () => client.invalidateQueries({ queryKey: getListQuotesQueryKey() });
  const fail = () => toast({ message: t("quotes.done.failed") });

  const actionsFor = (q: QuoteSummary, s: QuoteState): SwipeAction[] => {
    const close = () => setSwiped(null);
    const dup = (label: string): SwipeAction => ({ key: "dup", label, icon: "doc", iconTone: "slate", tone: "mute", onPress: () => { close(); duplicate.mutate({ id: q.id } as never, { onSuccess: () => { toast({ message: t("quotes.done.duplicated") }); void refresh(); }, onError: fail }); } });
    const arch: SwipeAction = { key: "archive", label: t("quotes.actions.archive"), icon: "box", iconTone: "stone", tone: "mute", onPress: () => {
      close();
      archive.mutate({ id: q.id } as never, { onSuccess: () => { void refresh(); toast({ message: t("quotes.done.archived"), action: t("quotes.done.undo"), onAction: () => restore.mutate({ id: q.id } as never, { onSuccess: () => void refresh(), onError: fail }) }); }, onError: fail });
    } };
    const go = (key: string, label: string, icon: SwipeAction["icon"], iconTone: SwipeAction["iconTone"], tone: SwipeAction["tone"], to: ReturnType<typeof screenHref>): SwipeAction => ({ key, label, icon, iconTone, tone, onPress: () => { close(); router.push(to); } });
    const quote = screenHref("Quote", t("quotes.actions.openQuote"), { id: q.id });
    switch (s) {
      case "draft": return [go("send", t("quotes.actions.send"), "send", "azure", "info", quote), dup(t("quotes.actions.duplicate"))];
      case "sent": case "viewed": case "expiring": return [go("follow", t("quotes.actions.followUp"), "chat", "violet", "acc", quote), arch];
      case "accepted": return [go("deposit", t("quotes.actions.invoiceDeposit"), "receipt", "amber", "warn", screenHref("Invoices", t("menu.rows.invoices.label"))), go("job", t("quotes.actions.startJob"), "cone", "amber", "ok", screenHref("JobSetup", t("quotes.actions.startJob")))];
      case "declined": return [dup(t("quotes.actions.revive")), arch];
      case "expired": return [dup(t("quotes.actions.renew")), arch];
    }
  };

  const mainFor = (q: QuoteSummary, s: QuoteState): { label: string; onPress: () => void } => {
    switch (s) {
      case "draft": return { label: t("quotes.actions.send"), onPress: () => open(q.id) };
      case "sent": case "viewed": case "expiring": return { label: t("quotes.actions.followUp"), onPress: () => open(q.id) };
      case "accepted": return { label: t("quotes.actions.startJob"), onPress: () => router.push(screenHref("JobSetup", t("quotes.actions.startJob"))) };
      case "declined": return { label: t("quotes.actions.revive"), onPress: () => duplicate.mutate({ id: q.id } as never, { onSuccess: () => { toast({ message: t("quotes.done.duplicated") }); void refresh(); }, onError: fail }) };
      case "expired": return { label: t("quotes.actions.renew"), onPress: () => duplicate.mutate({ id: q.id } as never, { onSuccess: () => { toast({ message: t("quotes.done.duplicated") }); void refresh(); }, onError: fail }) };
    }
  };

  const detail = (q: QuoteSummary, s: QuoteState) => {
    const d = (iso: string) => shortDate(new Date(iso), locale);
    const first = (title: string, sub: string, st?: { tone: StatusTone; shape: StatusShape; word: string }, i = 0) => (
      <XcRow key={title} first={i === 0} title={title} sub={sub} right={st ? <Status plain tone={st.tone} shape={st.shape}>{st.word}</Status> : undefined} />
    );
    const out: ReactElement[] = [];
    if (s === "draft") {
      out.push(first(t("quotes.detail.drafted", { date: d(q.createdAt) }), t("quotes.detail.draftedSub"), { ...STATUS.draft, word: t("quotes.detail.notSent") }));
      out.push(<XcRow key="items" title={t("quotes.detail.items", { count: q.lineItemCount })} sub={t("quotes.detail.itemsSub", { amount: m(q.subtotale) })} right={<Num size={14.5} weight={600}>{m(q.totale)}</Num>} />);
      out.push(<XcRow key="valid" title={t("quotes.detail.valid")} sub={t("quotes.detail.validSub")} />);
    } else if (s === "declined") {
      out.push(first(t("quotes.detail.declinedOn", { date: d(q.declinedAt ?? q.updatedAt) }), q.declinedReason?.trim() || t("quotes.detail.noReason"), { ...STATUS.declined, word: t("quotes.status.declined") }));
      if (q.sentAt) out.push(<XcRow key="sent" title={t("quotes.detail.sent", { date: d(q.sentAt) })} sub={q.clientData.email ? t("quotes.detail.sentTo", { email: q.clientData.email }) : t("quotes.detail.sentBy")} />);
      out.push(<XcRow key="total" title={t("quotes.detail.total", { amount: m(q.totale) })} sub={t("quotes.detail.totalSub")} />);
    } else if (s === "accepted") {
      out.push(first(t("quotes.detail.acceptedOn", { date: d(q.acceptedAt ?? q.updatedAt) }), t("quotes.detail.totalSub"), { ...STATUS.accepted, word: t("quotes.status.accepted") }));
      out.push(<XcRow key="total" title={t("quotes.detail.total", { amount: m(q.totale) })} sub={t("quotes.detail.items", { count: q.lineItemCount })} />);
    } else {
      const until = validUntil(q.sentAt!, q.validDays);
      const left = daysLeft(until, now);
      out.push(first(t("quotes.detail.sent", { date: d(q.sentAt!) }), q.clientData.email ? t("quotes.detail.sentTo", { email: q.clientData.email }) : t("quotes.detail.sentBy")));
      if (q.firstViewedAt && s !== "expired") out.push(<XcRow key="viewed" title={t("quotes.detail.viewed", { date: d(q.firstViewedAt) })} sub={t("quotes.detail.viewedSub")} right={<Status plain tone="acc" shape="q2">{t("quotes.status.viewed")}</Status>} />);
      if (s === "expired") out.push(<XcRow key="exp" title={t("quotes.detail.expiredOn", { date: shortDate(until, locale) })} sub={t("quotes.detail.expiredSub")} right={<Status plain tone="mute" shape="off">{t("quotes.status.expired")}</Status>} />);
      else out.push(<XcRow key="until" title={s === "expiring" ? t("quotes.detail.expires", { date: `${weekdayShort(until, locale)} ${shortDate(until, locale)}` }) : t("quotes.detail.until", { date: shortDate(until, locale) })}
        sub={t("quotes.detail.left", { count: left })} right={s === "expiring" ? <Status plain tone="warn" shape="clock">{t("quotes.status.expiring", { day: weekdayShort(until, locale) })}</Status> : undefined} />);
      out.push(<XcRow key="total" title={t("quotes.detail.total", { amount: m(q.totale) })} sub={t("quotes.detail.totalSub")} />);
    }
    return out;
  };

  const meta = (q: QuoteSummary, s: QuoteState) => {
    const when = s === "draft" ? t("quotes.jobMeta.today") : s === "accepted" ? t("quotes.jobMeta.accepted", { date: shortDate(new Date(q.acceptedAt ?? q.updatedAt), locale) })
      : s === "declined" ? t("quotes.jobMeta.declined", { date: shortDate(new Date(q.declinedAt ?? q.updatedAt), locale) }) : s === "expired" ? t("quotes.jobMeta.expired", { date: shortDate(validUntil(q.sentAt!, q.validDays), locale) }) : t("quotes.jobMeta.sent", { date: shortDate(new Date(q.sentAt!), locale) });
    return [s === "draft" ? "" : when, jobLine(q), numOf(q)].filter(Boolean).join(" · ");
  };

  const loading = quotes.isPending && !quotes.data;
  const failed = quotes.isError && !quotes.data;

  return (
    <TabScreen active="quotes">
      <TabHeader title={t("quotes.title")}>
        <Button size="sm" label={t("quotes.newQuote")} icon={<Glyph name="plus" size={14} weight={2.4} color="on-inv" />} onPress={newQuote} />
        <IconButton glyph="more" label={t("quotes.more")} />
      </TabHeader>
      <ExpandScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {failed ? (
          <Section pt={26} px={16}><Empty icon="warn" iconTone="clay" title={t("quotes.loadFailed.title")} body={t("quotes.loadFailed.body")} action={t("quotes.loadFailed.retry")} onAction={() => void quotes.refetch()} /></Section>
        ) : loading ? (
          <Section pt={16} px={16} gap={12}><Skeleton height={74} radius={22} /><Skeleton height={44} radius={14} /><Skeleton height={300} radius={22} /></Section>
        ) : all.length === 0 ? (
          <Section pt={26} px={16}><Empty icon="file" title={t("quotes.none.title")} body={t("quotes.none.body")} action={t("quotes.none.action")} onAction={newQuote} /></Section>
        ) : (
          <>
            {quotes.isError ? <Section pt={12} px={16}><Banner tone="info" icon="warn" iconTone="amber" lead={t("quotes.offline")} /></Section> : null}
            <Section delay={50} pt={16} px={16}>
              <ExpandCard id="kpi" label={t("quotes.glance")}
                head={<Figures items={[
                  { label: t("quotes.kpi.waiting"), value: m(g.waitingTotal, false), sub: t("quotes.kpi.quotes", { count: g.waitingCount }) },
                  { label: t("quotes.kpi.won"), value: m(g.wonTotal, false), sub: t("quotes.kpi.accepted", { count: g.wonCount }), subTone: "ok" },
                  { label: t("quotes.kpi.rate"), value: g.winRate == null ? "–" : `${Math.round(g.winRate * 100)} %`.replace(" %", locale === "fr-CA" ? " %" : "%"), sub: t("quotes.kpi.last90") },
                ]} />}>
                <XcDivider />
                <XcCaption>{t("quotes.waitingLongest")}</XcCaption>
                {rows.filter((r) => r.state === "sent" || r.state === "viewed" || r.state === "expiring").sort((a, b) => +new Date(a.q.sentAt!) - +new Date(b.q.sentAt!)).slice(0, 5).map((r, i) => (
                  <XcRow key={r.q.id} first={i === 0} title={r.q.clientData.nome} sub={jobLine(r.q)}
                    right={<><Num size={14.5} weight={600}>{m(r.q.totale)}</Num><XcButton label={t("quotes.actions.followUp")} onPress={() => open(r.q.id)} /></>} />
                ))}
                <MiniFigures items={[{ label: t("quotes.stats.sent", { month: monthLong(now, locale) }), value: String(g.sentThisMonth) }, { label: t("quotes.stats.expiring"), value: String(g.expiring) }]} />
              </ExpandCard>
            </Section>
            <Section delay={90} pt={14} px={16}>
              <Search label={t("quotes.searchLabel")} placeholder={t("quotes.searchPlaceholder")} value={term} onChangeText={setTerm} autoCorrect={false} />
            </Section>
            <Section delay={120} pt={12}>
              <ChipStrip label={t("quotes.filter")}>
                {FILTER_ORDER.map((f) => <Chip key={f} label={t(`quotes.filters.${f}`)} count={rows.filter((r) => matchesFilter(r.state, f)).length} selected={filter === f} onPress={() => setFilter(f)} />)}
              </ChipStrip>
            </Section>
            {groups.map((grp, gi) => (
              <Section key={grp.key} delay={150} pt={18} px={16}>
                <SectionHeader title={t(`quotes.groups.${grp.key}`)} link={m(grp.total)} />
                <Card style={{ overflow: "visible" }}>
                  <RowList>
                    {grp.items.map(({ q, state }, i) => (
                      <QuoteRow key={q.id} id={q.id} swiped={swiped === q.id} onSwipe={(o) => setSwiped(o ? q.id : null)} actions={actionsFor(q, state)}
                        label={`${q.clientData.nome}${numOf(q) ? `, ${numOf(q)}` : ""}`}
                        head={<RowBody leading={<Avatar initials={initialsOf(q.clientData.nome)} tint={TINTS[i % TINTS.length]} />} title={q.clientData.nome} meta={meta(q, state)}
                          trailing={<><Num size={14.5} weight={600}>{m(q.totale)}</Num><Status tone={STATUS[state].tone} shape={STATUS[state].shape}>{state === "expiring" ? t("quotes.status.expiring", { day: weekdayShort(validUntil(q.sentAt!, q.validDays), locale) }) : t(`quotes.status.${state}`)}</Status></>} />}>
                        <XcDivider />
                        <XcCaption>{q.descrizioneGenerale.split("\n")[0].slice(0, 90) || jobLine(q)}</XcCaption>
                        {detail(q, state)}
                        <XcActions link={t("quotes.actions.openQuote")} onLink={() => open(q.id)} main={mainFor(q, state).label} onMain={mainFor(q, state).onPress} />
                      </QuoteRow>
                    ))}
                  </RowList>
                </Card>
                {gi === 0 ? <SwipeHint>{t("quotes.swipeHint")}</SwipeHint> : null}
              </Section>
            ))}
            {groups.length === 0 ? (
              <Section delay={150} pt={26} px={16}>
                <Empty icon="search" iconTone="slate" title={t("quotes.empty.title")} body={t("quotes.empty.body")} action={t("quotes.empty.clear")} actionKind="secondary" onAction={() => { setTerm(""); setFilter("all"); }} />
              </Section>
            ) : null}
          </>
        )}
      </ExpandScrollView>
    </TabScreen>
  );
}

/** A quote row: the expandable card inside a swipe row, which stays still while the card is open. */
function QuoteRow({ id, label, head, swiped, onSwipe, actions, children }: { id: string; label: string; head: ReactNode; swiped: boolean; onSwipe: (open: boolean) => void; actions: SwipeAction[]; children: ReactNode }) {
  const expanded = useExpandOpen(id);
  return (
    <SwipeRow card={false} open={swiped && !expanded} onOpenChange={onSwipe} locked={expanded} actions={actions} accessibilityLabel={label}>
      <ExpandCard id={id} variant="row" list="quotes" label={label} head={head}>{children}</ExpandCard>
    </SwipeRow>
  );
}
