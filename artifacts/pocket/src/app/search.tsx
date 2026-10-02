// Search.dc.html. One box over the company's quotes, clients, jobs, invoices and the app's own pages: type to see matches grouped by kind (three each, "See all"
// for the rest, a chip per kind with its count), the match drawn in the title, accents ignored; with nothing typed, recent searches and what was opened lately.
// States: empty box, results, nothing matches, loading and can't load. The lists are the ones the other screens read (so they are searched on the phone, offline too).
// The design links to Search from nowhere (navigation.json has no way in), so it is reached at /search until the owner says where it opens from.
import { useEffect, useMemo, useState } from "react";
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useListQuotes } from "@workspace/api-client-react";
import { tintFor, type ClientRow } from "@/lib/clients";
import { dateOnly, jobState, type Job, type JobsResponse } from "@/lib/jobs";
import { clientsApi } from "@/lib/clientsApi";
import { daysLate, invoiceLook, type InvoiceDto } from "@/lib/invoices";
import { invoicesApi } from "@/lib/invoicesApi";
import { jobsApi } from "@/lib/jobsApi";
import { initialsOf } from "@/lib/invites";
import { kvGet, kvSet } from "@/lib/kv";
import { money, shortDate, type Locale } from "@/lib/format";
import { screenHref } from "@/lib/nav";
import { notificationsApi } from "@/lib/notificationsApi";
import { OPENED_KEY } from "@/lib/recents";
import { jobLine, quoteNumber, quoteState, type QuoteLike } from "@/lib/quotes";
import { TYPES, addOpened, addSearch, isOpened, parseList, search, type Hit, type Opened, type SearchType, type TypeFilter } from "@/lib/search";
import { useSession } from "@/lib/useSession";
import { Card } from "@/ui/Card";
import { Chip, ChipStrip, ChipWrap } from "@/ui/Chip";
import { Banner, Empty, Skeleton } from "@/ui/Feedback";
import { ScrollPage, Section } from "@/ui/Layout";
import { SectionHeader } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { GroupHead, HitAmount, HitKind, HitRow, SearchTop } from "@/ui/SearchPage";
import { Status, type StatusShape, type StatusTone } from "@/ui/Status";

const RECENT_KEY = "quoteai_recent_searches";

/** What a hit carries to be drawn and opened. */
type Ref =
  | { kind: "quote"; q: QuoteLike }
  | { kind: "client"; c: ClientRow }
  | { kind: "job"; j: Job }
  | { kind: "invoice"; i: InvoiceDto }
  | { kind: "page"; screen: string; icon: "gear" | "bell" | "list" | "users" | "tag" | "shield" | "link" | "house"; tone: "slate" | "violet" | "lilac" | "sage" | "teal" | "azure"; sub: string };

const QUOTE_LOOK: Record<string, { tone: StatusTone; shape: StatusShape }> = {
  draft: { tone: "mute", shape: "draft" }, sent: { tone: "info", shape: "q1" }, expiring: { tone: "warn", shape: "clock" }, viewed: { tone: "acc", shape: "q2" },
  accepted: { tone: "ok", shape: "check" }, declined: { tone: "bad", shape: "x" }, expired: { tone: "mute", shape: "off" },
};
const JOB_LOOK: Record<string, { tone: StatusTone; shape: StatusShape }> = {
  setup: { tone: "acc", shape: "q2" }, planning: { tone: "info", shape: "q1" }, active: { tone: "ok", shape: "live" }, hold: { tone: "warn", shape: "pause" }, done: { tone: "mute", shape: "check" },
};

