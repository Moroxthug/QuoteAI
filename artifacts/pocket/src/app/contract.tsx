// Contract.dc.html: one contract from draft to signed. The status and title, the client and the quote it came from, the four steps (Review,
// Sign, Send, Customer signs), the agreement as sections that open in place (the AI's are editable, the standard clauses locked), who
// signs and what they signed, the terms (Edit terms), the activity, and the floating bar whose one action follows the step: Sign as the
// company, Send to the client, Waiting for the client, Download the signed PDF. The client signs on the web page the emailed link opens.
// Opened with `id`, or with `quoteId` (finds the quote's contract or drafts one: the quote editor's "Contract" row). States: loading,
// drafting, can't load, not found, plan without contracts, offline, and every step of the flow.
// Not built (nothing on the server to read or write): see the 127.5 log in docs/POCKET-APP-PLAN.md.
import { useEffect, useMemo, useState } from "react";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWindowDimensions, View } from "react-native";
import { ApiFailure } from "@/lib/api";
import {
  activity, bodyBlocks, canRemind, canVoid, consentFor, details, editable, firstName, partyLines, plainHeading, primaryOf, sectionTag, SIGNER_LOOK, signerWord, stepOf, termsOf, termsPatch, typedSignature,
  validEmail, validSignature, warrantyParts, type Activity, type Block, type ContractFull, type SignerDto, type TermsForm,
} from "@/lib/contracts";
import { downloadContractPdf } from "@/lib/contractPdf";
import { contractsApi } from "@/lib/contractsApi";
import { tintFor } from "@/lib/clients";
import { dayDate, money, number, shortDate, time, type Locale } from "@/lib/format";
import { initialsOf } from "@/lib/invites";
import { screenHref } from "@/lib/nav";
import { useSession } from "@/lib/useSession";
import { ActionBar, ACTION_BAR_SPACE } from "@/ui/ActionBar";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Checkbox } from "@/ui/Check";
import { AgreementRow, ContractHead, Signature, SignerRow, StepsCard, TermRow, Timeline } from "@/ui/Contracts";
import { DateSheet } from "@/ui/DateSheet";
import { Empty, Skeleton, useToast } from "@/ui/Feedback";
import { SelectField, TextField } from "@/ui/Field";
import { Header } from "@/ui/Header";
import type { IconName, Tone } from "@/ui/Icon";
import { Icon } from "@/ui/Icon";
import { ScrollPage, Section, Stack } from "@/ui/Layout";
import { Press } from "@/ui/motion";
import { MenuList, MenuRow, SectionHeader } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { Stepper } from "@/ui/Stepper";
import { Switch } from "@/ui/Switch";
import { Text } from "@/ui/Text";
import type { ColorName } from "@/ui/theme";

const ACT_LOOK: Record<Activity["kind"], { icon: IconName; tone: Tone }> = {
  created: { icon: "orb", tone: "violet" }, edited: { icon: "pen", tone: "slate" }, contractorSigned: { icon: "check", tone: "sage" }, sent: { icon: "send", tone: "azure" },
  reminder: { icon: "bell", tone: "amber" }, viewed: { icon: "eye", tone: "sky" }, verified: { icon: "shield", tone: "indigo" }, signed: { icon: "check", tone: "sage" },
  declined: { icon: "warn", tone: "clay" }, voided: { icon: "lock", tone: "slate" }, expired: { icon: "clock", tone: "amber" },
};

const dayOf = (iso: string): Date => { const [y, m, d] = iso.split("-").map(Number) as [number, number, number]; return new Date(y, m - 1, d, 12); };
const isoDay = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const WARRANTY_STEP = 6;
const HOLDBACK_STEP = 5;

