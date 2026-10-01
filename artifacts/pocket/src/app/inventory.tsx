// Inventory.dc.html ("Materials"). Stock in the shop, on the truck and on sites: items tracked, items running low and what is set aside for jobs; the
// segmented control (all, shop, truck, sites); "Running low" with a suggestion to reorder from the supplier that charged least and a Reorder sheet
// (quantity, supplier, where it goes) that puts the order on the order list; the stock with its bar, where it is and what is reserved; Count stock
// and Review order list on the floating bar. States: default, loading, empty, offline, view only, locked (the plan has no stock tracking), can't load.
// Not on the board but real: Count stock, which the board's button doesn't open, is a sheet (pick an item, change what is in each place); adding a
// material and "Start from my receipts" are sheets / a server call. There is no usage history, so the suggested quantity brings stock back to twice the
// reorder level, and "needed this week" says how much is set aside for a job. Changes need a connection (no offline outbox).
import { useMemo, useState } from "react";
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiFailure } from "@/lib/api";
import { money, number, time, type Locale } from "@/lib/format";
import {
  canSaveMaterial, changedCount, countOf, destinations, EMPTY_MATERIAL, fillOf, kpis, LOCATIONS, lineTotalCents, listedCount, LOOK, lowItems, materialBody, orderFor, planName, qtyAt, qtyStep, reviewSupplier,
  statusKey, stepQty, suggestedOption, tagOf, unitFor, whereOf, type Count, type MaterialForm, type OpenOrder, type StockItem,
} from "@/lib/inventory";
import { inventoryApi } from "@/lib/inventoryApi";
import { screenHref } from "@/lib/nav";
import { parseAmount } from "@/lib/quoteEditor";
import { suppliersApi } from "@/lib/suppliersApi";
import { useSession } from "@/lib/useSession";
import { ActionBar, ACTION_BAR_SPACE } from "@/ui/ActionBar";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Chip, ChipWrap } from "@/ui/Chip";
import { KpiThree } from "@/ui/Compliance";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { TextField } from "@/ui/Field";
import { Header, PageTitle } from "@/ui/Header";
import { Icon } from "@/ui/Icon";
import { ScrollPage, Section, Stack } from "@/ui/Layout";
import { LabelRow, LowRow, OptionRow, QtyStepper, StockRow, TwoCols, Where } from "@/ui/Materials";
import { ListRow, MenuList, MenuRow, RowChevron, RowList, SectionHeader } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Segmented } from "@/ui/Segmented";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { Status, Tag } from "@/ui/Status";
import { SheetScroll, EmptyTwo } from "@/ui/SupplierParts";
import { Num, Text } from "@/ui/Text";

type Reorder = { itemId: string; orderId: string | null; qty: number; supplierId: string | null; dest: string };
type Counting = null | { mode: "pick" } | { mode: "item"; id: string; c: Count };

