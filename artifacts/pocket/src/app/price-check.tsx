// PriceCheck.dc.html: every priced line compared with your own references (price book, receipts); the ones 5% or more
// away get a suggestion to apply (one by one, or all). States: checking, default, no price history, locked quote,
// can't load, not found. Applying changes the quote's prices and totals on the server (POST /api/quotes/:id/reprice).
import { useMemo, useState } from "react";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getListQuotesQueryKey } from "@workspace/api-client-react";
import { ApiFailure } from "@/lib/api";
import { money, number, type Locale } from "@/lib/format";
import { screenHref } from "@/lib/nav";
import { deltaTone, headlineOf, lineDelta, lineKey, marks, suggestions, totalWith, type CheckLine } from "@/lib/priceCheck";
import { quoteApi } from "@/lib/quoteApi";
import { useSession } from "@/lib/useSession";
import { ActionBar, ACTION_BAR_SPACE } from "@/ui/ActionBar";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Banner, Empty, useToast } from "@/ui/Feedback";
import { Header, PageTitle } from "@/ui/Header";
import { ScrollPage, Section, Stack } from "@/ui/Layout";
import { Figures } from "@/ui/Numbers";
import { Footnote, KeyRow, KeySwatch, LoadingCards, PriceCard, RangeBar, Reason, SuggestBox } from "@/ui/PriceCheck";
import { Screen } from "@/ui/Screen";
import { Status, type StatusShape, type StatusTone } from "@/ui/Status";
import { Num, Text } from "@/ui/Text";

const LOOK: Record<string, { tone: StatusTone; shape: StatusShape; dot: "warn" | "info" | "ok-dot" | "faint" }> = {
  low: { tone: "warn", shape: "alert", dot: "warn" },
  high: { tone: "info", shape: "alert", dot: "info" },
  in_range: { tone: "ok", shape: "check", dot: "ok-dot" },
  no_data: { tone: "mute", shape: "off", dot: "faint" },
};

