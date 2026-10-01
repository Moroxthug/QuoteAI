// JobSetup.dc.html. "Review the plan": the job's name, the client and the two figures, the milestones (move up, delete with Undo,
// add), "shift everything to start on" (chips and a date sheet), the cost budget with a stepper for each category and the
// projected margin. "Looks good, start the job" confirms the plan; on a job that is already running the same screen saves changes.
// Opened with `id` (a job), or with `quoteId` (the job for that quote is made, or found, and opened) or with neither (a blank job).
// States built: loading, can't load, not found, the plan (waiting for review or running), saving, started. Not on the board: the
// "more" menu (rebuild the plan from the contract) and the plan-limit message.
import { useEffect, useMemo, useRef, useState } from "react";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiFailure } from "@/lib/api";
import { dateRange, money, shortDate, type Locale } from "@/lib/format";
import { tintFor } from "@/lib/clients";
import { initialsOf } from "@/lib/invites";
import type { CostCategory } from "@/lib/jobDetail";
import { jobsApi } from "@/lib/jobsApi";
import { TARGET_MARGIN_PCT, addWork, budgetRows, draftFrom, isoDay, layout, margin, newMilestone, parseDay, setupBody, shares, startOptions, stepCents, window as windowOf, type BudgetRow, type DraftMilestone } from "@/lib/jobSetup";
import { screenHref } from "@/lib/nav";
import { useSession } from "@/lib/useSession";
import { ActionBar, ACTION_BAR_SPACE } from "@/ui/ActionBar";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Chip } from "@/ui/Chip";
import { DateSheet } from "@/ui/DateSheet";
import { Empty, Skeleton, useToast } from "@/ui/Feedback";
import { TextField } from "@/ui/Field";
import { Header } from "@/ui/Header";
import { Glyph, Icon } from "@/ui/Icon";
import { BudgetRow as BudgetLine, ClientFigures, MarginCard, MilestoneRow, SetupIntro, ShiftCard } from "@/ui/JobSetup";
import { Section, ScrollPage, Stack } from "@/ui/Layout";
import { MenuList, MenuRow, RowList, SectionHeader } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { Num, Text } from "@/ui/Text";

