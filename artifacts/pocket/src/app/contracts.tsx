// Contracts.dc.html. The list opened from Menu: the three numbers (to sign, signed this month, average time to sign), search, filter chips,
// then the contracts in Needs a signature / Signed / Closed, each with its client, job, number, dates, amount and status word. A row opens
// the contract. States built: list, no match (the board's empty), no contracts at all, loading, can't load, offline.
// Not on the board but real: Declined and Expired alongside Voided in Closed (the server has them); "Completed" is not a contract state on the
// server, so nothing shows it. The board's ⋯ draws no menu: it holds a link to the Archive.
import { useMemo, useState } from "react";
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { FILTER_ORDER, GROUP_ORDER, groupOf, kpis, matchesFilter, matchesSearch, oneDecimal, rowDates, stateOf, STATE_LOOK, type ContractRow, type DatePart } from "@/lib/contracts";
import { contractsApi } from "@/lib/contractsApi";
import { tintFor } from "@/lib/clients";
import { money, number, shortDate, type Locale } from "@/lib/format";
import { initialsOf } from "@/lib/invites";
import { screenHref } from "@/lib/nav";
import { useSession } from "@/lib/useSession";
import { Avatar } from "@/ui/Avatar";
import { Card } from "@/ui/Card";
import { Chip, ChipStrip } from "@/ui/Chip";
import { KpiThree } from "@/ui/Compliance";
import { Banner, Empty, Skeleton } from "@/ui/Feedback";
import { Header, PageTitle } from "@/ui/Header";
import { Icon } from "@/ui/Icon";
import { ScrollPage, Section } from "@/ui/Layout";
import { ListRow, MenuList, MenuRow, RowList, SectionHeader } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Search } from "@/ui/Search";
import { Sheet } from "@/ui/Sheet";
import { Status } from "@/ui/Status";
import { Num } from "@/ui/Text";

