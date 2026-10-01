// Jobs.dc.html. The tab: today's three figures (an expandable card), filter chips, "receipts to review", then the jobs
// grouped Needs your review / In progress / Planning / On hold / Completed. Each job opens in place (who is on site, what
// is next, a blocker the crew raised, the figures) with "Open job". A job whose AI setup is waiting is the violet card.
// States built: list, no jobs (also for a filter with none), loading, can't load, offline.
// What the server doesn't hold, so the screen doesn't show it: warranty and review rows on a finished job, the reason a job
// is on hold, a paint-order or deposit row on a job that hasn't started, and "Message client" opens the client instead.
import { useMemo, useState } from "react";
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { dateOnly, daysUntil, clashes, costPct, firstName, FILTER_ORDER, GROUP_ORDER, glance, invoicedPct, jobState, marginPct, matchesFilter, receiptsToReview, toInvoiceCents, type Job, type JobState } from "@/lib/jobs";
import { jobsApi } from "@/lib/jobsApi";
import { money, shortDate, time, weekdayShort, type Locale } from "@/lib/format";
import { initialsOf } from "@/lib/invites";
import { screenHref } from "@/lib/nav";
import { useSession } from "@/lib/useSession";
import type { AvatarTint } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Chip, ChipStrip } from "@/ui/Chip";
import { ExpandCard, ExpandScrollView, XcActions, XcButton, XcCaption, XcDivider, XcRow } from "@/ui/Expand";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { IconButton, TabHeader } from "@/ui/Header";
import { Glyph } from "@/ui/Icon";
import { JobHead, JobStats, ReceiptsRow, SetupCard } from "@/ui/Jobs";
import { Section, Stack } from "@/ui/Layout";
import { Figures } from "@/ui/Numbers";
import { RowList, SectionHeader } from "@/ui/Row";
import { Status, type StatusShape, type StatusTone } from "@/ui/Status";
import { TAB_BAR_SPACE } from "@/ui/TabBar";
import { TabScreen } from "@/ui/TabShell";
import { Num, Text } from "@/ui/Text";

const STATUS: Record<JobState, { tone: StatusTone; shape: StatusShape }> = {
  setup: { tone: "acc", shape: "q2" }, planning: { tone: "info", shape: "q1" }, active: { tone: "ok", shape: "live" }, hold: { tone: "warn", shape: "pause" }, done: { tone: "mute", shape: "check" },
};
const TINTS: AvatarTint[] = [3, 2, 1, 4, 5];
const MAX_ROWS = 5;

