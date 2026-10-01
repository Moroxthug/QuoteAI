// Supplier.dc.html. One supplier: the rep with Call, Email and Directions; the account and terms; the price history with a sparkline for each item and,
// when a price went up while the price book still has the old one, a banner that brings the price book up to date; recent orders; receipts (pick the job
// of one that has none); notes; and the ⋯ menu (edit, share the order list, archive). States: default, can't load, not found, offline, view only.
// From the receipts' lines, not a price list: the history is what the supplier charged on each receipt. The account card shows what was spent this month
// where the board shows "owing" (the app keeps no supplier bills). The board's "Statement" and "Add a contact" are not built.
import { useState } from "react";
import { Linking, Share } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiFailure } from "@/lib/api";
import { tintFor } from "@/lib/clients";
import { money, shortDate, splitMoney, type Locale } from "@/lib/format";
import { initialsOf } from "@/lib/invites";
import { jobsApi } from "@/lib/jobsApi";
import { screenHref } from "@/lib/nav";
import { parseAmount } from "@/lib/quoteEditor";
import { priceBookApi } from "@/lib/priceBookApi";
import { canSaveSupplier, dialable, formOf, isKnownCategory, mapsHref, ORDER_LOOK, orderCents, priceLook, deltaText, shareText, supplierBody, type OrderDto, type ReceiptDto, type SupplierForm } from "@/lib/suppliers";
import { suppliersApi } from "@/lib/suppliersApi";
import { useSession } from "@/lib/useSession";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { Glyph, Icon } from "@/ui/Icon";
import { Header } from "@/ui/Header";
import { ScrollPage, Section, Stack } from "@/ui/Layout";
import { ListRow, MenuList, MenuRow, RowBody, RowList, SectionHeader } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { Status, Tag } from "@/ui/Status";
import { AccountCard, NudgeBanner, PriceHistoryRow, SupplierFormSheet } from "@/ui/SupplierParts";
import { Num, Text } from "@/ui/Text";

