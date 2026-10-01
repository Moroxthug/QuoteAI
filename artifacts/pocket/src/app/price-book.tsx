// PriceBook.dc.html. Labour, materials and assemblies the company quotes with: the three numbers (items, used this month, prices changed),
// search, the category chips, the groups with each item's price and unit, a mark when a price moved, an assembly that opens to its parts,
// "Import prices" and the Add item sheet. The same rows are the quote editor's price book sheet and New quote's Price list, so an item added
// here is on the next quote. States: list, nothing called "x" (the board's empty), no items at all, loading, can't load, offline.
// Not on the board but real: a role that can't edit has no Add item. The board's ⋯ draws no menu: it holds the link to Import prices.
import { useMemo, useRef, useState } from "react";
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiFailure } from "@/lib/api";
import { parseAmount } from "@/lib/quoteEditor";
import { money, number, percent, shortDate, type Locale } from "@/lib/format";
import { canSaveItem, costOf, countOf, FILTERS, groupsOf, KINDS, marginPct, markOf, metaOf, newItemBody, UNITS, unitKey, UNIT_VALUE, type BookItem, type FilterKey, type PriceKind } from "@/lib/priceBook";
import { priceBookApi } from "@/lib/priceBookApi";
import { screenHref } from "@/lib/nav";
import { useSession } from "@/lib/useSession";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Chip, ChipStrip, ChipWrap } from "@/ui/Chip";
import { KpiThree } from "@/ui/Compliance";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { TextField } from "@/ui/Field";
import { Header, PageTitle } from "@/ui/Header";
import { Glyph, Icon, type IconName, type Tone } from "@/ui/Icon";
import { ScrollPage, Section, Stack } from "@/ui/Layout";
import { Flash, MarginLine, PartsList, RateFigure, TwoCols } from "@/ui/Materials";
import { ListRow, MenuList, MenuRow, RowChevron, RowList, SectionHeader } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Search } from "@/ui/Search";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { Status } from "@/ui/Status";
import { Text } from "@/ui/Text";

const LOOK: Record<PriceKind, { icon: IconName; tone: Tone }> = {
  labour: { icon: "hammer", tone: "clay" },
  material: { icon: "box", tone: "stone" },
  assembly: { icon: "house", tone: "violet" },
};

