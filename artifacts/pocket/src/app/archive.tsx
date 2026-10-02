// Archive.dc.html. What was archived (quotes, jobs, clients, invoices, contracts), a month at a time, with a search and a type filter; swipe a row left to Restore it or Delete it for
// good. Each is held for five seconds with an Undo before it is sent (the row leaves the list at once). States: default, empty, no match, loading, can't load.
// Only a quote, an invoice and a job can be deleted for good (the server has no delete for a contract or a client: their row has Restore alone).
import { useEffect, useMemo, useRef, useState } from "react";
import { Redirect, router } from "expo-router";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiFailure } from "@/lib/api";
import { FILTERS, byMonth, canDelete, matches, titleOf, type ArchiveItem, type Kind } from "@/lib/archive";
import { archiveApi } from "@/lib/archiveApi";
import { dayFromKey } from "@/lib/assistant";
import { money, monthLong, shortDate, type Locale } from "@/lib/format";
import { screenHref } from "@/lib/nav";
import { useSession } from "@/lib/useSession";
import { Card, Hairline } from "@/ui/Card";
import { Chip, ChipStrip } from "@/ui/Chip";
import { Empty, Skeleton, useToast } from "@/ui/Feedback";
import { Header, PageTitle } from "@/ui/Header";
import { ScrollPage, Section } from "@/ui/Layout";
import { RowBody, SectionHeader, SwipeHint } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Search } from "@/ui/Search";
import { SwipeRow, type SwipeAction } from "@/ui/SwipeRow";
import { Num } from "@/ui/Text";

const HOLD_MS = 5000;
const SPEC: Record<Kind, { icon: "doc" | "cone" | "user" | "receipt" | "pen"; tone: "violet" | "amber" | "teal" | "sage" | "indigo" }> = {
  quote: { icon: "doc", tone: "violet" }, job: { icon: "cone", tone: "amber" }, client: { icon: "user", tone: "teal" }, invoice: { icon: "receipt", tone: "sage" }, contract: { icon: "pen", tone: "indigo" },
};