export default function Contract() {
  const { t: tr, i18n } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`ct.page.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const params = useLocalSearchParams<{ id?: string; quoteId?: string }>();
  const id = params.id;
  const quoteId = params.quoteId;
  const { status, user } = useSession();
  const signedIn = status === "in" || status === "offline";
  const toast = useToast();
  const client = useQueryClient();
  const tall = useWindowDimensions().height * 0.32;

  const byId = useQuery({ queryKey: ["contract", id], queryFn: () => contractsApi.get(id!).then((r) => r.contract), enabled: signedIn && !!id, retry: 1, staleTime: 5_000 });
  const [drafting, setDrafting] = useState(false);
  const resolve = useQuery({
    queryKey: ["contract-for-quote", quoteId],
    queryFn: async (): Promise<ContractFull> => {
      const found = await contractsApi.byQuote(quoteId!);
      if (found.contract) return (await contractsApi.get(found.contract.id)).contract;
      setDrafting(true);
      try { return (await contractsApi.fromQuote(quoteId!, i18n.language === "fr" ? "fr" : undefined)).contract; } finally { setDrafting(false); }
    },
    enabled: signedIn && !id && !!quoteId, retry: false, staleTime: Infinity,
  });
  useEffect(() => {
    if (!id && resolve.data) {
      client.setQueryData(["contract", resolve.data.id], resolve.data);
      void client.invalidateQueries({ queryKey: ["contracts"] });
      router.setParams({ id: resolve.data.id });
    }
  }, [id, resolve.data, client]);

  const c = (id ? byId.data : undefined) ?? undefined;
  const error = id ? byId.error : resolve.error;

  const [open, setOpen] = useState(0);
  const [menu, setMenu] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [signName, setSignName] = useState("");
  const [agree, setAgree] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [voidOpen, setVoidOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [termsOpen, setTermsOpen] = useState(false);
  const [terms, setTerms] = useState<TermsForm | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const acts = useMemo(() => (c ? activity(c) : []), [c]);

  if (status === "out") return <Redirect href="/" />;

  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("Contracts", tr("menu.rows.contracts.label"))));
  const header = (number?: string) => <Header title={number ?? ""} subtle backLabel={tr("ct.back")} onBack={back} moreLabel={tr("ct.more")} onMore={c ? () => setMenu(true) : undefined} />;

  if (!c) {
    const f = error instanceof ApiFailure ? error : null;
    if (f?.code === "PLAN_REQUIRED") return <Screen>{header()}<Section pt={26} px={16}><Empty icon="lock" iconTone="slate" title={t("plan.title")} body={t("plan.body")} action={tr("ct.back")} actionKind="secondary" onAction={back} /></Section></Screen>;
    if (error && f?.status === 404) return <Screen>{header()}<Section pt={26} px={16}><Empty icon="doc" iconTone="slate" title={t("notFound.title")} body={t("notFound.body")} action={tr("ct.back")} actionKind="secondary" onAction={back} /></Section></Screen>;
    if (error) {
      const fromQuote = !id;
      return <Screen>{header()}<Section pt={26} px={16}><Empty icon="warn" iconTone="clay" title={fromQuote && !f?.offline ? t("draftFailed.title") : t("loadFailed.title")} body={fromQuote && !f?.offline ? t("draftFailed.body") : t("loadFailed.body")} action={tr("ct.retry")} onAction={() => void (id ? byId.refetch() : resolve.refetch())} /></Section></Screen>;
    }
    if (!id && !quoteId) return <Screen>{header()}<Section pt={26} px={16}><Empty icon="doc" iconTone="slate" title={t("notFound.title")} body={t("notFound.body")} action={tr("ct.back")} actionKind="secondary" onAction={back} /></Section></Screen>;
    if (drafting) return <Screen>{header()}<Section pt={26} px={16} gap={16}><Empty icon="orb" iconTone="violet" title={t("drafting.title")} body={t("drafting.body")} /><Skeleton height={86} radius={22} /><Skeleton height={190} radius={22} /></Section></Screen>;
    return <Screen>{header()}<Section pt={8} px={16} gap={12}><Skeleton height={120} radius={22} /><Skeleton height={90} radius={22} /><Skeleton height={300} radius={22} /></Section></Screen>;
  }

  const v = c.variables;
  const m = (cents: number) => money(cents / 100, locale);
  const company = v.contractor.name;
  const customer = c.signers.find((s) => s.role === "customer");
  const contractor = c.signers.find((s) => s.role === "contractor");
  const clientName = v.customer.name || customer?.name || "";
  const first = firstName(clientName);
  const step = stepOf(c);
  const primary = primaryOf(c);
  const sections = c.document.sections;
  const canEdit = editable(c);
  const pct = (n: number) => `${number(n, locale, n % 1 ? 1 : 0)}${locale === "fr-CA" ? " %" : "%"}`;
  const when = (iso: string): string => {
    const d = new Date(iso);
    const now = new Date();
    const today = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    return today ? t("when.today", { time: time(d, locale) }) : t("when.on", { date: shortDate(d, locale), time: time(d, locale) });
  };
  const provinceName = (code: string) => tr(`ct.page.prov.${code}`, { defaultValue: code }) as string;

  const setContract = (next: ContractFull) => {
    client.setQueryData(["contract", c.id], next);
    void client.invalidateQueries({ queryKey: ["contracts"] });
  };
  const fail = (e: unknown, fallback = t("failed")) => {
    const f = e instanceof ApiFailure ? e : null;
    if (f?.offline) return toast({ message: t("offline") });
    if (f?.status === 403) return toast({ message: f.code === "PLAN_REQUIRED" ? t("plan.title") : t("noAccess") });
    if (f?.code === "LOCKED") return toast({ message: t("sign.locked") });
    toast({ message: fallback });
  };

  // ── Sign as the company ─────────────────────────────────────────────────
  const startSign = () => { setSignName(user?.name ?? ""); setAgree(false); setSignOpen(true); };
  const doSign = async () => {
    if (!validSignature(signName, agree) || busy) return;
    setBusy("sign");
    try {
      const r = await contractsApi.sign(c.id, typedSignature(signName));
      setContract(r.contract);
      setSignOpen(false);
      toast({ message: t("sign.done", { name: first }) });
    } catch (e) { fail(e); } finally { setBusy(null); }
  };

  // ── Send to the client (or remind) ──────────────────────────────────────
  const knownEmail = termsOf(c).customerEmail.trim();
  const doSend = async (toEmail?: string) => {
    if (busy) return;
    setBusy("send");
    const reminder = canRemind(c);
    try {
      const r = await contractsApi.send(c.id, toEmail);
      setContract(r.contract);
      setAskOpen(false);
      toast({ message: t(reminder ? "send.reminded" : "send.sent", { name: first }) });
    } catch (e) {
      if (e instanceof ApiFailure && e.code === "CUSTOMER_EMAIL_MISSING") { setEmail(""); setEmailError(undefined); setAskOpen(true); }
      else fail(e, t("send.failed"));
    } finally { setBusy(null); }
  };
  const send = () => { if (validEmail(knownEmail)) void doSend(); else { setEmail(""); setEmailError(undefined); setAskOpen(true); } };
  const sendAsked = () => {
    if (!validEmail(email)) { setEmailError(t("ask.invalid")); return; }
    void doSend(email.trim());
  };

  // ── Download, void, archive ─────────────────────────────────────────────
  const download = async () => {
    setMenu(false);
    if (busy) return;
    setBusy("pdf");
    try { await downloadContractPdf(c.id, c.contractNumber); toast({ message: t("pdfReady") }); } catch (e) { fail(e, t("pdfFailed")); } finally { setBusy(null); }
  };
  const doVoid = async () => {
    if (busy) return;
    setBusy("void");
    try {
      const r = await contractsApi.void(c.id, reason.trim() || undefined);
      setContract(r.contract);
      setVoidOpen(false);
      toast({ message: t("voidSheet.done") });
    } catch (e) { fail(e); } finally { setBusy(null); }
  };
  const archive = async () => {
    setMenu(false);
    if (busy) return;
    setBusy("archive");
    try {
      await contractsApi.archive(c.id);
      void client.invalidateQueries({ queryKey: ["contracts"] });
      toast({ message: t("archived"), action: t("undo"), onAction: () => { void contractsApi.restore(c.id).then(() => { void client.invalidateQueries({ queryKey: ["contracts"] }); toast({ message: t("restored") }); }).catch((e: unknown) => fail(e)); } });
      back();
    } catch (e) { fail(e); } finally { setBusy(null); }
  };

  // ── Edit a section, edit the terms ──────────────────────────────────────
  const editing = sections.find((s) => s.key === editKey) ?? null;
  const startEdit = (key: string, body: string) => { setEditText(body); setEditKey(key); };
  const saveSection = async () => {
    if (!editing || busy) return;
    setBusy("edit");
    try {
      const r = await contractsApi.update(c.id, { sections: [{ key: editing.key, body: editText }] });
      setContract(r.contract);
      setEditKey(null);
      toast({ message: t("editSheet.saved") });
    } catch (e) { fail(e, t("editSheet.failed")); } finally { setBusy(null); }
  };
  const startTerms = () => { setTerms(termsOf(c)); setEmailError(undefined); setTermsOpen(true); };
  const termsChanged = terms ? termsPatch(termsOf(c), terms) : {};
  const saveTerms = async () => {
    if (!terms || busy) return;
    if (terms.customerEmail.trim() && !validEmail(terms.customerEmail)) { setEmailError(t("ask.invalid")); return; }
    if (Object.keys(termsChanged).length === 0) { setTermsOpen(false); return; }
    setBusy("terms");
    try {
      const r = await contractsApi.update(c.id, { variables: termsChanged });
      setContract(r.contract);
      setTermsOpen(false);
      toast({ message: t("termsSheet.saved") });
    } catch (e) { fail(e, t("termsSheet.failed")); } finally { setBusy(null); }
  };
  const signedByUs = contractor?.status === "signed";

  // ── What the page says ─────────────────────────────────────────────────
  const statusLine = c.status === "draft" ? t(step === 2 ? "status.signedYou" : "status.draft")
    : c.status === "sent" ? t("status.sent", { name: first }) : c.status === "viewed" ? t("status.viewed", { name: first })
    : c.status === "declined" ? t("status.declined", { name: first }) : t(`status.${c.status}`);
  const dot: ColorName = c.status === "draft" ? (step === 2 ? "ok-dot" : "warn-dot") : c.status === "sent" ? "info" : c.status === "viewed" ? "acc" : c.status === "signed" ? "ok-dot" : c.status === "expired" ? "muted" : "bad";
  const stepLabels = [t("steps.review"), t("steps.sign"), t("steps.send"), t("steps.customer")];

  const label = primary === "sign" ? t("primary.sign", { company }) : primary === "send" ? t("primary.send", { name: first }) : primary === "waiting" ? t("primary.waiting", { name: first })
    : primary === "download" ? t("primary.download") : t(`status.${c.status}`);
  const onPrimary = primary === "sign" ? startSign : primary === "send" ? send : primary === "download" ? () => void download() : () => setMenu(true);

  const quoteLink = c.quoteId ? (
    <Text size={12.5} color="muted" numberOfLines={1}>
      {t("from")}{" "}
      <Text size={12.5} color="acc-t" onPress={() => router.push(screenHref("Quote", v.quoteNumber, { id: c.quoteId! }))} accessibilityRole="link">{v.quoteNumber}</Text>
      {` · ${m(c.contractValueCents)}`}
    </Text>
  ) : (
    <Text size={12.5} color="muted" numberOfLines={1}>{`${t("changeOrder")} · ${m(c.contractValueCents)}`}</Text>
  );

  const sectionBlocks = (key: string, body: string): Block[] => {
    if (key === "parties") {
      const lines = (label: string, p: typeof v.contractor): Block[] => [{ kind: "p", parts: [{ text: label, bold: true }] }, ...partyLines(p).map((l): Block => ({ kind: "p", parts: [{ text: l, bold: false }] }))];
      return [...lines(t("parties.contractor"), v.contractor), ...lines(t("parties.customer"), v.customer)];
    }
    return bodyBlocks(body);
  };

  const signerRow = (s: SignerDto, i: number) => {
    const word = signerWord(c, s);
    const look = SIGNER_LOOK[word];
    const mine = s.role === "contractor";
    const name = mine && s.status !== "signed" ? (user?.name ?? s.name) : s.name;
    const sentAt = c.events.filter((e) => e.type === "sent").map((e) => e.createdAt).sort().pop() ?? c.sentAt;
    let meta: string;
    if (s.status === "signed" && s.signedAt) meta = mine || !c.events.some((e) => e.type === "otp_verified") ? t("meta.signed", { when: when(s.signedAt) }) : t("meta.signedVerified", { when: when(s.signedAt) });
    else if (s.status === "declined") meta = s.declinedAt ? t("meta.declined", { when: when(s.declinedAt) }) + (s.declineReason ? ` · ${t("meta.reason", { reason: s.declineReason })}` : "") : t("word.declined");
    else if (mine) meta = t("meta.signToSend");
    else if (c.status === "draft") meta = t("meta.getsLink");
    else if (s.viewedAt) meta = t("meta.opened", { when: when(s.viewedAt) });
    else meta = sentAt ? t("meta.emailed", { when: when(sentAt) }) : t("meta.getsLink");
    const sig = s.status === "signed" && s.signatureData ? (s.signatureType === "drawn" ? <Signature image={s.signatureData} label={t("signatureOf", { name })} /> : <Signature typed={s.signatureData} label={t("signatureOf", { name })} />) : null;
    return (
      <SignerRow key={s.id} first={i === 0} initials={initialsOf(name)} tint={mine ? 5 : tintFor(clientName)} name={name}
        role={mine ? t("role.contractor", { company }) : v.siteAddress ? t("role.customer", { address: v.siteAddress }) : t("role.customerBare")}
        status={{ tone: look.tone, shape: look.shape, label: t(`word.${word}`) }} meta={meta} signature={sig} />
    );
  };

  const detailRows = details(c).map((d) => {
    switch (d.key) {
      case "province": return { k: t("detail.province"), v: provinceName(d.value) };
      case "language": return { k: t("detail.language"), v: t(`detail.lang.${d.value}`) };
      case "subtotal": return { k: t("detail.subtotal"), v: m(d.cents), figure: true };
      case "tax": return { k: t("detail.tax", { label: d.label, province: provinceName(c.province), rate: pct(d.rate) }), v: m(d.cents), figure: true };
      case "total": return { k: t("detail.total"), v: m(d.cents), figure: true, strong: true };
      case "holdback": return { k: t("detail.holdback", { percent: pct(d.percent) }), v: m(d.cents), figure: true };
      case "start": return { k: t("detail.start"), v: dayDate(dayOf(d.iso), locale) };
      case "warranty": { const w = warrantyParts(d.months); return { k: t("detail.warranty"), v: d.months === 0 ? t("detail.noWarranty") : t(`detail.${w.unit}`, { count: w.count }) }; }
    }
  });

  const actText = (a: Activity): string => {
    const name = firstName(a.who ?? clientName);
    switch (a.kind) {
      case "created": return c.kind === "change_order" ? t("act.createdChange") : v.quoteNumber ? t("act.created", { quote: v.quoteNumber }) : t("act.createdBare");
      case "edited": {
        const heads = (a.sections ?? []).map((k) => sections.find((s) => s.key === k)?.heading).filter((x): x is string => !!x).map(plainHeading);
        return heads.length ? t("act.edited", { what: heads.join(", ") }) : t("act.editedTerms");
      }
      case "contractorSigned": return t("act.contractorSigned", { name });
      case "sent": return t("act.sent", { name: first });
      case "reminder": return t("act.reminder", { name: first });
      case "viewed": return t("act.viewed", { name });
      case "verified": return t("act.verified", { name });
      case "signed": return t("act.signed", { name });
      case "declined": return a.reason ? t("act.declinedWhy", { name, reason: a.reason }) : t("act.declined", { name });
      case "voided": return a.reason ? t("act.voidedWhy", { reason: a.reason }) : t("act.voided");
      case "expired": return t("act.expired");
    }
  };

  const consent = consentFor(c.language);

  return (
    <Screen floating={<ActionBar label={label} onPress={onPrimary} moreLabel={t("moreAria")} onMore={() => setMenu(true)} quiet={primary === "waiting" || primary === "closed"} busy={busy === "pdf" || busy === "send"} />}>
      {header(c.contractNumber)}
      <ScrollPage bottom={ACTION_BAR_SPACE}>
        <Section>
          <ContractHead dot={dot} line={statusLine} title={c.kind === "change_order" ? c.document.title : v.projectTitle} client={clientName}
            avatar={<Avatar initials={initialsOf(clientName)} tint={tintFor(clientName)} size={32} />} from={quoteLink} />
        </Section>
        <Section delay={60} pt={20} px={16}><StepsCard label={t("progress")} steps={stepLabels} current={step} /></Section>

        <Section delay={110} pt={22} px={16}>
          <SectionHeader title={t("agreement")} link={t("sections", { count: sections.length })} />
          <Card style={{ overflow: "hidden" }}>
            {sections.map((s, i) => {
              const tag = sectionTag(s);
              const isOpen = open === i;
              return (
                <AgreementRow key={s.key} first={i === 0} n={i + 1} title={plainHeading(s.heading)} tag={t(`tag.${tag}`)} locked={tag !== "ai"} ai={tag === "ai"} open={isOpen}
                  openLabel={t("expandLabel", { title: plainHeading(s.heading), tag: t(`tag.${tag}`) })} onToggle={() => setOpen(isOpen ? -1 : i)} blocks={sectionBlocks(s.key, s.body)}
                  action={tag === "ai" && canEdit ? <Button size="sm" kind="secondary" label={t("editSection")} onPress={() => startEdit(s.key, s.body)} /> : undefined} />
              );
            })}
          </Card>
        </Section>

        <Section delay={160} pt={22} px={16}>
          <SectionHeader title={t("signers")} />
          <Card style={{ overflow: "hidden" }}>
            {[contractor, customer].filter((s): s is SignerDto => !!s).map(signerRow)}
          </Card>
        </Section>

        <Section delay={200} pt={22} px={16}>
          <SectionHeader title={t("details")} link={canEdit ? t("editTerms") : undefined} onLink={startTerms} />
          <Card style={{ overflow: "hidden" }}>
            {detailRows.map((r, i) => <TermRow key={`${r.k}-${i}`} first={i === 0} k={r.k} v={r.v} figure={"figure" in r ? r.figure : false} strong={"strong" in r ? r.strong : false} />)}
          </Card>
        </Section>

        <Section delay={240} pt={22} px={16}>
          <SectionHeader title={t("activity")} />
          <Timeline items={acts.map((a) => ({ key: a.id, icon: ACT_LOOK[a.kind].icon, tone: ACT_LOOK[a.kind].tone, text: actText(a), time: when(a.at) }))} />
        </Section>
      </ScrollPage>

      <Sheet open={menu} onClose={() => setMenu(false)} label={t("menu.title")} closeLabel={tr("close")}>
        <SheetTitle>{c.contractNumber}</SheetTitle>
        <MenuList>
          <MenuRow icon={<Icon name="file" tone="azure" size={28} />} title={t("menu.pdf")} sub={t(c.status === "signed" ? "menu.pdfSigned" : "menu.pdfDraft")} chevron={false} onPress={() => void download()} />
          {canRemind(c) ? <MenuRow icon={<Icon name="bell" tone="amber" size={28} />} title={t("menu.remind")} sub={t("menu.remindSub", { name: first })} chevron={false} onPress={() => { setMenu(false); send(); }} /> : null}
          {c.quoteId ? <MenuRow icon={<Icon name="doc" tone="violet" size={28} />} title={t("menu.quote")} sub={v.quoteNumber} onPress={() => { setMenu(false); router.push(screenHref("Quote", v.quoteNumber, { id: c.quoteId! })); }} /> : null}
          {canVoid(c) ? <MenuRow icon={<Icon name="lock" tone="clay" size={28} />} title={t("menu.void")} sub={t("menu.voidSub")} chevron={false} onPress={() => { setMenu(false); setReason(""); setVoidOpen(true); }} /> : null}
          <MenuRow icon={<Icon name="box" tone="slate" size={28} />} title={t("menu.archive")} sub={t("menu.archiveSub")} chevron={false} onPress={() => void archive()} />
        </MenuList>
        <Stack pt={12} />
      </Sheet>

      <Sheet open={signOpen} onClose={() => setSignOpen(false)} label={t("sign.title")} closeLabel={tr("close")}>
        <SheetTitle>{t("sign.title")}</SheetTitle>
        <Stack px={16} gap={14} pb={20}>
          <Text size={14.5} color="t2" leading={1.45}>{t("sign.body")}</Text>
          <TextField label={t("sign.name")} value={signName} onChangeText={setSignName} autoCapitalize="words" autoCorrect={false} />
          {signName.trim() ? <Signature flush typed={signName.trim()} label={t("signatureOf", { name: signName.trim() })} /> : null}
          <Stack row align="flex-start" gap={4}>
            <Checkbox checked={agree} onChange={setAgree} label={t("sign.consentAria")} />
            <Press onPress={() => setAgree(!agree)} accessibilityRole="button" accessibilityLabel={t("sign.consentAria")} style={{ flexShrink: 1, minHeight: 44, justifyContent: "center" }}>
              <Text size={13.5} color="t2" leading={1.4}>{consent}</Text>
            </Press>
          </Stack>
          <Button block label={t("sign.action")} disabled={!validSignature(signName, agree)} busy={busy === "sign" ? t("sign.signing") : false} onPress={() => void doSign()} />
        </Stack>
      </Sheet>

      <Sheet open={askOpen} onClose={() => setAskOpen(false)} label={t("ask.title")} closeLabel={tr("close")}>
        <SheetTitle>{t("ask.title")}</SheetTitle>
        <Stack px={16} gap={14} pb={20}>
          <Text size={14.5} color="t2" leading={1.45}>{t("ask.body", { name: clientName })}</Text>
          <TextField label={t("ask.label")} value={email} onChangeText={(x) => { setEmail(x); setEmailError(undefined); }} placeholder={t("ask.placeholder")} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} error={emailError} />
          <Button block label={t("ask.action")} busy={busy === "send" ? t("ask.sending") : false} onPress={sendAsked} />
        </Stack>
      </Sheet>

      <Sheet open={voidOpen} onClose={() => setVoidOpen(false)} label={t("voidSheet.title")} closeLabel={tr("close")}>
        <SheetTitle>{t("voidSheet.title")}</SheetTitle>
        <Stack px={16} gap={14} pb={20}>
          <Text size={14.5} color="t2" leading={1.45}>{t("voidSheet.body", { number: c.contractNumber, name: clientName })}</Text>
          <TextField label={t("voidSheet.reason")} value={reason} onChangeText={setReason} placeholder={t("voidSheet.reasonPlaceholder")} multiline maxLength={500} maxHeight={tall} />
          <Button kind="destructive" block label={t("voidSheet.action")} busy={busy === "void" ? t("voidSheet.working") : false} onPress={() => void doVoid()} />
          <Button kind="secondary" block label={t("voidSheet.cancel")} onPress={() => setVoidOpen(false)} />
        </Stack>
      </Sheet>

      <Sheet open={!!editing} onClose={() => setEditKey(null)} label={t("editSheet.title", { section: plainHeading(editing?.heading ?? "") })} closeLabel={tr("close")}>
        <SheetTitle>{t("editSheet.title", { section: plainHeading(editing?.heading ?? "") })}</SheetTitle>
        <Stack px={16} gap={12} pb={20}>
          <Text size={13.5} color="muted" leading={1.4}>{signedByUs ? t("editSheet.clears") : t("editSheet.note")}</Text>
          <TextField label={t("editSheet.label")} value={editText} onChangeText={setEditText} multiline maxLength={20000} maxHeight={tall} />
          <Button block label={t("editSheet.save")} busy={busy === "edit" ? t("editSheet.saving") : false} disabled={!editText.trim()} onPress={() => void saveSection()} />
        </Stack>
      </Sheet>

      <Sheet open={termsOpen} onClose={() => setTermsOpen(false)} label={t("termsSheet.title")} closeLabel={tr("close")}>
        <SheetTitle>{t("termsSheet.title")}</SheetTitle>
        {terms ? (
          <Stack px={16} gap={14} pb={20}>
            {signedByUs ? <Text size={13.5} color="muted" leading={1.4}>{t("termsSheet.clears")}</Text> : null}
            <SelectField label={t("termsSheet.start")} value={terms.startDate ? dayDate(dayOf(terms.startDate), locale) : t("termsSheet.noStart")} mono={!!terms.startDate} onPress={() => setDateOpen(true)} />
            {terms.startDate ? <Stack align="flex-start"><Button size="sm" kind="secondary" label={t("termsSheet.clearStart")} onPress={() => setTerms({ ...terms, startDate: null })} /></Stack> : null}
            <Stack row align="center" justify="space-between" gap={12}>
              <Text size={14.5} weight={500}>{t("termsSheet.warranty")}</Text>
              <Stepper value={terms.warrantyMonths === 0 ? t("detail.noWarranty") : (() => { const w = warrantyParts(terms.warrantyMonths); return t(`detail.${w.unit}`, { count: w.count }); })()}
                decLabel={t("termsSheet.less")} incLabel={t("termsSheet.more")} canDec={terms.warrantyMonths > 0} canInc={terms.warrantyMonths < 120}
                onDec={() => setTerms({ ...terms, warrantyMonths: Math.max(0, terms.warrantyMonths - WARRANTY_STEP) })} onInc={() => setTerms({ ...terms, warrantyMonths: Math.min(120, terms.warrantyMonths + WARRANTY_STEP) })} />
            </Stack>
            <Stack row align="center" justify="space-between" gap={12}>
              <Text size={14.5} weight={500} style={{ flexShrink: 1 }}>{t("termsSheet.holdback")}</Text>
              <Switch value={terms.holdbackEnabled} label={t("termsSheet.holdback")} onChange={(on) => setTerms({ ...terms, holdbackEnabled: on })} />
            </Stack>
            <Stack row align="center" justify="space-between" gap={12}>
                <Text size={14.5} weight={500}>{t("termsSheet.holdbackPercent")}</Text>
                <Stepper value={pct(terms.holdbackPercent)} decLabel={t("termsSheet.less")} incLabel={t("termsSheet.more")} canDec={terms.holdbackEnabled && terms.holdbackPercent > HOLDBACK_STEP} canInc={terms.holdbackEnabled && terms.holdbackPercent < 50}
                  onDec={() => setTerms({ ...terms, holdbackPercent: Math.max(HOLDBACK_STEP, terms.holdbackPercent - HOLDBACK_STEP) })} onInc={() => setTerms({ ...terms, holdbackPercent: Math.min(50, terms.holdbackPercent + HOLDBACK_STEP) })} />
              </Stack>
            <TextField label={t("termsSheet.email")} value={terms.customerEmail} onChangeText={(x) => { setTerms({ ...terms, customerEmail: x }); setEmailError(undefined); }} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} error={emailError} />
            <Button block label={t("termsSheet.save")} busy={busy === "terms" ? t("editSheet.saving") : false} onPress={() => void saveTerms()} />
          </Stack>
        ) : null}
      </Sheet>
      <DateSheet open={dateOpen} onClose={() => setDateOpen(false)} title={t("termsSheet.pick")} closeLabel={tr("close")} prevLabel={t("termsSheet.prev")} nextLabel={t("termsSheet.next")} locale={locale}
        value={terms?.startDate ? dayOf(terms.startDate) : null} onPick={(d) => { setDateOpen(false); if (terms) setTerms({ ...terms, startDate: isoDay(d) }); }} />
    </Screen>
  );
}
