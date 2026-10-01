// Suppliers.dc.html. The stores the company buys from: spend this month and this year, how many prices changed, search, the chips by what they sell,
// the suppliers as Accounts (billed monthly) and Pay at the counter (receipts only), each swiping left to call or email, a tip when materials run low,
// and Add supplier. A row opens the supplier. States: list, no match, none yet (add one, or find them in the receipts), loading, can't load, offline, view only.
// The board's "Owing" figure has no data (the app keeps no supplier bills), so the middle number is the year's spend. The board's momentary
// "Called just now" / "Email drafted" on a row is not drawn: the phone's own call and mail apps open.
import { useMemo, useState } from "react";
import { Linking } from "react-native";
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiFailure } from "@/lib/api";
import { money, number, shortDate, type Locale } from "@/lib/format";
import { screenHref } from "@/lib/nav";
import { canSaveSupplier, categoriesOf, contactOf, dialable, EMPTY_FORM, groupsOf, isKnownCategory, supplierBody, type SupplierForm, type SupplierRow } from "@/lib/suppliers";
import { suppliersApi } from "@/lib/suppliersApi";
import { parseAmount } from "@/lib/quoteEditor";
import { useSession } from "@/lib/useSession";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Chip, ChipStrip } from "@/ui/Chip";
import { KpiThree } from "@/ui/Compliance";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { Glyph } from "@/ui/Icon";
import { Header, PageTitle } from "@/ui/Header";
import { ScrollPage, Section } from "@/ui/Layout";
import { ListRow, RowBody, RowChevron, RowList, SectionHeader, SwipeHint } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Search } from "@/ui/Search";
import { Sheet } from "@/ui/Sheet";
import { SwipeRow, type SwipeAction } from "@/ui/SwipeRow";
import { EmptyTwo, SupplierFormSheet } from "@/ui/SupplierParts";
import { Num, Text } from "@/ui/Text";

