// NewQuote.dc.html: three ways to build a quote. Write with AI (describe the job; photos, a spoken description, an
// example, a PDF layout, a target total, who it is for), Manual (title, client, chapters with lines, taxes, payment
// terms, notes) and Price list (pick items from your own list, set quantities). States: the form, writing (five steps
// over the real request) and ready, can't write (offline, limit, not enough, plan, role, failed), the client list loading
// / can't load / empty, and the price list loading / can't load / empty / no match / nothing picked.
import { useEffect, useMemo, useRef, useState } from "react";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getListQuotesQueryKey, useListClients, type Client } from "@workspace/api-client-react";
import { clientsApi } from "@/lib/clientsApi";
import { tintFor } from "@/lib/clients";
import { firstQuoteApi, type AttachFile } from "@/lib/firstQuoteApi";
import { money, number, type Locale } from "@/lib/format";
import {
  addManualLine, canAddNewClient, canSaveManual, canWrite, categoriesOf, clientDataFor, DONE, EMPTY_CLIENT, EXAMPLES, editManualLine, filterCatalog, isChosen, LAYOUTS, manualBody, manualTotals,
  newManualChapter, newClientBody, nextProgress, parseTarget, PROVINCES, PROVINCE_RATE, renameManualChapter, selectionChapter, selectionOf, startProvince, stepChosen, stepStates, summaryOf, taxKey,
  taxRate, templateIdOf, TERMS, toggleChosen, type CatalogRow, type Chosen, type ManualChapter, type NewClientForm, type PickedClient, type ProvinceCode, type Summary,
} from "@/lib/newQuote";
import { newQuoteApi, type CreateProblem } from "@/lib/newQuoteApi";
import { pickPhotos, useDictation } from "@/lib/newQuoteInput";
import { screenHref } from "@/lib/nav";
import { quoteApi } from "@/lib/quoteApi";
import { initialsFor } from "@/lib/quoteBar";
import { useSession } from "@/lib/useSession";
import { Banner, Empty, Skeleton } from "@/ui/Feedback";
import { Button } from "@/ui/Button";
import { Card, Hairline } from "@/ui/Card";
import { Chip, ChipStrip, ChipWrap } from "@/ui/Chip";
import { TextField } from "@/ui/Field";
import { Glyph } from "@/ui/Icon";
import { Header } from "@/ui/Header";
import { ScrollPage, Section, Stack } from "@/ui/Layout";
import { ListRow, SectionHeader } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Search } from "@/ui/Search";
import { Segmented } from "@/ui/Segmented";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { Stepper } from "@/ui/Stepper";
import { Text } from "@/ui/Text";
import {
  AttachChip, AttachNote, BeforeTax, CatalogRowView, ChapterFooter, ChapterHeading, ClientLine, ClientNote, ClientRow, DashedAdd, DescribeCard, ManualLine, NewClientFields, NoteEmpty, NotesField, PillAction, ReadySummary,
  RoundMic, SelectionRow, SheetList, TargetBox, TaxesCard, WritingCard,
} from "@/ui/NewQuote";
import type { Tone, IconName } from "@/ui/Icon";

const STEP_MS = 1400;
const RECENT = 4;
const CATEGORY_ICON: [IconName, Tone][] = [["pen", "violet"], ["box", "stone"], ["ruler", "amber"], ["truck", "teal"], ["hammer", "clay"], ["brush", "rose"]];

type Phase = "form" | "writing" | "done";
type ClientOpt = PickedClient & { sub: string };

