// ChangeOrder.dc.html. Four steps that follow where the change order stands: Describe (talk or type what changed, a title), Review (the lines the
// assistant drafted from what was said, the tax, the contract before and after, the schedule, how it's billed, who it goes to), Sent (awaiting the
// client's signature: progress, remind) and Signed (what updated for you). Opened with `jobId` for a new one, or `id` and `jobId` for an existing one.
// The server keeps a draft as soon as it has a line, so leaving the screen keeps the work. Sending signs the document for the contractor (typed name)
// and emails the client a signing link. Not built: texting the link and "Signed on paper" (the server has only email and the client's own signature),
// the other two billing choices (a change order is billed with the next progress invoice), photos on the change order, the reminder switch.
import { useEffect, useMemo, useState } from "react";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiFailure } from "@/lib/api";
import { tintFor } from "@/lib/clients";
import { changeOrderApi } from "@/lib/changeOrderApi";
import { canWrite, contractNow, itemsOf, lineTotal, linesOf, proposalLines, STEPS, stepOf, subtotal, type Line, type Step } from "@/lib/changeOrder";
import { dayDate, money, number, shortDate, time, type Locale } from "@/lib/format";
import { initialsOf } from "@/lib/invites";
import { jobsApi } from "@/lib/jobsApi";
import { useDictation } from "@/lib/newQuoteInput";
import { screenHref } from "@/lib/nav";
import { useSession } from "@/lib/useSession";
import { Avatar } from "@/ui/Avatar";
import { BigAmount, BottomBar, CompareRow, Hero, LineRow, LinesFooter, MicCard, StepsBar, Summary, TrackItem } from "@/ui/ChangeOrder";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Chip } from "@/ui/Chip";
import { RadioRow } from "@/ui/Check";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { TextField } from "@/ui/Field";
import { Header } from "@/ui/Header";
import { Icon } from "@/ui/Icon";
import { MiniStepper } from "@/ui/JobSetup";
import { Section, ScrollPage, Stack } from "@/ui/Layout";
import { MenuList, MenuRow, RowList, SectionHeader } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Segmented } from "@/ui/Segmented";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { Status } from "@/ui/Status";
import { Num, Text } from "@/ui/Text";

let keyN = 0;
const newLine = (o: Partial<Line> = {}): Line => ({ key: `n${++keyN}`, description: "", qty: 1, unit: "", unitPrice: 0, ...o });

