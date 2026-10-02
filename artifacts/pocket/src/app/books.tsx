// Books.dc.html: month-end. The month chips, the month card (open and done, the ticks, Close), the checklist (each item opens where it is
// fixed, or is marked N/A for the month) and the bank lines to match, record as a cost or ignore. Reads /api/books/*.
// Not built: the server has no "not needed" mark, so N/A is kept on this phone; no "sends it to QuickBooks" on close (the close is a lock and a record).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, View, type LayoutChangeEvent } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiFailure } from "@/lib/api";
import { BANK_FILTERS, candidateCount, checklist, closeState, dayDate, dayOfIso, defaultMonth, filterCounts, linesFor, monthChips, monthDate, monthLines, naKey, needsPicker, openCount, parseNa, serializeNa, signOf, suggestion, type BankFilter, type BankLine as Line, type CheckKey, type Candidates } from "@/lib/books";
import { booksApi } from "@/lib/booksApi";
import { money, shortDate, time, type Locale } from "@/lib/format";
import { kvGet, kvSet } from "@/lib/kv";
import { screenHref } from "@/lib/nav";
import { useSession } from "@/lib/useSession";
import { Card } from "@/ui/Card";
import { Chip, ChipStrip } from "@/ui/Chip";
import { Empty, Skeleton, Banner, useToast } from "@/ui/Feedback";
import { Header, PageTitle } from "@/ui/Header";
import { BankLine, ChecklistRow, ClosedButton, CloseButton, LineActions, MiniButton, MonthCard } from "@/ui/Books";
import { ScrollPage, Section, Stack } from "@/ui/Layout";
import { ListRow, MenuList, MenuRow, RowList, SectionHeader } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { Icon } from "@/ui/Icon";
import { Status } from "@/ui/Status";
import { Num, Text } from "@/ui/Text";

const CAP = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
/** Where an item is fixed. `bank` stays on the page; the server's own targets that are later screens open Coming soon. */
const ITEM_TARGET: Record<CheckKey, { screen: string; titleKey?: string } | "bank"> = {
  bank_unmatched: "bank",
  payments_unbanked: { screen: "Invoices" },
  costs_pending: { screen: "Documents", titleKey: "menu.rows.documents.label" },
  claims_open: { screen: "Team" },
  tax_unsplit: { screen: "Compliance", titleKey: "menu.rows.compliance.label" },
  invoices_draft: { screen: "Invoices" },
  time_unapproved: { screen: "Team" },
  not_in_books: { screen: "Integrations", titleKey: "menu.rows.integrations.label" },
};

