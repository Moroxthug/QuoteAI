// Client.dc.html. A client: who they are and four quick contacts, four figures, a banner when an invoice is late,
// their details (editable), and four records (Quotes, Jobs, Invoices, Messages with the client portal). The
// floating bar starts a new quote for them. States: loading, can't load, not found, offline.
import { useState } from "react";
import { Linking, Platform } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { contactLinks, formatPhone, tintFor, wonOf, type ClientDetail } from "@/lib/clients";
import { clientsApi } from "@/lib/clientsApi";
import { money, monthLong, relativeWhen, shortDate, type Locale } from "@/lib/format";
import { initialsOf } from "@/lib/invites";
import { screenHref } from "@/lib/nav";
import { invoiceLook } from "@/lib/invoices";
import { quoteState, type QuoteState } from "@/lib/quotes";
import { useRememberOpened } from "@/lib/recents";
import { useSession } from "@/lib/useSession";
import { ActionBar, ACTION_BAR_SPACE } from "@/ui/ActionBar";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { Header } from "@/ui/Header";
import { ClientHero, Bubble, ContactTiles, DetailRows, JobCard, PortalCard, SendButton, StatGrid } from "@/ui/Clients";
import { Icon } from "@/ui/Icon";
import { Section, Stack } from "@/ui/Layout";
import { Progress } from "@/ui/Numbers";
import { RowBody, RowList, SectionHeader } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Search } from "@/ui/Search";
import { Status, type StatusShape, type StatusTone } from "@/ui/Status";
import { Tabs } from "@/ui/Tabs";
import { Num, Text } from "@/ui/Text";
import { ClientEditSheet } from "@/home/ClientEditSheet";
import { Press } from "@/ui/motion";
import { Glyph } from "@/ui/Icon";
import { ScrollPage } from "@/ui/Layout";

const QUOTE_STATUS: Record<QuoteState, { tone: StatusTone; shape: StatusShape }> = {
  draft: { tone: "mute", shape: "draft" }, sent: { tone: "info", shape: "q1" }, viewed: { tone: "acc", shape: "q2" }, expiring: { tone: "warn", shape: "clock" },
  accepted: { tone: "ok", shape: "check" }, declined: { tone: "bad", shape: "x" }, expired: { tone: "mute", shape: "off" },
};
const TABS = ["quotes", "jobs", "invoices", "messages"] as const;