export default function Inventory() {
  const { t: tr, i18n } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`iv.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const toast = useToast();
  const client = useQueryClient();
  const q = useQuery({ queryKey: ["inventory"], queryFn: inventoryApi.overview, enabled: signedIn, retry: 1, staleTime: 15_000 });

  const [loc, setLoc] = useState(0);
  const [reorder, setReorder] = useState<Reorder | null>(null);
  const [saving, setSaving] = useState(false);
  const [menu, setMenu] = useState(false);
  const [counting, setCounting] = useState<Counting>(null);
  const [adding, setAdding] = useState(false);
  const [material, setMaterial] = useState<MaterialForm>(EMPTY_MATERIAL);
  const [busy, setBusy] = useState(false);

  const data = q.data;
  const on = data && data.enabled ? data : null;
  const items = useMemo(() => on?.items ?? [], [on]);
  const orders = useMemo(() => on?.orders ?? [], [on]);
  const low = useMemo(() => lowItems(items), [items]);
  const k = useMemo(() => kpis(items, orders), [items, orders]);
  const place = LOCATIONS[loc]!;
  const stock = useMemo(() => items.filter((i) => qtyAt(i, place) > 0), [items, place]);

  if (status === "out") return <Redirect href="/" />;

  const canEdit = on?.canEdit ?? false;
  const loading = q.isPending && !q.data;
  const failed = q.isError && !q.data;
  const locked = !!data && !data.enabled;
  const m = (cents: number) => money(cents / 100, locale);
  const n = (v: number) => number(v, locale, Number.isInteger(v) ? 0 : 1);
  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("Menu", tr("menu.back"))));
  const destLabel = (d: string) => (d === "shop" || d === "pickup" ? t(`dest.${d}`) : d);
  const refresh = () => Promise.all([client.invalidateQueries({ queryKey: ["inventory"] }), client.invalidateQueries({ queryKey: ["suppliers"] }), client.invalidateQueries({ queryKey: ["supplier"] })]);
  const fail = (e: unknown) => toast({ message: e instanceof ApiFailure && e.status === 403 ? t("toast.noAccess") : t("toast.failed") });

  const review = reviewSupplier(orders);
  const listed = listedCount(orders);
  const showBar = !!on && items.length > 0 && canEdit;

  // ── Reorder ───────────────────────────────────────────────────────────────
  const openReorder = (i: StockItem) => {
    const o = orderFor(i, orders);
    const existing = o && o.status === "listed" ? o : null;
    setReorder({ itemId: i.id, orderId: existing?.id ?? null, qty: existing?.qty ?? i.suggested, supplierId: existing?.supplierId ?? suggestedOption(i)?.supplierId ?? null, dest: existing?.destination || "shop" });
  };
  const cur = reorder ? items.find((i) => i.id === reorder.itemId) ?? null : null;
  const curOpt = cur && reorder ? cur.options.find((o) => o.supplierId === reorder.supplierId) : undefined;
  const addOrder = async () => {
    if (!cur || !reorder || !reorder.supplierId || saving) return;
    setSaving(true);
    try {
      const body = { qty: reorder.qty, unitPriceCents: curOpt?.priceCents ?? null, destination: reorder.dest };
      if (reorder.orderId) await suppliersApi.changeOrder(reorder.orderId, { supplierId: reorder.supplierId, ...body });
      else await suppliersApi.addOrder(reorder.supplierId, { inventoryItemId: cur.id, itemName: cur.name, unit: cur.unit, ...body });
      await refresh();
      setReorder(null);
      toast({ message: reorder.orderId ? t("toast.changed") : t("toast.ordered") });
    } catch (e) { fail(e); } finally { setSaving(false); }
  };

  // ── Count and add ─────────────────────────────────────────────────────────
  const countItem = counting && counting.mode === "item" ? items.find((i) => i.id === counting.id) ?? null : null;
  const saveCount = async () => {
    if (!counting || counting.mode !== "item" || !countItem || saving) return;
    setSaving(true);
    try {
      await inventoryApi.count(countItem.id, counting.c);
      await refresh();
      setCounting({ mode: "pick" });
      toast({ message: t("toast.counted") });
    } catch (e) { fail(e); } finally { setSaving(false); }
  };
  const openAdd = () => { setMaterial(EMPTY_MATERIAL); setMenu(false); setCounting(null); setAdding(true); };
  const saveMaterial = async () => {
    if (!canSaveMaterial(material) || saving) return;
    setSaving(true);
    try {
      await inventoryApi.addItem(materialBody(material, parseAmount));
      await refresh();
      setAdding(false);
      toast({ message: t("toast.added") });
    } catch (e) { fail(e); } finally { setSaving(false); }
  };
  const fromReceipts = async () => {
    setBusy(true);
    try {
      const r = await inventoryApi.fromReceipts();
      await refresh();
      toast({ message: r.created ? t("toast.found", { count: r.created }) : t("toast.foundNone") });
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const unitW = (i: StockItem, qty: number) => unitFor(i.unit, qty);
  const rowStatus = (i: StockItem, o: OpenOrder | undefined) => { const key = statusKey(i, o); return { key, look: LOOK[key] }; };
  const suggestionOf = (i: StockItem, o: OpenOrder | undefined): { line: string; sub: string } => {
    if (o) return { line: t("low.ordered", { qty: n(o.qty), unit: o.unit, supplier: o.supplierName }), sub: t(o.status === "listed" ? "low.onList" : "low.sent", { dest: destLabel(o.destination) }) };
    const opt = suggestedOption(i);
    if (!opt) return { line: t("low.noSupplier"), sub: "" };
    const line = t("low.order", { qty: n(i.suggested), unit: i.unit, supplier: opt.name.replace(" Paints", "") });
    const short = i.level === "short" && i.reserved.length ? t("low.needed", { qty: n(i.reserved.reduce((s, r) => s + r.qty, 0)), unit: i.unit, job: i.reserved[0]!.job }) : null;
    return { line, sub: short ?? (opt.priceCents != null ? t("low.price", { price: m(opt.priceCents) }) : t("low.noPrice")) };
  };

  const placeTitle = t(`stock.${place}`);
  const lowSub = k.onOrder > 0 ? t("kpi.onOrder", { count: k.onOrder }) : k.short > 0 ? t("kpi.short", { count: k.short }) : t("kpi.shortNone");

  const moreMenu = () => setMenu(true);
  const head = <Header title="" backLabel={t("back")} onBack={back} moreLabel={t("more")} onMore={on && items.length ? moreMenu : undefined} />;

  return (
    <Screen floating={showBar ? (
      <ActionBar label={listed > 0 ? t("fab.review", { n: listed }) : t("fab.count")} moreLabel={t("more")} onMore={moreMenu}
        onPress={() => (listed > 0 && review ? router.push(screenHref("Supplier", review.name, { id: review.id })) : setCounting({ mode: "pick" }))} />
    ) : undefined}>
      {head}
      <ScrollPage bottom={showBar ? ACTION_BAR_SPACE : 44}>
        <Section px={20} pt={4} gap={6}>
          <PageTitle>{t("title")}</PageTitle>
          <Text size={13.5} color="muted">{t("sub")}</Text>
        </Section>

        {failed ? (
          <Section pt={26} px={16}><Empty icon="warn" iconTone="clay" title={t("loadFailed.title")} body={t("loadFailed.body")} action={t("retry")} onAction={() => void q.refetch()} /></Section>
        ) : loading ? (
          <Section pt={18} px={16} gap={14}><Skeleton height={80} radius={22} /><Skeleton height={36} radius={11} /><Skeleton height={300} radius={22} /></Section>
        ) : locked ? (
          <>
            <Section pt={18} px={16}>
              <Card>
                <Stack gap={8} px={22} pt={26} pb={22}>
                  <Stack align="center"><Icon name="lock" tone="violet" size={44} /></Stack>
                  <Text size={17} weight={600} tracking={-0.02} align="center" accessibilityRole="header">{t("locked.title")}</Text>
                  <Text size={13.5} color="muted" leading={1.45} align="center">{t("locked.body")}</Text>
                  <Stack row justify="center"><Tag accent>{t("locked.tag", { plan: planName(data && !data.enabled ? data.requiredPlan : "monthly_business") })}</Tag></Stack>
                  <Stack pt={4}><Button size="md" kind="secondary" block label={t("locked.compare")} onPress={() => router.push(screenHref("SetPlan", t("soon.setPlan")))} /></Stack>
                  <Text size={12.5} color="muted" align="center">{t("locked.note")}</Text>
                </Stack>
              </Card>
            </Section>
            <Section pt={18} px={16}>
              <Card>
                <RowList>
                  {[0, 1, 2, 3].map((i) => <Stack key={i} row align="center" gap={12} px={16} pt={14} pb={14}><Skeleton width={28} height={28} radius={14} /><Stack grow gap={6}><Skeleton width="58%" height={12} /><Skeleton width="38%" height={10} /></Stack></Stack>)}
                </RowList>
              </Card>
            </Section>
          </>
        ) : items.length === 0 ? (
          <>
            {q.isError ? <Section pt={14} px={16}><Banner tone="warn" icon="cloud" iconTone="amber" lead={t("offline.lead")}>{t("offline.body", { time: time(new Date(q.dataUpdatedAt), locale) })}</Banner></Section> : null}
            <Section delay={40}>
              <EmptyTwo icon="box" tone="amber" title={t("empty.title")} body={t("empty.body")} primary={canEdit ? t("empty.add") : undefined} onPrimary={openAdd}
                secondary={canEdit ? t("empty.receipts") : undefined} onSecondary={busy ? undefined : () => void fromReceipts()} />
            </Section>
          </>
        ) : (
          <>
            {q.isError ? <Section pt={14} px={16}><Banner tone="warn" icon="cloud" iconTone="amber" lead={t("offline.lead")}>{t("offline.body", { time: time(new Date(q.dataUpdatedAt), locale) })}</Banner></Section> : null}
            {!canEdit ? <Section pt={14} px={16}><Banner tone="info" icon="eye" iconTone="sky" lead={t("readOnly.lead")}>{t("readOnly.body")}</Banner></Section> : null}
            <Section delay={40} pt={16} px={16}>
              <KpiThree items={[
                { label: t("kpi.tracked"), value: number(k.tracked, locale), sub: t("kpi.places", { count: k.places }) },
                { label: t("kpi.low"), value: number(k.low, locale), sub: lowSub, tone: k.low > 0 ? "warn" : undefined },
                { label: t("kpi.reserved"), value: money(k.reservedCents / 100, locale, { cents: false }), sub: t("kpi.forJobs", { count: k.reservedJobs }) },
              ]} />
            </Section>
            <Section delay={70} pt={14} px={16}>
              <Segmented label={t("where")} options={LOCATIONS.map((l) => t(`loc.${l}`))} value={loc} onChange={setLoc} />
            </Section>
            {loc === 0 && low.length > 0 ? (
              <Section delay={100} pt={22} px={16}>
                <SectionHeader title={t("low.title")} link={t("low.link", { n: k.low, total: k.tracked })} />
                <Card>
                  {low.map((i, idx) => {
                    const o = orderFor(i, orders);
                    const st = rowStatus(i, o);
                    const sug = suggestionOf(i, o);
                    const canOrder = canEdit && !o && !!suggestedOption(i);
                    const canEditOrder = canEdit && !!o && o.status === "listed";
                    return (
                      <LowRow key={i.id} first={idx === 0} name={i.name}
                        left={<Text size={12.5} color="muted"><Num size={12.5} weight={600} color="ink">{n(i.total)}</Num> {t("low.left", { unit: unitW(i, i.total), par: n(i.par) })}</Text>}
                        status={<Status tone={st.look.tone} shape={st.look.shape}>{t(`low.status.${st.key}`)}</Status>}
                        suggestion={sug.line} suggestionSub={sug.sub}
                        action={canOrder ? <Button size="sm" label={t("low.reorder")} accessibilityLabel={t("low.reorderLabel", { name: i.name })} onPress={() => openReorder(i)} />
                          : canEditOrder ? <Button size="sm" kind="secondary" label={t("low.edit")} accessibilityLabel={t("low.editLabel", { name: i.name })} onPress={() => openReorder(i)} /> : undefined} />
                    );
                  })}
                </Card>
              </Section>
            ) : null}
            <Section delay={130} pt={22} px={16}>
              <SectionHeader title={placeTitle} link={t("stock.count", { count: stock.length })} />
              <Card>
                {stock.length === 0 ? <Stack px={20} pt={22} pb={22}><Text size={13.5} color="muted" align="center">{t("stock.none")}</Text></Stack> : stock.map((i, idx) => {
                  const qty = qtyAt(i, place);
                  return (
                    <StockRow key={i.id} first={idx === 0} name={i.name} qty={n(qty)} unit={unitW(i, qty)} fill={fillOf(i)} low={i.level !== "ok"}
                      where={whereOf(i).map((w, wi) => <Where key={wi} name={w.kind === "shop" ? t("loc.shop") : w.kind === "truck" ? t("loc.truck") : w.kind === "site" ? w.name! : t("stock.nowhere")} n={n(w.n)} />)}
                      reserved={i.reserved.map((r) => t("stock.reserved", { qty: n(r.qty), unit: i.unit, job: r.job }))} />
                  );
                })}
              </Card>
            </Section>
          </>
        )}
      </ScrollPage>

      <Sheet open={menu} onClose={() => setMenu(false)} label={t("more")} closeLabel={t("close")}>
        <MenuList>
          {canEdit ? <MenuRow icon={<Icon name="box" tone="amber" size={28} />} title={t("menu.count")} sub={t("menu.countSub")} chevron={false} onPress={() => { setMenu(false); setCounting({ mode: "pick" }); }} /> : null}
          {canEdit ? <MenuRow icon={<Icon name="plus" tone="violet" size={28} />} title={t("menu.add")} sub={t("menu.addSub")} chevron={false} onPress={openAdd} /> : null}
          <MenuRow icon={<Icon name="truck" tone="stone" size={28} />} title={t("menu.suppliers")} sub={t("menu.suppliersSub")} onPress={() => { setMenu(false); router.push(screenHref("Suppliers", t("soon.suppliers"))); }} />
        </MenuList>
      </Sheet>

      <Sheet open={!!reorder && !!cur} onClose={() => setReorder(null)} label={t("sheet.title")} closeLabel={t("close")}>
        {cur && reorder ? (
          <>
            <SheetTitle>{t("sheet.title")}</SheetTitle>
            <Stack px={20}><Text size={12.5} color="muted">{t("sheet.sub", { name: cur.name, n: n(cur.total) })}</Text></Stack>
            <SheetScroll>
              <Stack pt={16} pb={20} gap={16}>
                <Stack px={16}>
                  <LabelRow title={t("sheet.quantity")} sub={reorder.qty === cur.suggested ? t("sheet.why") : t("sheet.whyOther", { n: n(cur.suggested) })}>
                  <QtyStepper value={n(reorder.qty)} decLabel={t("sheet.fewer")} incLabel={t("sheet.more")}
                    onDec={() => setReorder({ ...reorder, qty: Math.max(1, stepQty(reorder.qty, -qtyStep(cur.suggested))) })} onInc={() => setReorder({ ...reorder, qty: stepQty(reorder.qty, qtyStep(cur.suggested)) })} />
                  </LabelRow>
                </Stack>
                <Stack gap={8} px={16}>
                  <Text size={12.5} color="muted">{t("sheet.supplier")}</Text>
                  {cur.options.length === 0 ? <Text size={13.5} color="muted">{t("sheet.noSuppliers")}</Text> : (
                    <Card>
                      {cur.options.map((o, idx) => {
                        const tag = tagOf(o, cur.options);
                        const sub = [o.delivers, o.terms].filter(Boolean).join(" · ") || (o.kind === "counter" ? t("sheet.counter") : "");
                        return (
                          <OptionRow key={o.supplierId} first={idx === 0} on={reorder.supplierId === o.supplierId} title={o.name} sub={sub} onPress={() => setReorder({ ...reorder, supplierId: o.supplierId })}
                            label={`${o.name}, ${o.priceCents != null ? t("sheet.priceEach", { price: m(o.priceCents) }) : t("sheet.noPrice")}`}
                            price={o.priceCents != null ? m(o.priceCents) : undefined}
                            tag={tag ? t(`sheet.tag.${tag.key}`, { pct: tag.pct }) : t("sheet.noPrice")} tagTone={tag?.key === "best" ? "ok" : tag?.key === "up" ? "warn" : "muted"} />
                        );
                      })}
                    </Card>
                  )}
                </Stack>
                <Stack gap={8}>
                  <Stack px={20}><Text size={12.5} color="muted">{t("sheet.deliver")}</Text></Stack>
                  <ChipWrap>{destinations(on?.sites ?? []).map((d) => <Chip key={d} label={destLabel(d)} selected={reorder.dest === d} onPress={() => setReorder({ ...reorder, dest: d })} />)}</ChipWrap>
                </Stack>
                <Stack px={16}>
                  <Button size="lg" block disabled={!reorder.supplierId || cur.options.length === 0}
                    label={lineTotalCents(reorder.qty, curOpt) != null ? t("sheet.add", { total: m(lineTotalCents(reorder.qty, curOpt)!) }) : reorder.orderId ? t("sheet.update") : t("sheet.addNoPrice")}
                    busy={saving ? t("sheet.saving") : false} onPress={() => void addOrder()} />
                </Stack>
              </Stack>
            </SheetScroll>
          </>
        ) : null}
      </Sheet>

      <Sheet open={!!counting} onClose={() => setCounting(null)} label={t("count.title")} closeLabel={t("close")}>
        {counting && counting.mode === "pick" ? (
          <>
            <SheetTitle>{t("count.title")}</SheetTitle>
            <SheetScroll>
              <Stack px={16} pb={20}>
                <Card>
                  <RowList>
                    <ListRow leading={<Icon name="plus" tone="violet" size={28} />} title={t("count.add")} meta={t("count.addSub")} onPress={openAdd} trailing={<RowChevron />} />
                    {items.length === 0 ? <Stack px={16} pt={14} pb={14}><Text size={13.5} color="muted">{t("count.noItems")}</Text></Stack> : items.map((i) => (
                      <ListRow key={i.id} title={i.name} meta={t("count.rowSub", { n: n(i.total), unit: unitW(i, i.total) })} onPress={() => setCounting({ mode: "item", id: i.id, c: countOf(i) })} trailing={<RowChevron />} />
                    ))}
                  </RowList>
                </Card>
              </Stack>
            </SheetScroll>
          </>
        ) : counting && counting.mode === "item" && countItem ? (
          <>
            <SheetTitle>{countItem.name}</SheetTitle>
            <Stack px={16} pb={20} gap={14}>
              {[
                { key: "shop", label: t("count.shop"), qty: counting.c.shopQty, set: (v: number) => setCounting({ ...counting, c: { ...counting.c, shopQty: v } }) },
                { key: "truck", label: t("count.truck"), qty: counting.c.truckQty, set: (v: number) => setCounting({ ...counting, c: { ...counting.c, truckQty: v } }) },
                ...counting.c.sites.map((s, si) => ({ key: `s${si}`, label: s.name, qty: s.qty, set: (v: number) => setCounting({ ...counting, c: { ...counting.c, sites: counting.c.sites.map((x, xi) => (xi === si ? { ...x, qty: v } : x)) } }) })),
              ].map((r) => (
                <LabelRow key={r.key} title={r.label} sub={unitW(countItem, r.qty)}>
                  <QtyStepper value={n(r.qty)} decLabel={t("count.fewer", { place: r.label })} incLabel={t("count.more", { place: r.label })}
                    onDec={() => r.set(stepQty(r.qty, -qtyStep(countItem.par)))} onInc={() => r.set(stepQty(r.qty, qtyStep(countItem.par)))} />
                </LabelRow>
              ))}
              <Button size="lg" block label={t("count.save")} disabled={!changedCount(countItem, counting.c)} busy={saving ? t("sheet.saving") : false} onPress={() => void saveCount()} />
              <Button size="md" block kind="secondary" label={t("count.all")} onPress={() => setCounting({ mode: "pick" })} />
            </Stack>
          </>
        ) : null}
      </Sheet>

      <Sheet open={adding} onClose={() => setAdding(false)} label={t("add.title")} closeLabel={t("close")}>
        <SheetTitle>{t("add.title")}</SheetTitle>
        <Stack pb={20} gap={14} px={16}>
          <TextField label={t("add.name")} value={material.name} onChangeText={(v) => setMaterial({ ...material, name: v })} placeholder={t("add.namePh")} />
          <TextField label={t("add.unit")} value={material.unit} onChangeText={(v) => setMaterial({ ...material, unit: v })} placeholder={t("add.unitPh")} autoCapitalize="none" />
          <TwoCols>
            {[
              <TextField key="p" label={t("add.par")} numeric keyboardType="decimal-pad" value={material.par} onChangeText={(v) => setMaterial({ ...material, par: v })} />,
              <TextField key="s" label={t("add.shop")} numeric keyboardType="decimal-pad" value={material.shop} onChangeText={(v) => setMaterial({ ...material, shop: v })} />,
            ]}
          </TwoCols>
          <Button size="lg" block label={t("add.save")} disabled={!canSaveMaterial(material)} busy={saving ? t("add.saving") : false} onPress={() => void saveMaterial()} />
        </Stack>
      </Sheet>
    </Screen>
  );
}