export default function ChangeOrder() {
  const { t, i18n } = useTranslation();
  const c = (k: string, o?: Record<string, unknown>) => t(`co.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const lang: "en" | "fr" = i18n.language === "fr" ? "fr" : "en";
  const { id, jobId } = useLocalSearchParams<{ id?: string; jobId?: string }>();
  const { status, user } = useSession();
  const signedIn = status === "in" || status === "offline";
  const toast = useToast();
  const client = useQueryClient();
  const dictation = useDictation();
  const job = useQuery({ queryKey: ["job", jobId], queryFn: () => jobsApi.get(jobId!), enabled: signedIn && !!jobId, retry: 1, staleTime: 15_000 });
  const [coId, setCoId] = useState<string | undefined>(id);
  const detail = job.data;
  const co = detail?.changeOrders.find((x) => x.id === coId) ?? null;
  const docId = co?.documentContractId ?? null;
  const contract = useQuery({ queryKey: ["contract", docId], queryFn: () => changeOrderApi.contract(docId!), enabled: signedIn && !!docId && !!co && co.status !== "draft", retry: 1, staleTime: 10_000 });

  const [mode, setMode] = useState(0); // 0 talk, 1 type
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [days, setDays] = useState(0);
  const [phase, setPhase] = useState<Step>("describe");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lineOpen, setLineOpen] = useState<Line | null>(null);
  const [menu, setMenu] = useState(false);
  const [seeded, setSeeded] = useState<string | null>(null);

  // An existing change order opens on its own data.
  useEffect(() => {
    if (!co || seeded === co.id) return;
    setSeeded(co.id);
    setTitle(co.title); setText(co.description); setLines(linesOf(co)); setDays(co.scheduleDeltaDays);
  }, [co, seeded]);

  const now = useMemo(() => new Date(), []);
  if (status === "out") return <Redirect href="/" />;

  const toJob = () => router.replace(screenHref("Job", detail?.job.name ?? "", { id: jobId!, tab: "co" }));
  const back = () => (router.canGoBack() ? router.back() : toJob());
  const m = (cents: number, cents2 = true) => money(cents / 100, locale, { cents: cents2 });
  const refresh = () => { void client.invalidateQueries({ queryKey: ["job", jobId] }); void client.invalidateQueries({ queryKey: ["jobs"] }); if (docId) void client.invalidateQueries({ queryKey: ["contract", docId] }); };
  const header = (more?: () => void) => <Header title={co ? co.number : ""} subtle backLabel={c("back")} onBack={back} moreLabel={c("more")} onMore={more} />;

  if (job.error instanceof ApiFailure && job.error.status === 404 || (detail && coId && !co)) {
    return <Screen>{header()}<Section pt={26} px={16}><Empty icon="pen" iconTone="indigo" title={c("notFound.title")} body={c("notFound.body")} action={c("notFound.action")} onAction={toJob} /></Section></Screen>;
  }
  if (job.isError && !detail) {
    return <Screen>{header()}<Section pt={26} px={16}><Empty icon="warn" iconTone="clay" title={c("loadFailed.title")} body={c("loadFailed.body")} action={c("loadFailed.retry")} onAction={() => void job.refetch()} /></Section></Screen>;
  }
  if (!detail) return <Screen>{header()}<Section pt={14} px={20} gap={12}><Skeleton width={200} height={28} radius={8} /><Skeleton height={44} radius={14} /><Skeleton height={140} radius={22} /></Section></Screen>;

  const j = detail.job;
  const clientName = j.client?.name ?? "";
  const step: Step = co ? (editing && co.status === "draft" ? "describe" : stepOf(co)) : phase;

  const upsert = async (next: { title: string; description: string; lines: Line[]; days: number }) => {
    const items = itemsOf(next.lines);
    if (!next.title.trim() || !items.length) return null;
    const body = { title: next.title.trim(), description: next.description.trim(), items, scheduleDeltaDays: next.days };
    try {
      if (co) {
        await changeOrderApi.update(j.id, co.id, body);
        refresh();
        return co.id;
      }
      const r = await changeOrderApi.create(j.id, body);
      setCoId(r.changeOrder.id);
      refresh();
      return r.changeOrder.id;
    } catch (e) {
      toast({ message: e instanceof ApiFailure && e.code === "NO_CONTRACT" ? c("review.noContract") : c("review.saveFailed") });
      return null;
    }
  };

  const talk = async () => {
    const r = await dictation.toggle();
    if (!r) return;
    if (!r.ok) { toast({ message: r.problem === "denied" ? c("describe.micDenied") : r.problem === "unavailable" ? c("describe.noMic") : c("describe.heardNothing") }); return; }
    if (!r.text.trim()) { toast({ message: c("describe.heardNothing") }); return; }
    setText((x) => (x ? `${x} ${r.text.trim()}` : r.text.trim()));
  };

  const write = async () => {
    if (!text.trim()) { toast({ message: c("describe.needText") }); return; }
    setBusy("write");
    let t2 = title.trim();
    let drafted: Line[] = lines;
    let d2 = days;
    let note: string | null = null;
    if (!lines.length) {
      try {
        const r = await changeOrderApi.draft(j.id, text.trim(), lang);
        const prop = r.proposals.find((p) => p.kind === "change_order" && p.status === "pending") ?? r.proposals.find((p) => p.kind === "change_order");
        const parsed = prop ? proposalLines(prop.payload) : null;
        if (parsed) { drafted = parsed.lines; d2 = parsed.days; t2 = t2 || parsed.title; note = c("review.draftedBy"); }
        else note = c("review.draftFailed");
        if (prop) void changeOrderApi.dismissProposal(prop.id).catch(() => undefined);
      } catch {
        note = c("review.draftFailed");
      }
    }
    if (!t2) t2 = text.trim().split(/\s+/).slice(0, 6).join(" ");
    setTitle(t2); setLines(drafted); setDays(d2); setNotice(note);
    await upsert({ title: t2, description: text, lines: drafted, days: d2 });
    setBusy(null);
    setEditing(false);
    setPhase("review");
  };

  const saveLines = async (next: Line[], nextDays = days) => {
    setLines(next); setDays(nextDays);
    await upsert({ title, description: text, lines: next, days: nextDays });
  };

  const send = async () => {
    if (!co?.documentContractId && !coId) return;
    const name = user?.name?.trim();
    if (!name || !j.client?.email) { toast({ message: c("review.noEmail") }); return; }
    setBusy("send");
    try {
      const saved = (await upsert({ title, description: text, lines, days })) ?? co?.id;
      if (!saved) return;
      const fresh = await jobsApi.get(j.id);
      client.setQueryData(["job", j.id], fresh);
      const doc = fresh.changeOrders.find((x) => x.id === saved)?.documentContractId;
      if (!doc) return;
      await changeOrderApi.sign(doc, name);
      await changeOrderApi.send(doc);
      setEditing(false);
      refresh();
    } catch (e) {
      toast({ message: e instanceof ApiFailure && e.code === "CUSTOMER_EMAIL_MISSING" ? c("review.noEmail") : c("review.saveFailed") });
    } finally {
      setBusy(null);
    }
  };

  const remind = async () => {
    if (!docId) return;
    setBusy("remind");
    try { await changeOrderApi.send(docId); toast({ message: c("sent.reminded") }); refresh(); } catch { toast({ message: c("sent.remindFailed") }); } finally { setBusy(null); }
  };

  const removeDraft = async () => {
    setMenu(false);
    if (!co) { back(); return; }
    try { await changeOrderApi.remove(j.id, co.id); refresh(); toJob(); } catch { toast({ message: c("deleteFailed") }); }
  };
  const voidIt = async () => {
    setMenu(false);
    if (!docId) return;
    try { await api(`/api/contracts/${encodeURIComponent(docId)}/void`, { method: "POST", body: {} }); refresh(); } catch { toast({ message: c("deleteFailed") }); }
  };

  const split = (cents: number) => { const v = m(cents); const k = v.search(/[.,]\d\d(?: \$)?$/); return k > 0 ? ([v.slice(0, k), v.slice(k)] as const) : ([v, ""] as const); };
  const dayText = (n: number) => (n > 0 ? c("review.days", { count: n }) : n < 0 ? c("review.daysLess", { count: n }) : c("review.noDays"));
  const totals = co ?? null;
  const contractNumber = j.contract?.contractNumber ?? "";
  const clientRow = (
    <Stack row align="center" gap={10} mt={12}>
      <Avatar initials={initialsOf(clientName || j.name)} tint={tintFor(clientName || j.name)} size={32} />
      <Stack grow>
        <Text size={14.5} weight={500} numberOfLines={1}>{j.name}</Text>
        <Text size={12.5} color="muted" numberOfLines={1}>{[clientName, contractNumber].filter(Boolean).join(" · ")}</Text>
      </Stack>
    </Stack>
  );

  const stepsBar = <StepsBar steps={STEPS.map((s) => c(`steps.${s}`))} current={STEPS.indexOf(step)} label={c("stepsLabel")} />;
  const customer = contract.data?.contract.signers.find((s) => s.role === "customer");
  const sentAt = contract.data?.contract.sentAt ? new Date(contract.data.contract.sentAt) : null;
  const when = (d: Date | null, a: string, b: string) => (d ? (d.toDateString() === now.toDateString() ? c(a, { time: time(d, locale) }) : c(b, { date: shortDate(d, locale), time: time(d, locale) })) : "");

  // ── Describe ───────────────────────────────────────────────────────────────
  if (step === "describe") {
    return (
      <Screen>
        {header(co ? () => setMenu(true) : undefined)}
        {stepsBar}
        <ScrollPage bottom={130}>
          <Section px={20} pt={14}>
            <Text size={24} weight={600} tracking={-0.035} leading={1.2} accessibilityRole="header">{c("describe.title")}</Text>
            {clientRow}
          </Section>
          <Section delay={50} px={16} pt={16}>
            <Segmented label={c("describe.how")} options={[c("describe.talk"), c("describe.type")]} value={mode} onChange={setMode} />
          </Section>
          <Section delay={80} px={16} pt={12}>
            {mode === 0 ? (
              <MicCard listening={dictation.state === "listening"} busy={dictation.state === "busy"} label={dictation.state === "listening" ? c("describe.stop") : c("describe.start")} onPress={() => void talk()}
                title={dictation.state === "listening" ? c("describe.listening") : text ? c("describe.gotIt") : c("describe.tapToTalk")} sub={text ? c("describe.addMore") : c("describe.sayIt")} heard={text || undefined} />
            ) : (
              <TextField label={c("describe.describeLabel")} value={text} onChangeText={setText} multiline />
            )}
          </Section>
          <Section delay={110} px={16} pt={12}>
            <TextField label={c("describe.titleLabel")} value={title} onChangeText={setTitle} placeholder={c("describe.titlePlaceholder")} />
          </Section>
        </ScrollPage>
        <BottomBar>
          <Button size="lg" grow label={c("describe.write")} busy={busy === "write" ? c("describe.writing") : false} disabled={!text.trim()} onPress={() => void write()} />
        </BottomBar>
        <Sheet open={menu} onClose={() => setMenu(false)} label={c("more")} closeLabel={t("close")}>
          <SheetTitle>{co?.number ?? ""}</SheetTitle>
          <MenuList><MenuRow icon={<Icon name="box" tone="stone" size={28} />} title={c("menu.delete")} chevron={false} onPress={() => void removeDraft()} /></MenuList>
        </Sheet>
      </Screen>
    );
  }

  // ── Review ─────────────────────────────────────────────────────────────────
  if (step === "review") {
    const baseNow = detail.job.totalValueCents;
    const newTotal = totals ? baseNow + totals.totalCents : baseNow;
    const [whole, cents] = totals ? split(totals.totalCents) : (["–", ""] as const);
    const ok = canWrite(title, lines) && !!j.client?.email;
    return (
      <Screen>
        {header(() => setMenu(true))}
        {stepsBar}
        <ScrollPage bottom={130}>
          <Section px={20} pt={14}>
            <Stack row align="center" gap={8}>
              <Status tone="mute" shape="draft">{c("review.draft")}</Status>
              {contractNumber ? <Text size={12.5} color="muted">{c("review.addsTo", { number: contractNumber })}</Text> : null}
            </Stack>
            <Stack mt={10}><Text size={24} weight={600} tracking={-0.035} leading={1.2} accessibilityRole="header">{title}</Text></Stack>
            <Stack mt={4}><Text size={13.5} color="muted">{[j.name, clientName].filter(Boolean).join(" · ")}</Text></Stack>
          </Section>
          {notice ? <Section px={16} pt={12}><Banner tone="info" icon="spark" iconTone="violet" lead={notice} /></Section> : null}
          <Section delay={50} px={16} pt={16}>
            <Card>
              <Stack px={16} pt={16} pb={14} gap={5}>
                <Text size={12.5} color="muted">{c("review.thisChange")}</Text>
                <BigAmount whole={totals ? `+${whole}` : whole} cents={cents} />
              </Stack>
              <Summary cells={[{ label: c("review.contractNow"), value: m(baseNow, false) }, { label: c("review.newTotal"), value: totals ? m(newTotal, false) : "–" }, { label: c("review.schedule"), value: dayText(days) }]} />
            </Card>
          </Section>
          <Section delay={90} px={16} pt={22}>
            <SectionHeader title={c("review.lines")} link={c("review.addLine")} onLink={() => setLineOpen(newLine())} />
            {lines.length ? (
              <Card>
                <RowList>
                  {lines.map((l) => (
                    <LineRow key={l.key} name={l.description || "…"} detail={l.qty !== 1 || l.unit ? `${number(l.qty, locale, Number.isInteger(l.qty) ? 0 : 1)}${l.unit ? ` ${l.unit}` : ""} × ${money(l.unitPrice, locale)}` : undefined} amount={money(lineTotal(l), locale)} onPress={() => setLineOpen(l)} />
                  ))}
                </RowList>
                {totals ? <LinesFooter subtotalLabel={c("review.subtotal")} subtotal={m(totals.subtotalCents)} taxLabel={c("review.tax")} tax={m(totals.taxCents)} totalLabel={c("review.total")} total={m(totals.totalCents)} />
                  : <LinesFooter subtotalLabel={c("review.subtotal")} subtotal={money(subtotal(lines), locale)} taxLabel={c("review.tax")} tax="–" totalLabel={c("review.total")} total="–" />}
              </Card>
            ) : <Card padded><Text size={13.5} color="muted">{c("review.noLines")}</Text></Card>}
          </Section>
          <Section delay={120} px={16} pt={22}>
            <SectionHeader title={c("review.scheduleTitle")} link={days > 0 ? c("review.addsDays", { count: days }) : c("review.addsNone")} />
            <Card padded>
              <Stack row align="center" justify="space-between">
                <Text size={14.5} weight={500}>{dayText(days)}</Text>
                <MiniStepper decLabel={c("review.lessDay")} incLabel={c("review.moreDay")} onDec={() => void saveLines(lines, Math.max(-365, days - 1))} onInc={() => void saveLines(lines, Math.min(365, days + 1))} />
              </Stack>
            </Card>
          </Section>
          <Section delay={150} px={16} pt={22}>
            <SectionHeader title={c("review.billed")} />
            <Card><RadioRow selected onPress={() => undefined} title={c("review.billNext")} sub={c("review.billNextSub")} /></Card>
          </Section>
          <Section delay={180} px={16} pt={22}>
            <SectionHeader title={c("review.sendTo")} />
            <Card>
              <Stack row align="center" gap={12} px={16} pt={12} pb={12}>
                <Avatar initials={initialsOf(clientName)} tint={tintFor(clientName)} size={34} />
                <Stack grow gap={2}>
                  <Text size={14.5} weight={500} numberOfLines={1}>{clientName}</Text>
                  <Text size={12.5} color="muted" numberOfLines={1}>{j.client?.email || c("review.noEmail")}</Text>
                </Stack>
              </Stack>
            </Card>
            <Stack row gap={6} mt={10}><Chip label={c("review.email")} selected glyph="check" /></Stack>
            <Stack mt={10}><Text size={12.5} color="muted" leading={1.4}>{c("review.signNote", { name: user?.name ?? "" })}</Text></Stack>
          </Section>
        </ScrollPage>
        <BottomBar>
          <Button kind="secondary" size="lg" label={c("review.edit")} onPress={() => { setEditing(true); setPhase("describe"); }} />
          <Button size="lg" grow label={c("review.send")} busy={busy === "send" ? c("review.sending") : false} disabled={!ok} onPress={() => void send()} />
        </BottomBar>
        <Sheet open={menu} onClose={() => setMenu(false)} label={c("more")} closeLabel={t("close")}>
          <SheetTitle>{co?.number ?? title}</SheetTitle>
          <MenuList><MenuRow icon={<Icon name="box" tone="stone" size={28} />} title={c("menu.delete")} chevron={false} onPress={() => void removeDraft()} /></MenuList>
        </Sheet>
        <LineSheet line={lineOpen} onClose={() => setLineOpen(null)} locale={locale} labels={{ title: c("review.lineSheet"), description: c("review.lineDescription"), qty: c("review.lineQty"), unit: c("review.lineUnit"), price: c("review.linePrice"), save: c("review.lineSave"), remove: c("review.lineDelete"), close: t("close") }}
          exists={lineOpen ? lines.some((l) => l.key === lineOpen.key) : false}
          onSave={(l) => { const next = lines.some((x) => x.key === l.key) ? lines.map((x) => (x.key === l.key ? l : x)) : [...lines, l]; setLineOpen(null); void saveLines(next); }}
          onRemove={(l) => { setLineOpen(null); void saveLines(lines.filter((x) => x.key !== l.key)); }} />
      </Screen>
    );
  }

  // ── Sent (also declined and voided) ────────────────────────────────────────
  if (step === "sent" && co) {
    const cn = contractNow(detail.job.totalValueCents, co);
    const pill = co.status === "declined" ? { tone: "bad" as const, shape: "x" as const, word: c("sent.declined") } : co.status === "voided" ? { tone: "mute" as const, shape: "off" as const, word: c("sent.voided") } : { tone: "warn" as const, shape: "clock" as const, word: c("sent.awaiting") };
    const opened = customer?.viewedAt ? new Date(customer.viewedAt) : null;
    const [bigW] = split(co.totalCents);
    return (
      <Screen>
        {header(co.status === "sent" ? () => setMenu(true) : undefined)}
        {stepsBar}
        <ScrollPage bottom={130}>
          <Hero title={c("sent.sentTo", { name: clientName })} sub={sentAt ? when(sentAt, "sent.at", "sent.atDate") : ""}><Status tone={pill.tone} shape={pill.shape}>{pill.word}</Status></Hero>
          {co.status === "declined" ? <Section px={16} pt={14}><Banner tone="bad" icon="warn" iconTone="rose" lead={c("sent.declinedLead", { name: clientName })} /></Section> : co.status === "voided" ? <Section px={16} pt={14}><Banner tone="info" icon="warn" iconTone="amber" lead={c("sent.voidedLead")} /></Section> : null}
          <Section delay={50} px={16} pt={20}>
            <Card>
              <Stack row align="center" justify="space-between" gap={12} px={16} pt={14} pb={14}>
                <Stack grow gap={2}><Text size={14.5} weight={500}>{co.title}</Text><Text size={12.5} color="muted">{`${co.number} · ${co.scheduleDeltaDays > 0 ? c("sent.adds", { days: c("review.days", { count: co.scheduleDeltaDays }) }) : c("sent.addsNone")}`}</Text></Stack>
                <Num size={15} weight={600}>{`+${bigW}${split(co.totalCents)[1]}`}</Num>
              </Stack>
              <Summary cells={[{ label: c("review.contractNow"), value: m(cn.now, false) }, { label: c("sent.ifSigned"), value: m(cn.after, false) }, { label: c("sent.finish"), value: j.plannedEnd ? shortDate(new Date(j.plannedEnd.slice(0, 10) + "T12:00:00"), locale) : "–" }]} />
            </Card>
          </Section>
          <Section delay={110} px={16} pt={22}>
            <SectionHeader title={c("sent.progress")} />
            <Card padded>
              <TrackItem done last={false} text={c("sent.sentRow", { name: clientName })} when={sentAt ? time(sentAt, locale) : ""} sub={c("sent.sentSub")} />
              {(contract.data?.contract.reminderCount ?? 0) > 0 ? <TrackItem done last={false} text={c("sent.reminder")} when="" sub={c("sent.reminderSub")} /> : null}
              <TrackItem done={!!opened} last={false} text={opened ? c("sent.opened") : c("sent.opens")} when={opened ? time(opened, locale) : c("sent.waiting")} sub={opened ? c("sent.openedSub", { name: clientName }) : c("sent.notify")} />
              <TrackItem done={false} last text={c("sent.signs")} when={c("sent.waiting")} sub={c("sent.signsSub")} />
            </Card>
          </Section>
        </ScrollPage>
        <BottomBar>
          {co.status === "sent" ? <Button size="lg" grow label={busy === "remind" ? c("sent.reminded") : c("sent.remind", { name: clientName.split(" ")[0] ?? "" })} busy={busy === "remind" ? c("review.sending") : false} onPress={() => void remind()} />
            : <Button size="lg" grow label={c("signed.back")} onPress={toJob} />}
        </BottomBar>
        <Sheet open={menu} onClose={() => setMenu(false)} label={c("more")} closeLabel={t("close")}>
          <SheetTitle>{co.number}</SheetTitle>
          <MenuList><MenuRow icon={<Icon name="box" tone="stone" size={28} />} title={c("menu.void")} chevron={false} onPress={() => void voidIt()} /></MenuList>
        </Sheet>
      </Screen>
    );
  }

  // ── Signed ─────────────────────────────────────────────────────────────────
  if (co) {
    const cn = contractNow(detail.job.totalValueCents, co);
    const signedAt = contract.data?.contract.signedAt ? new Date(contract.data.contract.signedAt) : co.signedAt ? new Date(co.signedAt) : null;
    const who = customer?.name || clientName;
    return (
      <Screen>
        {header()}
        {stepsBar}
        <ScrollPage bottom={130}>
          <Hero title={c("signed.by", { name: who })} sub={signedAt ? when(signedAt, "signed.at", "signed.atDate") : ""}><Status tone="ok" shape="check">{c("signed.pill")}</Status></Hero>
          <Section delay={50} px={16} pt={20}>
            <Card padded>
              <Stack row justify="space-between" gap={12} align="center">
                <Text size={14.5} weight={500} style={{ flexShrink: 1 }}>{co.title}</Text>
                <Num size={15} weight={600}>{`+${m(co.totalCents)}`}</Num>
              </Stack>
              <Stack mt={10}><Text size={12.5} color="muted">{c("signed.pdf")}</Text></Stack>
            </Card>
          </Section>
          <Section delay={90} px={16} pt={22}>
            <SectionHeader title={c("signed.updated")} />
            <Card>
              <CompareRow title={c("signed.contractValue")} sub={c("signed.contractSub", { number: contractNumber })} was={m(cn.now, false)} now={m(cn.after, false)} />
              {co.scheduleDeltaDays !== 0 ? <CompareRow title={c("signed.schedule")} sub={c("signed.scheduleSub", { count: Math.abs(co.scheduleDeltaDays) })} now={dayText(co.scheduleDeltaDays)} /> : null}
            </Card>
          </Section>
        </ScrollPage>
        <BottomBar><Button size="lg" grow label={c("signed.back")} onPress={toJob} /></BottomBar>
      </Screen>
    );
  }
  return null;
}

function LineSheet({ line, onClose, onSave, onRemove, exists, locale, labels }: {
  line: Line | null; onClose: () => void; onSave: (l: Line) => void; onRemove: (l: Line) => void; exists: boolean; locale: Locale;
  labels: { title: string; description: string; qty: string; unit: string; price: string; save: string; remove: string; close: string };
}) {
  const [desc, setDesc] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("");
  const [price, setPrice] = useState("");
  useEffect(() => {
    if (!line) return;
    setDesc(line.description); setQty(String(line.qty)); setUnit(line.unit); setPrice(line.unitPrice ? String(line.unitPrice) : "");
  }, [line?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const num = (s: string) => Number(s.replace(",", "."));
  const valid = desc.trim().length > 0 && Number.isFinite(num(price)) && num(qty) > 0;
  return (
    <Sheet open={!!line} onClose={onClose} label={labels.title} closeLabel={labels.close}>
      <SheetTitle>{labels.title}</SheetTitle>
      <Stack px={20} gap={14} pb={20}>
        <TextField label={labels.description} value={desc} onChangeText={setDesc} autoFocus />
        <Stack row gap={10}>
          <Stack grow><TextField label={labels.qty} value={qty} onChangeText={setQty} numeric keyboardType="decimal-pad" /></Stack>
          <Stack grow><TextField label={labels.unit} value={unit} onChangeText={setUnit} /></Stack>
        </Stack>
        <TextField label={labels.price} value={price} onChangeText={setPrice} numeric keyboardType="decimal-pad" placeholder={locale === "fr-CA" ? "0,00" : "0.00"} />
        <Button label={labels.save} block disabled={!valid} onPress={() => line && onSave({ ...line, description: desc.trim(), qty: num(qty), unit: unit.trim(), unitPrice: num(price) })} />
        {exists && line ? <Button kind="link" label={labels.remove} block onPress={() => onRemove(line)} /> : null}
      </Stack>
    </Sheet>
  );
}