export default function Client() {
  const { t, i18n } = useTranslation();
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const toast = useToast();
  const client = useQueryClient();
  const q = useQuery({ queryKey: ["client", id], queryFn: () => clientsApi.detail(id!), enabled: signedIn && !!id, retry: 1, staleTime: 30_000 });
  const [tab, setTab] = useState(0);
  const [editing, setEditing] = useState(false);
  const [reminded, setReminded] = useState(false);
  const now = new Date();
  useRememberOpened(q.data ? { type: "clients", id: q.data.client.id, title: q.data.client.name, sub: [q.data.client.address, q.data.client.city].filter(Boolean).join(", ") } : null);
  if (status === "out") return <Redirect href="/" />;

  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("Clients", t("clients.title"))));
  const d = q.data;
  const header = <Header title="" backLabel={t("clients.detail.back")} onBack={back} moreLabel={t("clients.detail.more")} onMore={() => setEditing(true)} />;

  if (q.isError && !d) {
    const notFound = (q.error as { status?: number } | null)?.status === 404;
    return (
      <Screen>
        {header}
        <Section pt={26} px={16}>
          {notFound ? <Empty icon="users" iconTone="slate" title={t("clients.detail.notFound.title")} body={t("clients.detail.notFound.body")} action={t("clients.detail.back")} actionKind="secondary" onAction={back} />
            : <Empty icon="warn" iconTone="clay" title={t("clients.detail.loadFailed.title")} body={t("clients.detail.loadFailed.body")} action={t("clients.detail.loadFailed.retry")} onAction={() => void q.refetch()} />}
        </Section>
      </Screen>
    );
  }
  if (!d) return <Screen>{header}<Section pt={6} px={16} gap={12}><Skeleton height={230} radius={22} /><Skeleton height={150} radius={22} /><Skeleton height={120} radius={22} /></Section></Screen>;

  const c = d.client;
  const m = (cents: number, withCents = false) => money(cents / 100, locale, { cents: withCents });
  const links = contactLinks(c);
  const go = (url?: string) => { if (url) void Linking.openURL(url); };
  const won = wonOf(d.quotes);
  const place = [c.address, c.city].filter(Boolean).join(", ");
  const owed = c.owedCents;
  const running = c.activeJobs;
  const runningJob = (d.jobs ?? []).find((j) => !j.completedAt && j.status !== "completed");
  const worst = d.worstOverdue;

  const remind = async () => {
    if (!worst) return;
    try { await clientsApi.remind(worst.id); setReminded(true); void client.invalidateQueries({ queryKey: ["client", id] }); }
    catch { toast({ message: t("clients.detail.remindFailed") }); }
  };

  const detailRows = [
    { k: t("clients.detail.rows.address"), v: place || t("clients.detail.rows.none") },
    { k: t("clients.detail.rows.phone"), v: c.phone ? formatPhone(c.phone) : t("clients.detail.rows.none"), mono: !!c.phone },
    { k: t("clients.detail.rows.email"), v: c.email ?? t("clients.detail.rows.none") },
    { k: t("clients.detail.rows.language"), v: t(`clients.detail.language.${c.preferredLanguage === "fr" ? "fr" : "en"}`) },
    { k: t("clients.detail.rows.business"), v: c.businessNumber ?? t("clients.detail.rows.none") },
    ...(c.notes.trim() ? [{ k: t("clients.detail.rows.notes"), v: c.notes.trim() }] : []),
  ];

  return (
    <Screen floating={<ActionBar label={t("clients.detail.newQuoteFor", { name: c.name })} onPress={() => router.push(screenHref("NewQuote", t("clients.newQuote"), { client: c.id }))} moreLabel={t("clients.detail.more")} onMore={() => setEditing(true)} icon={<Glyph name="plus" size={15} weight={2.4} color="on-inv" />} />}>
      {header}
      <ScrollPage bottom={ACTION_BAR_SPACE}>
        <Section delay={0} pt={6} px={16}>
          <ClientHero avatar={<Avatar initials={initialsOf(c.name)} tint={tintFor(c.name)} size={58} />} name={c.name} address={place || undefined}
            status={<Status tone={c.status === "active" ? "ok" : "info"} shape={c.status === "active" ? "live" : "q1"}>{t(`clients.status.${c.status}`)}</Status>}
            since={t("clients.detail.since", { date: `${monthLong(new Date(c.createdAt), locale)} ${new Date(c.createdAt).getFullYear()}` })}>
            <ContactTiles tiles={[
              { key: "call", icon: "phone", tone: "sage", label: t("clients.contact.call"), aria: `${t("clients.contact.call")} ${c.name}`, onPress: () => go(links.call), disabled: !links.call },
              { key: "text", icon: "chat", tone: "azure", label: t("clients.contact.text"), aria: `${t("clients.contact.text")} ${c.name}`, onPress: () => go(links.text), disabled: !links.text },
              { key: "email", icon: "mail", tone: "sky", label: t("clients.contact.email"), aria: `${t("clients.contact.email")} ${c.name}`, onPress: () => go(links.email), disabled: !links.email },
              { key: "map", icon: "pin", tone: "clay", label: t("clients.contact.map"), aria: place ? `${t("clients.contact.map")}: ${place}` : t("clients.contact.map"), onPress: () => go(links.map), disabled: !links.map },
            ]} />
          </ClientHero>
        </Section>
        <Section delay={60} pt={12} px={16}>
          <StatGrid items={[
            { label: t("clients.detail.stats.won"), value: won ? t("clients.detail.stats.wonOf", { won: won.won, of: won.of }) : "–", sub: won ? t("clients.detail.stats.rate", { pct: won.percent }) : t("clients.detail.stats.noRate") },
            { label: t("clients.detail.stats.total"), value: m(c.lifetimeCents), sub: t("clients.detail.stats.since", { date: `${monthLong(new Date(c.createdAt), locale)} ${new Date(c.createdAt).getFullYear()}` }) },
            ...(owed != null ? [{ label: t("clients.detail.stats.owed"), value: m(owed), sub: worst ? t("clients.detail.stats.late", { count: worst.daysLate }) : t("clients.detail.stats.none"), tone: worst ? ("bad" as const) : ("muted" as const) }] : []),
            ...(d.jobs ? [{ label: t("clients.detail.stats.jobs"), value: String(c.jobCount), sub: running && runningJob ? `${t("clients.detail.stats.running", { count: running })}, ${t("clients.detail.stats.done", { pct: runningJob.progressPercent })}` : t("clients.detail.stats.noJobs"), tone: running ? ("ok" as const) : ("muted" as const) }] : []),
          ]} />
        </Section>
        {worst ? (
          <Section delay={100} pt={12} px={16}>
            <Banner tone="bad" icon="bell" iconTone="clay" lead={t("clients.detail.banner", { number: worst.number, count: worst.daysLate })}>{t("clients.detail.bannerAmount", { amount: m(worst.balanceCents, true) })}</Banner>
            {worst.canRemind ? <Stack align="flex-end" pt={8}><Button size="sm" kind={reminded ? "secondary" : "primary"} label={reminded ? t("clients.detail.reminded") : t("clients.detail.remind")} disabled={reminded} onPress={() => void remind()} /></Stack> : null}
          </Section>
        ) : null}
        <Section delay={140} pt={22} px={16}>
          <SectionHeader title={t("clients.detail.details")} link={t("clients.detail.edit")} onLink={() => setEditing(true)} />
          <DetailRows rows={detailRows} />
        </Section>
        <Section delay={180} pt={22}>
          <Tabs tabs={TABS.map((k) => t(`clients.detail.tabs.${k}`))} active={tab} onChange={setTab} />
        </Section>
        <Section pt={16} px={16}>
          {tab === 0 ? <QuotesTab d={d} locale={locale} now={now} m={m} /> : tab === 1 ? <JobsTab d={d} locale={locale} m={m} /> : tab === 2 ? <InvoicesTab d={d} locale={locale} m={m} /> : <MessagesTab d={d} locale={locale} />}
        </Section>
      </ScrollPage>
      <ClientEditSheet open={editing} client={c} onClose={() => setEditing(false)} onSaved={(r) => { client.setQueryData(["client", id], r); void client.invalidateQueries({ queryKey: ["clients-overview"] }); setEditing(false); }} />
    </Screen>
  );
}