export default function Supplier() {
  const { t: tr, i18n } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`sp.page.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const toast = useToast();
  const client = useQueryClient();
  const q = useQuery({ queryKey: ["supplier", id], queryFn: () => suppliersApi.get(id!), enabled: signedIn && !!id, retry: 1, staleTime: 15_000 });

  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<SupplierForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState<ReceiptDto | null>(null);
  const [updated, setUpdated] = useState<{ itemId: string; price: number; was: number; wasCost: number | null } | null>(null);
  const jobs = useQuery({ queryKey: ["jobs"], queryFn: jobsApi.list, enabled: signedIn && !!pick, retry: 1, staleTime: 30_000 });

  if (status === "out") return <Redirect href="/" />;

  const d = q.data;
  const s = d?.supplier;
  const m = (n: number) => money(n, locale);
  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("Suppliers", t("soon.suppliers"))));
  const canEdit = d?.canEdit ?? false;
  const failed = q.isError && !q.data;
  const notFound = failed && q.error instanceof ApiFailure && q.error.status === 404;
  const catLabel = (c: string) => (isKnownCategory(c.trim().toLowerCase()) ? tr(`sp.list.filters.${c.trim().toLowerCase()}`) : c.trim());
  const destLabel = (x: string) => (x === "shop" || x === "pickup" ? t(`dest.${x}`) : x);
  const refresh = async () => {
    await Promise.all([client.invalidateQueries({ queryKey: ["supplier", id] }), client.invalidateQueries({ queryKey: ["suppliers"] })]);
  };
  const noAccess = (e: unknown) => toast({ message: e instanceof ApiFailure && e.status === 403 ? tr("sp.toast.noAccess") : tr("sp.toast.failed") });

  const openEdit = () => { if (!s) return; setForm(formOf(s)); setMenu(false); setEditing(true); };
  const save = async () => {
    if (!form || !s || !canSaveSupplier(form) || saving) return;
    setSaving(true);
    try {
      await suppliersApi.update(s.id, supplierBody(form, form.proDiscount.trim() ? parseAmount(form.proDiscount) : null));
      await refresh();
      setEditing(false);
      toast({ message: tr("sp.toast.saved") });
    } catch (e) { noAccess(e); } finally { setSaving(false); }
  };
  const archive = async () => {
    if (!s) return;
    setBusy(true);
    try {
      await suppliersApi.archive(s.id);
      await client.invalidateQueries({ queryKey: ["suppliers"] });
      setConfirm(false);
      toast({ message: tr("sp.toast.archived", { name: s.name }) });
      back();
    } catch (e) { noAccess(e); } finally { setBusy(false); }
  };
  const share = async () => {
    if (!s || !d) return;
    const listed = d.orders.filter((o) => o.status === "listed");
    setMenu(false);
    if (!listed.length) { toast({ message: t("menu.shareNone") }); return; }
    const text = shareText(t("shareHeading", { supplier: s.name }), listed, destLabel);
    try {
      await Share.share({ message: text });
    } catch {
      // No share sheet (the web): open the mail app with it instead.
      void Linking.openURL(`mailto:${s.email}?subject=${encodeURIComponent(t("shareHeading", { supplier: s.name }))}&body=${encodeURIComponent(text)}`);
    }
    try { await suppliersApi.sent(s.id); await refresh(); } catch (e) { noAccess(e); }
  };
  const matchJob = async (jobId: string, jobName: string) => {
    if (!pick) return;
    const r = pick;
    setPick(null);
    try {
      await suppliersApi.matchReceipt(jobId, r.id);
      await refresh();
      void client.invalidateQueries({ queryKey: ["books"] });
      toast({ message: t("pickDone", { job: jobName }) });
    } catch (e) { noAccess(e); }
  };
  const updatePrice = async () => {
    const n = d?.nudge;
    if (!n) return;
    setBusy(true);
    try {
      await priceBookApi.update(n.itemId, { prezzoUnitario: n.newPrice, ...(n.newCost != null ? { unitCost: n.newCost } : null) });
      setUpdated({ itemId: n.itemId, price: n.newPrice, was: n.bookPrice, wasCost: n.newCost != null ? n.bookPrice : null });
      await refresh();
      void client.invalidateQueries({ queryKey: ["price-book"] });
      void client.invalidateQueries({ queryKey: ["catalog"] });
    } catch (e) { noAccess(e); } finally { setBusy(false); }
  };
  const undoPrice = async () => {
    if (!updated) return;
    try {
      await priceBookApi.update(updated.itemId, { prezzoUnitario: updated.was });
      setUpdated(null);
      await refresh();
      void client.invalidateQueries({ queryKey: ["price-book"] });
      void client.invalidateQueries({ queryKey: ["catalog"] });
      toast({ message: tr("sp.toast.undone") });
    } catch (e) { noAccess(e); }
  };

  const head = <Header title="" backLabel={tr("sp.back")} onBack={back} moreLabel={tr("sp.more")} onMore={s ? () => setMenu(true) : undefined} />;

  if (failed) {
    return (
      <Screen>{head}
        <Section pt={26} px={16}>
          {notFound ? <Empty icon="box" iconTone="slate" title={t("notFound.title")} body={t("notFound.body")} action={tr("sp.back")} actionKind="secondary" onAction={back} />
            : <Empty icon="warn" iconTone="clay" title={t("loadFailed.title")} body={t("loadFailed.body")} action={tr("sp.retry")} onAction={() => void q.refetch()} />}
        </Section>
      </Screen>
    );
  }
  if (!d || !s) {
    return <Screen>{head}<Section pt={8} px={20} gap={12}><Skeleton width="60%" height={28} radius={8} /><Skeleton height={150} radius={22} /><Skeleton height={190} radius={22} /></Section></Screen>;
  }

  const sub = [s.category.trim() ? catLabel(s.category) : "", s.address].filter(Boolean).join(" · ");
  const spent = splitMoney(d.spendMonthCents / 100, locale);
  const nudge = d.nudge && !updated ? d.nudge : null;
  const listedCount = d.orders.filter((o) => o.status === "listed").length;
  const firstName = s.repName.trim();
  const orderMeta = (o: OrderDto) => [t("orderMeta", { qty: o.qty, unit: o.unit }), o.destination ? destLabel(o.destination) : "", shortDate(new Date(o.orderedAt ?? o.createdAt), locale)].filter(Boolean).join(" · ");

  return (
    <Screen>
      {head}
      <ScrollPage bottom={40}>
        <Section px={20} pt={4} gap={3}>
          <Text size={24} weight={600} tracking={-0.035} leading={1.2} accessibilityRole="header">{s.name}</Text>
          {sub ? <Text size={13.5} color="muted">{sub}</Text> : null}
        </Section>
        <Section px={20} pt={12} row wrap gap={6}>
          {s.kind === "account" ? <Tag accent>{t("tagAccount")}</Tag> : <Tag>{t("tagCounter")}</Tag>}
          {s.terms ? <Tag>{s.terms}</Tag> : null}
          {s.delivers ? <Tag>{s.delivers}</Tag> : null}
        </Section>
        {q.isError ? <Section pt={14} px={16}><Banner tone="warn" icon="cloud" iconTone="amber" lead={t("offline.lead")}>{t("offline.body")}</Banner></Section> : null}
        {!canEdit ? <Section pt={14} px={16}><Banner tone="info" icon="eye" iconTone="sky" lead={t("readOnly.lead")}>{t("readOnly.body")}</Banner></Section> : null}

        <Section delay={40} pt={18} px={16}>
          <Card>
            {firstName ? (
              <ListRow leading={<Avatar initials={initialsOf(firstName)} tint={tintFor(firstName)} />} title={firstName} meta={s.repRole || undefined}
                trailing={<>{s.phone ? <Num size={13.5}>{s.phone}</Num> : null}{s.hours ? <Text size={11.5} color="muted">{s.hours}</Text> : null}</>} />
            ) : null}
            <Stack row gap={8} px={16} pt={firstName ? 4 : 16} pb={16}>
              <Button size="md" grow label={t("call")} disabled={!s.phone} icon={<Glyph name="phone" size={16} weight={2} color="on-inv" />} accessibilityLabel={s.phone ? t("callName", { name: s.name }) : t("noPhone")}
                onPress={() => void Linking.openURL(`tel:${dialable(s.phone)}`)} />
              <Button size="md" grow kind="secondary" label={t("email")} disabled={!s.email} accessibilityLabel={s.email ? `${t("email")}, ${s.name}` : t("noEmail")} onPress={() => void Linking.openURL(`mailto:${s.email}`)} />
              <Button size="md" grow kind="secondary" label={t("directions")} disabled={!s.address} accessibilityLabel={s.address ? `${t("directions")}, ${s.name}` : t("noAddress")} onPress={() => void Linking.openURL(mapsHref(s.address))} />
            </Stack>
          </Card>
        </Section>

        <Section delay={70} pt={22} px={16}>
          <SectionHeader title={t("account")} link={s.accountNo || undefined} />
          <AccountCard caption={t("spentMonth")} whole={spent.whole} cents={spent.cents} cells={[
            { label: t("terms"), value: s.terms || t("dash") },
            { label: t("pro"), value: s.proDiscountPct ? t("proOff", { pct: s.proDiscountPct }) : t("dash") },
            { label: t("year"), value: money(d.spendYearCents / 100, locale, { cents: false }) },
          ]} />
        </Section>

        <Section delay={100} pt={22} px={16}>
          <SectionHeader title={t("prices")} link={t("last6")} />
          {d.prices.length === 0 ? (
            <Card><Empty icon="bars" iconTone="slate" title={t("noPrices.title")} body={t("noPrices.body")} padding={{ v: 24, h: 24 }} /></Card>
          ) : (
            <Card>
              {d.prices.map((p, i) => {
                const look = priceLook(p);
                return <PriceHistoryRow key={p.name} first={i === 0} name={p.name} from={m(p.from)} to={m(p.to)} spark={p.points} sparkColor={look.color} delta={deltaText(p.changePct, locale)} when={p.when ? shortDate(new Date(`${p.when}T12:00:00`), locale) : t("noChange")} />;
              })}
            </Card>
          )}
          {nudge && canEdit ? (
            <Stack pt={12}>
              <NudgeBanner lead={t("nudge.lead", { item: nudge.itemName, pct: Math.round(nudge.changePct) })}
                body={nudge.openQuotes > 0 ? t("nudge.bodyQuotes", { price: m(nudge.bookPrice), count: nudge.openQuotes }) : t("nudge.body", { price: m(nudge.bookPrice) })}
                primary={t("nudge.update", { price: m(nudge.newPrice) })} onPrimary={() => void updatePrice()} busy={busy ? t("nudge.update", { price: m(nudge.newPrice) }) : false}
                secondary={nudge.quoteId ? t("nudge.seeQuotes") : undefined} onSecondary={() => router.push(screenHref("PriceCheck", t("nudge.seeQuotes"), { id: nudge.quoteId! }))} />
            </Stack>
          ) : null}
          {updated && canEdit ? (
            <Stack pt={12}><Banner tone="ok" icon="check" iconTone="sage" lead={t("nudge.done")} link={t("nudge.undo")} onLink={() => void undoPrice()}>{t("nudge.doneBody", { price: m(updated.price) })}</Banner></Stack>
          ) : null}
        </Section>

        <Section delay={130} pt={22} px={16}>
          <SectionHeader title={t("orders")} link={listedCount ? t("onList", { count: listedCount }) : undefined} />
          {d.orders.length === 0 ? (
            <Card><Empty icon="truck" iconTone="amber" title={t("noOrders.title")} body={t("noOrders.body")} padding={{ v: 24, h: 24 }} /></Card>
          ) : (
            <Card>
              <RowList>
                {d.orders.slice(0, 8).map((o) => {
                  const look = ORDER_LOOK[o.status];
                  const cents = orderCents(o);
                  const word = t(`status.${o.status}`);
                  return (
                    <RowBody key={o.id} title={o.itemName} meta={orderMeta(o)}
                      trailing={<>{cents != null ? <Num size={14.5} weight={600}>{money(cents / 100, locale)}</Num> : null}<Status plain tone={look.tone} shape={look.shape}>{word}</Status></>} />
                  );
                })}
              </RowList>
            </Card>
          )}
        </Section>

        <Section delay={160} pt={22} px={16}>
          <SectionHeader title={t("receipts")} link={d.receiptsTotal ? t("matched", { n: d.receiptsMatched, m: d.receiptsTotal }) : undefined} />
          {d.receipts.length === 0 ? (
            <Card><Empty icon="receipt" iconTone="amber" title={t("noReceipts.title")} body={t("noReceipts.body")} padding={{ v: 24, h: 24 }} /></Card>
          ) : (
            <Card>
              <RowList>
                {d.receipts.map((r) => {
                  const needs = !r.projectId;
                  return (
                    <RowBody key={r.id} title={t("receiptTitle", { date: shortDate(new Date(`${r.date.slice(0, 10)}T12:00:00`), locale), what: r.description })}
                      meta={needs ? t("receiptMeta", { amount: m(r.totalCents / 100) }) : t("matchedTo", { job: r.projectName ?? "" })}
                      trailing={needs && d.canMatch
                        ? <Button size="sm" kind="secondary" label={t("pick")} onPress={() => setPick(r)} />
                        : <><Num size={14.5} weight={600}>{m(r.totalCents / 100)}</Num><Status plain tone={needs ? "warn" : "ok"} shape={needs ? "clock" : "check"}>{needs ? t("rcToMatch") : t("rcMatched")}</Status></>} />
                  );
                })}
              </RowList>
            </Card>
          )}
        </Section>

        {s.notes ? (
          <Section delay={190} pt={22} px={16}>
            <SectionHeader title={t("notes")} />
            <Card padded><Text size={14.5} color="t2" leading={1.45}>{s.notes}</Text></Card>
          </Section>
        ) : null}
      </ScrollPage>

      <Sheet open={menu} onClose={() => setMenu(false)} label={tr("sp.more")} closeLabel={tr("sp.close")}>
        <MenuList>
          {canEdit ? <MenuRow icon={<Icon name="pen" tone="indigo" size={28} />} title={t("menu.edit")} sub={t("menu.editSub")} onPress={openEdit} /> : null}
          <MenuRow icon={<Icon name="list" tone="azure" size={28} />} title={t("menu.share")} sub={t("menu.shareSub")} onPress={() => void share()} />
          {canEdit ? <MenuRow icon={<Icon name="box" tone="stone" size={28} />} title={t("menu.archive")} sub={t("menu.archiveSub")} onPress={() => { setMenu(false); setConfirm(true); }} /> : null}
        </MenuList>
      </Sheet>

      <Sheet open={editing} onClose={() => setEditing(false)} label={tr("sp.form.editTitle")} closeLabel={tr("sp.close")}>
        {form ? (
          <SupplierFormSheet t={(key) => tr(`sp.form.${key}`) as string} title={tr("sp.form.editTitle")} form={form} onChange={setForm} canSave={canSaveSupplier(form)} saving={saving} onSave={() => void save()}
            saveLabel={tr("sp.form.save")} categoryLabels={{ building: tr("sp.list.filters.building"), paint: tr("sp.list.filters.paint"), lumber: tr("sp.list.filters.lumber"), tools: tr("sp.list.filters.tools") }} />
        ) : null}
      </Sheet>

      <Sheet open={confirm} onClose={() => setConfirm(false)} label={t("confirm.title", { name: s.name })} closeLabel={tr("sp.close")}>
        <SheetTitle>{t("confirm.title", { name: s.name })}</SheetTitle>
        <Stack px={20} pb={4}><Text size={13.5} color="muted" leading={1.45}>{t("confirm.body")}</Text></Stack>
        <Stack px={16} pt={14} pb={20} gap={8}>
          <Button size="lg" block kind="destructive" label={t("confirm.yes")} busy={busy ? t("confirm.yes") : false} onPress={() => void archive()} />
          <Button size="lg" block kind="secondary" label={t("confirm.no")} onPress={() => setConfirm(false)} />
        </Stack>
      </Sheet>

      <Sheet open={!!pick} onClose={() => setPick(null)} label={t("pickTitle")} closeLabel={tr("sp.close")}>
        <SheetTitle>{t("pickTitle")}</SheetTitle>
        <Stack pb={20} px={16}>
          {jobs.isPending ? <Skeleton height={120} radius={22} /> : (jobs.data?.items ?? []).length === 0 ? <Text size={13.5} color="muted">{t("pickNone")}</Text> : (
            <Card>
              <RowList>
                {(jobs.data?.items ?? []).filter((j) => j.status !== "completed").slice(0, 12).map((j) => (
                  <ListRow key={j.id} onPress={() => void matchJob(j.id, j.name)} title={j.name} meta={j.clientName ?? undefined} />
                ))}
              </RowList>
            </Card>
          )}
        </Stack>
      </Sheet>
    </Screen>
  );
}