export default function PriceCheck() {
  const { t, i18n } = useTranslation();
  const locale: Locale = i18n.language.startsWith("fr") ? "fr-CA" : "en-CA";
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const toast = useToast();
  const client = useQueryClient();
  const check = useQuery({ queryKey: ["quote-price-check", id], queryFn: () => quoteApi.priceCheck(id!), enabled: signedIn && !!id, retry: 1 });
  const quote = useQuery({ queryKey: ["quote", id], queryFn: () => quoteApi.get(id!), enabled: signedIn && !!id, retry: 1, staleTime: 15_000 });
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const lines = useMemo(() => (check.data?.lines ?? []) as CheckLine[], [check.data]);
  const sug = useMemo(() => suggestions(lines), [lines]);
  if (status === "out") return <Redirect href="/" />;

  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("QuoteEditor", t("qe.back"), { id: id ?? "" })));
  const head = <Header title="" backLabel={t("pc.back")} onBack={back} />;
  const m = (n: number) => money(n, locale);
  const loading = (check.isPending || quote.isPending) && !check.data;

  if ((check.isError || quote.isError) && !check.data) {
    const nf = (check.error instanceof ApiFailure && check.error.status === 404) || (quote.error instanceof ApiFailure && quote.error.status === 404);
    return (
      <Screen>{head}<Section pt={26} px={16}>
        {nf ? <Empty icon="file" iconTone="slate" title={t("pc.notFound.title")} body={t("pc.notFound.body")} action={t("pc.back")} actionKind="secondary" onAction={back} />
          : <Empty icon="warn" iconTone="clay" title={t("pc.loadFailed.title")} body={t("pc.loadFailed.body")} action={t("pc.loadFailed.retry")} onAction={() => { void check.refetch(); void quote.refetch(); }} />}
      </Section></Screen>
    );
  }

  const q = quote.data;
  const locked = !!q && (q.status === "accepted" || !!q.pdfDownloadedAt || check.data?.editable === false);
  const nApplied = sug.filter((l) => applied.has(lineKey(l))).length;
  const remaining = sug.length - nApplied;
  const headline = headlineOf({ loading, suggested: sug.length, applied: nApplied });
  const refs = check.data?.references ?? 0;
  const thin = !loading && refs === 0;
  const caps = q?.capitoli ?? [];
  const rate = Number(q?.ivaPercentuale ?? 0);
  const disc = q?.sconto?.percentuale ?? 0;
  const asQuoted = q?.totale ?? 0;
  const allKeys = new Set(sug.map(lineKey));
  const shown = nApplied ? totalWith(caps, lines, applied, rate, disc) : totalWith(caps, lines, allKeys, rate, disc);
  const delta = Math.round((shown - asQuoted) * 100) / 100;
  const threshold = check.data?.thresholdPct ?? 5;
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";

  const toggle = (l: CheckLine) => setApplied((s) => { const n = new Set(s); const k = lineKey(l); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const save = async () => {
    const items = sug.filter((l) => applied.has(lineKey(l)) && l.referenceUnitPrice != null).map((l) => ({ chapter: l.chapter, index: l.index, unitPrice: l.referenceUnitPrice! }));
    if (!items.length || !q) return;
    setBusy(true);
    try {
      const r = await quoteApi.reprice(q.id, items);
      client.setQueryData(["quote", id], r.quote);
      void client.invalidateQueries({ queryKey: getListQuotesQueryKey() });
      void client.invalidateQueries({ queryKey: ["quote-price-check", id] });
      setApplied(new Set());
      toast({ message: t("pc.toast.applied") });
    } catch (e) {
      toast({ message: e instanceof ApiFailure && e.offline ? t("pc.toast.offline") : e instanceof ApiFailure && e.status === 400 ? t("pc.toast.locked") : t("pc.toast.failed") });
    } finally {
      setBusy(false);
    }
  };

  const ordered = lines.filter((l) => l.verdict === "low" || l.verdict === "high").concat(lines.filter((l) => l.verdict === "in_range"));
  const noData = lines.filter((l) => l.verdict === "no_data").length;
  const refLines = lines.some((l) => l.referenceUnitPrice != null);

  return (
    <Screen floating={!loading && !locked && sug.length > 0 ? (
      <ActionBar label={nApplied > 0 ? `${t("pc.apply")} (${nApplied})` : t("pc.applyAll", { count: remaining })} busy={busy}
        onPress={() => { if (nApplied === 0) setApplied(allKeys); else void save(); }} moreLabel={t("pc.backToEditor")} onMore={back} />
    ) : undefined}>
      {head}
      <ScrollPage bottom={ACTION_BAR_SPACE}>
        <Section px={20} pt={8} gap={6}>
          <Text size={12.5} color="muted">{[q?.clientData.nome, q?.numeroPreventivoData].filter(Boolean).join(" · ")}</Text>
          <PageTitle>{t(thin ? "pc.headline.noHistory" : `pc.headline.${headline}`, { count: headline === "checking" ? (check.data?.linesChecked ?? "") : remaining })}</PageTitle>
          <Text size={13.5} color="muted" leading={1.45}>{loading ? t("pc.basis.checking") : refs > 0 ? t("pc.basis.based", { count: refs }) : t("pc.basis.none")}</Text>
        </Section>
        {loading ? <Section pt={18} px={16}><LoadingCards /></Section> : (
          <>
            {thin ? <Section delay={20} pt={16} px={16}><Banner tone="info" icon="spark" iconTone="sky" lead={t("pc.thin.lead")}>{t("pc.thin.body")}</Banner></Section> : null}
            {locked ? <Section delay={20} pt={16} px={16}><Banner tone="info" icon="lock" iconTone="slate" lead={t("pc.locked")} /></Section> : null}
            {sug.length > 0 && q ? (
              <Section delay={50} pt={18} px={16}>
                <Card>
                  <Stack row justify="space-between" align="flex-end" gap={12} px={16} pt={16} pb={14}>
                    <Stack gap={5}>
                      <Text size={12.5} color="muted">{nApplied ? t("pc.total.newTotal") : t("pc.total.ifAll")}</Text>
                      <Num size={32} weight={600} tracking={-0.04} leading={1}>{m(shown)}</Num>
                    </Stack>
                    <Num size={13.5} weight={600} color={deltaTone(delta)}>{`${sign}${m(Math.abs(delta))}`}</Num>
                  </Stack>
                  <Figures items={[{ label: t("pc.total.asQuoted"), value: m(asQuoted) }, { label: t("pc.total.lines"), value: String(check.data?.linesChecked ?? 0) }]} />
                </Card>
              </Section>
            ) : null}
            {refLines ? (
              <Section delay={80} pt={14}>
                <KeyRow items={[
                  { node: <KeySwatch kind="band" />, label: t("pc.legend.band", { pct: threshold }) },
                  { node: <KeySwatch kind="reference" />, label: t("pc.legend.reference") },
                  { node: <KeySwatch kind="you" />, label: t("pc.legend.you") },
                  { node: <KeySwatch kind="suggested" />, label: t("pc.legend.suggested") },
                ]} />
              </Section>
            ) : null}
            <Section delay={110} pt={14} px={16} gap={10}>
              {ordered.map((l) => {
                const k = lineKey(l);
                const ap = applied.has(k);
                const look = LOOK[l.verdict]!;
                const ref = l.referenceUnitPrice;
                const mk = ref != null ? marks(l.quotedUnitPrice, ref, threshold) : null;
                const canSuggest = (l.verdict === "low" || l.verdict === "high") && !locked && ref != null;
                const price = ap && ref != null ? ref : l.quotedUnitPrice;
                const srcName = l.source ? t(`pc.sourceName.${l.source}`) : "";
                const d = lineDelta(l);
                return (
                  <PriceCard key={k} name={l.description.split("\n")[0]!}
                    sub={<Text size={12.5} color="muted"><Num size={12.5} weight={400} color="muted">{m(price)}</Num>{` · ${t("pc.qty", { qty: number(l.quantita, locale, 2), unit: l.um })}`}</Text>}
                    status={<Status tone={ap ? "ok" : look.tone} shape={ap ? "check" : look.shape}>{ap ? t("pc.verdict.applied") : t(`pc.verdict.${l.verdict}`)}</Status>}>
                    {mk && ref != null ? <RangeBar you={ap ? mk.reference : mk.you} reference={mk.reference} bandLo={mk.bandLo} bandHi={mk.bandHi} suggested={canSuggest && !ap ? mk.reference : undefined}
                      youColor={ap ? "ok-dot" : look.dot} label={`${t(`pc.verdict.${l.verdict}`)}: ${m(l.quotedUnitPrice)}, ${t("pc.range", { price: m(ref) })}`} /> : null}
                    <Reason>{l.verdict === "no_data" ? t("pc.why.no_data") : t(`pc.why.${l.verdict}`, { source: srcName, reference: m(ref ?? 0), quoted: m(l.quotedUnitPrice) })}</Reason>
                    {canSuggest ? (
                      <SuggestBox action={<Button size="sm" kind={ap ? "secondary" : "primary"} label={ap ? t("pc.undo") : t("pc.apply")} onPress={() => toggle(l)} />}>
                        <Text size={13.5} weight={500}>{t("pc.suggest", { price: m(ref!) })}{" "}<Num size={13.5} weight={500} color={deltaTone(d)}>{`${d > 0 ? "+" : "−"}${m(Math.abs(d))}`}</Num></Text>
                        <Text size={12.5} color="muted">{l.source === "receipts" ? t("pc.source.receipts", { count: l.sampleCount ?? 0 }) : t("pc.source.catalog")}</Text>
                      </SuggestBox>
                    ) : null}
                  </PriceCard>
                );
              })}
              {noData > 0 ? <Footnote>{t("pc.noDataCount", { count: noData })}</Footnote> : null}
              <Footnote>{t("pc.footnote")}</Footnote>
            </Section>
          </>
        )}
      </ScrollPage>
    </Screen>
  );
}