export default function Suppliers() {
  const { t: tr, i18n } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`sp.list.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const toast = useToast();
  const client = useQueryClient();
  const q = useQuery({ queryKey: ["suppliers"], queryFn: suppliersApi.overview, enabled: signedIn, retry: 1, staleTime: 15_000 });

  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [swiped, setSwiped] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<SupplierForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [finding, setFinding] = useState(false);

  const data = q.data;
  const items = useMemo(() => data?.items ?? [], [data]);
  const cats = useMemo(() => categoriesOf(items), [items]);
  const groups = useMemo(() => groupsOf(items, filter, term), [items, filter, term]);

  if (status === "out") return <Redirect href="/" />;

  const canEdit = data?.canEdit ?? false;
  const m0 = (cents: number) => money(cents / 100, locale, { cents: false });
  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("Menu", tr("menu.back"))));
  const open = (s: SupplierRow) => router.push(screenHref("Supplier", s.name, { id: s.id }));
  const loading = q.isPending && !q.data;
  const failed = q.isError && !q.data;
  const catLabel = (key: string, raw: string) => (isKnownCategory(key) ? t(`filters.${key}`) : raw);

  const openAdd = () => { setForm(EMPTY_FORM); setAdding(true); };
  const save = async () => {
    if (!canSaveSupplier(form) || saving) return;
    setSaving(true);
    try {
      const { supplier } = await suppliersApi.add(supplierBody(form, form.proDiscount.trim() ? parseAmount(form.proDiscount) : null));
      await client.invalidateQueries({ queryKey: ["suppliers"] });
      setAdding(false);
      toast({ message: tr("sp.toast.added") });
      router.push(screenHref("Supplier", supplier.name, { id: supplier.id }));
    } catch (e) {
      toast({ message: e instanceof ApiFailure && e.status === 403 ? tr("sp.toast.noAccess") : tr("sp.toast.failed") });
    } finally { setSaving(false); }
  };
  const findInReceipts = async () => {
    setFinding(true);
    try {
      const r = await suppliersApi.fromReceipts();
      await client.invalidateQueries({ queryKey: ["suppliers"] });
      toast({ message: r.created ? t("found", { count: r.created }) : t("foundNone") });
    } catch (e) {
      toast({ message: e instanceof ApiFailure && e.status === 403 ? tr("sp.toast.noAccess") : tr("sp.toast.failed") });
    } finally { setFinding(false); }
  };

  const rowActions = (s: SupplierRow): SwipeAction[] => [
    ...(s.phone ? [{ key: "call", label: t("swipe.call"), icon: "phone" as const, iconTone: "sage" as const, tone: "ok" as const, onPress: () => { setSwiped(null); void Linking.openURL(`tel:${dialable(s.phone)}`); } }] : []),
    ...(s.email ? [{ key: "email", label: t("swipe.email"), icon: "mail" as const, iconTone: "azure" as const, tone: "info" as const, onPress: () => { setSwiped(null); void Linking.openURL(`mailto:${s.email}`); } }] : []),
  ];
  const acctLine = (s: SupplierRow) => (s.kind === "counter" || !s.accountNo ? (s.kind === "counter" ? t("row.noAccount") : s.terms ? t("row.terms", { terms: s.terms }) : "") : s.terms ? t("row.acctTerms", { no: s.accountNo, terms: s.terms }) : t("row.acct", { no: s.accountNo }));

  const k = data;
  const hasAny = items.length > 0;

  return (
    <Screen>
      <Header title="" backLabel={tr("sp.back")} onBack={back} />
      <ScrollPage bottom={48}>
        <Section px={20} pt={2} row align="center" justify="space-between" gap={12}>
          <PageTitle>{t("title")}</PageTitle>
          {canEdit && !loading ? <Button size="sm" label={t("add")} icon={<Glyph name="plus" size={14} weight={2.4} color="on-inv" />} onPress={openAdd} /> : null}
        </Section>
        {failed ? (
          <Section pt={26} px={16}><Empty icon="warn" iconTone="clay" title={t("loadFailed.title")} body={t("loadFailed.body")} action={tr("sp.retry")} onAction={() => void q.refetch()} /></Section>
        ) : loading ? (
          <Section pt={16} px={16} gap={14}><Skeleton height={78} radius={22} /><Skeleton height={44} radius={14} /><Skeleton height={330} radius={22} /></Section>
        ) : !hasAny ? (
          <Section delay={40}>
            <EmptyTwo icon="truck" tone="amber" title={t("none.title")} body={t("none.body")} primary={canEdit ? t("none.add") : undefined} onPrimary={openAdd}
              secondary={canEdit ? t("none.find") : undefined} onSecondary={finding ? undefined : () => void findInReceipts()} />
          </Section>
        ) : (
          <>
            {q.isError ? <Section pt={12} px={16}><Banner tone="warn" icon="cloud" iconTone="amber" lead={t("offline.lead")}>{t("offline.body")}</Banner></Section> : null}
            {!canEdit ? <Section pt={12} px={16}><Banner tone="info" icon="eye" iconTone="sky" lead={t("readOnly.lead")}>{t("readOnly.body")}</Banner></Section> : null}
            <Section delay={50} pt={16} px={16}>
              <KpiThree items={[
                { label: t("kpi.spend"), value: m0(k?.spendMonthCents ?? 0), sub: t("kpi.receipts", { count: k?.purchasesMonth ?? 0 }) },
                { label: t("kpi.year"), value: m0(k?.spendYearCents ?? 0), sub: t("kpi.suppliers", { count: items.length }) },
                { label: t("kpi.changes"), value: number(k?.priceChanges ?? 0, locale), sub: (k?.priceUps ?? 0) > 0 ? t("kpi.up", { count: k!.priceUps }) : t("kpi.upNone"), subTone: (k?.priceUps ?? 0) > 0 ? "warn" : "muted" },
              ]} />
            </Section>
            <Section delay={90} pt={14} px={16}>
              <Search label={t("search")} placeholder={t("placeholder")} value={term} onChangeText={setTerm} autoCorrect={false} />
            </Section>
            <Section delay={120} pt={12}>
              <ChipStrip label={t("filter")}>
                <Chip label={t("filters.all")} count={items.length} selected={filter === "all"} onPress={() => setFilter("all")} />
                {cats.map((c) => <Chip key={c.key} label={catLabel(c.key, c.label)} count={c.count} selected={filter === c.key} onPress={() => setFilter(c.key)} />)}
              </ChipStrip>
            </Section>
            {groups.map((g, gi) => (
              <Section key={g.kind} delay={150} pt={18} px={16}>
                <SectionHeader title={t(`groups.${g.kind}`)} link={t(`sub.${g.kind}`)} />
                <Card>
                  <RowList>
                    {g.items.map((s) => {
                      const actions = rowActions(s);
                      const body = (
                        <RowBody title={s.name} meta={contactOf(s) || undefined} note={acctLine(s) || undefined}
                          trailing={<><Num size={14.5} weight={600}>{money(s.spendMonthCents / 100, locale)}</Num><Text size={11.5} color="muted">{s.lastOrderAt ? t("row.last", { date: shortDate(new Date(s.lastOrderAt), locale) }) : t("row.none")}</Text></>} />
                      );
                      return actions.length ? (
                        <SwipeRow key={s.id} card={false} open={swiped === s.id} onOpenChange={(o) => setSwiped(o ? s.id : null)} onPress={() => open(s)} actions={actions} accessibilityLabel={s.name}>
                          {body}
                        </SwipeRow>
                      ) : (
                        <ListRow key={s.id} onPress={() => open(s)} title={s.name} meta={contactOf(s) || undefined} note={acctLine(s) || undefined}
                          trailing={<><Num size={14.5} weight={600}>{money(s.spendMonthCents / 100, locale)}</Num><Text size={11.5} color="muted">{s.lastOrderAt ? t("row.last", { date: shortDate(new Date(s.lastOrderAt), locale) }) : t("row.none")}</Text></>} />
                      );
                    })}
                  </RowList>
                </Card>
                {gi === 0 && g.items.some((s) => s.phone || s.email) ? <SwipeHint>{t("swipe.hint")}</SwipeHint> : null}
              </Section>
            ))}
            {groups.length === 0 ? (
              <Section delay={150} pt={26} px={16}>
                <Empty icon="search" iconTone="slate" title={t("noMatch.title")} body={t("noMatch.body")} action={t("noMatch.clear")} actionKind="secondary" onAction={() => { setTerm(""); setFilter("all"); }} />
              </Section>
            ) : null}
            {groups.length > 0 && !term.trim() && filter === "all" && (k?.lowCount ?? 0) > 0 ? (
              <Section delay={190} pt={18} px={16}>
                <Card>
                  <ListRow onPress={() => router.push(screenHref("Inventory", t("soon.inventory")))} title={t("tip.title", { count: k!.lowCount })} meta={t("tip.sub")} trailing={<RowChevron />} />
                </Card>
              </Section>
            ) : null}
          </>
        )}
      </ScrollPage>

      <Sheet open={adding} onClose={() => setAdding(false)} label={tr("sp.form.addTitle")} closeLabel={tr("sp.close")}>
        <SupplierFormSheet t={(key) => tr(`sp.form.${key}`) as string} title={tr("sp.form.addTitle")} form={form} onChange={setForm} canSave={canSaveSupplier(form)} saving={saving} onSave={() => void save()}
          saveLabel={tr("sp.form.add")} categoryLabels={{ building: t("filters.building"), paint: t("filters.paint"), lumber: t("filters.lumber"), tools: t("filters.tools") }} />
      </Sheet>
    </Screen>
  );
}