type Fmt = (cents: number, withCents?: boolean) => string;

function QuotesTab({ d, locale, now, m }: { d: ClientDetail; locale: Locale; now: Date; m: Fmt }) {
  const { t } = useTranslation();
  if (d.quotes.length === 0) return <Empty icon="file" title={t("clients.detail.noQuotes")} body="" />;
  return (
    <Card>
      <RowList>
        {d.quotes.map((x) => {
          const s = quoteState({ status: x.acceptedAt ? "accepted" : "draft", sentAt: x.sentAt, acceptedAt: x.acceptedAt, firstViewedAt: x.firstViewedAt, declinedAt: x.declinedAt, validDays: x.validDays }, now);
          const st = QUOTE_STATUS[s];
          const when = s === "accepted" ? t("clients.detail.when.accepted", { date: shortDate(new Date(x.acceptedAt!), locale) }) : s === "declined" ? t("clients.detail.when.declined", { date: shortDate(new Date(x.declinedAt!), locale) }) : x.sentAt ? t("clients.detail.when.sent", { date: shortDate(new Date(x.sentAt), locale) }) : t("clients.detail.when.drafted", { date: shortDate(new Date(x.createdAt), locale) });
          const title = x.title && x.title !== "Project Quote & Itemized Estimate" ? x.title : x.description.split("\n")[0]!.slice(0, 60);
          return (
            <Press key={x.id} onPress={() => router.push(screenHref("Quote", t("quotes.actions.openQuote"), { id: x.id }))} accessibilityRole="button" accessibilityLabel={title}>
              <RowBody leading={<Icon name="doc" tone={s === "declined" ? "slate" : "indigo"} size={26} />} title={title} meta={[x.number, when].filter(Boolean).join(" · ")}
                trailing={<><Num size={14.5} weight={600}>{m(x.totalCents, true)}</Num><Status tone={st.tone} shape={st.shape}>{t(`quotes.status.${s}`, { day: "" })}</Status></>} />
            </Press>
          );
        })}
      </RowList>
    </Card>
  );
}