export default function Archive() {
  const { t: tr, i18n } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`ar.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const toast = useToast();
  const client = useQueryClient();
  const q = useQuery({ queryKey: ["archive"], queryFn: archiveApi.list, enabled: signedIn, retry: 1, staleTime: 15_000 });
  const [filter, setFilter] = useState<"all" | Kind>("all");
  const [term, setTerm] = useState("");
  const [gone, setGone] = useState<string[]>([]);
  const [swiped, setSwiped] = useState<string | null>(null);
  const held = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => () => { held.current.forEach((h) => clearTimeout(h)); }, []);

  const live = useMemo(() => (q.data?.items ?? []).filter((i) => !gone.includes(i.id)), [q.data, gone]);

  if (status === "out") return <Redirect href="/" />;

  const rows = live.filter((i) => (filter === "all" || i.type === filter) && matches(i, term));
  const groups = byMonth(rows);
  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("Menu", t("title"))));

  const send = async (item: ArchiveItem, how: "restore" | "delete") => {
    held.current.delete(item.id);
    try {
      if (how === "restore") await archiveApi.restore(item.type, item.id); else await archiveApi.remove(item.type, item.id);
      void client.invalidateQueries({ queryKey: ["archive"] });
      void client.invalidateQueries({ queryKey: [item.type === "quote" ? "quotes" : item.type === "invoice" ? "invoices" : item.type === "job" ? "jobs" : item.type === "client" ? "clients-overview" : "contracts"] });
    } catch (e) {
      setGone((g) => g.filter((x) => x !== item.id));
      const bad = e instanceof ApiFailure ? e : null;
      toast({ message: bad?.status === 0 ? t("toast.offline") : bad?.status === 403 ? t("toast.noAccess") : bad?.status === 409 ? t("toast.cantDelete") : t("toast.failed") });
    }
  };
  const act = (item: ArchiveItem, how: "restore" | "delete") => {
    setSwiped(null);
    setGone((g) => [...g, item.id]);
    held.current.set(item.id, setTimeout(() => void send(item, how), HOLD_MS));
    toast({
      lead: titleOf(item, t("untitled")), message: how === "restore" ? t("toast.restored", { plural: t(`plural.${item.type}`) }) : t("toast.deleted"),
      action: t("toast.undo"), duration: HOLD_MS, countdown: true,
      onAction: () => { const h = held.current.get(item.id); if (h) clearTimeout(h); held.current.delete(item.id); setGone((g) => g.filter((x) => x !== item.id)); },
    });
  };

  const actionsOf = (i: ArchiveItem): SwipeAction[] => [
    { key: "restore", label: t("restore"), icon: "sync", iconTone: "sage", tone: "ok", onPress: () => act(i, "restore") },
    ...(canDelete(i.type) ? [{ key: "delete", label: t("delete"), icon: "warn" as const, iconTone: "rose" as const, tone: "bad" as const, onPress: () => act(i, "delete") }] : []),
  ];
  const subOf = (i: ArchiveItem) => [t(`kind.${i.type}`), i.detail, i.type === "client" ? "" : i.state ? t(`state.${i.state}`) : ""].filter(Boolean).join(" · ");
  const first = groups[0]?.rows[0]?.id;

  const loading = q.isPending && !q.data;
  const none = !!q.data && q.data.items.length === 0;
  const noMatch = !loading && !none && groups.length === 0 && !q.isError;

  return (
    <Screen>
      <Header title="" backLabel={t("back")} onBack={back} />
      <ScrollPage bottom={56}>
        <Section pt={4} px={20}><PageTitle>{t("title")}</PageTitle></Section>
        {!loading && !none && !q.isError ? (
          <>
            <Section delay={40} pt={16} px={16}><Search label={t("searchLabel")} placeholder={t("searchPlaceholder")} value={term} onChangeText={setTerm} autoCorrect={false} onClear={term ? () => setTerm("") : undefined} clearLabel={t("clear")} /></Section>
            <Section delay={70} pt={12}>
              <ChipStrip label={t("filter")}>
                {FILTERS.map((f) => <Chip key={f} label={t(`filters.${f}`)} count={live.filter((i) => f === "all" || i.type === f).length} selected={filter === f} onPress={() => setFilter(f)} />)}
              </ChipStrip>
            </Section>
          </>
        ) : null}

        {loading ? (
          <Section pt={18} px={16} gap={14}><Skeleton height={260} radius={22} /></Section>
        ) : q.isError && !q.data ? (
          <Empty icon="warn" iconTone="clay" title={t("loadFailed.title")} body={t("loadFailed.body")} action={t("loadFailed.retry")} onAction={() => void q.refetch()} />
        ) : none ? (
          <Empty icon="box" iconTone="stone" title={t("none.title")} body={t("none.body")} action={t("none.action")} actionKind="secondary" onAction={() => router.push(screenHref("Quotes", t("none.action")))} padding={{ v: 90, h: 28 }} />
        ) : noMatch ? (
          <Empty icon="search" iconTone="slate" title={t("noMatch.title")} body={t("noMatch.body")} action={t("noMatch.clear")} actionKind="secondary" onAction={() => { setTerm(""); setFilter("all"); }} />
        ) : (
          groups.map((g, gi) => (
            <Section key={g.month} delay={100 + gi * 30} pt={18} px={16}>
              <SectionHeader title={monthLong(dayFromKey(`${g.month}-01`), locale)} link={t(g.rows.length === 1 ? "month.one" : "month.other", { count: g.rows.length })} />
              <Card>
                {g.rows.map((i, ri) => {
                  const title = titleOf(i, t("untitled"));
                  const spec = SPEC[i.type];
                  return (
                    <View key={i.id}>
                      {ri ? <Hairline inset={0} /> : null}
                      <SwipeRow card={false} open={swiped === i.id} onOpenChange={(o) => setSwiped(o ? i.id : swiped === i.id ? null : swiped)} actions={actionsOf(i)} accessibilityLabel={t("rowLabel", { kind: t(`kind.${i.type}`), title, detail: subOf(i) })}>
                        <RowBody title={title} meta={subOf(i)} trailing={(
                          <>
                            {i.amountCents ? <Num size={14.5} weight={600}>{money(i.amountCents / 100, locale)}</Num> : null}
                            <Num size={12.5} color="muted">{shortDate(new Date(i.archivedAt), locale)}</Num>
                          </>
                        )} />
                      </SwipeRow>
                    </View>
                  );
                })}
              </Card>
              {g.rows[0]?.id === first ? <SwipeHint>{t("swipeHint")}</SwipeHint> : null}
            </Section>
          ))
        )}
      </ScrollPage>
    </Screen>
  );
}