export default function Books() {
  const { t, i18n } = useTranslation();
  const m = (k: string, o?: Record<string, unknown>) => t(`bk.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { status } = useSession();
  const toast = useToast();
  const client = useQueryClient();
  const signedIn = status === "in" || status === "offline";
  const scroll = useRef<ScrollView>(null);
  const bankY = useRef(0);

  const overviewQ = useQuery({ queryKey: ["books-overview"], queryFn: booksApi.overview, enabled: signedIn, retry: 1 });
  const ov = overviewQ.data && overviewQ.data.enabled ? overviewQ.data : null;
  const today = ov?.today ?? null;
  const [picked, setPicked] = useState<string | null>(null);
  const month = picked ?? (today ? defaultMonth(today) : null);
  const checkQ = useQuery({ queryKey: ["books-close", month], queryFn: () => booksApi.close(month!), enabled: signedIn && !!ov && !!month, retry: 1 });
  const bankOn = !!ov && ov.bank.onPlan && ov.bank.connected;
  const bankQ = useQuery({ queryKey: ["books-bank"], queryFn: booksApi.bank, enabled: signedIn && bankOn, retry: 1 });

  const [na, setNa] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    if (!month) return;
    let live = true;
    void kvGet(naKey(month)).then((raw) => { if (live) setNa(parseNa(raw)); });
    return () => { live = false; };
  }, [month]);
  const markNa = (key: string, on: boolean) => {
    if (!month) return;
    const next = new Set(na);
    if (on) next.add(key); else next.delete(key);
    setNa(next);
    void kvSet(naKey(month), serializeNa(next));
  };

  const [bf, setBf] = useState<BankFilter>("open");
  const [busy, setBusy] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [pick, setPick] = useState<Line | null>(null);

  const lines = useMemo(() => (month ? monthLines(bankQ.data?.lines ?? [], month) : []), [bankQ.data, month]);
  const counts = useMemo(() => filterCounts(lines), [lines]);
  const shown = useMemo(() => linesFor(lines, bf), [lines, bf]);

  // What each line that waits could be: asked for the first dozen so the hint can say "Looks like INV-0412".
  const waiting = useMemo(() => linesFor(lines, "open").slice(0, 12), [lines]);
  const candQ = useQueries({ queries: waiting.map((l) => ({ queryKey: ["books-candidates", l.id], queryFn: () => booksApi.candidates(l.id), staleTime: 60_000, retry: 0 })) });
  const cands = useMemo(() => {
    const map = new Map<string, { data?: Candidates; pending: boolean }>();
    waiting.forEach((l, i) => map.set(l.id, { data: candQ[i]?.data, pending: !!candQ[i]?.isPending && !candQ[i]?.isError }));
    return map;
  }, [waiting, candQ]);

  const check = checkQ.data;
  const list = useMemo(() => (check ? checklist(check.items, na) : []), [check, na]);
  const open = openCount(list);
  const done = list.length - open;
  const closed = !!check?.closed;
  const state = month && today && check ? closeState(month, today, list, closed) : "openItems";

  const refresh = useCallback(() => {
    for (const k of ["books-overview", "books-close", "books-bank", "books-candidates"]) void client.invalidateQueries({ queryKey: [k] });
  }, [client]);

  const monthName = month ? new Intl.DateTimeFormat(locale, { month: "long" }).format(monthDate(month)) : "";
  const err = (e: unknown) => toast({ message: e instanceof ApiFailure && e.code === "ALREADY_MATCHED" ? m("toast.taken") : e instanceof ApiFailure && e.code === "OVER_BALANCE" ? m("toast.over") : m("toast.failed") });
  const run = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try { await fn(); toast({ message: done }); refresh(); } catch (e) { err(e); } finally { setBusy(null); }
  };

  const applySuggestion = (l: Line, c: Candidates | undefined) => {
    const s = suggestion(c);
    if (!s) return;
    if (s.kind === "payment") void run(l.id, () => booksApi.matchPayment(l.id, s.id), m("toast.matched"));
    else if (s.kind === "invoice") void run(l.id, () => booksApi.recordPayment(l.id, s.id), m("toast.paid"));
    else void run(l.id, () => booksApi.matchCost(l.id, s.id), m("toast.matched"));
  };

  const closeMonth = async () => {
    if (!month) return;
    setBusy("close");
    try { await booksApi.doClose(month); toast({ message: m("closeDone", { month: monthName }) }); refresh(); } catch { toast({ message: m("closeFailed") }); } finally { setBusy(null); }
  };
  const reopen = async () => {
    if (!month) return;
    setMenu(false); setBusy("close");
    try { await booksApi.reopen(month); toast({ message: m("reopenDone", { month: monthName }) }); refresh(); } catch { toast({ message: m("toast.failed") }); } finally { setBusy(null); }
  };
  const sync = async () => {
    setMenu(false); setBusy("sync");
    try { const r = await booksApi.sync(); toast({ message: r.fetched > 0 ? m("sync.done", { count: r.fetched }) : m("sync.none") }); refresh(); } catch { toast({ message: m("sync.failed") }); } finally { setBusy(null); }
  };

  const openItem = (key: CheckKey) => {
    const target = ITEM_TARGET[key];
    if (target === "bank") { setBf("open"); scroll.current?.scrollTo({ y: Math.max(0, bankY.current - 12), animated: true }); return; }
    router.push(screenHref(target.screen, target.titleKey ? (t(target.titleKey) as string) : (t(`menu.rows.${target.screen === "Invoices" ? "invoices" : "crew"}.label`) as string)));
  };

  const provider = check?.books ?? ov?.books?.provider ?? null;
  const itemSub = (key: CheckKey, count: number, rows: { label: string }[]): string => {
    if (key === "invoices_draft" && count > 0) {
      const names = rows.slice(0, 2).map((r) => r.label);
      const text = count === 2 && names.length === 2 ? m("items.and", { a: names[0], b: names[1] }) : names.join(", ") + (count > names.length ? ` +${count - names.length}` : "");
      return m("items.invoices_draft.sub", { numbers: text });
    }
    if (count === 0 && (key === "tax_unsplit" || key === "not_in_books" || key === "invoices_draft" || key === "time_unapproved")) return m(`items.${key}.subDone`);
    if (key === "time_unapproved") return m("items.time_unapproved.sub", { count });
    return m(`items.${key}.sub`);
  };

  const failed = (overviewQ.isError && !overviewQ.data) || (checkQ.isError && !checkQ.data);
  const loading = !failed && ((overviewQ.isPending && !overviewQ.data) || (!!ov && checkQ.isPending && !checkQ.data));
  const chips = today ? monthChips(today, check?.closedMonths ?? []) : [];
  const back = () => (router.canGoBack() ? router.back() : router.replace("/menu"));

  const lineLook = (l: Line): { icon: "receipt" | "photo" | "search" | "bank"; tone: "violet" | "amber" | "slate" | "sage"; hint: string; muted: boolean; stTone?: "ok" | "info" | "mute"; stShape?: "check" | "dot" | "off"; stWord?: string } => {
    if (l.status === "ignored") return { icon: "bank", tone: "slate", hint: m("bank.hint.ignored"), muted: true, stTone: "mute", stShape: "off", stWord: m("bank.status.ignored") };
    if (l.status === "matched" && l.match) {
      if (l.match.kind === "payment") return { icon: "receipt", tone: "sage", hint: m("bank.hint.paymentOf", { number: l.match.invoiceNumber, customer: l.match.customer }), muted: true, stTone: "ok", stShape: "check", stWord: m("bank.status.matched") };
      const fromLine = l.match.fromBankLine;
      return { icon: "photo", tone: "amber", hint: m("bank.hint.costOf", { label: l.match.label }), muted: true, stTone: fromLine ? "info" : "ok", stShape: fromLine ? "dot" : "check", stWord: fromLine ? m("bank.status.cost") : m("bank.status.matched") };
    }
    const c = cands.get(l.id);
    if (!c || (c.pending && !c.data)) return { icon: "search", tone: "slate", hint: m("bank.hint.looking"), muted: false };
    const s = suggestion(c.data);
    if (!s) return { icon: "search", tone: "slate", hint: m("bank.hint.none"), muted: false };
    if (s.kind === "cost") return { icon: "photo", tone: "amber", hint: m("bank.hint.costIs", { label: s.label, date: shortDate(dayDate(dayOfIso(s.date)), locale) }), muted: false };
    const exact = s.kind === "payment" || s.exact;
    return { icon: "receipt", tone: "violet", hint: m(exact ? "bank.hint.looksLike" : "bank.hint.couldBe", { number: s.number, customer: s.customer }), muted: false };
  };

  const bankSection = () => {
    if (!ov) return null;
    if (!ov.bank.onPlan) return <Card><Empty icon="bank" iconTone="sage" title={m("bank.plan.title")} body={m("bank.plan.body")} /></Card>;
    if (!ov.bank.connected) return <Card><Empty icon="bank" iconTone="sage" title={m("bank.notConnected.title")} body={m("bank.notConnected.body")} /></Card>;
    return (
      <>
        <Stack pb={10}>
          <ChipStrip label={m("bank.filter")}>
            {BANK_FILTERS.map((f) => <Chip key={f} label={m(`bank.${f}`)} count={counts[f]} selected={bf === f} onPress={() => setBf(f)} />)}
          </ChipStrip>
        </Stack>
        <Card>
          {bankQ.isPending && !bankQ.data ? (
            <Stack gap={12} px={16} pt={16} pb={16}><Skeleton height={44} radius={12} /><Skeleton height={44} radius={12} /></Stack>
          ) : bankQ.isError && !bankQ.data ? (
            <Empty icon="warn" iconTone="clay" title={m("loadFailed.title")} body={m("loadFailed.body")} action={m("retry")} onAction={refresh} />
          ) : shown.length === 0 ? (
            lines.length === 0
              ? <Empty icon="bank" iconTone="sage" title={m("bank.noneTitle")} body={m("bank.noneBody", { month: monthName })} />
              : <Empty icon="bank" iconTone="sage" title={m("bank.emptyTitle")} body={m("bank.emptyBody")} />
          ) : (
            <RowList>
              {shown.map((l) => {
                const look = lineLook(l);
                const c = cands.get(l.id);
                const out = l.amountCents < 0;
                const amount = `${signOf(l.amountCents)}${money(Math.abs(l.amountCents) / 100, locale)}`;
                const date = shortDate(dayDate(dayOfIso(l.date)), locale);
                return (
                  <BankLine key={l.id} date={date} desc={l.description} amount={amount} positive={!out} icon={look.icon} tone={look.tone} hint={look.hint} hintMuted={look.muted}>
                    {l.status === "unmatched" ? (
                      <LineActions>
                        <MiniButton variant="accent" label={needsPicker(c?.data) ? m("bank.matchMore") : m("bank.match")} disabled={busy === l.id}
                          onPress={() => (needsPicker(c?.data) ? setPick(l) : applySuggestion(l, c?.data))} />
                        {out ? <MiniButton label={m("bank.cost")} disabled={busy === l.id} onPress={() => void run(l.id, () => booksApi.recordCost(l.id), m("toast.cost"))} /> : null}
                        <MiniButton variant="ghost" label={m("bank.ignore")} disabled={busy === l.id} onPress={() => void run(l.id, () => booksApi.ignore(l.id), m("toast.ignored"))} />
                      </LineActions>
                    ) : (
                      <Stack row align="center" gap={8}>
                        <Status tone={look.stTone ?? "mute"} shape={look.stShape}>{look.stWord ?? ""}</Status>
                        <MiniButton variant="ghost" label={m("bank.undo")} disabled={busy === l.id} onPress={() => void run(l.id, () => booksApi.unmatch(l.id), m("toast.undone"))} />
                      </Stack>
                    )}
                  </BankLine>
                );
              })}
            </RowList>
          )}
        </Card>
        <Stack pt={10} px={4}>
          <Text size={12.5} color="faint">{ov.bank.lastSyncedAt ? m("bank.feed", { time: time(new Date(ov.bank.lastSyncedAt), locale) }) : m("bank.feedNever")}</Text>
        </Stack>
      </>
    );
  };

  const pickCands = pick ? cands.get(pick.id)?.data : undefined;
  const choose = (fn: () => Promise<unknown>, done: string) => { const l = pick; setPick(null); if (l) void run(l.id, fn, done); };

  return (
    <Screen>
      <Header title="" backLabel={m("back")} onBack={back} moreLabel={m("more")} onMore={() => setMenu(true)} />
      <ScrollPage bottom={48} scrollRef={scroll}>
        <Section px={20} gap={6}>
          <PageTitle>{m("title")}</PageTitle>
          <Text size={13.5} color="muted">{provider ? m("sub.books", { provider: m(`providers.${provider}`) }) : m("sub.none")}</Text>
        </Section>

        {failed ? (
          <Section pt={26} px={16}><Empty icon="warn" iconTone="clay" title={m("loadFailed.title")} body={m("loadFailed.body")} action={m("retry")} onAction={refresh} /></Section>
        ) : overviewQ.data && !overviewQ.data.enabled ? (
          <Section pt={26} px={16}><Empty icon="bank" iconTone="sage" title={m("locked.title")} body={m("locked.body")} /></Section>
        ) : loading || !month || !check ? (
          <Section pt={16} px={16} gap={12}><Skeleton height={34} radius={17} /><Skeleton height={190} radius={22} /><Skeleton height={300} radius={22} /></Section>
        ) : (
          <>
            <Section delay={30} pt={16}>
              <ChipStrip label={m("monthLabel")}>
                {chips.map((c) => (
                  <Chip key={c.month} selected={c.month === month} onPress={() => { setPicked(c.month); setBf("open"); }}
                    label={new Intl.DateTimeFormat(locale, { month: "short" }).format(monthDate(c.month)).replace(/^./, (x) => x.toUpperCase())}
                    count={c.closed ? m("tagClosed") : m("tagOpen")} />
                ))}
              </ChipStrip>
            </Section>

            <Section delay={60} pt={14} px={16} gap={12}>
              <MonthCard
                title={CAP(monthName)}
                line={<Text size={13.5} color="muted"><Text size={13.5} weight={600} color="ink">{String(open)}</Text>{` ${m("openWord", { count: open })} · `}<Text size={13.5} color="muted">{String(done)}</Text>{` ${m("done", { count: done })}`}</Text>}
                status={closed ? { tone: "ok", shape: "check", label: m("tagClosed") } : { tone: "warn", shape: "clock", label: m("tagOpen") }}
                ticks={list.map((i) => !i.open)}
                button={closed
                  ? <ClosedButton label={m("closeBtn.closed", { month: monthName })} />
                  : <CloseButton label={m("closeBtn.ready", { month: monthName })} disabled={state !== "ready"} busy={busy === "close" ? m("closeBtn.working") : false} onPress={() => void closeMonth()} />}
                note={closed ? m("note.closed", { date: shortDate(new Date(check.closed!.closedAt), locale) }) : state === "notOver" ? m("note.notOver", { month: monthName }) : state === "openItems" ? m("note.openItems") : m("note.ready", { month: monthName })}
              />
              {closed && check.changedSinceClose.length > 0 ? (
                <Banner tone="warn" icon="warn" iconTone="amber" lead={m("changed.lead", { month: monthName })}>
                  {m("changed.body", { items: check.changedSinceClose.map((k) => m(`items.${k}.title`, { provider: provider ? m(`providerShort.${provider}`) : "" })).join(", ") })}
                </Banner>
              ) : null}
            </Section>

            <Section delay={100} pt={22} px={16}>
              <SectionHeader title={m("checklist.title")} link={list.length ? m("checklist.count", { done, total: list.length }) : undefined} />
              <Card>
                {list.length === 0 ? <Empty icon="check" iconTone="sage" title={m("checklist.empty")} body="" /> : (
                  <RowList>
                    {list.map((i) => {
                      const title = m(`items.${i.key}.title`, { provider: provider ? m(`providerShort.${provider}`) : "" });
                      return (
                        <ChecklistRow key={i.key} look={i.open ? "open" : i.na ? "na" : "done"} count={i.count} title={title}
                          sub={i.na ? m("checklist.naSub") : itemSub(i.key, i.count, i.rows)}
                          naText={m("checklist.na")} undoText={m("checklist.undo")} naLabel={m("checklist.naLabel", { item: title })} openLabel={m("checklist.openLabel", { item: title })}
                          onNa={() => markNa(i.key, true)} onUndo={() => markNa(i.key, false)} onOpen={() => openItem(i.key)} />
                      );
                    })}
                  </RowList>
                )}
              </Card>
            </Section>

            <Section delay={140} pt={22} px={16}>
              <View onLayout={(e: LayoutChangeEvent) => { bankY.current = e.nativeEvent.layout.y + 0; }}>
                <SectionHeader title={m("bank.title")} link={ov?.bank.account ? m("bank.account", { name: ov.bank.account.name, last4: ov.bank.account.last4 ?? "" }) : undefined} />
                {bankSection()}
              </View>
            </Section>
          </>
        )}
      </ScrollPage>

      <Sheet open={menu} onClose={() => setMenu(false)} label={m("more")} closeLabel={m("close")}>
        <MenuList>
          {bankOn ? <MenuRow icon={<Icon name="sync" tone="teal" size={28} />} title={m("sync.now")} sub={m("sync.nowSub")} chevron={false} onPress={() => void sync()} /> : null}
          {closed && month ? <MenuRow icon={<Icon name="lock" tone="slate" size={28} />} title={m("menu.reopen", { month: monthName })} sub={m("menu.reopenSub")} chevron={false} onPress={() => void reopen()} /> : null}
        </MenuList>
      </Sheet>

      <Sheet open={!!pick} onClose={() => setPick(null)} label={m("picker.title")} closeLabel={m("close")}>
        <SheetTitle>{m("picker.title")}</SheetTitle>
        {pick ? (
          <Stack px={16} pb={20} gap={12}>
            <Stack row align="center" justify="space-between" gap={12}>
              <Text size={14.5} weight={500} numberOfLines={1} style={{ flexShrink: 1 }}>{pick.description}</Text>
              <Num size={14.5} weight={600}>{`${signOf(pick.amountCents)}${money(Math.abs(pick.amountCents) / 100, locale)}`}</Num>
            </Stack>
            {candidateCount(pickCands) === 0 ? (
              <Empty icon="search" iconTone="slate" title={m("picker.emptyTitle")} body={pick.amountCents < 0 ? m("picker.emptyOut") : m("picker.emptyIn")} />
            ) : (
              <Card>
                <RowList>
                  {(pickCands?.payments ?? []).map((p) => (
                    <PickRow key={p.id} title={m("bank.hint.paymentOf", { number: p.invoiceNumber, customer: p.customer })} meta={`${m("picker.payments")} · ${shortDate(dayDate(dayOfIso(p.date)), locale)}`} amount={money(p.amountCents / 100, locale)}
                      onPress={() => choose(() => booksApi.matchPayment(pick.id, p.id), m("toast.matched"))} />
                  ))}
                  {(pickCands?.invoices ?? []).map((i) => (
                    <PickRow key={i.id} title={m("bank.hint.paymentOf", { number: i.number, customer: i.customer })} meta={i.exact ? m("picker.exact") : m("picker.owing", { amount: money(i.balanceCents / 100, locale) })} amount={money(i.balanceCents / 100, locale)}
                      onPress={() => choose(() => booksApi.recordPayment(pick.id, i.id), m("toast.paid"))} />
                  ))}
                  {(pickCands?.costs ?? []).map((c) => (
                    <PickRow key={c.id} title={c.vendor || c.description} meta={`${m("picker.costs")} · ${shortDate(dayDate(dayOfIso(c.date)), locale)}${c.projectName ? ` · ${c.projectName}` : ""}`} amount={money(c.totalCents / 100, locale)}
                      onPress={() => choose(() => booksApi.matchCost(pick.id, c.id), m("toast.matched"))} />
                  ))}
                </RowList>
              </Card>
            )}
          </Stack>
        ) : null}
      </Sheet>
    </Screen>
  );
}

function PickRow({ title, meta, amount, onPress }: { title: string; meta: string; amount: string; onPress: () => void }) {
  return <ListRow title={title} meta={meta} trailing={<Num size={14.5} weight={600}>{amount}</Num>} onPress={onPress} />;
}