export default function SearchScreen() {
  const { t: tr, i18n } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`sr.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const quotesQ = useListQuotes({ query: { enabled: signedIn, retry: 1 } } as never);
  const clientsQ = useQuery({ queryKey: ["clients-overview"], queryFn: clientsApi.overview, enabled: signedIn, retry: 1, staleTime: 30_000 });
  const jobsQ = useQuery({ queryKey: ["jobs"], queryFn: jobsApi.list, enabled: signedIn, retry: 1, staleTime: 30_000 });
  const invoicesQ = useQuery({ queryKey: ["invoices"], queryFn: invoicesApi.list, enabled: signedIn, retry: 1, staleTime: 15_000 });
  const unreadQ = useQuery({ queryKey: ["notifications", "list"], queryFn: notificationsApi.list, enabled: signedIn, retry: 0, staleTime: 30_000 });

  const [term, setTerm] = useState("");
  const [type, setType] = useState<TypeFilter>("all");
  const [recent, setRecent] = useState<string[]>([]);
  const [opened, setOpened] = useState<Opened[]>([]);
  const now = useMemo(() => new Date(), []);

  useEffect(() => {
    let live = true;
    void Promise.all([kvGet(RECENT_KEY), kvGet(OPENED_KEY)]).then(([r, o]) => {
      if (!live) return;
      setRecent(parseList(r, (v): v is string => typeof v === "string"));
      setOpened(parseList(o, isOpened));
    });
    return () => { live = false; };
  }, []);

  const m2 = (cents: number) => money(cents / 100, locale);
  const quotes = ((quotesQ.data as unknown as QuoteLike[] | undefined) ?? []).filter((q) => !q.archivedAt);
  const clients = clientsQ.data?.items ?? [];
  const jobs = (jobsQ.data as JobsResponse | undefined)?.items ?? [];
  const invoices = (invoicesQ.data?.items ?? []).filter((i) => !i.archivedAt);
  const unread = unreadQ.data?.unread ?? 0;

  const jobDetail = (j: Job): string => {
    const s = jobState(j);
    if (s === "done") return j.completedAt ? t("jobFinished", { date: shortDate(new Date(j.completedAt), locale) }) : t("jobState.done");
    if (s === "planning") return j.plannedStart ? t("jobStarts", { date: shortDate(dateOnly(j.plannedStart), locale) }) : t("jobState.planning");
    if (s === "hold") return t("jobWaiting");
    return `${j.progressPercent}%`;
  };

  const hits = useMemo<Hit<Ref>[]>(() => {
    const out: Hit<Ref>[] = [];
    for (const q of quotes) {
      const title = q.clientData.nome;
      out.push({ type: "quotes", id: q.id, title, haystack: [quoteNumber(q), title, jobLine(q), q.clientData.indirizzo ?? ""].join(" "), ref: { kind: "quote", q } });
    }
    for (const c of clients) out.push({ type: "clients", id: c.id, title: c.name, haystack: [c.name, c.address ?? "", c.city ?? "", c.email ?? "", c.phone ?? ""].join(" "), ref: { kind: "client", c } });
    for (const j of jobs) out.push({ type: "jobs", id: j.id, title: j.name, haystack: [j.name, j.clientName ?? "", j.address].join(" "), ref: { kind: "job", j } });
    for (const i of invoices) {
      const late = daysLate(i.dueDate, now);
      out.push({ type: "invoices", id: i.id, title: i.number, haystack: [i.number, i.clientName ?? i.customer.name ?? "", i.projectName ?? "", i.title ?? "", late > 0 && i.status !== "paid" ? tr("sr.invState.overdue") : ""].join(" "), ref: { kind: "invoice", i } });
    }
    const pages: { screen: string; key: string; icon: Extract<Ref, { kind: "page" }>["icon"]; tone: Extract<Ref, { kind: "page" }>["tone"] }[] = [
      { screen: "Settings", key: "settings", icon: "gear", tone: "slate" }, { screen: "Notifications", key: "notifications", icon: "bell", tone: "violet" }, { screen: "Menu", key: "menu", icon: "list", tone: "slate" },
      { screen: "Team", key: "team", icon: "users", tone: "lilac" }, { screen: "PriceBook", key: "priceBook", icon: "tag", tone: "sage" }, { screen: "Compliance", key: "compliance", icon: "shield", tone: "teal" },
      { screen: "Integrations", key: "integrations", icon: "link", tone: "azure" }, { screen: "SmartHome", key: "home", icon: "house", tone: "violet" },
    ];
    for (const p of pages) {
      const key = p.key === "notifications" && unread === 0 ? "notificationsNone" : p.key;
      const title = tr(`sr.pages.${key}.t`);
      const sub = tr(`sr.pages.${key}.s`, { count: unread });
      out.push({ type: "pages", id: p.screen, title, haystack: `${title} ${sub}`, ref: { kind: "page", screen: p.screen, icon: p.icon, tone: p.tone, sub } });
    }
    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotes.length, clients.length, jobs.length, invoices.length, unread, now, i18n.language, quotesQ.dataUpdatedAt, jobsQ.dataUpdatedAt, invoicesQ.dataUpdatedAt, clientsQ.dataUpdatedAt]);

  if (status === "out") return <Redirect href="/" />;

  const loading = [quotesQ, clientsQ, jobsQ, invoicesQ].every((x) => x.isPending) && hits.length <= TYPES.length;
  const partial = [quotesQ, clientsQ, jobsQ, invoicesQ].some((x) => x.isError) && !loading;
  const allFailed = [quotesQ, clientsQ, jobsQ, invoicesQ].every((x) => x.isError);
  const typed = term.trim().length > 0;
  const found = typed ? search<Ref>(hits, term, type) : null;

  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("SmartHome", t("cancel"))));
  const remember = async (o?: Opened) => {
    const r = addSearch(recent, term);
    setRecent(r);
    await kvSet(RECENT_KEY, JSON.stringify(r));
    if (o) { const l = addOpened(opened, o); setOpened(l); await kvSet(OPENED_KEY, JSON.stringify(l)); }
  };
  const submit = () => { if (typed) void remember(); };

  const subOf = (h: Hit<Ref>): string => {
    const r = h.ref;
    switch (r.kind) {
      case "quote": { const n = quoteNumber(r.q); const job = jobLine(r.q); return n && job ? t("quoteSub", { number: n, job }) : n || job; }
      case "client": return [r.c.address, r.c.city].filter(Boolean).join(", ") || r.c.email || r.c.phone || "";
      case "job": return r.j.clientName ? t("jobSub", { client: r.j.clientName, detail: jobDetail(r.j) }) : jobDetail(r.j);
      case "invoice": return r.i.clientName ?? r.i.customer.name ?? "";
      case "page": return r.sub;
    }
  };

  const open = (h: Hit<Ref>) => {
    const r = h.ref;
    const o = (type: Opened["type"]): Opened => ({ type, id: h.id, title: h.title, sub: subOf(h) });
    switch (r.kind) {
      case "quote": void remember(o("quotes")); router.push(screenHref("Quote", h.title, { id: h.id })); break;
      case "client": void remember(o("clients")); router.push(screenHref("Client", h.title, { id: h.id })); break;
      case "job": void remember(o("jobs")); router.push(screenHref("Job", h.title, { id: h.id })); break;
      case "invoice": void remember(o("invoices")); router.push(screenHref("Invoice", h.title, { id: h.id })); break;
      case "page": void remember(); router.push(screenHref(r.screen, h.title)); break;
    }
  };

  const rowOf = (h: Hit<Ref>, first: boolean) => {
    const r = h.ref;
    const sub = subOf(h);
    switch (r.kind) {
      case "quote": {
        const s = quoteState(r.q, now);
        const look = QUOTE_LOOK[s]!;
        return <HitRow key={`${h.type}${h.id}`} first={first} icon="doc" tone="violet" title={h.title} term={term} sub={sub} onPress={() => open(h)}
          right={<><HitAmount>{m2(Math.round(r.q.totale * 100))}</HitAmount><Status tone={look.tone} shape={look.shape}>{t(`quoteState.${s}`)}</Status></>} />;
      }
      case "client":
        return <HitRow key={`${h.type}${h.id}`} first={first} avatar={{ initials: initialsOf(h.title), tint: tintFor(h.title) }} title={h.title} term={term} sub={sub} chevron onPress={() => open(h)} />;
      case "job": {
        const s = jobState(r.j);
        const look = JOB_LOOK[s]!;
        return <HitRow key={`${h.type}${h.id}`} first={first} icon={s === "planning" ? "cone" : "house"} tone={s === "done" ? "slate" : s === "planning" || s === "hold" ? "amber" : "teal"} title={h.title} term={term} sub={sub} onPress={() => open(h)}
          right={<Status tone={look.tone} shape={look.shape}>{t(`jobState.${s}`)}</Status>} />;
      }
      case "invoice": {
        const late = daysLate(r.i.dueDate, now);
        const l = invoiceLook(r.i.status, late);
        const word = l.word === "late" ? t("invoiceOverdue", { count: late }) : t(`invState.${l.word}`);
        return <HitRow key={`${h.type}${h.id}`} first={first} icon="receipt" tone={l.word === "late" ? "clay" : "amber"} title={h.title} term={term} sub={sub} onPress={() => open(h)}
          right={<><HitAmount>{m2(r.i.totalCents)}</HitAmount><Status tone={l.look.tone} shape={l.look.shape}>{word}</Status></>} />;
      }
      case "page":
        return <HitRow key={`${h.type}${h.id}`} first={first} icon={r.icon} tone={r.tone} title={h.title} term={term} sub={sub} chevron onPress={() => open(h)} />;
    }
  };

  const openedRow = (o: Opened, i: number) => {
    const icon = o.type === "quotes" ? { icon: "doc" as const, tone: "violet" as const } : o.type === "jobs" ? { icon: "house" as const, tone: "teal" as const } : { icon: "receipt" as const, tone: "clay" as const };
    const screen = o.type === "quotes" ? "Quote" : o.type === "clients" ? "Client" : o.type === "jobs" ? "Job" : "Invoice";
    return (
      <HitRow key={`${o.type}${o.id}`} first={i === 0} {...(o.type === "clients" ? { avatar: { initials: initialsOf(o.title), tint: tintFor(o.title) } } : icon)} title={o.title} sub={o.sub}
        right={<HitKind>{t(`kind.${o.type}`)}</HitKind>} onPress={() => router.push(screenHref(screen, o.title, { id: o.id }))} />
    );
  };

  return (
    <Screen>
      <ScrollPage bottom={40}>
        <SearchTop value={term} onChange={(v) => { setTerm(v); if (!v) setType("all"); }} onSubmit={submit} placeholder={t("placeholder")} label={t("label")} clearLabel={t("clear")} cancel={t("cancel")} onCancel={back} />
        <Section delay={40} pt={12}>
          <ChipStrip label={t("typeLabel")}>
            {(["all", ...TYPES] as TypeFilter[]).map((ty) => <Chip key={ty} label={t(`types.${ty}`)} count={found ? found.counts[ty] : undefined} selected={type === ty} onPress={() => setType(ty)} />)}
          </ChipStrip>
        </Section>

        {allFailed ? (
          <Section pt={26} px={16}><Empty icon="warn" iconTone="clay" title={t("loadFailed.title")} body={t("loadFailed.body")} action={t("retry")} onAction={() => { void quotesQ.refetch(); void clientsQ.refetch(); void jobsQ.refetch(); void invoicesQ.refetch(); }} /></Section>
        ) : loading ? (
          <Section pt={22} px={16} gap={12}><Skeleton height={44} radius={22} /><Skeleton height={220} radius={22} /></Section>
        ) : (
          <>
            {partial && typed ? <Section pt={14} px={16}><Banner tone="warn" icon="cloud" iconTone="amber" lead={t("partial.lead")}>{t("partial.body")}</Banner></Section> : null}
            {!typed ? (
              <>
                {recent.length ? (
                  <Section delay={80} pt={22} px={16}>
                    <SectionHeader title={t("recentSearches")} link={t("clearRecent")} onLink={() => { setRecent([]); void kvSet(RECENT_KEY, null); }} />
                    <ChipWrap>{recent.map((r) => <Chip key={r} label={r} onPress={() => setTerm(r)} />)}</ChipWrap>
                  </Section>
                ) : null}
                {opened.length ? (
                  <Section delay={120} pt={24} px={16}>
                    <SectionHeader title={t("opened")} />
                    <Card>{opened.map(openedRow)}</Card>
                  </Section>
                ) : null}
              </>
            ) : found && found.groups.length ? (
              found.groups.map((g) => (
                <Section key={g.type} pt={20} px={16}>
                  <GroupHead title={t(`types.${g.type}`)} count={g.n} link={g.more ? t("seeAll") : undefined} onLink={() => setType(g.type as SearchType)} />
                  <Card>{g.rows.map((h, i) => rowOf(h, i === 0))}</Card>
                </Section>
              ))
            ) : (
              <Section delay={60} pt={60}><Empty icon="search" iconTone="slate" title={t("none.title", { q: term.trim() })} body={t("none.body")} action={t("none.action")} actionKind="secondary" onAction={() => { setTerm(""); setType("all"); }} /></Section>
            )}
          </>
        )}
      </ScrollPage>
    </Screen>
  );
}

