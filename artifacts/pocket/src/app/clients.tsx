// Clients.dc.html. The tab: the three figures (an expandable card with who owes and the top clients), search,
// Active / Prospects chips, then every client, most recent activity first. A row opens in place: call, text
// or email, what is going on with them (a late invoice, the running job, the latest quotes), three figures,
// New quote and Open client. States: list, no match, no clients, loading, can't load, offline.
import { useMemo, useState } from "react";
import { Linking } from "react-native";
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CLIENT_FILTERS, contactLine, contactLinks, formatPhone, matchesClientFilter, matchesClientSearch, owingClients, peekRows, tintFor, topClients, yearTrend, type ClientDetail, type ClientFilter, type ClientRow, type PeekRow } from "@/lib/clients";
import { clientsApi } from "@/lib/clientsApi";
import { money, relativeWhen, type Locale } from "@/lib/format";
import { initialsOf } from "@/lib/invites";
import { screenHref } from "@/lib/nav";
import { useSession } from "@/lib/useSession";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Chip, ChipStrip } from "@/ui/Chip";
import { ContactButtons } from "@/ui/Clients";
import { ExpandCard, ExpandScrollView, XcActions, XcButton, XcCaption, XcDivider, XcRow, useExpandOpen } from "@/ui/Expand";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { IconButton, TabHeader } from "@/ui/Header";
import { Glyph } from "@/ui/Icon";
import { Section } from "@/ui/Layout";
import { Figures, MiniFigures } from "@/ui/Numbers";
import { RowBody, RowList, SectionHeader } from "@/ui/Row";
import { Search } from "@/ui/Search";
import { Status, type StatusShape, type StatusTone } from "@/ui/Status";
import { TAB_BAR_SPACE } from "@/ui/TabBar";
import { TabScreen } from "@/ui/TabShell";
import { Num, Text } from "@/ui/Text";
import { AddClientSheet } from "@/home/AddClientSheet";

const QUOTE_STATUS: Record<string, { tone: StatusTone; shape: StatusShape }> = {
  draft: { tone: "mute", shape: "draft" }, sent: { tone: "info", shape: "q1" }, viewed: { tone: "acc", shape: "q2" }, expiring: { tone: "warn", shape: "clock" },
  accepted: { tone: "ok", shape: "check" }, declined: { tone: "bad", shape: "x" }, expired: { tone: "mute", shape: "off" },
};

