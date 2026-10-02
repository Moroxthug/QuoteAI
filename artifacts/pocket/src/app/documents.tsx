// Documents.dc.html. What the receipts and supplier invoices the AI read say about prices: the item that moved most (who charges what, and the price
// book to bring up to date), the item that is nearly tracked, the key materials, what was read, and the files by job. Upload: a photo or a file,
// filed under a job or under the company. States: default, empty (nothing read yet), loading, can't load, offline, view only.
// Not drawn, for want of data: the board's "per sheet" unit under the price (receipt lines carry no unit), the "Forward by email" way to upload (the
// app has no inbound address for documents yet) and the Company folder's "WSIB, insurance" (it holds every file not filed under a job).
import { useEffect, useMemo, useState } from "react";
import { RoleTabs } from "@/ui/TabShell";
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiFailure } from "@/lib/api";
import { deltaText, priceLook } from "@/lib/suppliers";
import { cheapest, clip, directionOf, foldersOf, isEmpty, keepKey, keepValue, keptThisMonth, monthLabels, movePercent, sinceMonth, type DocRow } from "@/lib/documents";
import { documentsApi, chooseDocument } from "@/lib/documentsApi";
import { kvGet, kvSet } from "@/lib/kv";
import { money, number, shortDate, type Locale } from "@/lib/format";
import { takePhoto, type PickResult } from "@/lib/media";
import { screenHref } from "@/lib/nav";
import { priceBookApi } from "@/lib/priceBookApi";
import { useSession } from "@/lib/useSession";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Chip, ChipWrap } from "@/ui/Chip";
import { AlmostRow, ButtonPair, FolderGrid, FolderTile, MaterialRow, ReadRow, SheetHead, TrendCard, UploadOption } from "@/ui/Documents";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { Glyph } from "@/ui/Icon";
import { Header, PageTitle } from "@/ui/Header";
import { ScrollPage, Section, Stack } from "@/ui/Layout";
import { SectionHeader } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Sheet } from "@/ui/Sheet";
import { Text } from "@/ui/Text";

type Waiting = { key: string; name: string; job: string | null };