export default function PriceBook() {
  const { t: tr, i18n } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`pb.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const toast = useToast();
  const client = useQueryClient();
  const q = useQuery({ queryKey: ["price-book"], queryFn: priceBookApi.overview, enabled: signedIn, retry: 1, staleTime: 15_000 });

  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [adding, setAdding] = useState(false);
  const [nName, setNName] = useState("");
  const [nKind, setNKind] = useState<PriceKind>("labour");
  const [nUnit, setNUnit] = useState<string>("sqft");
  const [nPrice, setNPrice] = useState("");
  const [nCost, setNCost] = useState("");
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const data = q.data;
  const items = useMemo(() => data?.items ?? [], [data]);
  const now = useMemo(() => new Date(), [q.dataUpdatedAt]);
  const groups = useMemo(() => groupsOf(items, filter, term, flash), [items, filter, term, flash]);

  if (status === "out") return <Redirect href="/" />;

  const canEdit = data?.canEdit ?? false;
  const m = (n: number) => money(n, locale);
  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("Menu", tr("menu.back"))));
  const toImports = () => router.push(screenHref("Imports", t("soon.imports")));
  const loading = q.isPending && !q.data;
  const failed = q.isError && !q.data;
  const unitLabel = (um: string) => { const k = unitKey(um); return k ? t(`unit.${k}`) : um.trim(); };
  const today = (iso: string) => new Date(iso).toDateString() === now.toDateString();

  const openAdd = (name = "") => {
    setNName(name); setNKind("labour"); setNUnit("sqft"); setNPrice(""); setNCost(""); setMenu(false); setAdding(true);
  };
  const price = parseAmount(nPrice);
  const cost = parseAmount(nCost);
  const margin = marginPct(price, cost > 0 ? cost : null);
  const save = async () => {
    if (!canSaveItem(nName, price) || saving) return;
    setSaving(true);
    try {
      const created = await priceBookApi.add(newItemBody({ name: nName, kind: nKind, unit: UNIT_VALUE[nUnit] ?? nUnit, price, cost }));
      await client.invalidateQueries({ queryKey: ["price-book"] });
      void client.invalidateQueries({ queryKey: ["catalog"] });
      setAdding(false); setTerm(""); setFilter("all"); setFlash(created.id);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash(null), 1600);
      toast({ message: t("toast.added") });
    } catch (e) {
      toast({ message: e instanceof ApiFailure && e.status === 403 ? t("toast.noAccess") : t("toast.addFailed") });
    } finally { setSaving(false); }
  };

  const rowMeta = (i: BookItem): string => metaOf(i, now).map((p) => {
    switch (p.key) {
      case "parts": return t("meta.parts", { count: p.n });
      case "used": return today(p.date!) ? t("meta.usedToday") : t("meta.used", { date: shortDate(new Date(p.date!), locale) });
      case "added": return t("meta.added", { date: shortDate(new Date(p.date!), locale) });
      case "was": return t("meta.was", { price: m(p.price!) });
    }
  }).join(" · ");

  const noteOf = (kind: PriceKind, n: number): string => (term.trim() ? t("note.found", { count: n }) : kind === "assembly" ? t("note.parts") : t("note.most"));
  const assembliesLine = t("kpi.assemblies", { count: data?.assemblies ?? 0 });

  return (
    <Screen>
      <Header title="" backLabel={t("back")} onBack={back} moreLabel={t("more")} onMore={() => setMenu(true)} />
      <ScrollPage bottom={60}>
        <Section px={20} pt={4} row align="center" justify="space-between" gap={12}>
          <PageTitle>{t("title")}</PageTitle>
          {canEdit ? <Button size="sm" label={t("add")} icon={<Glyph name="plus" size={14} weight={2.4} color="on-inv" />} onPress={() => openAdd()} /> : null}
        </Section>
        {failed ? (
          <Section pt={26} px={16}><Empty icon="warn" iconTone="clay" title={t("loadFailed.title")} body={t("loadFailed.body")} action={t("retry")} onAction={() => void q.refetch()} /></Section>
        ) : loading ? (
          <Section pt={16} px={16} gap={12}><Skeleton height={86} radius={22} /><Skeleton height={44} radius={14} /><Skeleton height={300} radius={22} /></Section>
        ) : (
          <>
            {q.isError ? <Section pt={12} px={16}><Banner tone="info" icon="warn" iconTone="amber" lead={t("offline")} /></Section> : null}
            <Section delay={40} pt={16} px={16}>
              <KpiThree items={[
                { label: t("kpi.items"), value: number(items.length, locale), sub: assembliesLine },
                { label: t("kpi.used"), value: number(data?.usedThisMonth ?? 0, locale), sub: t("kpi.quotes", { count: data?.usedInQuotes ?? 0 }) },
                { label: t("kpi.changed"), value: number(data?.pricesChanged ?? 0, locale), sub: t("kpi.since", { date: data ? shortDate(new Date(`${data.changedSince}T12:00:00`), locale) : "" }), subTone: (data?.pricesChanged ?? 0) > 0 ? "warn" : "muted" },
              ]} />
            </Section>
            <Section delay={70} pt={14} px={16}>
              <Search label={t("search")} placeholder={t("placeholder")} value={term} onChangeText={setTerm} autoCorrect={false} />
            </Section>
            <Section delay={100} pt={12}>
              <ChipStrip label={t("filter")}>
                {FILTERS.map((f) => <Chip key={f} label={t(`filters.${f}`)} count={countOf(items, f)} selected={filter === f} onPress={() => setFilter(f)} />)}
              </ChipStrip>
            </Section>
            {groups.map((g) => (
              <Section key={g.kind} delay={130} pt={18} px={16}>
                <SectionHeader title={t(`groups.${g.kind}`)} link={noteOf(g.kind, g.items.length)} />
                <Card>
                  <RowList>
                    {g.items.map((i) => {
                      const look = LOOK[i.kind];
                      const mark = markOf(i, now, flash === i.id);
                      const opens = i.kind === "assembly" && !!i.parts?.length;
                      const isOpen = opens && open === i.id;
                      const unit = t("perUnit", { unit: unitLabel(i.um) });
                      const word = mark ? t(`mark.${mark.key}`, { pct: mark.pct }) : "";
                      return (
                        <Flash key={i.id} on={flash === i.id}>
                          <ListRow onPress={opens ? () => setOpen(isOpen ? null : i.id) : undefined}
                            accessibilityLabel={`${i.nome}, ${m(i.prezzoUnitario)} ${unit}${word ? `, ${word}` : ""}`}
                            leading={<Icon name={look.icon} tone={look.tone} size={26} />}
                            title={i.nome} meta={flash === i.id ? t("meta.added", { date: shortDate(now, locale) }) : rowMeta(i)}
                            trailing={<><RateFigure rate={m(i.prezzoUnitario)} unit={unit} />{mark ? <Status plain tone={mark.tone} shape={mark.key === "up" || mark.key === "changed" ? "alert" : mark.key === "down" ? "check" : "dot"}>{word}</Status> : null}</>} />
                          {isOpen ? <PartsList parts={(i.parts ?? []).map((p) => ({ name: p.name, value: m(p.amount) }))} costLabel={t("yourCost")} cost={costOf(i) != null ? m(costOf(i)!) : undefined} /> : null}
                        </Flash>
                      );
                    })}
                  </RowList>
                </Card>
              </Section>
            ))}
            {groups.length === 0 && items.length > 0 && term.trim() ? (
              <Section delay={130} pt={26} px={16}>
                <Empty icon="search" iconTone="slate" title={t("empty.title", { q: term.trim() })} body={t("empty.body")} action={canEdit ? t("empty.add", { q: term.trim() }) : undefined}
                  actionKind="secondary" onAction={() => openAdd(term.trim().charAt(0).toUpperCase() + term.trim().slice(1))} />
              </Section>
            ) : null}
            {items.length === 0 ? (
              <Section delay={130} pt={26} px={16}>
                <Empty icon="tag" iconTone="lilac" title={t("none.title")} body={t("none.body")} action={canEdit ? t("none.action") : undefined} onAction={() => openAdd()} />
              </Section>
            ) : null}
            <Section delay={160} pt={18} px={16}>
              <Card>
                <ListRow onPress={toImports} leading={<Icon name="export" tone="azure" size={28} />} title={t("import.title")} meta={t("import.sub")} trailing={<RowChevron />} />
              </Card>
            </Section>
          </>
        )}
      </ScrollPage>

      <Sheet open={menu} onClose={() => setMenu(false)} label={t("more")} closeLabel={t("close")}>
        <MenuList>
          <MenuRow icon={<Icon name="export" tone="azure" size={28} />} title={t("import.title")} sub={t("import.sub")} onPress={() => { setMenu(false); toImports(); }} />
        </MenuList>
      </Sheet>

      <Sheet open={adding} onClose={() => setAdding(false)} label={t("sheet.title")} closeLabel={t("close")}>
        <SheetTitle>{t("sheet.title")}</SheetTitle>
        <Stack pb={20} gap={14}>
          <Stack px={16}><TextField label={t("sheet.name")} value={nName} onChangeText={setNName} placeholder={t("sheet.namePh")} /></Stack>
          <Stack gap={8}>
            <Stack px={20}><Text size={12.5} color="muted">{t("sheet.category")}</Text></Stack>
            <ChipWrap>{KINDS.map((k) => <Chip key={k} label={t(`sheet.kind.${k}`)} selected={nKind === k} onPress={() => setNKind(k)} />)}</ChipWrap>
          </Stack>
          <Stack gap={8}>
            <Stack px={20}><Text size={12.5} color="muted">{t("sheet.unit")}</Text></Stack>
            <ChipWrap>{UNITS.map((u) => { const k = unitKey(u)!; return <Chip key={k} label={t(`unit.${k}`)} selected={nUnit === k} onPress={() => setNUnit(k)} />; })}</ChipWrap>
          </Stack>
          <Stack px={16}>
            <TwoCols>
              {[
                <TextField key="p" label={t("sheet.price")} numeric keyboardType="decimal-pad" value={nPrice} onChangeText={setNPrice} placeholder={t("sheet.pricePh")} />,
                <TextField key="c" label={t("sheet.cost")} numeric keyboardType="decimal-pad" value={nCost} onChangeText={setNCost} placeholder={t("sheet.costPh")} />,
              ]}
            </TwoCols>
          </Stack>
          {margin != null ? <Stack px={16}><MarginLine label={t("sheet.margin")} value={percent(margin / 100, locale)} /></Stack> : null}
          <Stack px={16}><Button size="lg" block label={t("sheet.save")} disabled={!canSaveItem(nName, price)} busy={saving ? t("sheet.saving") : false} onPress={() => void save()} /></Stack>
        </Stack>
      </Sheet>
    </Screen>
  );
}