function JobsTab({ d, locale, m }: { d: ClientDetail; locale: Locale; m: Fmt }) {
  const { t } = useTranslation();
  if (!d.jobs || d.jobs.length === 0) return <Empty icon="hammer" iconTone="amber" title={t("clients.detail.noJobs")} body="" />;
  return (
    <Stack gap={12}>
      {d.jobs.map((j) => {
        const done = !!j.completedAt || j.status === "completed";
        const tone: StatusTone = done ? "mute" : j.status === "suspended" ? "warn" : j.status === "planning" ? "info" : "ok";
        const word = done ? t("clients.detail.jobDone") : j.status === "suspended" ? t("clients.detail.jobPaused") : j.status === "planning" ? t("clients.detail.jobPlanning") : t("clients.detail.jobOnTrack");
        return (
          <JobCard key={j.id} icon={<Icon name="hammer" tone="amber" size={30} />} name={j.name} dates={j.plannedStart && j.plannedEnd ? t("clients.detail.jobDates", { from: shortDate(new Date(j.plannedStart), locale), to: shortDate(new Date(j.plannedEnd), locale) }) : j.address}
            status={<Status tone={tone} shape={done ? "check" : "live"}>{word}</Status>} phaseLabel={t("clients.detail.progress")}
            percent={<Num size={15} weight={600}>{`${j.progressPercent}%`}</Num>}>
            <Stack mt={8}><Progress value={j.progressPercent / 100} /></Stack>
            <Stack mt={16} gap={2}><Text size={12.5} color="muted">{t("clients.detail.jobValue")}</Text><Num size={13.5} weight={600}>{m(j.contractValueCents)}</Num></Stack>
          </JobCard>
        );
      })}
    </Stack>
  );
}

function InvoicesTab({ d, locale, m }: { d: ClientDetail; locale: Locale; m: Fmt }) {
  const { t } = useTranslation();
  if (!d.invoices || d.invoices.length === 0) return <Empty icon="receipt" iconTone="clay" title={t("clients.detail.noInvoices")} body="" />;
  return (
    <>
      <Card>
        <RowList>
          {d.invoices.map((i) => {
            const paid = i.status === "paid";
            const late = i.daysLate > 0;
            const { word, look } = invoiceLook(i.status as never, i.daysLate);
            const when = paid ? t("clients.detail.when.paid", { date: shortDate(new Date(i.issueDate), locale) }) : late ? t("clients.detail.when.overdue", { date: shortDate(new Date(i.dueDate), locale), count: i.daysLate }) : t("clients.detail.when.due", { date: shortDate(new Date(i.dueDate), locale) });
            return (
              <Press key={i.id} onPress={() => router.push(screenHref("Invoice", t("menu.rows.invoices.label"), { id: i.id }))} accessibilityRole="button" accessibilityLabel={i.number}>
                <RowBody leading={<Icon name="receipt" tone={late ? "clay" : "sage"} size={26} />} title={i.projectName ?? i.number} meta={`${i.number} · ${when}`}
                  trailing={<><Num size={14.5} weight={600}>{m(i.totalCents, true)}</Num><Status tone={look.tone} shape={look.shape}>{t(`clients.detail.invoiceStatus.${word}`)}</Status></>} />
              </Press>
            );
          })}
        </RowList>
      </Card>
      <Stack row justify="space-between" pt={12} px={4}>
        <Text size={12.5} color="muted">{t("clients.detail.invoiced")} <Num size={12.5} weight={400}>{m(d.invoicedCents ?? 0, true)}</Num></Text>
        <Text size={12.5} color="muted">{t("clients.detail.owedLabel")} <Num size={12.5} weight={600} color={d.client.owedCents ? "bad" : "ink"}>{m(d.client.owedCents ?? 0, true)}</Num></Text>
      </Stack>
    </>
  );
}