export default function Jobs() {
  const { t, i18n } = useTranslation();
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const toast = useToast();
  const client = useQueryClient();
  const jobsQ = useQuery({ queryKey: ["jobs"], queryFn: jobsApi.list, enabled: signedIn, retry: 1, staleTime: 30_000 });
  const dayQ = useQuery({ queryKey: ["crew-today"], queryFn: jobsApi.crewToday, enabled: signedIn, retry: 0, staleTime: 30_000 });
  const [filter, setFilter] = useState<(typeof FILTER_ORDER)[number]>("all");
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const now = useMemo(() => new Date(), [jobsQ.dataUpdatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const all = useMemo(() => jobsQ.data?.items ?? [], [jobsQ.data]);
  const rows = useMemo(() => all.map((j) => ({ j, state: jobState(j) })), [all]);
  const shown = useMemo(() => rows.filter((r) => matchesFilter(r.state, filter)), [rows, filter]);
  const groups = useMemo(() => GROUP_ORDER.map((g) => {
    const items = shown.filter((r) => r.state === g).map((r) => r.j);
    return { key: g, items, total: items.reduce((n, j) => n + j.totalValueCents, 0) / 100 };
  }).filter((g) => g.items.length), [shown]);
  const g = useMemo(() => glance(all), [all]);
  const receipts = useMemo(() => receiptsToReview(all), [all]);
  const day = dayQ.data?.enabled ? dayQ.data : null;
  const clash = useMemo(() => clashes(day?.jobs ?? []), [day]);
  if (status === "out") return <Redirect href="/" />;

  const m = (cents: number, withCents = false) => money(cents / 100, locale, { cents: withCents });
  const pct = (n: number | null) => (n == null ? "–" : locale === "fr-CA" ? `${n} %` : `${n}%`);
  const open = (j: Job) => router.push(screenHref("Job", j.name, { id: j.id }));
  const toQuotes = () => router.push(screenHref("Quotes", t("tabs.quotes")));
  const toInvoices = () => router.push(screenHref("Invoices", t("menu.rows.invoices.label")));
  const newJob = () => router.push(screenHref("JobSetup", t("jobs.newJob")));
  const clientOf = (j: Job) => (j.clientId ? () => router.push(screenHref("Client", j.clientName ?? "", { id: j.clientId! })) : () => open(j));
  const tint = (name: string): AvatarTint => TINTS[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % TINTS.length]!;
  const onSiteOf = (j: Job) => (day?.clockedIn ?? []).filter((c) => c.projectId === j.id);

  const nextLine = (j: Job): string => {
    const s = jobState(j);
    if (s === "done") return j.completedAt ? t("jobs.meta.finished", { date: shortDate(new Date(j.completedAt), locale) }) : t("jobs.status.done");
    if (s === "hold") return t("jobs.meta.onHold");
    if (s === "planning") {
      if (j.plannedStart && j.plannedEnd) return t("jobs.meta.starts", { start: shortDate(dateOnly(j.plannedStart), locale), end: shortDate(dateOnly(j.plannedEnd), locale) });
      return j.plannedStart ? t("jobs.meta.startsOnly", { start: shortDate(dateOnly(j.plannedStart), locale) }) : t("jobs.meta.noDates");
    }
    const n = j.nextMilestone;
    if (!n) return t("jobs.meta.running");
    return n.plannedEnd ? t("jobs.meta.next", { title: n.title, date: shortDate(dateOnly(n.plannedEnd), locale) }) : t("jobs.meta.nextNoDate", { title: n.title });
  };

  const crewNote = (j: Job): string | undefined => {
    const on = onSiteOf(j).length;
    if (on > 0) return t("jobs.crew.onSite", { count: on });
    return j.crew.length === 1 ? firstName(j.crew[0]!.name) : undefined;
  };

  const resolve = async (id: string) => {
    try {
      await jobsApi.resolveBlocker(id);
      setResolved((s) => new Set(s).add(id));
      void client.invalidateQueries({ queryKey: ["crew-today"] });
    } catch {
      toast({ message: t("jobs.resolveFailed") });
    }
  };

  const detail = (j: Job, s: JobState) => {
    const out: React.ReactElement[] = [];
    const on = onSiteOf(j);
    const cap = s === "active" ? (on.length ? t("jobs.caps.onSite") : t("jobs.caps.today")) : s === "planning" ? t("jobs.caps.before") : s === "hold" ? t("jobs.caps.waiting") : t("jobs.caps.after");
    if (s === "active") {
      on.forEach((c) => out.push(<XcRow key={c.entryId} title={c.workerName ?? ""} sub={t("jobs.row.since", { time: time(new Date(c.since), locale) })} right={<Status plain tone="ok" shape="live">{t("jobs.row.onSite")}</Status>} />));
      const n = j.nextMilestone;
      if (n) {
        const late = !!n.plannedEnd && daysUntil(n.plannedEnd, now) < 0;
        out.push(<XcRow key="next" title={t("jobs.row.next", { title: n.title })} sub={n.plannedEnd ? `${weekdayShort(dateOnly(n.plannedEnd), locale)} ${shortDate(dateOnly(n.plannedEnd), locale)}` : undefined}
          right={<Status plain tone={late ? "bad" : "ok"} shape={late ? "alert" : "check"}>{late ? t("jobs.row.late") : t("jobs.row.onTrack")}</Status>} />);
      }
      (day?.blockers ?? []).filter((b) => b.projectId === j.id).forEach((b) => {
        const done = resolved.has(b.id);
        const when = time(new Date(b.createdAt), locale);
        out.push(<XcRow key={b.id} title={b.body.split("\n")[0]!.slice(0, 80)} sub={b.authorName ? t("jobs.row.flagged", { name: b.authorName, time: when }) : t("jobs.row.flaggedNoName", { time: when })}
          right={<><Status plain tone="bad" shape="alert">{t("jobs.row.blocker")}</Status><XcButton label={done ? t("jobs.row.resolved") : t("jobs.row.resolve")} tone={done ? "done" : "primary"} onPress={done ? undefined : () => void resolve(b.id)} /></>} />);
      });
    } else if (s === "planning") {
      out.push(j.crew.length
        ? <XcRow key="crew" title={t("jobs.row.booked")} sub={t("jobs.row.bookedSub", { names: j.crew.map((c) => firstName(c.name)).join(", ") })} />
        : <XcRow key="crew" title={t("jobs.row.noCrew")} sub={t("jobs.row.noCrewSub")} />);
    } else if (s === "hold") {
      out.push(<XcRow key="wait" title={t("jobs.row.waiting")} sub={t("jobs.row.waitingSub", { date: shortDate(new Date(j.updatedAt), locale) })} right={<Status plain tone="warn" shape="pause">{t("jobs.row.waiting")}</Status>} />);
    } else if (j.completedAt) {
      out.push(<XcRow key="fin" title={t("jobs.row.finished", { date: shortDate(new Date(j.completedAt), locale) })} sub={t("jobs.row.finishedSub", { amount: m(j.totalValueCents) })} right={<Status plain tone="mute" shape="check">{t("jobs.status.done")}</Status>} />);
    }
    const stats = s === "done"
      ? [{ label: t("jobs.stats.final"), value: m(j.totalValueCents) }, { label: t("jobs.stats.margin"), value: pct(marginPct(j)) }, { label: t("jobs.stats.days"), value: String(Math.max(0, Math.round((+new Date(j.completedAt ?? j.createdAt) - +new Date(j.createdAt)) / 86_400_000))) }]
      : s === "planning" ? [] : [{ label: t("jobs.stats.invoiced"), value: pct(invoicedPct(j)) }, { label: t("jobs.stats.costs"), value: pct(costPct(j)) }, { label: t("jobs.stats.margin"), value: pct(marginPct(j)) }];
    return { cap, out, stats };
  };

  const loading = jobsQ.isPending && !jobsQ.data;
  const failed = jobsQ.isError && !jobsQ.data;
  const clashWord = clash.length === 1 ? t("jobs.kpi.clash", { count: 1 }) : t("jobs.kpi.clash", { count: clash.length });
  const readyRows = all.filter((j) => jobState(j) === "active" && toInvoiceCents(j) > 0).sort((a, b) => toInvoiceCents(b) - toInvoiceCents(a)).slice(0, 3);

  return (
    <TabScreen active="jobs">
      <TabHeader title={t("jobs.title")}>
        <Button size="sm" label={t("jobs.newJob")} icon={<Glyph name="plus" size={14} weight={2.4} color="on-inv" />} onPress={newJob} />
        <IconButton glyph="more" label={t("jobs.more")} />
      </TabHeader>
      <ExpandScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {failed ? (
          <Section pt={26} px={16}><Empty icon="warn" iconTone="clay" title={t("jobs.loadFailed.title")} body={t("jobs.loadFailed.body")} action={t("jobs.loadFailed.retry")} onAction={() => void jobsQ.refetch()} /></Section>
        ) : loading ? (
          <Section pt={16} px={16} gap={12}><Skeleton height={74} radius={22} /><Skeleton height={44} radius={14} /><Skeleton height={150} radius={22} /><Skeleton height={150} radius={22} /></Section>
        ) : (
          <>
            {jobsQ.isError ? <Section pt={12} px={16}><Banner tone="info" icon="warn" iconTone="amber" lead={t("jobs.offline")} /></Section> : null}
            <Section delay={50} pt={16} px={16}>
              <ExpandCard id="kpi" compact label={t("jobs.glance")}
                head={<Figures items={[
                  { label: t("jobs.kpi.progress"), value: m(g.inProgressCents), sub: t("jobs.kpi.jobs", { count: g.inProgressCount }) },
                  { label: t("jobs.kpi.toInvoice"), value: m(g.toInvoiceCents), sub: g.toInvoiceTop ? (g.toInvoiceTop.clientName ?? g.toInvoiceTop.name) : undefined },
                  day ? { label: t("jobs.kpi.onSite"), value: String(day.clockedIn?.length ?? 0), sub: clash.length ? clashWord : t("jobs.kpi.clear"), subTone: clash.length ? "bad" : "muted" }
                    : { label: t("jobs.kpi.onSite"), value: "–" },
                ]} />}>
                <XcDivider />
                {rows.filter((r) => r.state === "active").slice(0, MAX_ROWS).map(({ j }, i) => (
                  <XcRow key={j.id} first={i === 0} title={j.name} sub={[j.clientName, t("jobs.glanceRows.done", { pct: pct(j.progressPercent) })].filter(Boolean).join(" · ")} right={<Num size={14.5} weight={600}>{m(j.totalValueCents)}</Num>} />
                ))}
                {readyRows.map((j) => (
                  <XcRow key={`r${j.id}`} title={t("jobs.glanceRows.ready", { name: j.clientName ?? j.name })} sub={t("jobs.glanceRows.readySub", { pct: pct(j.progressPercent), invoiced: m(j.invoicedCents) })}
                    right={<><Status plain tone="warn" shape="clock">{t("jobs.glanceRows.toInvoice")}</Status><Num size={14.5} weight={600}>{m(toInvoiceCents(j))}</Num><XcButton label={t("jobs.glanceRows.invoice")} onPress={toInvoices} /></>} />
                ))}
                {clash.slice(0, MAX_ROWS).map((c, i) => (
                  <XcRow key={`c${i}`} title={t("jobs.glanceRows.clash", { name: firstName(c.workerName), from: time(c.from, locale), to: time(c.to, locale) })} sub={t("jobs.glanceRows.clashSub", { a: c.jobs[0], b: c.jobs[1] })}
                    right={<><Status plain tone="bad" shape="alert">{t("jobs.glanceRows.clashWord")}</Status><XcButton label={t("jobs.glanceRows.fix")} onPress={() => router.push(screenHref("Schedule", t("jobs.glanceRows.fix")))} /></>} />
                ))}
              </ExpandCard>
            </Section>
            {all.length > 0 ? (
              <Section delay={90} pt={14}>
                <ChipStrip label={t("jobs.filter")}>
                  {FILTER_ORDER.map((f) => <Chip key={f} label={t(`jobs.filters.${f}`)} count={rows.filter((r) => matchesFilter(r.state, f)).length} selected={filter === f} onPress={() => setFilter(f)} />)}
                </ChipStrip>
              </Section>
            ) : null}
            {receipts ? (
              <Section delay={120} pt={14} px={16}>
                <ReceiptsRow title={t("jobs.receipts.title", { count: receipts.count })} sub={t("jobs.receipts.sub", { job: receipts.top.name, amount: m(receipts.cents, true) })} onPress={() => open(receipts.top)} />
              </Section>
            ) : null}
            {groups.map((grp) => (
              <Section key={grp.key} delay={150} pt={20} px={16}>
                <SectionHeader title={t(`jobs.groups.${grp.key}`)} link={grp.key === "setup" ? undefined : m(grp.total * 100)} />
                {grp.key === "setup" ? (
                  <Stack gap={10}>
                    {grp.items.map((j) => (
                      <SetupCard key={j.id} name={j.name} meta={t("jobs.setup.meta")} value={m(j.totalValueCents)} action={t("jobs.setup.action")} onPress={() => router.push(screenHref("JobSetup", j.name, { id: j.id }))} />
                    ))}
                  </Stack>
                ) : (
                  <Card style={{ overflow: "visible" }}>
                    <RowList>
                      {grp.items.map((j) => {
                        const d = detail(j, grp.key);
                        const crew = j.crew.slice(0, 3).map((c, i) => ({ initials: initialsOf(c.name), tint: TINTS[i % TINTS.length]! }));
                        return (
                          <JobCard key={j.id} job={j} label={`${j.name}, ${j.clientName ?? ""}`}
                            head={<JobHead name={j.name} value={m(j.totalValueCents)} sub={[j.clientName, nextLine(j)].filter(Boolean).join(" · ")}
                              progress={grp.key === "planning" ? undefined : j.progressPercent / 100} pct={pct(j.progressPercent)} fill={grp.key === "done" ? "ok-dot" : grp.key === "hold" ? "warn-dot" : "inv"}
                              crew={crew} crewNote={crewNote(j)} status={{ ...STATUS[grp.key], word: t(`jobs.status.${grp.key}`) }} />}>
                            <XcDivider />
                            <XcCaption>{d.cap}</XcCaption>
                            {d.out}
                            {d.stats.length ? <JobStats items={d.stats} /> : null}
                            <XcActions link={j.clientName ? t("jobs.message", { name: firstName(j.clientName) }) : t("jobs.messageClient")} onLink={clientOf(j)} main={t("jobs.openJob")} onMain={() => open(j)} />
                          </JobCard>
                        );
                      })}
                    </RowList>
                  </Card>
                )}
              </Section>
            ))}
            {groups.length === 0 ? (
              <Section delay={150} pt={26} px={16}>
                <Empty icon="cone" iconTone="amber" title={t("jobs.empty.title")} body={t("jobs.empty.body")} action={t("jobs.empty.action")} actionKind="secondary" onAction={toQuotes} />
              </Section>
            ) : null}
            {jobsQ.data?.jobLimit != null ? (
              <Section delay={200} pt={22} px={24}><Text size={12.5} color="faint" align="center">{t("jobs.plan", { open: jobsQ.data.openJobs, limit: jobsQ.data.jobLimit })}</Text></Section>
            ) : null}
          </>
        )}
      </ExpandScrollView>
    </TabScreen>
  );
}

/** A job row: the expandable card, closed on the head and open on the figures and the two actions. */
function JobCard({ job, label, head, children }: { job: Job; label: string; head: React.ReactNode; children: React.ReactNode }) {
  return <ExpandCard id={job.id} variant="row" list="jobs" label={label} head={head}>{children}</ExpandCard>;
}