export default function Contracts() {
  const { t: tr, i18n } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`ct.list.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const q = useQuery({ queryKey: ["contracts"], queryFn: contractsApi.list, enabled: signedIn, retry: 1, staleTime: 15_000 });
  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState<(typeof FILTER_ORDER)[number]>("all");
  const [menu, setMenu] = useState(false);
  const rows = q.data?.items;
  const now = useMemo(() => new Date(), [q.dataUpdatedAt]);

  const shown = useMemo(() => (rows ?? []).filter((c) => matchesFilter(c.status, filter) && matchesSearch(c, term)), [rows, filter, term]);
  const groups = useMemo(() => GROUP_ORDER.map((g) => ({ key: g, list: shown.filter((c) => groupOf(c.status) === g) })).filter((g) => g.list.length), [shown]);
  const k = useMemo(() => kpis(rows ?? [], now), [rows, now]);

  if (status === "out") return <Redirect href="/" />;

  const all = rows ?? [];
  const m = (cents: number) => money(cents / 100, locale);
  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("Menu", tr("menu.back"))));
  const open = (c: ContractRow) => router.push(screenHref("Contract", c.contractNumber, { id: c.id }));
  const loading = q.isPending && !q.data;
  const failed = q.isError && !q.data;

  const partText = (p: DatePart): string => t(`dates.${p.key}`, { date: p.at ? shortDate(new Date(p.at), locale) : "" });
  const datesOf = (c: ContractRow) => rowDates(c, now).map(partText).join(" · ");

  const delta = k.deltaDays == null ? null : oneDecimal(Math.abs(k.deltaDays));
  const avgSub = k.avgDays == null ? t("kpi.noneYet") : delta == null ? t("kpi.signedCount", { count: all.filter((c) => c.status === "signed").length }) : delta === 0 ? t("kpi.same") : t(k.deltaDays! < 0 ? "kpi.faster" : "kpi.slower", { n: number(delta, locale, 1) });
  const avgTone = k.deltaDays != null && delta !== 0 ? (k.deltaDays < 0 ? ("ok" as const) : ("warn" as const)) : ("muted" as const);
  const yoursText = k.yours === 0 ? t("kpi.yoursNone") : t("kpi.yours", { count: k.yours });
  const totalOf = (c: ContractRow) => m(c.contractValueCents);

  return (
    <Screen>
      <Header title="" backLabel={tr("ct.back")} onBack={back} moreLabel={tr("ct.more")} onMore={() => setMenu(true)} />
      <ScrollPage bottom={48}>
        <Section px={20} pt={2}><PageTitle>{t("title")}</PageTitle></Section>
        {failed ? (
          <Section pt={26} px={16}><Empty icon="warn" iconTone="clay" title={t("loadFailed.title")} body={t("loadFailed.body")} action={tr("ct.retry")} onAction={() => void q.refetch()} /></Section>
        ) : loading ? (
          <Section pt={16} px={16} gap={12}><Skeleton height={86} radius={22} /><Skeleton height={44} radius={14} /><Skeleton height={300} radius={22} /></Section>
        ) : all.length === 0 ? (
          <Section pt={26} px={16}><Empty icon="pen" iconTone="indigo" title={t("none.title")} body={t("none.body")} action={t("none.action")} onAction={() => router.push(screenHref("Quotes", tr("tabs.quotes")))} /></Section>
        ) : (
          <>
            {q.isError ? <Section pt={12} px={16}><Banner tone="info" icon="warn" iconTone="amber" lead={t("offline")} /></Section> : null}
            <Section delay={50} pt={16} px={16}>
              <KpiThree items={[
                { label: t("kpi.toSign"), value: number(k.toSign, locale), sub: yoursText, subTone: k.yours > 0 ? "warn" : "muted" },
                { label: t("kpi.signed"), value: money(k.signed.cents / 100, locale, { cents: false }), sub: t("kpi.contracts", { count: k.signed.count }), subTone: k.signed.count > 0 ? "ok" : "muted" },
                { label: t("kpi.avg"), value: k.avgDays == null ? "–" : t("kpi.days", { n: number(oneDecimal(k.avgDays), locale, 1) }), sub: avgSub, subTone: avgTone },
              ]} />
            </Section>
            <Section delay={90} pt={14} px={16}>
              <Search label={t("search")} placeholder={t("placeholder")} value={term} onChangeText={setTerm} autoCorrect={false} />
            </Section>
            <Section delay={120} pt={12}>
              <ChipStrip label={t("filter")}>
                {FILTER_ORDER.map((f) => <Chip key={f} label={t(`filters.${f}`)} count={all.filter((c) => matchesFilter(c.status, f)).length} selected={filter === f} onPress={() => setFilter(f)} />)}
              </ChipStrip>
            </Section>
            {groups.map((g) => (
              <Section key={g.key} delay={150} pt={18} px={16}>
                <SectionHeader title={t(`groups.${g.key}`)} link={number(g.list.length, locale)} />
                <Card>
                  <RowList>
                    {g.list.map((c) => {
                      const look = STATE_LOOK[stateOf(c.status)];
                      const word = t(`status.${stateOf(c.status)}`);
                      const dates = datesOf(c);
                      return (
                        <ListRow key={c.id} onPress={() => open(c)} accessibilityLabel={`${c.customerName}, ${c.title}, ${c.contractNumber}, ${totalOf(c)}, ${word}`}
                          leading={<Avatar initials={initialsOf(c.customerName.replace("&", ""))} tint={tintFor(c.customerName)} />}
                          title={c.customerName} meta={c.title} note={[c.contractNumber, dates].filter(Boolean).join(" · ")}
                          trailing={<><Num size={14.5} weight={600}>{totalOf(c)}</Num><Status tone={look.tone} shape={look.shape}>{word}</Status></>} />
                      );
                    })}
                  </RowList>
                </Card>
              </Section>
            ))}
            {groups.length === 0 ? (
              <Section delay={150} pt={26} px={16}>
                <Empty icon="search" iconTone="slate" title={t("empty.title")} body={t("empty.body")} action={t("empty.clear")} actionKind="secondary" onAction={() => { setTerm(""); setFilter("all"); }} />
              </Section>
            ) : null}
          </>
        )}
      </ScrollPage>

      <Sheet open={menu} onClose={() => setMenu(false)} label={tr("ct.more")} closeLabel={tr("close")}>
        <MenuList>
          <MenuRow icon={<Icon name="box" tone="slate" size={28} />} title={t("menu.archive")} sub={t("menu.archiveSub")} onPress={() => { setMenu(false); router.push(screenHref("Archive", t("soon.archive"))); }} />
        </MenuList>
      </Sheet>
    </Screen>
  );
}

