// QuoteEditor.dc.html: the full editor. Title, client, the price check, every line (name, quantity x rate, move up, a
// price flag), the price book, totals, notes, "Not included", Good / Better / Best, the payment schedule, PDF layout,
// redo with AI and the contract. Changes save as you go (a moment after the last edit). `?variant=` edits one option's
// lines instead of the quote's. States: read-only (role), locked (accepted or PDF downloaded), seen by the client,
// loading, can't load, not found, offline.
import { useEffect, useMemo, useRef, useState } from "react";
import { Linking } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getListQuotesQueryKey } from "@workspace/api-client-react";
import { ApiFailure } from "@/lib/api";
import { money, relativeWhen, shortDate, type Locale } from "@/lib/format";
import { initialsOf } from "@/lib/invites";
import { screenHref } from "@/lib/nav";
import { tintFor } from "@/lib/clients";
import { API_ORIGIN } from "@/lib/session";
import { quoteApi, type QuoteFull, type Variant } from "@/lib/quoteApi";
import { addLine, canSend, editLine, flagKey, flagsOf, lineCount, moveLineUp, newLine, normalizeSchedule, parseAmount, scheduleView, segments, SEGMENT_COLOURS, stepTerm, toggleHoldback } from "@/lib/quoteEditor";
import { recompute, type Chapter } from "@/lib/quoteMath";
import { quoteState, validUntil as validUntilOf } from "@/lib/quotes";
import { useSession } from "@/lib/useSession";
import { ActionBar, ACTION_BAR_SPACE } from "@/ui/ActionBar";
import { Avatar } from "@/ui/Avatar";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { TextField } from "@/ui/Field";
import { Header } from "@/ui/Header";
import { Icon } from "@/ui/Icon";
import { ScrollPage, Section, Stack } from "@/ui/Layout";
import { Press } from "@/ui/motion";
import { MenuList, MenuRow, RowBody, RowList, SectionHeader } from "@/ui/Row";
import { QuoteHead, TotalsCard } from "@/ui/Quote";
import { ChapterBand, Divided, EditableTitle, ExclusionRow, Hint, LineEdit, LineEditCard, NavCard, NoteCard, ScheduleBar, SectionTitleRow, TermRow, TierCard } from "@/ui/QuoteEditor";
import { Screen } from "@/ui/Screen";
import { Search } from "@/ui/Search";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { Status } from "@/ui/Status";
import { Stepper } from "@/ui/Stepper";
import { Switch } from "@/ui/Switch";
import { Num, Text } from "@/ui/Text";

const SAVE_MS = 700;