export default function JobSetup() {
  const { t, i18n } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`jobSetup.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { id: idParam, quoteId } = useLocalSearchParams<{ id?: string; quoteId?: string }>();
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const toast = useToast();
  const client = useQueryClient();
  const [id, setId] = useState<string | undefined>(idParam);
  const [makeFailed, setMakeFailed] = useState<string | null>(null);
  const making = useRef(false);

  // No job yet: make (or find) it, then carry on with its id.
  useEffect(() => {
    if (id || !signedIn || making.current) return;
    making.current = true;
    jobsApi.create(quoteId ? { name: s("newMilestone"), quoteId } : { name: t("jobs.newJob") })
      .then((r) => { setId(r.job.id); void client.invalidateQueries({ queryKey: ["jobs"] }); })
      .catch((e) => setMakeFailed(e instanceof ApiFailure && e.code === "JOB_LIMIT" ? "limit" : "failed"));
  }, [id, signedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = useQuery({ queryKey: ["job", id], queryFn: () => jobsApi.get(id!), enabled: signedIn && !!id, retry: 1, staleTime: 15_000 });
  const detail = q.data;
  const [name, setName] = useState("");
  const [list, setList] = useState<DraftMilestone[]>([]);
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [removed, setRemoved] = useState<{ m: DraftMilestone; at: number } | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const seeded = useRef<string | null>(null);
  const counter = useRef(0);

  useEffect(() => {
    if (!detail || seeded.current === detail.job.id) return;
    seeded.current = detail.job.id;
    setName(detail.job.name);
    setList(draftFrom(detail));
    setRows(budgetRows(detail));
  }, [detail]);

  const today = useMemo(() => new Date(), []);
  const win = useMemo(() => windowOf(list), [list]);
  const pcts = useMemo(() => shares(list), [list]);
  if (status === "out") return <Redirect href="/" />;

  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("Jobs", t("tabs.jobs"))));
  const m = (cents: number, withCents = true) => money(cents / 100, locale, { cents: withCents });
  const pctText = (n: number) => (locale === "fr-CA" ? `${n} %` : `${n}%`);
  const header = (more?: () => void) => <Header title={s("title")} backLabel={s("back")} onBack={back} moreLabel={s("more")} onMore={more} />;

  if (makeFailed) {
    return (
      <Screen>{header()}<Section pt={26} px={16}>
        <Empty icon="warn" iconTone="clay" title={s("loadFailed.title")} body={makeFailed === "limit" ? s("limit", { limit: "" }).replace("  ", " ") : s("loadFailed.body")}
          action={s("notFound.action")} onAction={back} /></Section></Screen>
    );
  }
  const failed = q.isError && !detail;
  const notFound = q.error instanceof ApiFailure && q.error.status === 404;
  if (notFound) return <Screen>{header()}<Section pt={26} px={16}><Empty icon="cone" iconTone="amber" title={s("notFound.title")} body={s("notFound.body")} action={s("notFound.action")} onAction={back} /></Section></Screen>;
  if (failed) return <Screen>{header()}<Section pt={26} px={16}><Empty icon="warn" iconTone="clay" title={s("loadFailed.title")} body={s("loadFailed.body")} action={s("loadFailed.retry")} onAction={() => void q.refetch()} /></Section></Screen>;
  if (!detail || seeded.current !== detail.job.id) {
    return <Screen>{header()}<Section pt={20} px={20} gap={12}><Skeleton width={160} height={14} radius={6} /><Skeleton height={30} radius={8} /><Skeleton height={140} radius={22} /><Skeleton height={260} radius={22} /></Section></Screen>;
  }

  const job = detail.job;
  const pending = job.setupStatus === "pending_review";
  const costs = rows.reduce((n, r) => n + r.cents, 0);
  const mg = margin(job.contractValueCents, costs);
  const step = stepCents(job.contractValueCents);
  const deposit = detail.invoices.find((i) => i.type === "deposit" && i.paidCents > 0);
  const options = startOptions(today);

  const topLine = (() => {
    if (job.contract?.signedAt) return s("signed", { date: shortDate(new Date(job.contract.signedAt), locale), number: job.contract.contractNumber });
    if (job.quote && pending) return s("won", { date: shortDate(new Date(job.createdAt), locale), number: job.quote.number });
    return s("started", { date: shortDate(new Date(job.createdAt), locale) });
  })();

  /** Dates follow the order: lay the list out again from where it starts (or from the chosen day). */
  const relayout = (next: DraftMilestone[], from?: Date | null): DraftMilestone[] => {
    const start = from ?? (picked ? parseDay(picked) : windowOf(next)?.from ?? (next.some((x) => x.start) ? null : null));
    return start ? layout(next, start) : next;
  };
  const edit = (next: DraftMilestone[]) => { setList(next); setDone(false); };

  const moveUp = (i: number) => { if (i === 0) return; const o = list.slice(); o.splice(i - 1, 0, o.splice(i, 1)[0]!); edit(relayout(o, windowOf(list)?.from)); };
  const del = (i: number) => { const o = list.slice(); const [gone] = o.splice(i, 1); setRemoved({ m: gone!, at: i }); edit(relayout(o, windowOf(list)?.from)); };
  const undo = () => { if (!removed) return; const o = list.slice(); o.splice(removed.at, 0, removed.m); setRemoved(null); edit(relayout(o, windowOf(list)?.from)); };
  const add = () => {
    const last = list[list.length - 1];
    const startsAfter = last?.end ? addWork(parseDay(last.end), 1) : null;
    const created = { ...newMilestone(s("newMilestone"), `new-${++counter.current}`) };
    edit(startsAfter ? layout([...list, created], windowOf(list)!.from) : [...list, created]);
  };
  const shift = (d: Date) => { setPicked(isoDay(d)); edit(layout(list, d)); };
  const bump = (cat: CostCategory, dir: 1 | -1) => { setRows(rows.map((r) => (r.category === cat ? { ...r, cents: Math.max(0, r.cents + dir * step) } : r))); setDone(false); };

  const body = () => setupBody({ name, plannedStart: win ? isoDay(win.from) : null, milestones: list, budget: rows });
  const run = async () => {
    setBusy(true);
    try {
      const saved = pending ? await jobsApi.confirmSetup(job.id, body()) : await jobsApi.saveSetup(job.id, body());
      client.setQueryData(["job", job.id], saved);
      void client.invalidateQueries({ queryKey: ["jobs"] });
      setDone(true);
      setTimeout(() => router.replace(screenHref("Job", saved.job.name, { id: job.id })), 700);
    } catch (e) {
      toast({ message: e instanceof ApiFailure && e.code === "JOB_LIMIT" ? s("limit", { limit: (e as ApiFailure & { limit?: number }).limit ?? "" }) : s("saveFailed") });
    } finally {
      setBusy(false);
    }
  };

  const regenerate = async () => {
    setMenu(false);
    try {
      const fresh = await jobsApi.regenerateSetup(job.id);
      client.setQueryData(["job", job.id], fresh);
      seeded.current = null;
      setRemoved(null); setPicked(null); setDone(false);
      setName(fresh.job.name); setList(draftFrom(fresh)); setRows(budgetRows(fresh));
      seeded.current = fresh.job.id;
      toast({ message: s("regenerated") });
    } catch {
      toast({ message: s("saveFailed") });
    }
  };

  const window2 = win ? dateRange(win.from, win.to, locale) : "–";
  const canStart = name.trim().length > 0 && list.every((x) => x.title.trim().length > 0);
  const noteFor = (r: BudgetRow) => r.note || (r.category === "subcontractor" ? s("noneYet.subcontractor") : r.category === "permits_fees" ? s("noneYet.permits_fees") : "");

  return (
    <Screen floating={<ActionBar label={done ? (pending ? s("started2") : s("saved")) : busy ? s("saving") : pending ? s("start") : s("save")} done={done} busy={busy} disabled={!canStart} onPress={() => void run()} moreLabel={s("more")} onMore={() => setMenu(true)} />}>
      {header(() => setMenu(true))}
      <ScrollPage bottom={ACTION_BAR_SPACE}>
        <Section px={20} pt={8}>
          <SetupIntro line={topLine} heading={pending ? s("heading") : s("headingRunning")} intro={pending ? s("intro") : s("introRunning")} />
        </Section>

        <Section delay={50} pt={18} px={16}>
          <TextField label={s("name")} value={name} onChangeText={(v) => { setName(v); setDone(false); }} autoCapitalize="sentences" />
          <ClientFigures avatar={<Avatar initials={initialsOf(job.client?.name ?? job.name)} tint={tintFor(job.client?.name ?? job.name)} size={34} />} name={job.client?.name ?? "–"} address={job.address || undefined} cells={[
            { label: s("contractValue"), value: <Num size={19} weight={600} tracking={-0.03}>{m(job.contractValueCents)}</Num>, sub: deposit ? s("depositPaid", { amount: m(deposit.paidCents, false) }) : s("noDeposit") },
            { label: s("window"), value: <Num size={19} weight={600} tracking={-0.03}>{window2}</Num>, sub: win ? s("windowSub", { count: win.days }) : s("noWindow") },
          ]} />
        </Section>

        <Section delay={100} pt={24} px={16}>
          <SectionHeader title={s("milestones")} link={`${s("milestonesCount", { count: list.length })} · ${s("ofWork")}`} />
          {list.length ? (
            <Card>
              <RowList>
                {list.map((x, i) => (
                  <MilestoneRow key={x.key} title={x.title}
                    meta={[s("tasks", { count: x.tasks }), s("shareOfWork", { pct: pctText(pcts[i] ?? 0) }), x.start && x.end ? dateRange(parseDay(x.start), parseDay(x.end), locale) : ""].filter(Boolean).join(" · ")}
                    term={x.term ? `${x.term.label} · ${m(x.term.amountCents, false)}` : s("noPayment")} hasTerm={!!x.term}
                    upLabel={s("moveUp", { title: x.title })} onUp={() => moveUp(i)} canUp={i > 0} delLabel={s("delete", { title: x.title })} onDelete={() => del(i)} />
                ))}
              </RowList>
            </Card>
          ) : null}
          <Stack row gap={8} mt={10}>
            <Button kind="secondary" size="md" grow label={s("add")} icon={<Glyph name="plus" size={14} weight={2.4} />} onPress={add} />
            {removed ? <Button kind="secondary" size="md" label={s("undo")} onPress={undo} /> : null}
          </Stack>
        </Section>

        <Section delay={140} pt={14} px={16}>
          <ShiftCard title={s("shift")} sub={s("shiftSub")}>
              {options.map((d) => <Chip key={isoDay(d)} label={new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric" }).format(d).replace(/,/g, "")} selected={picked === isoDay(d)} onPress={() => shift(d)} />)}
              <Chip label={s("pickDate")} onPress={() => setDateOpen(true)} />
          </ShiftCard>
        </Section>

        <Section delay={180} pt={24} px={16}>
          <SectionHeader title={s("budget")} link={s("budgetFrom")} />
          <Card>
            <RowList>
              {rows.map((r) => (
                <BudgetLine key={r.category} name={s(`categories.${r.category}`)} note={noteFor(r)} amount={m(r.cents, false)} zero={r.cents === 0}
                  decLabel={s("less", { name: s(`categories.${r.category}`) })} incLabel={s("more2", { name: s(`categories.${r.category}`) })}
                  onDec={() => bump(r.category, -1)} onInc={() => bump(r.category, 1)} canDec={r.cents > 0} />
              ))}
            </RowList>
          </Card>
          <Stack mt={12}>
            <MarginCard valueLabel={s("contractValue")} value={m(job.contractValueCents)} costsLabel={s("expected")} costs={m(costs)} title={s("margin")}
              note={mg.pct >= TARGET_MARGIN_PCT ? s("above", { pct: pctText(TARGET_MARGIN_PCT) }) : s("below", { pct: pctText(TARGET_MARGIN_PCT) })} noteTone={mg.pct >= TARGET_MARGIN_PCT ? "ok" : "warn"}
              pct={pctText(mg.pct)} amount={m(mg.cents)} fill={mg.pct >= TARGET_MARGIN_PCT ? "ok-dot" : "warn-dot"} bar={Math.max(0, Math.min(1, mg.pct / 100))} />
          </Stack>
        </Section>
      </ScrollPage>

      <DateSheet open={dateOpen} onClose={() => setDateOpen(false)} title={s("pickTitle")} closeLabel={t("close")} prevLabel={s("prevMonth")} nextLabel={s("nextMonth")} locale={locale}
        value={picked ? parseDay(picked) : win?.from ?? null} min={today} onPick={shift} />
      <Sheet open={menu} onClose={() => setMenu(false)} label={s("menu.title")} closeLabel={t("close")}>
        <SheetTitle>{s("menu.title")}</SheetTitle>
        <MenuList>
          {pending && job.contractId ? <MenuRow icon={<Icon name="sync" tone="violet" size={28} />} title={s("menu.regenerate")} sub={s("menu.regenerateSub")} onPress={() => void regenerate()} chevron={false} /> : null}
          {!pending ? <MenuRow icon={<Icon name="list" tone="violet" size={28} />} title={s("menu.openJob")} onPress={() => { setMenu(false); router.replace(screenHref("Job", job.name, { id: job.id })); }} /> : null}
        </MenuList>
      </Sheet>
    </Screen>
  );
}