export default function Clients() {
  const { t, i18n } = useTranslation();
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const q = useQuery({ queryKey: ["clients-overview"], queryFn: clientsApi.overview, enabled: signedIn, retry: 1, staleTime: 30_000 });
  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState<ClientFilter>("all");
  const [adding, setAdding] = useState(false);
  const now = useMemo(() => new Date(), [q.dataUpdatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const items = q.data?.items ?? [];
  const stats = q.data?.stats;
  const shown = useMemo(() => items.filter((c) => matchesClientFilter(c, filter) && matchesClientSearch(c, term)), [items, filter, term]);
  const owing = useMemo(() => owingClients(items), [items]);
  const top = useMemo(() => topClients(items), [items]);
  if (status === "out") return <Redirect href="/" />;

  const m = (cents: number, withCents = false) => money(cents / 100, locale, { cents: withCents });
  const openClient = (id: string) => router.push(screenHref("Client", t("clients.title"), { id }));
  const newQuote = () => router.push(screenHref("NewQuote", t("clients.newQuote")));
  const loading = q.isPending && !q.data;
  const failed = q.isError && !q.data;
  const trend = stats ? yearTrend(stats) : null;

  const activityText = (c: ClientRow) => (c.lastActivity ? t(`clients.activity.${c.lastActivity.kind}`, { when: relativeWhen(new Date(c.lastActivity.at), now, locale) }) : t("clients.activity.none"));
  const meta = (c: ClientRow) => `${t("clients.meta.quotes", { count: c.quoteCount })} · ${activityText(c)}`;

  return (
    <TabScreen active="clients">
      <TabHeader title={t("clients.title")}>
        <Button size="sm" label={t("clients.add")} icon={<Glyph name="plus" size={14} weight={2.4} color="on-inv" />} onPress={() => setAdding(true)} />
        <IconButton glyph="more" label={t("clients.more")} />
      </TabHeader>
      <ExpandScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {failed ? (
          <Section pt={26} px={16}><Empty icon="warn" iconTone="clay" title={t("clients.loadFailed.title")} body={t("clients.loadFailed.body")} action={t("clients.loadFailed.retry")} onAction={() => void q.refetch()} /></Section>
        ) : loading ? (
          <Section pt={16} px={16} gap={12}><Skeleton height={74} radius={22} /><Skeleton height={44} radius={14} /><Skeleton height={300} radius={22} /></Section>
        ) : items.length === 0 ? (
          <Section pt={26} px={16}><Empty icon="users" title={t("clients.none.title")} body={t("clients.none.body")} action={t("clients.none.action")} onAction={() => setAdding(true)} /></Section>
        ) : (
          <>
            {q.isError ? <Section pt={12} px={16}><Banner tone="info" icon="warn" iconTone="amber" lead={t("clients.offline")} /></Section> : null}
            {stats ? (
              <Section delay={50} pt={16} px={16}>
                <ExpandCard id="kpi" label={t("clients.glance")}
                  head={<Figures items={[
                    { label: t("clients.kpi.active"), value: String(stats.active), sub: stats.activeJobs ? t("clients.kpi.jobsRunning", { count: stats.activeJobs }) : undefined },
                    { label: t("clients.kpi.lifetime"), value: m(stats.lifetimeCents), sub: trend == null ? undefined : t(trend >= 0 ? "clients.kpi.thisYear" : "clients.kpi.lastYear", { pct: Math.abs(trend) }), subTone: trend != null && trend >= 0 ? "ok" : "bad" },
                    ...(stats.owedCents != null ? [{ label: t("clients.kpi.owed"), value: m(stats.owedCents), sub: stats.overdueCount ? t("clients.kpi.overdue", { count: stats.overdueCount }) : undefined, subTone: "bad" as const }] : []),
                  ]} />}>
                  <XcDivider />
                  {owing.length ? <XcCaption>{t("clients.owedToYou")}</XcCaption> : null}
                  {owing.map((c, i) => (
                    <XcRow key={c.id} first={i === 0} title={c.name} sub={t("clients.meta.quotes", { count: c.quoteCount })}
                      right={<><Num size={14.5} weight={600}>{m(c.owedCents ?? 0, true)}</Num>{(c.overdueCount ?? 0) > 0 ? <Status plain tone="bad" shape="alert">{t("clients.kpi.overdue", { count: c.overdueCount ?? 0 })}</Status> : null}</>} />
                  ))}
                  {top.length ? <XcCaption>{t("clients.topClients")}</XcCaption> : null}
                  {top.map((c, i) => <XcRow key={c.id} first={i === 0} title={c.name} sub={t("clients.meta.quotes", { count: c.quoteCount })} right={<Num size={14.5} weight={600}>{m(c.lifetimeCents)}</Num>} />)}
                </ExpandCard>
              </Section>
            ) : null}
            <Section delay={90} pt={14} px={16}>
              <Search label={t("clients.searchLabel")} placeholder={t("clients.searchPlaceholder")} value={term} onChangeText={setTerm} autoCorrect={false} />
            </Section>
            <Section delay={120} pt={12}>
              <ChipStrip label={t("clients.filter")}>
                {CLIENT_FILTERS.map((f) => <Chip key={f} label={t(`clients.filters.${f}`)} count={items.filter((c) => matchesClientFilter(c, f)).length} selected={filter === f} onPress={() => setFilter(f)} />)}
              </ChipStrip>
            </Section>
            {shown.length ? (
              <Section delay={150} pt={18} px={16}>
                <SectionHeader title={t("clients.count", { count: shown.length })} link={t("clients.recent")} />
                <Card style={{ overflow: "visible" }}>
                  <RowList>
                    {shown.map((c) => (
                      <ExpandCard key={c.id} id={c.id} variant="row" list="clients" label={c.name}
                        head={<RowBody leading={<Avatar initials={initialsOf(c.name)} tint={tintFor(c.name)} />} title={c.name} meta={`${contactLine(c, formatPhone)}\n${meta(c)}`}
                          trailing={<>
                            {c.lifetimeCents > 0 ? <Num size={14.5} weight={600}>{m(c.lifetimeCents)}</Num> : <Text size={12.5} weight={500} color="faint">{t("clients.noJobs")}</Text>}
                            <Status tone={c.status === "active" ? "ok" : "info"} shape={c.status === "active" ? "live" : "q1"}>{t(`clients.status.${c.status}`)}</Status>
                          </>} />}>
                        <XcDivider />
                        <ClientPeek c={c} now={now} locale={locale} onOpen={() => openClient(c.id)} onNewQuote={newQuote} />
                      </ExpandCard>
                    ))}
                  </RowList>
                </Card>
              </Section>
            ) : (
              <Section delay={150} pt={26} px={16}>
                <Empty icon="search" iconTone="slate" title={t("clients.empty.title")} body={t("clients.empty.body")} action={t("clients.empty.clear")} actionKind="secondary" onAction={() => { setTerm(""); setFilter("all"); }} />
              </Section>
            )}
          </>
        )}
      </ExpandScrollView>
      <AddClientSheet open={adding} onClose={() => setAdding(false)} onAdded={(id) => { setAdding(false); void q.refetch(); openClient(id); }} />
    </TabScreen>
  );
}

/** An open client card's body. It loads the client's detail only once the card is open. */
function ClientPeek({ c, now, locale, onOpen, onNewQuote }: { c: ClientRow; now: Date; locale: Locale; onOpen: () => void; onNewQuote: () => void }) {
  const { t } = useTranslation();
  const open = useExpandOpen(c.id);
  const toast = useToast();
  const client = useQueryClient();
  const detail = useQuery({ queryKey: ["client", c.id], queryFn: () => clientsApi.detail(c.id), enabled: open, retry: false, staleTime: 30_000 });
  const [nudged, setNudged] = useState<Record<string, true>>({});
  const links = contactLinks(c);
  const go = (url?: string) => { if (url) void Linking.openURL(url); };
  const rows: PeekRow[] = detail.data ? peekRows(detail.data as ClientDetail, now) : [];
  const m = (cents: number, withCents = false) => money(cents / 100, locale, { cents: withCents });
  const remind = async (id: string) => {
    try { await clientsApi.remind(id); setNudged((n) => ({ ...n, [id]: true })); void client.invalidateQueries({ queryKey: ["client", c.id] }); }
    catch { toast({ message: t("widgets.owed.remindFailed") }); }
  };
  const actions = [
    ...(links.call ? [{ key: "call", glyph: "phone" as const, label: t("clients.contact.call"), onPress: () => go(links.call) }] : []),
    ...(links.text ? [{ key: "text", glyph: "text" as const, label: t("clients.contact.text"), onPress: () => go(links.text) }] : []),
    ...(links.email ? [{ key: "email", glyph: "mail" as const, label: t("clients.contact.email"), onPress: () => go(links.email) }] : []),
  ];
  return (
    <>
      {actions.length ? <ContactButtons actions={actions} /> : null}
      <XcCaption>{[c.phone ? formatPhone(c.phone) : "", c.email ?? "", c.address ?? ""].filter(Boolean).join(" · ")}</XcCaption>
      {rows.map((r, i) => {
        if (r.type === "invoice") {
          return <XcRow key={r.id} first={i === 0} title={r.number} sub={<Status plain tone="bad" shape="alert">{t("clients.detail.stats.late", { count: r.daysLate })}</Status>}
            right={<><Num size={14.5} weight={600}>{m(r.amountCents, true)}</Num>{r.canRemind ? <XcButton label={nudged[r.id] ? t("clients.nudged") : t("clients.nudge")} tone={nudged[r.id] ? "done" : "primary"} onPress={() => { if (!nudged[r.id]) void remind(r.id); }} /> : null}</>} />;
        }
        if (r.type === "job") {
          return <XcRow key={r.id} first={i === 0} title={r.name} sub={t("clients.detail.stats.done", { pct: r.progressPercent })} right={<><Num size={14.5} weight={600}>{m(r.valueCents)}</Num><Status plain tone="ok" shape="live">{t("clients.status.active")}</Status></>} />;
        }
        const st = QUOTE_STATUS[r.state] ?? QUOTE_STATUS.draft!;
        return <XcRow key={r.id} first={i === 0} title={r.number ? `${r.number} · ${r.title}` : r.title} sub={undefined} right={<><Num size={14.5} weight={600}>{m(r.amountCents, true)}</Num><Status plain tone={st.tone} shape={st.shape}>{t(`quotes.status.${r.state}`, { day: "" })}</Status></>} />;
      })}
      <MiniFigures items={[
        { label: t("clients.stats.lifetime"), value: m(c.lifetimeCents) },
        ...(c.owedCents != null ? [{ label: t("clients.stats.owed"), value: m(c.owedCents) }] : []),
        { label: t("clients.stats.quotes"), value: String(c.quoteCount) },
      ]} />
      <XcActions link={t("clients.newQuote")} onLink={onNewQuote} main={t("clients.open")} onMain={onOpen} />
    </>
  );
}