export default function QuoteEditor() {
  const { t, i18n } = useTranslation();
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { id, variant: variantId } = useLocalSearchParams<{ id?: string; variant?: string }>();
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const toast = useToast();
  const client = useQueryClient();
  const q = useQuery({ queryKey: ["quote", id], queryFn: () => quoteApi.get(id!), enabled: signedIn && !!id, retry: 1, staleTime: 15_000 });
  const vq = useQuery({ queryKey: ["quote-variants", id], queryFn: () => quoteApi.variants(id!), enabled: signedIn && !!id, retry: false, staleTime: 15_000 });
  const pc = useQuery({ queryKey: ["quote-price-check", id], queryFn: () => quoteApi.priceCheck(id!), enabled: signedIn && !!id, retry: false, staleTime: 30_000 });
  const book = useQuery({ queryKey: ["catalog"], queryFn: quoteApi.catalog, enabled: signedIn, retry: false, staleTime: 5 * 60_000 });
  const quote = q.data;
  const variants = vq.data?.variants ?? [];
  const editingVariant = variants.find((v) => v.id === variantId) ?? null;

  const [caps, setCaps] = useState<Chapter[] | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [exDraft, setExDraft] = useState("");
  const [bookOpen, setBookOpen] = useState(false);
  const [bookTerm, setBookTerm] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [redoOpen, setRedoOpen] = useState(false);
  const [redoText, setRedoText] = useState("");
  const [redoBusy, setRedoBusy] = useState(false);
  const [tierSheet, setTierSheet] = useState<Variant | null>(null);
  const [tierName, setTierName] = useState("");
  const [tierSub, setTierSub] = useState("");
  const [offAsk, setOffAsk] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ lines?: Chapter[]; title?: string; notes?: string }>({});

  useEffect(() => {
    if (!quote) return;
    const src = editingVariant ? editingVariant.capitoli : quote.capitoli;
    if (!caps) setCaps(src.map((c) => ({ ...c, voci: c.voci.map((v) => ({ ...v, quantita: Number(v.quantita), prezzoUnitario: Number(v.prezzoUnitario) })) })));
    if (title === null) setTitle(quote.titoloPreventivoRiga1 && quote.titoloPreventivoRiga1 !== "Project Quote & Itemized Estimate" ? quote.titoloPreventivoRiga1 : "");
    if (notes === null) setNotes(quote.note ?? "");
  }, [quote, editingVariant, caps, title, notes]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const rate = Number(editingVariant ? editingVariant.ivaPercentuale : quote?.ivaPercentuale ?? 0);
  const discount = (editingVariant ? editingVariant.sconto : quote?.sconto)?.percentuale ?? 0;
  const live = useMemo(() => (caps ? recompute(caps, rate, discount) : null), [caps, rate, discount]);

  if (status === "out") return <Redirect href="/" />;
  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("Quote", t("quote.actions.openQuote"), { id: id ?? "" })));
  const head = <Header title={editingVariant ? editingVariant.label : (quote?.numeroPreventivoData?.trim() ?? "")} subtle backLabel={t("qe.back")} onBack={back} moreLabel={t("qe.more")} onMore={quote ? () => setMoreOpen(true) : undefined} />;

  if (q.isError && !quote) {
    const nf = q.error instanceof ApiFailure && q.error.status === 404;
    return <Screen>{head}<Section pt={26} px={16}>{nf ? <Empty icon="file" iconTone="slate" title={t("qe.notFound.title")} body={t("qe.notFound.body")} action={t("qe.back")} actionKind="secondary" onAction={back} /> : <Empty icon="warn" iconTone="clay" title={t("qe.loadFailed.title")} body={t("qe.loadFailed.body")} action={t("qe.loadFailed.retry")} onAction={() => void q.refetch()} />}</Section></Screen>;
  }
  if (!quote || !caps || !live || title === null || notes === null) return <Screen>{head}<Section pt={8} px={16} gap={12}><Skeleton height={110} radius={22} /><Skeleton height={380} radius={22} /><Skeleton height={160} radius={22} /></Section></Screen>;

  const now = new Date();
  const state = quoteState({ status: quote.status, sentAt: quote.sentAt, acceptedAt: quote.acceptedAt, firstViewedAt: quote.firstViewedAt, declinedAt: quote.declinedAt, validDays: quote.validDays }, now);
  const locked = state === "accepted" || !!quote.pdfDownloadedAt;
  const m = (n: number) => money(n, locale);
  const cd = quote.clientData;
  const firstName = cd.nome.trim().split(/\s+/)[0] ?? cd.nome;
  const readOnly = locked; // a role that cannot edit gets a 403 from the server and the toast below
  const seen = !!quote.firstViewedAt && !locked;
  const flags = flagsOf(pc.data?.findings ?? []);
  const nFlags = Object.keys(flags).length;
  const fmt = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 3, useGrouping: false }).format(n);
  const schedule = !editingVariant ? quote.paymentSchedule ?? null : null;
  const total = live.totale;
  const sv = schedule ? scheduleView(schedule, total) : null;

  const failToast = (e: unknown) => toast({ message: e instanceof ApiFailure && e.offline ? t("qe.save.offline") : e instanceof ApiFailure && e.status === 403 ? t("quote.toast.noAccess") : t("qe.save.failed") });
  const flush = async () => {
    timer.current = null;
    const p = pending.current; pending.current = {};
    try {
      if (p.lines) {
        const r = recompute(p.lines, rate, discount);
        if (editingVariant) { const v = await quoteApi.updateVariant(quote.id, editingVariant.id, { capitoli: r.capitoli, subtotale: r.subtotale, ivaValore: r.ivaValore, totale: r.totale, sconto: r.sconto }); void client.setQueryData(["quote-variants", id], { variants: variants.map((x) => (x.id === v.id ? v : x)) }); }
        else { const u = await quoteApi.update(quote.id, { capitoli: r.capitoli, subtotale: r.subtotale, ivaValore: r.ivaValore, totale: r.totale, sconto: r.sconto, ...(quote.paymentSchedule ? { paymentSchedule: normalizeSchedule(quote.paymentSchedule) } : null) }); client.setQueryData(["quote", id], u); }
        void client.invalidateQueries({ queryKey: ["quote-price-check", id] });
      }
      if (p.title !== undefined || p.notes !== undefined) {
        const u = await quoteApi.update(quote.id, { ...(p.title !== undefined ? { titoloPreventivoRiga1: p.title.trim() || null } : null), ...(p.notes !== undefined ? { note: p.notes } : null) });
        client.setQueryData(["quote", id], u);
      }
      void client.invalidateQueries({ queryKey: getListQuotesQueryKey() });
    } catch (e) { failToast(e); }
  };
  const later = () => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => void flush(), SAVE_MS); };
  const changeLines = (next: Chapter[]) => { setCaps(next); pending.current.lines = next; later(); };
  const changeTitle = (v: string) => { setTitle(v); pending.current.title = v; later(); };
  const changeNotes = (v: string) => { setNotes(v); pending.current.notes = v; later(); };
  const saveQuote = (data: Parameters<typeof quoteApi.update>[1]) => quoteApi.update(quote.id, data).then((u) => { client.setQueryData(["quote", id], u); return u; }).catch((e) => { failToast(e); throw e; });

  const exclusions = quote.exclusions ?? [];
  const addExclusion = () => { const v = exDraft.trim(); if (!v) return; setExDraft(""); void saveQuote({ exclusions: [...exclusions, v] }); };
  const removeExclusion = (i: number) => void saveQuote({ exclusions: exclusions.filter((_, j) => j !== i) });

  const optsOn = variants.length > 0;
  const refreshVariants = () => client.invalidateQueries({ queryKey: ["quote-variants", id] });
  const turnOptions = async (on: boolean) => {
    try {
      if (on) { const labels = [t("qe.options.good"), t("qe.options.better"), t("qe.options.best")]; for (let i = 0; i < 3; i++) await quoteApi.addVariant(quote.id, { label: labels[i] }); }
      else for (const v of variants) await quoteApi.removeVariant(quote.id, v.id);
      await refreshVariants();
    } catch (e) { failToast(e); }
  };
  const recommend = (v: Variant) => void quoteApi.updateVariant(quote.id, v.id, { recommended: !v.recommended }).then(() => refreshVariants()).catch(failToast);

  const sendReady = canSend(schedule, total);
  const sendNow = () => router.push(screenHref("Quote", t("quote.actions.openQuote"), { id: quote.id }));
  const addFromBook = (b: { nome: string; um: string; prezzoUnitario: number }) => { changeLines(addLine(caps, newLine({ descrizione: b.nome, um: b.um, quantita: 1, prezzoUnitario: Number(b.prezzoUnitario) }), t("qe.lineItems"))); setBookOpen(false); };
  const bookItems = (book.data ?? []).filter((b) => !bookTerm.trim() || `${b.nome} ${b.categoria ?? ""}`.toLowerCase().includes(bookTerm.trim().toLowerCase())).slice(0, 8);

  return (
    <Screen floating={!locked ? <ActionBar label={!sendReady ? t("qe.fixSchedule") : t("qe.send", { total: m(total) })} disabled={!sendReady} onPress={sendNow} moreLabel={t("qe.more")} secondary={t("qe.preview")} onSecondary={() => void Linking.openURL(`${API_ORIGIN}/p/${quote.id}?preview=1`)} /> : undefined}>
      {head}
      <ScrollPage bottom={ACTION_BAR_SPACE}>
        <Section>
          <QuoteHead status={<Status plain tone={state === "viewed" ? "acc" : state === "draft" ? "mute" : state === "accepted" ? "ok" : "info"} shape={state === "viewed" ? "q2" : state === "draft" ? "draft" : state === "accepted" ? "check" : "q1"}>{t(`quote.status.${state}`)}</Status>}
            valid={quote.firstViewedAt && state === "viewed" ? t("qe.viewedAgo", { when: relativeWhen(new Date(quote.firstViewedAt), now, locale), date: shortDate(validUntilOf(quote.sentAt ?? now.toISOString(), quote.validDays), locale) }) : t("qe.statusLine", { date: shortDate(validUntilOf(quote.sentAt ?? now.toISOString(), quote.validDays), locale) })}
            title="" titleNode={!editingVariant ? <EditableTitle value={title} onChange={changeTitle} label={t("qe.titleLabel")} readOnly={readOnly} placeholder={t("qe.untitled")} /> : undefined} avatar={<Avatar initials={initialsOf(cd.nome)} tint={tintFor(cd.nome)} size={32} />} client={cd.nome} address={[cd.indirizzo, cd.city].filter(Boolean).join(", ") || undefined}
            changeLabel={!readOnly && !editingVariant ? t("qe.change") : undefined} onChange={() => router.push(screenHref("Quote", t("quote.actions.openQuote"), { id: quote.id }))} />
        </Section>
        {readOnly ? <Section delay={20} pt={14} px={16}><Banner tone="info" icon="lock" iconTone="slate" lead={t("qe.banner.locked")}>{t("qe.banner.lockedBody")}</Banner></Section> : (seen || quote.revisionOpen) ? <Section delay={40} pt={14} px={16}>{quote.revisionOpen ? <Banner tone="acc" icon="sync" iconTone="violet" lead={t("qe.banner.version", { n: quote.version ?? 2 })}>{t("qe.banner.versionBody", { name: firstName })}</Banner> : <Banner tone="acc" icon="sync" iconTone="violet" lead={t("qe.banner.seen", { name: firstName })}>{t("qe.banner.seenBody", { next: (quote.version ?? 1) + 1 })}</Banner>}</Section> : null}
        <Section delay={60} pt={12} px={16}>
          <NavCard title={t("qe.priceCheck.title")} sub={pc.data ? (nFlags ? t("qe.priceCheck.against") : pc.data.references ? t("qe.priceCheck.inRange") : t("qe.priceCheck.none")) : t("qe.priceCheck.against")}
            status={pc.data ? (nFlags ? <Status tone="warn" shape="alert">{t("qe.priceCheck.toCheck", { count: nFlags })}</Status> : <Status tone="ok" shape="check">{t("qe.priceCheck.ok")}</Status>) : <Text size={12.5} color="muted">…</Text>}
            onPress={() => router.push(screenHref("PriceCheck", t("qe.priceCheck.title"), { id: quote.id }))} />
        </Section>
        <Section delay={80} pt={22} px={16}>
          <SectionHeader title={t("qe.lineItems")} link={t("qe.items", { count: lineCount(caps) })} />
          <LineEditCard footer={!readOnly ? (
            <Stack row gap={8} px={16} pt={12} pb={14}>
              <Stack grow><Button kind="secondary" size="sm" label={t("qe.priceBook")} onPress={() => { setBookTerm(""); setBookOpen(true); }} block /></Stack>
              <Button kind="secondary" size="sm" label={t("qe.blank")} onPress={() => changeLines(addLine(caps, newLine({ descrizione: t("qe.newLine"), um: "ea" }), t("qe.lineItems")))} />
            </Stack>
          ) : undefined}>
            <Divided>
              {caps.map((c, ci) => (
                <Stack key={`${c.lettera}-${ci}`} pt={0}>
                  <ChapterBand name={c.titolo || t("qe.lineItems")} sub={m(live.capitoli[ci]?.subtotale ?? 0)} />
                  <Divided>
                    {c.voci.map((v, vi) => {
                      const f = flags[flagKey(c, vi)];
                      return (
                        <LineEdit key={vi} name={v.descrizione} nameLabel={t("qe.name")} onName={(x) => changeLines(editLine(caps, ci, vi, "descrizione", x))} amount={m(live.capitoli[ci]?.voci[vi]?.totale ?? 0)}
                          qty={v.quantita} onQty={(x) => changeLines(editLine(caps, ci, vi, "quantita", parseAmount(x)))} unit={v.um} onUnit={(x) => changeLines(editLine(caps, ci, vi, "um", x))} rate={v.prezzoUnitario} onRate={(x) => changeLines(editLine(caps, ci, vi, "prezzoUnitario", parseAmount(x)))}
                          flag={f ? <Status plain tone={f === "low" ? "warn" : "info"} shape="alert">{t(`qe.flag.${f}`)}</Status> : undefined} flagLabel={f ? t(`qe.flag.${f}`) : undefined} onFlag={() => router.push(screenHref("PriceCheck", t("qe.priceCheck.title"), { id: quote.id }))}
                          onUp={() => changeLines(moveLineUp(caps, ci, vi))} upLabel={t("qe.moveUp", { name: v.descrizione.split("\n")[0] ?? "" })} qtyLabel={t("qe.quantity")} rateLabel={t("qe.rate")} readOnly={readOnly} format={fmt} />
                      );
                    })}
                  </Divided>
                </Stack>
              ))}
            </Divided>
          </LineEditCard>
        </Section>
        <Section delay={100} pt={12} px={16}>
          <TotalsCard rows={[{ label: t("qe.subtotal"), value: m(live.subtotale) }, ...(live.sconto ? [{ label: t("qe.discount", { pct: live.sconto.percentuale }), value: `−${m(live.subtotale - live.imponibile)}` }] : []), { label: `${quote.taxLines?.map((l) => l.label ?? l.code).join(" + ") || t("qe.tax")} ${Math.round(rate * 1000) / 1000}%`, value: m(live.ivaValore) }]} totalLabel={t("qe.total")}
            whole={m(total).replace(/[.,]\d\d(?: \$)?$/, "")} cents={(m(total).match(/[.,]\d\d(?: \$)?$/) ?? [""])[0]} />
        </Section>
        {!editingVariant ? (
          <>
            <Section delay={120} pt={22} px={16}>
              <SectionHeader title={t("qe.notes", { name: firstName })} />
              <TextField label={t("qe.notesLabel")} value={notes} onChangeText={changeNotes} multiline disabled={readOnly} />
            </Section>
            <Section delay={140} pt={22} px={16}>
              <SectionHeader title={t("qe.notIncluded")} link={String(exclusions.length)} />
              <Card>
                <Divided>
                  {[
                    ...exclusions.map((x, i) => <ExclusionRow key={`${i}-${x}`} text={x} removeLabel={t("qe.remove", { text: x })} onRemove={!readOnly ? () => removeExclusion(i) : undefined} />),
                    ...(!readOnly ? [
                      <Stack key="add" row align="center" gap={8} px={16} pt={10} pb={12}>
                        <Stack grow><TextField label={t("qe.addExclusionLabel")} value={exDraft} onChangeText={setExDraft} placeholder={t("qe.addExclusion")} onSubmitEditing={addExclusion} returnKeyType="done" /></Stack>
                        <Button kind="secondary" size="sm" label={t("qe.add")} disabled={!exDraft.trim()} onPress={addExclusion} />
                      </Stack>,
                    ] : []),
                  ]}
                </Divided>
              </Card>
            </Section>
            <Section delay={160} pt={22} px={16}>
              <SectionTitleRow title={t("qe.options.title")} right={<Switch value={optsOn} onChange={(v) => { if (v) void turnOptions(true); else setOffAsk(true); }} label={t("qe.options.offer")} disabled={readOnly} />} />
              {optsOn ? (
                <Stack gap={10} pt={10}>
                  {variants.map((v, i) => (
                    <TierCard key={v.id} name={v.label || [t("qe.options.good"), t("qe.options.better"), t("qe.options.best")][i] || ""} sub={v.description} price={m(v.totale)} priceSub={t("qe.total")} chosen={v.recommended} icon={<Icon name={(["tier1", "tier2", "tier3"] as const)[Math.min(i, 2)]!} tone={(["slate", "violet", "gold"] as const)[Math.min(i, 2)]!} size={30} />}
                      includes={(v.capitoli ?? []).map((c) => c.titolo).filter(Boolean).slice(0, 3)}>
                      <Button size="sm" kind={v.recommended ? "primary" : "secondary"} label={v.recommended ? t("qe.options.recommended") : t("qe.options.recommend")} onPress={() => recommend(v)} disabled={readOnly} />
                      <Button size="sm" kind="secondary" label={t("qe.options.edit")} onPress={() => { setTierSheet(v); setTierName(v.label); setTierSub(v.description); }} />
                    </TierCard>
                  ))}
                  <Hint>{t("qe.options.pick", { name: firstName })}</Hint>
                </Stack>
              ) : (
                <Stack pt={0}><NoteCard>{t("qe.options.one")}</NoteCard></Stack>
              )}
            </Section>
            {schedule && sv ? (
              <Section delay={180} pt={22} px={16}>
                <SectionTitleRow title={t("qe.schedule.title")} right={sv.over ? <Status tone="bad" shape="alert">{t("qe.schedule.over")}</Status> : <Status tone="ok" shape="check">{t("qe.schedule.ok")}</Status>} />
                <Card>
                  <Stack px={16} pt={16} pb={12}>
                    <ScheduleBar segments={segments(sv).map((s, i) => ({ ...s, color: SEGMENT_COLOURS[i % 4]! }))} />
                    <Stack row justify="space-between" pt={10}><Text size={12.5} color="muted">{t("qe.schedule.addsUp")}</Text><Num size={12.5} weight={600}>{m((sv.rows.reduce((n, r) => n + Math.max(0, r.cents), 0) + sv.holdbackCents) / 100)}</Num></Stack>
                  </Stack>
                  <Divided>
                    {[
                      ...sv.rows.map((r, i) => (
                        <TermRow key={r.id} color={SEGMENT_COLOURS[i % 4]!} label={r.label} when={r.rest ? t("qe.schedule.rest") : t(`qe.schedule.when.${r.trigger}`, { n: "" })}
                          right={r.editable && !readOnly ? <Stepper value={`${r.pct}%`} decLabel={t("qe.schedule.lower", { what: r.label })} incLabel={t("qe.schedule.raise", { what: r.label })} onDec={() => void saveQuote({ paymentSchedule: stepTerm(schedule, r.id, -1) })} onInc={() => void saveQuote({ paymentSchedule: stepTerm(schedule, r.id, 1) })} canDec={r.pct > 0} />
                            : <Num size={13.5} weight={600} color={r.rest && sv.over ? "bad" : "ink"} align="center" style={{ minWidth: 44 }}>{`${r.rest && sv.over ? "−" : ""}${Math.abs(r.pct)}%`}</Num>}
                          amount={m(r.cents / 100)} amountColor={r.rest && sv.over ? "bad" : "ink"} />
                      )),
                      <Stack key="hold" row align="center" gap={12} px={16} pt={12} pb={12}>
                        <Stack grow gap={2}><Text weight={500}>{t("qe.schedule.holdback", { pct: sv.holdbackPct })}</Text><Text size={12.5} color="muted">{t("qe.schedule.holdbackSub")}</Text></Stack>
                        <Switch value={sv.holdbackOn} onChange={() => void saveQuote({ paymentSchedule: toggleHoldback(schedule) })} label={t("qe.schedule.holdbackLabel", { pct: sv.holdbackPct })} disabled={readOnly} />
                      </Stack>,
                      ...(sv.over ? [<Stack key="err" px={16} pt={0} pb={14}><Banner tone="bad" icon="warn" iconTone="clay" lead={t("qe.schedule.overBy", { pct: Math.abs(sv.restPct) })}>{t("qe.schedule.overBody")}</Banner></Stack>] : []),
                    ]}
                  </Divided>
                </Card>
              </Section>
            ) : null}
            <Section delay={200} pt={22} px={16}>
              <Card>
                <MenuList>
                  <MenuRow icon={<Icon name="doc" tone="violet" size={28} />} title={t("qe.extras.contract")} sub={t("qe.extras.contractSub")} onPress={() => router.push(screenHref("Contract", t("qe.extras.contract"), { quoteId: quote.id }))} />
                  <MenuRow icon={<Icon name="file" tone="stone" size={28} />} title={t("qe.extras.pdf")} sub={quote.pdfDownloadedAt ? t("qe.extras.pdfLocked") : quote.templateId && quote.templateId !== "standard" ? t("qe.extras.pdfPro") : t("qe.extras.pdfSub")} chevron={false}
                    onPress={!quote.pdfDownloadedAt ? () => void saveQuote({ templateId: quote.templateId && quote.templateId !== "standard" ? "standard" : "arosio" }) : undefined} />
                  <MenuRow icon={<Icon name="orb" tone="violet" size={28} />} title={t("qe.extras.redo")} sub={t("qe.extras.redoSub")} chevron={false} onPress={!quote.pdfDownloadedAt ? () => { setRedoText(""); setRedoOpen(true); } : undefined} />
                </MenuList>
              </Card>
            </Section>
          </>
        ) : null}
      </ScrollPage>

      <Sheet open={bookOpen} onClose={() => setBookOpen(false)} label={t("qe.priceBook")} closeLabel={t("close")}>
        <SheetTitle>{t("qe.priceBook")}</SheetTitle>
        <Stack px={16} gap={8} pt={0}>
          <Search label={t("qe.book.search")} placeholder={t("qe.book.search")} value={bookTerm} onChangeText={setBookTerm} autoCorrect={false} />
          {bookItems.length === 0 ? <Text size={13.5} color="muted" align="center">{(book.data ?? []).length ? t("qe.book.none") : t("qe.book.empty")}</Text> : (
            <Card><RowList>{bookItems.map((b) => (
              <Press key={b.id} onPress={() => addFromBook(b)} accessibilityRole="button" accessibilityLabel={t("qe.book.add", { name: b.nome })}>
                <RowBody title={b.nome} meta={b.categoria ?? undefined} trailing={<><Num size={13.5} weight={600}>{m(Number(b.prezzoUnitario))}</Num><Text size={11.5} color="muted">{t("qe.book.perUnit", { unit: b.um })}</Text></>} />
              </Press>
            ))}</RowList></Card>
          )}
          <Press onPress={() => { setBookOpen(false); router.push(screenHref("PriceBook", t("qe.book.open"))); }} accessibilityRole="link" style={{ minHeight: 44, justifyContent: "center" }}><Text size={13.5} color="acc-t">{t("qe.book.open")}</Text></Press>
        </Stack>
        <Stack pt={12} />
      </Sheet>

      <Sheet open={redoOpen} onClose={() => setRedoOpen(false)} label={t("qe.extras.redoTitle")} closeLabel={t("close")}>
        <SheetTitle>{t("qe.extras.redoTitle")}</SheetTitle>
        <Stack px={16} gap={12} pt={0}>
          <TextField label={t("qe.extras.redoLabel")} value={redoText} onChangeText={setRedoText} multiline />
          <Button label={t("qe.extras.redoGo")} busy={redoBusy ? t("qe.extras.redoBusy") : false} disabled={!redoText.trim()} block onPress={async () => {
            setRedoBusy(true);
            try { const u = await quoteApi.regenerate(quote.id, `${quote.rawInput ?? ""}\n${redoText}`.trim()); client.setQueryData(["quote", id], u); setCaps(null); setRedoOpen(false); void client.invalidateQueries({ queryKey: getListQuotesQueryKey() }); }
            catch { toast({ message: t("qe.extras.redoFailed") }); } finally { setRedoBusy(false); }
          }} />
        </Stack>
        <Stack pt={16} />
      </Sheet>

      <Sheet open={!!tierSheet} onClose={() => setTierSheet(null)} label={t("qe.options.edit")} closeLabel={t("close")}>
        <SheetTitle>{t("qe.options.edit")}</SheetTitle>
        <Stack px={16} gap={12} pt={0}>
          <TextField label={t("qe.options.name")} value={tierName} onChangeText={setTierName} />
          <TextField label={t("qe.options.sub")} value={tierSub} onChangeText={setTierSub} />
          <Button label={t("qe.options.save")} block disabled={!tierSheet} onPress={() => { if (!tierSheet) return; void quoteApi.updateVariant(quote.id, tierSheet.id, { label: tierName.trim(), description: tierSub.trim() }).then(() => { setTierSheet(null); void refreshVariants(); }).catch(failToast); }} />
          <Button kind="secondary" label={t("qe.options.editLines")} block onPress={() => { const v = tierSheet; setTierSheet(null); if (v) router.push(screenHref("QuoteEditor", t("quote.actions.editor"), { id: quote.id, variant: v.id })); }} />
        </Stack>
        <Stack pt={16} />
      </Sheet>

      <Sheet open={offAsk} onClose={() => setOffAsk(false)} label={t("qe.options.turnOffTitle")} closeLabel={t("close")}>
        <SheetTitle>{t("qe.options.turnOffTitle")}</SheetTitle>
        <Stack px={16} gap={12} pt={0}>
          <Text size={14.5} color="muted" leading={1.4}>{t("qe.options.turnOffBody")}</Text>
          <Button kind="destructive" label={t("qe.options.turnOff")} block onPress={() => { setOffAsk(false); void turnOptions(false); }} />
          <Button kind="secondary" label={t("qe.options.keep")} block onPress={() => setOffAsk(false)} />
        </Stack>
        <Stack pt={16} />
      </Sheet>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} label={t("qe.more")} closeLabel={t("close")}>
        <MenuList>
          <MenuRow icon={<Icon name="doc" tone="indigo" size={28} />} title={t("quote.actions.openQuote")} onPress={() => { setMoreOpen(false); router.push(screenHref("Quote", t("quote.actions.openQuote"), { id: quote.id })); }} />
          <MenuRow icon={<Icon name="ruler" tone="amber" size={28} />} title={t("quote.actions.priceCheck")} onPress={() => { setMoreOpen(false); router.push(screenHref("PriceCheck", t("quote.actions.priceCheck"), { id: quote.id })); }} />
        </MenuList>
        <Stack pt={12} />
      </Sheet>
    </Screen>
  );
}

export type { QuoteFull };