export default function Documents() {
  const { t: tr, i18n } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`dc.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const toast = useToast();
  const client = useQueryClient();
  const q = useQuery({ queryKey: ["documents"], queryFn: documentsApi.overview, enabled: signedIn, retry: 1, staleTime: 15_000 });

  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  const [waiting, setWaiting] = useState<Waiting[]>([]);
  const [kept, setKept] = useState(false);
  const [updated, setUpdated] = useState<{ itemId: string; price: number; was: number; wasCost: number | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const now = useMemo(() => new Date(), []);

  const data = q.data;
  const nudgeId = data?.trend?.nudge?.itemId ?? null;
  useEffect(() => {
    if (!nudgeId) return;
    let live = true;
    void kvGet(keepKey(nudgeId)).then((v) => { if (live) setKept(keptThisMonth(v, now)); });
    return () => { live = false; };
  }, [nudgeId, now]);

  if (status === "out") return <Redirect href="/" />;

  const m2 = (n: number) => money(n, locale);
  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("Menu", tr("menu.back"))));
  const loading = q.isPending && !data;
  const failed = q.isError && !data;
  const canUpload = data?.canUpload ?? false;
  const empty = !!data && isEmpty(data) && waiting.length === 0;

  // The board starts on the first job; "Company" files it under none.
  const job = picked === undefined ? data?.fileUnder[0]?.id ?? null : picked;
  const jobName = (id: string | null) => (id ? data?.fileUnder.find((j) => j.id === id)?.name ?? null : null);

  const send = async (r: PickResult) => {
    if (!r.ok) { toast({ message: t(r.problem === "denied" ? "toast.denied" : "toast.unavailable") }); return; }
    const file = r.files[0];
    if (!file) return;
    const key = `${Date.now()}`;
    const label = file.name;
    setWaiting((w) => [{ key, name: label, job }, ...w]);
    toast({ message: t("toast.reading", { name: label }) });
    const res = await documentsApi.upload(file, job);
    if (res.ok) {
      await client.invalidateQueries({ queryKey: ["documents"] });
      void client.invalidateQueries({ queryKey: ["books"] });
      toast({ message: t("toast.read", { name: label }) });
    } else {
      toast({ message: res.status === 403 ? t(res.message === "Receipt scanning requires the Pro plan" ? "toast.plan" : "toast.noAccess") : res.status === 0 ? t("toast.offline") : t("toast.failed") });
    }
    setWaiting((w) => w.filter((x) => x.key !== key));
  };
  const pickPhoto = async () => { setOpen(false); await send(await takePhoto("invoice")); };
  const pickFile = async () => { setOpen(false); await send(await chooseDocument()); };

  const updatePrice = async () => {
    const n = data?.trend?.nudge;
    if (!n || busy) return;
    setBusy(true);
    try {
      await priceBookApi.update(n.itemId, { prezzoUnitario: n.newPrice, ...(n.newCost != null ? { unitCost: n.newCost } : null) });
      setUpdated({ itemId: n.itemId, price: n.newPrice, was: n.bookPrice, wasCost: n.newCost != null ? n.bookPrice : null });
      void client.invalidateQueries({ queryKey: ["price-book"] });
      void client.invalidateQueries({ queryKey: ["catalog"] });
    } catch (e) {
      toast({ message: e instanceof ApiFailure && e.status === 403 ? t("toast.noAccess") : t("toast.priceFailed") });
    } finally { setBusy(false); }
  };
  const undoPrice = async () => {
    if (!updated) return;
    try {
      await priceBookApi.update(updated.itemId, { prezzoUnitario: updated.was });
      setUpdated(null);
      void client.invalidateQueries({ queryKey: ["price-book"] });
      void client.invalidateQueries({ queryKey: ["catalog"] });
      toast({ message: t("toast.undone") });
    } catch { toast({ message: t("toast.priceFailed") }); }
  };
  const keepPrice = async () => {
    const n = data?.trend?.nudge;
    if (!n) return;
    await kvSet(keepKey(n.itemId), keepValue(now));
    setKept(true);
  };

  const states = { read: { tone: "ok", shape: "check" }, reading: { tone: "info", shape: "live" }, check: { tone: "warn", shape: "clock" } } as const;
  const docSub = (d: DocRow): string => {
    const parts = [shortDate(new Date(d.at), locale)];
    if (d.state === "reading") parts.push(t("read.filed", { job: d.projectName ?? t("jobs.company") }));
    else if (d.unread > 0) parts.push(t("read.unread", { count: d.unread }));
    else if (d.prices === 0) parts.push(d.state === "check" ? t("read.failed") : t("read.none"));
    else parts.push(d.changed > 0 ? `${t("read.pricesRead", { count: d.prices })} · ${t("read.changed", { count: d.changed })}` : t("read.prices", { count: d.prices }));
    if (d.projectName && d.state !== "reading") parts.push(d.projectName);
    return parts.join(" · ");
  };

  const trend = data?.trend ?? null;
  const dir = trend ? directionOf(trend.changePct) : "flat";
  const look = trend ? priceLook({ name: trend.name, from: trend.from, to: trend.to, changePct: trend.changePct, when: "x", points: trend.points }) : null;
  const best = trend ? cheapest(trend.stores) : null;
  const pct = trend ? movePercent(trend.changePct, locale) : "";
  const nudge = trend?.nudge && !updated && !kept && canUpload ? trend.nudge : null;
  const folders = data ? foldersOf(data) : [];

  return (
    <Screen floating={<RoleTabs active="docs" />}>
      <Header title="" backLabel={t("back")} onBack={back} moreLabel={t("more")} />
      <ScrollPage bottom={50}>
        <Section px={20} pt={4} row align="center" justify="space-between" gap={12}>
          <PageTitle>{t("title")}</PageTitle>
          {canUpload && !loading && !failed ? <Button size="sm" label={t("upload")} icon={<Glyph name="arrowUp" size={14} weight={2.2} color="on-inv" />} onPress={() => setOpen(true)} /> : null}
        </Section>

        {failed ? (
          <Section pt={26} px={16}><Empty icon="warn" iconTone="clay" title={t("loadFailed.title")} body={t("loadFailed.body")} action={t("retry")} onAction={() => void q.refetch()} /></Section>
        ) : loading ? (
          <Section pt={16} px={16} gap={14}><Skeleton height={300} radius={22} /><Skeleton height={64} radius={22} /><Skeleton height={230} radius={22} /></Section>
        ) : empty ? (
          <Section delay={20} pt={18} px={16}>
            <Card><Empty icon="doc" title={t("empty.title")} body={t("empty.body")} action={canUpload ? t("empty.action") : undefined} onAction={() => setOpen(true)} /></Card>
          </Section>
        ) : (
          <>
            {q.isError ? <Section pt={12} px={16}><Banner tone="warn" icon="cloud" iconTone="amber" lead={t("offline.lead")}>{t("offline.body")}</Banner></Section> : null}
            {!canUpload ? <Section pt={12} px={16}><Banner tone="info" icon="eye" iconTone="sky" lead={t("readOnly.lead")}>{t("readOnly.body")}</Banner></Section> : null}

            {trend && look ? (
              <Section delay={40} pt={16} px={16}>
                <TrendCard
                  title={t(`trend.${dir}`, { name: trend.name, pct })} sub={t("trend.sub", { count: trend.invoices, month: sinceMonth(now, locale) })}
                  pill={t(dir === "up" ? "trend.pillUp" : dir === "down" ? "trend.pillDown" : "trend.pillFlat", { pct })} pillTone={dir === "up" ? "warn" : dir === "down" ? "ok" : "mute"} pillShape={dir === "up" ? "alert" : dir === "down" ? "check" : "dot"}
                  was={m2(trend.from)} now={m2(trend.to)} color={dir === "up" ? "warn-dot" : dir === "down" ? "ok-dot" : "faint"} values={trend.points}
                  chartLabel={t("trend.chart", { from: m2(trend.from), to: m2(trend.to) })} months={monthLabels(now, locale)}
                  stores={trend.stores.map((s) => ({ name: s.name, when: shortDate(new Date(s.at), locale), price: m2(s.price), best: s.name === best }))}>
                  {nudge ? (
                    <ButtonPair>
                      <Stack grow><Button size="sm" label={t("trend.update", { price: m2(nudge.newPrice) })} busy={busy ? t("trend.update", { price: m2(nudge.newPrice) }) : false} onPress={() => void updatePrice()} block /></Stack>
                      <Stack grow><Button size="sm" kind="secondary" label={t("trend.keep", { price: m2(nudge.bookPrice) })} onPress={() => void keepPrice()} block /></Stack>
                    </ButtonPair>
                  ) : null}
                  {updated ? <Banner tone="ok" icon="check" iconTone="sage" lead={t("trend.updated", { price: m2(updated.price) })} link={t("trend.undo")} onLink={() => void undoPrice()} /> : null}
                  {kept && trend.nudge && !updated ? <Banner tone="ok" icon="check" iconTone="sage" lead={t("trend.kept", { price: m2(trend.nudge.bookPrice) })} /> : null}
                </TrendCard>
              </Section>
            ) : null}

            {data?.almost ? (
              <Section delay={60} pt={12} px={16}>
                <AlmostRow title={t("almost.title", { name: data.almost.name })} sub={t("almost.sub", { have: data.almost.have, need: data.almost.need })} have={data.almost.have} need={data.almost.need} />
              </Section>
            ) : null}

            {data && data.materials.length ? (
              <Section delay={80} pt={22} px={16}>
                <SectionHeader title={t("key.title")} link={t("key.link")} onLink={() => router.push(screenHref("PriceBook", t("key.link")))} />
                <Card>
                  {data.materials.map((m, i) => {
                    const p = { name: m.name, from: m.points[0] ?? m.price, to: m.price, changePct: m.changePct, when: "x", points: m.points };
                    return <MaterialRow key={m.name} first={i === 0} name={m.name} sub={m.store ? t("key.sub", { store: m.store, count: m.invoices }) : t("key.subNone", { count: m.invoices })} spark={m.points} color={priceLook(p).color === "faint" ? "muted" : priceLook(p).color}
                      price={m2(m.price)} change={Math.abs(m.changePct) < 0.05 ? t("key.same") : deltaText(m.changePct, locale)} />;
                  })}
                </Card>
              </Section>
            ) : null}

            {data && (data.docs.length || waiting.length) ? (
              <Section delay={100} pt={22} px={16}>
                <SectionHeader title={t("read.title")} link={t("read.count", { count: number(data.readThisMonth + waiting.length, locale) })} />
                <Card>
                  {waiting.map((w, i) => (
                    <ReadRow key={w.key} first={i === 0} icon="camera" tone="violet" name={w.name} sub={t("read.filed", { job: jobName(w.job) ?? t("jobs.company") })} status={t("read.Reading")} statusTone="info" statusShape="live" />
                  ))}
                  {data.docs.map((d, i) => (
                    <ReadRow key={d.id} first={waiting.length === 0 && i === 0} icon={d.kind === "quote" ? "doc" : "receipt"} tone={d.kind === "quote" ? "violet" : (["amber", "stone", "sky"] as const)[i % 3]!}
                      name={d.name} sub={docSub(d)} status={t(`read.${d.state === "read" ? "Read" : d.state === "reading" ? "Reading" : "Check"}`)} statusTone={states[d.state].tone} statusShape={states[d.state].shape} />
                  ))}
                </Card>
              </Section>
            ) : null}

            {data && folders.length ? (
              <Section delay={120} pt={22} px={16}>
                <SectionHeader title={t("jobs.title")} link={t("jobs.files", { count: data.files })} />
                <FolderGrid>
                  {folders.map((f, i) => f.id ? (
                    <FolderTile key={f.key} icon={(["house", "bricks", "brush"] as const)[i % 3]!} tone={(["violet", "amber", "teal"] as const)[i % 3]!} name={f.name!}
                      sub={f.client ? t("jobs.sub", { client: f.client, count: f.count }) : t("jobs.subNone", { count: f.count })} onPress={() => router.push(screenHref("Job", f.name!, { id: f.id! }))} />
                  ) : (
                    <FolderTile key={f.key} icon="building" tone="slate" name={t("jobs.company")} sub={t("jobs.companySub", { count: f.count })} />
                  ))}
                </FolderGrid>
              </Section>
            ) : null}
          </>
        )}
      </ScrollPage>

      <Sheet open={open} onClose={() => setOpen(false)} label={t("sheet.title")} closeLabel={t("close")}>
        <Stack px={16} pb={30} gap={4}>
          <SheetHead title={t("sheet.title")} sub={t("sheet.sub")} closeLabel={t("close")} onClose={() => setOpen(false)} />
          <Card>
            <UploadOption first icon="camera" tone="violet" label={t("sheet.photo")} sub={t("sheet.photoSub")} onPress={() => void pickPhoto()} />
            <UploadOption icon="file" tone="azure" label={t("sheet.file")} sub={t("sheet.fileSub")} onPress={() => void pickFile()} />
          </Card>
          <Stack gap={6}>
            <Text size={12.5} color="muted">{t("sheet.under")}</Text>
            <ChipWrap>
              {(data?.fileUnder ?? []).map((j) => <Chip key={j.id} label={clip(j.name)} selected={job === j.id} onPress={() => setPicked(j.id)} />)}
              <Chip label={t("sheet.company")} selected={job === null} onPress={() => setPicked(null)} />
            </ChipWrap>
          </Stack>
        </Stack>
      </Sheet>
    </Screen>
  );
}