function MessagesTab({ d, locale }: { d: ClientDetail; locale: Locale }) {
  const { t } = useTranslation();
  const toast = useToast();
  const client = useQueryClient();
  const c = d.client;
  const first = c.name.split(/[\s&]+/).filter(Boolean)[0] ?? c.name;
  const thread = useQuery({ queryKey: ["client-messages", c.id], queryFn: () => clientsApi.messages(c.id), retry: false });
  const portal = useQuery({ queryKey: ["client-portal", c.id], queryFn: () => clientsApi.portal(c.id), retry: false });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [invited, setInvited] = useState(false);
  const now = new Date();
  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try { await clientsApi.send(c.id, body); setText(""); void client.invalidateQueries({ queryKey: ["client-messages", c.id] }); }
    catch { toast({ message: t("clients.detail.sendFailed") }); }
    finally { setBusy(false); }
  };
  const p = portal.data;
  const copy = async () => {
    if (!p?.url) return;
    try { if (Platform.OS === "web" && navigator.clipboard) await navigator.clipboard.writeText(p.url); else await Clipboard.setStringAsync(p.url); setCopied(true); } catch { /* the link is shown on the card */ }
  };
  const invite = async () => {
    try { await clientsApi.invite(c.id); setInvited(true); void client.invalidateQueries({ queryKey: ["client-portal", c.id] }); }
    catch { toast({ message: t("clients.detail.sendFailed") }); }
  };
  return (
    <Stack gap={18}>
      <Stack gap={10}>
        {(thread.data?.messages ?? []).length === 0 ? <Text size={13.5} color="muted" align="center">{t("clients.detail.noMessages")}</Text> : null}
        {(thread.data?.messages ?? []).map((x) => <Bubble key={x.id} mine={x.sender === "contractor"} text={x.body} time={relativeWhen(new Date(x.createdAt), now, locale)} />)}
      </Stack>
      <Stack row align="center" gap={8}>
        <Stack grow><Search label={t("clients.detail.messageLabel", { name: first })} placeholder={t("clients.detail.messagePlaceholder", { name: first })} value={text} onChangeText={setText} onSubmitEditing={() => void send()} returnKeyType="send" /></Stack>
        <SendButton label={t("clients.detail.send")} disabled={!text.trim() || busy} onPress={() => void send()} />
      </Stack>
      {p ? (
        <PortalCard icon={<Icon name="globe" tone="violet" size={30} />} title={t("clients.detail.portal.title")} sub={t("clients.detail.portal.sub")} link={p.url}
          status={<Status tone={p.lastSeenAt ? "acc" : "mute"} shape={p.lastSeenAt ? "q2" : "off"}>{p.lastSeenAt ? t("clients.detail.portal.opened", { when: relativeWhen(new Date(p.lastSeenAt), now, locale) }) : t("clients.detail.portal.notOpened")}</Status>}
          note={p.lastSeenAt ? t("clients.detail.portal.last", { name: first, when: relativeWhen(new Date(p.lastSeenAt), now, locale) }) : p.hasEmail ? t("clients.detail.portal.never", { name: first }) : t("clients.detail.portal.noEmail")}>
          <Stack grow><Button kind="secondary" size="md" label={copied ? t("clients.detail.portal.copied") : t("clients.detail.portal.copy")} onPress={() => void copy()} block /></Stack>
          <Stack grow><Button kind="secondary" size="md" label={invited ? t("clients.detail.portal.invited") : t("clients.detail.portal.invite", { name: first })} disabled={!p.hasEmail || invited} onPress={() => void invite()} block /></Stack>
        </PortalCard>
      ) : null}
    </Stack>
  );
}