export default function NewQuote() {
  const { t, i18n } = useTranslation();
  const fr = i18n.language.startsWith("fr");
  const locale: Locale = fr ? "fr-CA" : "en-CA";
  const params = useLocalSearchParams<{ client?: string; name?: string }>();
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const qc = useQueryClient();

  const [mode, setMode] = useState(0);
  const [problem, setProblem] = useState<CreateProblem | null>(null);
  // Write with AI
  const [text, setText] = useState("");
  const [example, setExample] = useState<string | null>(null);
  const [layout, setLayout] = useState(0);
  const [target, setTarget] = useState("");
  const [photos, setPhotos] = useState<AttachFile[]>([]);
  const [photoNote, setPhotoNote] = useState<"denied" | "failed" | null>(null);
  const [micNote, setMicNote] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("form");
  const [w, setW] = useState(0);
  const [built, setBuilt] = useState<(Summary & { id: string }) | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const dict = useDictation();
  // Who it is for
  const [pick, setPick] = useState<PickedClient | null>(null);
  const [newOn, setNewOn] = useState(!!params.name);
  const [form, setForm] = useState<NewClientForm>({ ...EMPTY_CLIENT, name: params.name ?? "" });
  const [remember, setRemember] = useState(true);
  const [clientSheet, setClientSheet] = useState(false);
  const [clientTerm, setClientTerm] = useState("");
  const [provSheet, setProvSheet] = useState<"tax" | "client" | null>(null);
  // Manual
  const ids = useRef(0);
  const uid = () => `n${++ids.current}`;
  const [title, setTitle] = useState("");
  const [chapters, setChapters] = useState<ManualChapter[]>(() => [newManualChapter("c0", "l0")]);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [provinceSet, setProvinceSet] = useState<ProvinceCode | null>(null);
  const [exempt, setExempt] = useState(false);
  const [termIx, setTermIx] = useState(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  // Price list
  const [pq, setPq] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Chosen[]>([]);

  const profile = useQuery({ queryKey: ["home-profile"], queryFn: async () => { const r = await firstQuoteApi.profile(); return r.ok ? r.data : null; }, enabled: signedIn, retry: false, staleTime: 10 * 60_000 });
  const clients = useListClients({ query: { queryKey: ["/api/clients"], enabled: signedIn, retry: false } } as never);
  const book = useQuery({ queryKey: ["catalog"], queryFn: quoteApi.catalog, enabled: signedIn && mode === 2, retry: false, staleTime: 5 * 60_000 });

  const opts: ClientOpt[] = useMemo(() => {
    const list = ((clients.data ?? []) as Client[]).slice().sort((a, b) => +new Date(b.lastQuoteDate) - +new Date(a.lastQuoteDate));
    return list.map((c) => ({
      id: c.id, name: c.clientName, sub: [c.indirizzo, c.city].filter(Boolean).join(", "),
      data: Object.fromEntries(Object.entries({ nome: c.clientName, indirizzo: c.indirizzo ?? "", email: c.email ?? "", phone: c.phone ?? "", city: c.city ?? "", province: c.province ?? "", postalCode: c.postalCode ?? "" }).filter(([, v]) => v)) as Record<string, string>,
    }));
  }, [clients.data]);

  // A client's own screen opens this with ?client=: start on that person once the list is in.
  useEffect(() => {
    if (!params.client || pick) return;
    const c = opts.find((o) => o.id === params.client);
    if (c) { setPick(c); setNewOn(false); }
  }, [params.client, opts, pick]);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  if (status === "out") return <Redirect href="/" />;

  const m = (n: number) => money(n, locale);
  const qty = (n: number) => number(n, locale, Number.isInteger(n) ? 0 : 2);
  const fmtQty = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 3, useGrouping: false }).format(n);
  const fmtPrice = (n: number) => new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 3, useGrouping: false }).format(n);
  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("Quotes", t("quotes.title"))));
  const soon = (title: string) => router.push(screenHref("AttachAndImprove", title));
  const openQuote = (id: string) => router.replace(screenHref("Quote", t("quotes.actions.openQuote"), { id }));
  const provName = (c: ProvinceCode) => t(`onboarding.provinces.${c}.name`);
  const rateText = (r: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(r);
  const taxWords = (c: ProvinceCode) => t(`nq.tax.${taxKey(c)}`);

  const profileProvince = profile.data?.province;
  const province: ProvinceCode = provinceSet ?? startProvince(pick?.data.province ?? (newOn ? form.province : null), profileProvince);
  const clientData = clientDataFor(pick, newOn ? form : null);
  const clientName = newOn ? form.name.trim() : pick?.name ?? "";

  const switchMode = (i: number) => { setMode(i); setProblem(null); };

  // ── Write with AI ──────────────────────────────────────────────────────────

  const write = async () => {
    if (!canWrite(text) || phase === "writing") return;
    setProblem(null);
    setPhase("writing");
    setW(1);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => setW((v) => nextProgress(v, false)), STEP_MS);
    if (newOn && remember && canAddNewClient(form)) {
      try { await clientsApi.add(newClientBody(form)); void qc.invalidateQueries({ queryKey: ["/api/clients"] }); } catch { /* the quote still carries the client's details */ }
    }
    const r = await firstQuoteApi.create(text.trim(), profile.data ?? null, { clientData, budget: parseTarget(target), templateId: templateIdOf(LAYOUTS[layout]!), files: photos });
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    if (!r.ok) { setPhase("form"); setW(0); setProblem(r.problem); return; }
    void qc.invalidateQueries({ queryKey: getListQuotesQueryKey() });
    setBuilt({ id: r.data.id, ...summaryOf(r.data) });
    setW(DONE);
    setPhase("done");
  };

  const restart = () => { setPhase("form"); setW(0); setBuilt(null); setProblem(null); };

  const mic = async () => {
    setMicNote(null);
    const r = await dict.toggle();
    if (!r) return;
    if (!r.ok) { setMicNote(r.problem); return; }
    if (!r.text) { setMicNote("empty"); return; }
    setText((cur) => (cur.trim() ? `${cur.trim()} ${r.text}` : r.text));
    setExample(null);
  };

  const attachPhotos = async () => {
    setPhotoNote(null);
    const r = await pickPhotos(3);
    if (!r.ok) { setPhotoNote(r.problem === "denied" ? "denied" : "failed"); return; }
    if (r.files.length) setPhotos(r.files);
  };

  const pickClient = (c: ClientOpt | null) => { setPick(c); setNewOn(false); };
  // The four most recent; someone picked from the full list (the sheet) takes the first place.
  const recent = (() => {
    const top = opts.slice(0, RECENT);
    const extra = pick ? opts.find((o) => o.id === pick.id) : undefined;
    return extra && !top.some((o) => o.id === extra.id) ? [extra, ...top.slice(0, RECENT - 1)] : top;
  })();
  const layoutName = t(`nq.ai.layouts.${LAYOUTS[layout]}`);
  const taxStep = provinceSet || profileProvince || pick?.data.province || (newOn && form.province) ? t("nq.writing.steps.tax", { tax: taxWords(province), province: provName(province), rate: rateText(PROVINCE_RATE[province]) }) : t("nq.writing.steps.taxGeneric");
  const stepLabels = [t("nq.writing.steps.reading"), t("nq.writing.steps.measuring"), t("nq.writing.steps.pricing"), taxStep, t("nq.writing.steps.layout")];
  const states = stepStates(w);

  // ── Manual and Price list ──────────────────────────────────────────────────

  const create = async (body: ReturnType<typeof manualBody>) => {
    setSaving(true);
    setProblem(null);
    const r = await newQuoteApi.createManual(body);
    setSaving(false);
    if (!r.ok) { setProblem(r.problem); return; }
    void qc.invalidateQueries({ queryKey: getListQuotesQueryKey() });
    if (newOn && remember && canAddNewClient(form)) { try { await clientsApi.add(newClientBody(form)); void qc.invalidateQueries({ queryKey: ["/api/clients"] }); } catch { /* the quote still carries the details */ } }
    openQuote(r.data.id);
  };

  const rate = taxRate(province, exempt);
  const totals = manualTotals(chapters, rate);
  const saveManual = () => void create(manualBody({ title, chapters, clientData, province, exempt, terms: TERMS[termIx]!, notes }));

  const rows: CatalogRow[] = book.data ?? [];
  const cats = categoriesOf(rows);
  const shown = filterCatalog(rows, pq, cat);
  const selection = selectionOf(chosen, rows);
  const buildPb = () => {
    if (!selection.rows.length) return;
    void create(manualBody({ title: "", chapters: [selectionChapter(selection.rows, t("nq.pb.chapter"), uid())], clientData, province, exempt: false, terms: "deposit30", notes: "" }));
  };
  const retry = mode === 0 ? () => void write() : mode === 1 ? saveManual : buildPb;

  const banner = problem ? (
    <Banner tone={problem === "failed" ? "bad" : problem === "role" ? "info" : "warn"} icon={problem === "offline" ? "cloud" : problem === "role" ? "lock" : "warn"} iconTone={problem === "failed" ? "clay" : problem === "role" ? "slate" : "amber"}
      lead={t(`nq.problem.${problem}.lead`)} link={problem === "offline" || problem === "failed" ? t("nq.problem.retry") : undefined} onLink={retry}>{t(`nq.problem.${problem}.text`)}</Banner>
  ) : null;

  const term = clientTerm.trim().toLowerCase();
  const sheetClients = opts.filter((o) => !term || `${o.name} ${o.sub}`.toLowerCase().includes(term));
  const initials = (n: string) => initialsFor(n);

  return (
    <Screen>
      <Header title={t("nq.title")} backLabel={t("nq.back")} onBack={back} />
      <ScrollPage bottom={40}>
        <Section pt={10} px={16}>
          <Segmented options={[t("nq.modes.ai"), t("nq.modes.manual"), t("nq.modes.priceList")]} value={mode} onChange={switchMode} label={t("nq.modeLabel")} />
        </Section>
        {banner ? <Section pt={14} px={16}>{banner}</Section> : null}

        {mode === 0 && phase === "form" ? (
          <>
            <Section delay={40} pt={16} px={16}>
              <DescribeCard value={text} onChange={(v) => { setText(v); setExample(null); }} label={t("nq.ai.describeLabel")} placeholder={t("nq.ai.placeholder")}>
                <AttachChip icon="photo" tone="sky" text={photos.length ? t("nq.ai.photosCount", { count: photos.length }) : t("nq.ai.photos")} label={t("nq.ai.photosLabel")} on={photos.length > 0} onPress={() => void attachPhotos()} />
                <AttachChip icon="file" tone="clay" text={t("nq.ai.pdf")} label={t("nq.ai.pdfLabel")} onPress={() => soon(t("nq.ai.pdfSoon"))} />
                <AttachChip icon="bars" tone="sage" text={t("nq.ai.sheet")} label={t("nq.ai.sheetLabel")} onPress={() => soon(t("nq.ai.sheetSoon"))} />
                <Stack grow />
                <RoundMic phase={dict.state} label={dict.state === "listening" ? t("nq.ai.micStop") : dict.state === "busy" ? t("nq.ai.micBusy") : t("nq.ai.mic")} onPress={() => void mic()} />
              </DescribeCard>
              {micNote ? <AttachNote text={t(`nq.ai.micNote.${micNote}`)} /> : null}
              {photoNote ? <AttachNote text={t(photoNote === "denied" ? "nq.ai.photosDenied" : "nq.ai.photosFailed")} /> : photos.length ? <AttachNote text={t("nq.ai.photosAttached", { count: photos.length })} action={t("nq.ai.photosRemove")} onAction={() => setPhotos([])} /> : null}
            </Section>
            <Section delay={80} pt={20}>
              <Stack px={20}><SectionHeader title={t("nq.ai.examples")} /></Stack>
              <ChipStrip label={t("nq.ai.examplesLabel")}>
                {EXAMPLES.map((id) => <Chip key={id} label={t(`nq.ai.example.${id}.name`)} selected={example === id} onPress={() => { setExample(id); setText(t(`nq.ai.example.${id}.text`)); }} />)}
              </ChipStrip>
            </Section>
            <Section delay={120} pt={22} px={16}>
              <SectionHeader title={t("nq.ai.options")} />
              <Card padded>
                <Stack gap={8}>
                  <Text size={13.5} color="muted">{t("nq.ai.layout")}</Text>
                  <Segmented options={LAYOUTS.map((l) => t(`nq.ai.layouts.${l}`))} value={layout} onChange={setLayout} label={t("nq.ai.layout")} />
                </Stack>
                <Stack pt={14}><Hairline inset={0} /></Stack>
                <Stack row align="center" justify="space-between" gap={12} pt={14}>
                  <Stack gap={2} grow>
                    <Text size={14.5} weight={500}>{t("nq.ai.target")}</Text>
                    <Text size={12.5} color="muted">{t("nq.ai.targetHelp")}</Text>
                  </Stack>
                  <TargetBox value={target} onChange={setTarget} label={t("nq.ai.target")} placeholder={t("nq.ai.targetPlaceholder")} suffix={fr} />
                </Stack>
              </Card>
            </Section>
            <Section delay={160} pt={22} px={16}>
              <SectionHeader title={t("nq.ai.client")} link={t("nq.ai.recent")} onLink={opts.length > RECENT ? () => { setClientTerm(""); setClientSheet(true); } : undefined} />
              <Card accessibilityRole="radiogroup" accessibilityLabel={t("nq.ai.client")}>
                {clients.isPending && !clients.data ? <Stack px={16} pt={14} pb={14} gap={12}><Skeleton height={34} radius={17} /><Skeleton height={34} radius={17} /></Stack>
                  : clients.isError ? <ClientNote text={t("nq.ai.clientsFailed")} action={t("nq.ai.clientsRetry")} onAction={() => void clients.refetch()} />
                  : opts.length === 0 ? <ClientNote text={t("nq.ai.clientsNone")} />
                  : recent.map((c, i) => <ClientRow key={c.id} first={i === 0} name={c.name} sub={c.sub} initials={initials(c.name)} tint={tintFor(c.name)} selected={pick?.id === c.id && !newOn} onPress={() => pickClient(c)} />)}
                <ClientRow first={false} plus name={t("nq.ai.newClient")} sub={t("nq.ai.newClientSub")} selected={newOn} onPress={() => { setNewOn(true); setPick(null); }} />
                {newOn ? (
                  <NewClientFields form={form} onChange={(k, v) => setForm((f) => ({ ...f, [k]: v }))} provinceName={form.province ? provName(form.province) : t("nq.ai.form.chooseProvince")} onProvince={() => setProvSheet("client")} remember={remember} onRemember={setRemember} />
                ) : null}
              </Card>
            </Section>
          </>
        ) : null}

        {mode === 0 && phase !== "form" ? (
          <Section pt={16} px={16}>
            <WritingCard title={phase === "done" ? t("nq.writing.ready") : t("nq.writing.title")} ready={phase === "done"}
              sub={clientName || newOn ? t("nq.writing.sub", { client: clientName || t("nq.writing.newClientName"), layout: layoutName }) : t("nq.writing.subNoClient", { layout: layoutName })}
              steps={stepLabels.map((label, i) => ({ label, state: states[i]! }))} stepSr={{ done: t("nq.writing.stepDone"), cur: t("nq.writing.stepNow"), todo: t("nq.writing.stepLater") }}>
              {phase === "done" && built ? (
                <>
                  <ReadySummary title={built.title || t("nq.writing.untitled")} number={built.number} total={m(built.total)}
                    meta={t("nq.writing.summary", { lines: t("nq.writing.lines", { count: built.lines }), chapters: t("nq.writing.chapters", { count: built.chapters }) })} />
                  <Stack row justify="center" pt={12}><Button kind="secondary" size="sm" label={t("nq.writing.restart")} onPress={restart} /></Stack>
                </>
              ) : null}
            </WritingCard>
          </Section>
        ) : null}

        {mode === 1 ? (
          <>
            <Section pt={16} px={16}>
              <Card padded>
                <Stack gap={12}>
                  <TextField label={t("nq.manual.title")} value={title} onChangeText={setTitle} placeholder={t("nq.manual.titlePlaceholder")} weight={500} />
                  {clientName
                    ? <ClientLine name={clientName} sub={newOn ? [form.address, form.city].filter(Boolean).join(", ") : pick?.data.indirizzo ? [pick.data.indirizzo, pick.data.city].filter(Boolean).join(", ") : undefined} initials={initials(clientName)} tint={tintFor(clientName)} action={t("nq.manual.change")} onAction={() => { setClientTerm(""); setClientSheet(true); }} />
                    : <ClientLine name={t("nq.manual.noClient")} sub={t("nq.manual.noClientSub")} action={t("nq.manual.choose")} onAction={() => { setClientTerm(""); setClientSheet(true); }} />}
                </Stack>
              </Card>
            </Section>
            {chapters.map((c, ci) => (
              <Section key={c.id} delay={60} pt={22} px={16}>
                <ChapterHeading n={ci + 1} title={c.title} editing={renaming === c.id} onTitle={(v) => setChapters((x) => renameManualChapter(x, ci, v))} onToggle={() => setRenaming((r) => (r === c.id ? null : c.id))}
                  renameLabel={t("nq.manual.rename")} doneLabel={t("nq.manual.renameDone")} fieldLabel={t("nq.manual.chapterLabel")} placeholder={t("nq.manual.chapterDefault")} />
                <Card>
                  {c.lines.map((l, li) => (
                    <Stack key={l.id}>
                      {li > 0 ? <Hairline inset={0} /> : null}
                      <ManualLine description={l.description} onDescription={(v) => setChapters((x) => editManualLine(x, ci, li, "description", v))} descLabel={t("nq.manual.descLabel")} descPlaceholder={t("nq.manual.descPlaceholder")}
                        improve={t("nq.manual.improve")} improveLabel={t("nq.manual.improveLabel")} onImprove={() => soon(t("nq.manual.improveSoon"))}
                        unit={l.um} onUnit={(v) => setChapters((x) => editManualLine(x, ci, li, "um", v))} unitLabel={t("nq.manual.unit")}
                        qty={fmtQty(l.quantita)} onQty={(v) => setChapters((x) => editManualLine(x, ci, li, "quantita", v))} qtyLabel={t("nq.manual.qty")}
                        price={fmtPrice(l.prezzoUnitario)} onPrice={(v) => setChapters((x) => editManualLine(x, ci, li, "prezzoUnitario", v))} priceLabel={t("nq.manual.unitPrice")}
                        total={m(totals.lineTotals[ci]?.[li] ?? 0)} totalLabel={t("nq.manual.total")} />
                    </Stack>
                  ))}
                  <ChapterFooter addLabel={t("nq.manual.addLine")} onAdd={() => setChapters((x) => addManualLine(x, ci, uid()))} subtotalLabel={t("nq.manual.subtotal")} subtotal={m(totals.chapterTotals[ci] ?? 0)} />
                </Card>
              </Section>
            ))}
            <Section pt={12} px={16}><DashedAdd label={t("nq.manual.addChapter")} onPress={() => setChapters((x) => [...x, newManualChapter(uid(), uid())])} /></Section>
            <Section pt={22} px={16}>
              <SectionHeader title={t("nq.manual.taxes")} />
              <TaxesCard provinceLabel={t("nq.manual.province")} provinceValue={t("nq.provinceValue", { province: provName(province), tax: taxWords(province) })} onProvince={() => setProvSheet("tax")}
                exemptLabel={t("nq.manual.exempt")} exemptSub={t("nq.manual.exemptSub")} exempt={exempt} onExempt={setExempt}
                subtotalLabel={t("nq.manual.subtotal")} subtotal={m(totals.subtotale)} taxLabel={exempt ? t("nq.manual.taxWord") : t("nq.taxLine", { tax: taxWords(province), province: provName(province), rate: rateText(rate) })} tax={exempt ? t("nq.manual.exemptWord") : m(totals.ivaValore)}
                totalLabel={t("nq.manual.total")} total={m(totals.totale)} />
            </Section>
            <Section pt={22}>
              <Stack px={16}><SectionHeader title={t("nq.manual.terms")} /></Stack>
              <ChipWrap>
                {TERMS.map((id, i) => <Chip key={id} label={t(`nq.manual.term.${id}`)} selected={termIx === i} onPress={() => setTermIx(i)} />)}
              </ChipWrap>
            </Section>
            <Section pt={22} px={16}><NotesField label={t("nq.manual.notes")} value={notes} onChange={setNotes} placeholder={t("nq.manual.notesPlaceholder")} /></Section>
          </>
        ) : null}

        {mode === 2 ? (
          <>
            <Section pt={16} px={16}><Search label={t("nq.pb.searchLabel")} placeholder={t("nq.pb.searchLabel")} value={pq} onChangeText={setPq} autoCorrect={false} /></Section>
            {cats.length ? (
              <Section delay={40} pt={12}>
                <ChipStrip label={t("nq.pb.categoryLabel")}>
                  <Chip label={t("nq.pb.all")} selected={cat === null} onPress={() => setCat(null)} />
                  {cats.map((c) => <Chip key={c} label={c} selected={cat?.toLowerCase() === c.toLowerCase()} onPress={() => setCat(c)} />)}
                </ChipStrip>
              </Section>
            ) : null}
            <Section delay={80} pt={16} px={16}>
              {book.isPending ? <Stack gap={10}><Skeleton height={64} radius={22} /><Skeleton height={64} radius={22} /></Stack>
                : book.isError ? <Empty icon="warn" iconTone="clay" title={t("nq.pb.loadFailed.title")} body={t("nq.pb.loadFailed.body")} action={t("nq.pb.loadFailed.retry")} onAction={() => void book.refetch()} padding={{ v: 28, h: 24 }} />
                : rows.length === 0 ? <Empty icon="list" iconTone="slate" title={t("nq.pb.emptyList.title")} body={t("nq.pb.emptyList.body")} action={t("nq.pb.emptyList.action")} actionKind="secondary" onAction={() => switchMode(1)} padding={{ v: 28, h: 24 }} />
                : (
                  <Card>
                    {shown.map((r, i) => {
                      const ix = Math.max(0, cats.findIndex((c) => c.toLowerCase() === (r.categoria ?? "").trim().toLowerCase()));
                      const look: [IconName, Tone] = r.categoria?.trim() ? CATEGORY_ICON[ix % CATEGORY_ICON.length]! : ["list", "slate"];
                      const rate = t("nq.pb.rate", { price: m(Number(r.prezzoUnitario)), unit: r.um });
                      return <CatalogRowView key={r.id} first={i === 0} icon={look[0]} tone={look[1]} name={r.nome} meta={r.categoria?.trim() ? `${rate} · ${r.categoria.trim()}` : rate}
                        added={isChosen(chosen, r.id)} onToggle={() => setChosen((s) => toggleChosen(s, r))} addLabel={t("nq.pb.add")} addedLabel={t("nq.pb.added")} removeLabel={t("nq.pb.remove")} />;
                    })}
                    {shown.length === 0 ? <Empty icon="search" iconTone="slate" title={t("nq.pb.none.title")} body={t("nq.pb.none.body")} padding={{ v: 28, h: 24 }} /> : null}
                  </Card>
                )}
            </Section>
            {book.data && rows.length > 0 ? (
              <Section delay={120} pt={22} px={16}>
                <SectionHeader title={t("nq.pb.selection")} link={t("nq.pb.items", { count: selection.rows.length })} />
                <Card>
                  {selection.rows.map((s, i) => (
                    <SelectionRow key={s.row.id} first={i === 0} name={s.row.nome} total={m(s.total)}
                      stepper={<Stepper value={`${qty(s.qty)} ${s.row.um}`} decLabel={t("nq.pb.less", { name: s.row.nome })} incLabel={t("nq.pb.more", { name: s.row.nome })} onDec={() => setChosen((x) => stepChosen(x, s.row, -1))} onInc={() => setChosen((x) => stepChosen(x, s.row, 1))} />} />
                  ))}
                  {selection.rows.length === 0 ? <NoteEmpty icon="list" tone="slate" text={t("nq.pb.nothing")} /> : <BeforeTax label={t("nq.pb.beforeTax")} total={m(selection.subtotal)} />}
                </Card>
              </Section>
            ) : null}
          </>
        ) : null}

        <Section pt={28} px={16} gap={10}>
          {mode === 0 && phase === "form" ? <PillAction label={t("nq.ai.write")} disabled={!canWrite(text)} onPress={() => void write()} icon={<Glyph name="arrowUp" size={17} color="on-inv" weight={2} />} />
            : mode === 0 && phase === "writing" ? <PillAction label={t("nq.ai.writingBtn")} busy onPress={() => undefined} />
            : mode === 0 ? <PillAction label={t("nq.ai.open")} onPress={() => built && openQuote(built.id)} />
            : mode === 1 ? <PillAction label={t("nq.manual.save")} disabled={!canSaveManual(chapters)} busy={saving} onPress={saveManual} />
            : <PillAction label={selection.rows.length ? t("nq.pb.build", { count: selection.rows.length }) : t("nq.pb.addToStart")} disabled={selection.rows.length === 0} busy={saving} onPress={buildPb} />}
          {mode === 1 && !canSaveManual(chapters) ? <Text size={12.5} color="muted" align="center">{t("nq.manual.needLine")}</Text> : null}
        </Section>
      </ScrollPage>

      <Sheet open={clientSheet} onClose={() => setClientSheet(false)} label={t("nq.sheets.clientTitle")} closeLabel={t("close")}>
        <SheetTitle>{t("nq.sheets.clientTitle")}</SheetTitle>
        <Stack px={16} pb={10}><Search label={t("nq.sheets.clientSearch")} placeholder={t("nq.sheets.clientSearch")} value={clientTerm} onChangeText={setClientTerm} autoCorrect={false} /></Stack>
        <SheetList>
          <ClientRow first plus name={t("nq.sheets.noClient")} sub={t("nq.sheets.noClientSub")} selected={!pick && !newOn} onPress={() => { pickClient(null); setClientSheet(false); }} />
          {sheetClients.map((c) => <ClientRow key={c.id} name={c.name} sub={c.sub} initials={initials(c.name)} tint={tintFor(c.name)} selected={pick?.id === c.id && !newOn} onPress={() => { pickClient(c); setClientSheet(false); }} />)}
        </SheetList>
      </Sheet>
      <Sheet open={provSheet !== null} onClose={() => setProvSheet(null)} label={t("nq.sheets.provinceTitle")} closeLabel={t("close")}>
        <SheetTitle>{t("nq.sheets.provinceTitle")}</SheetTitle>
        <SheetList>
          {PROVINCES.map((c) => {
            const on = provSheet === "client" ? form.province === c : province === c;
            return (
              <ListRow key={c} title={provName(c)} meta={t(`onboarding.provinces.${c}.tax`)} accessibilityLabel={`${provName(c)}, ${t(`onboarding.provinces.${c}.tax`)}`}
                trailing={on ? <Glyph name="check" size={16} weight={2.6} /> : undefined}
                onPress={() => { if (provSheet === "client") setForm((f) => ({ ...f, province: c })); else setProvinceSet(c); setProvSheet(null); }} />
            );
          })}
        </SheetList>
      </Sheet>
    </Screen>
  );
}
