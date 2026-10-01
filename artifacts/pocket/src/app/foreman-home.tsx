// ForemanHome.dc.html: the foreman's Home. Built from the office's "crew today" (routes/crew.ts): blockers to answer or sort, the crew by where they are, the hours waiting
// for approval (approve one, or all), what the field sent, the sites and what is next today. States: default, offline (what is saved, with the offline banner), and the
// plan lock when the company has no time tracking. Not built (nothing on the server to read): the foreman's own clock card, "waiting on the office", the day's task ticks
// and the ask-or-report bar (the assistant is phase 128).
import { useMemo, useState } from "react";
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiFailure } from "@/lib/api";
import { tintFor } from "@/lib/clients";
import { crewLines, hoursTotal, nextUp, onSiteCount, type ForemanReport } from "@/lib/foreman";
import { foremanApi } from "@/lib/foremanApi";
import { headerDate, number, relativeWhen, shortDate, time, type Locale } from "@/lib/format";
import { greetingFor } from "@/lib/home";
import { initialsOf } from "@/lib/invites";
import { screenHref } from "@/lib/nav";
import { useSession } from "@/lib/useSession";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { QuickLink } from "@/ui/Crew";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { TextField } from "@/ui/Field";
import { ExpandScrollView } from "@/ui/Expand";
import { HomeHeader } from "@/ui/Home";
import { Icon, type IconName, type Tone } from "@/ui/Icon";
import { Section, Stack } from "@/ui/Layout";
import { ListRow, RowChevron, RowList, SectionHeader } from "@/ui/Row";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { Status, type StatusShape, type StatusTone } from "@/ui/Status";
import { TAB_BAR_SPACE } from "@/ui/TabBar";
import { TabScreen } from "@/ui/TabShell";
import { Num, Text } from "@/ui/Text";

const QUICK: { key: "schedule" | "jobs" | "hours" | "crew"; icon: IconName; tone: Tone; screen: string }[] = [
  { key: "schedule", icon: "cal", tone: "violet", screen: "Schedule" },
  { key: "jobs", icon: "hammer", tone: "clay", screen: "Jobs" },
  { key: "hours", icon: "clock", tone: "teal", screen: "Timesheets" },
  { key: "crew", icon: "users", tone: "azure", screen: "CrewNow" },
];

const KIND_LOOK: Record<ForemanReport["kind"], { tone: StatusTone; shape: StatusShape }> = { blocker: { tone: "bad", shape: "alert" }, materials: { tone: "acc", shape: "q2" }, note: { tone: "info", shape: "dot" } };

export default function ForemanHome() {
  const { t, i18n } = useTranslation();
  const f = (k: string, o?: Record<string, unknown>) => t(`fh.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { status, user } = useSession();
  const toast = useToast();
  const client = useQueryClient();
  const signedIn = status === "in" || status === "offline";
  const q = useQuery({ queryKey: ["foreman-today"], queryFn: foremanApi.today, enabled: signedIn, retry: 1, refetchInterval: 60_000 });
  const [answering, setAnswering] = useState<ForemanReport | null>(null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const now = useMemo(() => new Date(), []);

  if (status === "out") return <Redirect href="/" />;

  const data = q.data && q.data.enabled ? q.data : null;
  const locked = q.data && !q.data.enabled;
  const offline = status === "offline" || (q.isError && q.error instanceof ApiFailure && q.error.status === 0);
  const first = user?.name.trim().split(/\s+/)[0] ?? "";
  const lines = data ? crewLines(data.jobs) : [];
  const total = data ? hoursTotal(data.awaitingApproval) : 0;
  const reports = data ? data.recentReports.filter((r) => r.kind !== "blocker" || r.resolvedAt) : [];
  const openReports = data ? data.recentReports.filter((r) => !r.resolvedAt) : [];
  const upcoming = data ? nextUp(data.jobs, now) : [];
  const sites = data ? data.jobs.filter((j) => j.jobId) : [];
  const open = (screen: string, title: string) => router.push(screenHref(screen, title));
  const refresh = () => void client.invalidateQueries({ queryKey: ["foreman-today"] });

  const sort = async (r: ForemanReport, note?: string) => {
    setBusy(r.id);
    try { await foremanApi.resolve(r.id, note); toast({ message: f("blockers.sortedToast") }); refresh(); setAnswering(null); setAnswer(""); }
    catch { toast({ message: f("blockers.failed") }); }
    finally { setBusy(null); }
  };
  const approve = async (ids: string[]) => {
    setBusy("hours");
    try { const r = await foremanApi.approve(ids); toast({ message: f("hours.approved", { count: r.approved }) }); refresh(); }
    catch { toast({ message: f("blockers.failed") }); }
    finally { setBusy(null); }
  };

  const crewWord = (s: "on" | "elsewhere" | "later"): { tone: StatusTone; shape: StatusShape; word: string } =>
    s === "on" ? { tone: "ok", shape: "live", word: f("crew.on") } : s === "elsewhere" ? { tone: "info", shape: "q1", word: f("crew.elsewhere") } : { tone: "warn", shape: "clock", word: f("crew.later") };

  return (
    <TabScreen active="home">
      <ExpandScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Section>
          <HomeHeader date={headerDate(now, locale)} greeting={first ? f(`greeting.${greetingFor(now)}`, { name: first }) : f(`greeting.${greetingFor(now)}`, { name: "" }).replace(/,\s*$/, "")}
            quickLabel={f("quickAdd")} onQuick={() => open("Schedule", f("quick.schedule"))} menuLabel={f("openMenu")} onMenu={() => router.push(screenHref("Menu", f("openMenu")))}
            initials={user ? initialsOf(user.name) : ""} />
        </Section>

        {offline ? <Section px={16} pt={12}><Banner tone="warn" icon="cloud" iconTone="amber" lead={f("offline.lead")}>{f("offline.text")}</Banner></Section> : null}
        {q.isError && !offline && !data ? <Section px={16} pt={12}><Banner tone="warn" icon="warn" iconTone="amber" lead={f("loadFailed.lead")} link={f("loadFailed.text")} onLink={() => void q.refetch()} /></Section> : null}

        <Section delay={60} px={16} pt={14}>
          <Stack row gap={8}>
            {QUICK.map((x) => <QuickLink key={x.key} icon={x.icon} tone={x.tone} label={f(`quick.${x.key}`)} onPress={() => open(x.screen, f(`quick.${x.key}`))} />)}
          </Stack>
        </Section>

        {q.isPending && !q.data && signedIn && !q.isError ? (
          <Section px={16} pt={22} gap={10}><Skeleton height={20} width="40%" /><Skeleton height={110} radius={20} /><Skeleton height={20} width="40%" /><Skeleton height={160} radius={20} /></Section>
        ) : null}

        {locked ? <Section px={16} pt={22}><Card><Empty icon="lock" iconTone="violet" title={f("locked.title")} body={f("locked.body")} /></Card></Section> : null}

        {data ? (
          <>
            <Section delay={100} px={16} pt={22}>
              <SectionHeader title={f("blockers.title")} link={data.blockers.length ? f("blockers.open", { count: data.blockers.length }) : f("blockers.allSorted")} />
              <Card>
                {data.blockers.length === 0 ? (
                  <Empty icon="check" iconTone="sage" title={f("blockers.allSorted")} body={f("blockers.noneBody")} />
                ) : (
                  <RowList inset={0}>
                    {data.blockers.map((b) => (
                      <Stack key={b.id} gap={10} pb={14}>
                        <ListRow title={b.body} meta={[b.authorName, b.projectName].filter(Boolean).join(" · ")}
                          leading={<Icon name="cone" tone="amber" size={26} />} trailing={<Status tone="bad" shape="alert">{f("blockers.word")}</Status>} />
                        <Stack row gap={8} px={16} pt={0}>
                          <Button size="sm" label={f("blockers.answer")} onPress={() => { setAnswering(b); setAnswer(""); }} />
                          <Button size="sm" kind="secondary" label={f("blockers.sort")} busy={busy === b.id ? f("blockers.sort") : false} onPress={() => void sort(b)} />
                        </Stack>
                      </Stack>
                    ))}
                  </RowList>
                )}
              </Card>
            </Section>

            <Section delay={140} px={16} pt={22}>
              <SectionHeader title={f("crew.title")} link={lines.length ? f("crew.summary", { on: onSiteCount(lines), later: lines.length - onSiteCount(lines) }) : undefined} onLink={() => open("CrewNow", f("quick.crew"))} />
              <Card>
                {lines.length === 0 ? <Empty icon="users" iconTone="azure" title={f("crew.empty")} body={f("crew.emptyBody")} /> : (
                  <RowList>
                    {lines.map((l) => {
                      const w = crewWord(l.state);
                      const at = time(new Date(l.at), locale);
                      return (
                        <ListRow key={l.workerId} title={l.name} meta={l.jobName ?? undefined} onPress={() => open("CrewNow", f("quick.crew"))}
                          leading={<Avatar initials={initialsOf(l.name)} tint={tintFor(l.name)} size={38} presence={l.state === "on" ? "on" : l.state === "later" ? "later" : "off"} />}
                          trailing={<><Status tone={w.tone} shape={w.shape} plain>{w.word}</Status><Num size={11.5} weight={400} color="muted">{l.state === "on" ? f("crew.since", { time: at }) : l.state === "later" ? f("crew.starts", { time: at }) : at}</Num></>} />
                      );
                    })}
                  </RowList>
                )}
              </Card>
            </Section>

            <Section delay={180} px={16} pt={22}>
              <SectionHeader title={f("hours.title")} link={data.awaitingApproval.length ? f("hours.week", { count: data.awaitingApproval.length }) : undefined} onLink={() => open("Timesheets", f("quick.hours"))} />
              <Card>
                {data.awaitingApproval.length === 0 ? <Empty icon="clock" iconTone="teal" title={f("hours.none")} body={f("hours.noneBody")} /> : (
                  <>
                    <RowList>
                      {data.awaitingApproval.map((h) => (
                        <ListRow key={h.id} title={h.workerName ?? ""} meta={f("hours.sub", { job: h.projectName ?? "", date: shortDate(new Date(`${h.date}T12:00:00`), locale) })}
                          leading={<Avatar initials={initialsOf(h.workerName ?? "")} tint={tintFor(h.workerName ?? "")} size={38} />}
                          trailing={<><Num size={14.5} weight={600}>{`${number(h.hours, locale, 1)} h`}</Num><Status tone={h.geofenceFlagged ? "warn" : "info"} shape={h.geofenceFlagged ? "alert" : "q1"} plain>{h.geofenceFlagged ? f("hours.flagged") : h.clocked ? f("hours.clocked") : f("hours.byHand")}</Status></>} />
                      ))}
                    </RowList>
                    <Stack row align="center" justify="space-between" gap={10} px={16} pt={12} pb={14}>
                      <Text size={13.5} color="muted" style={{ flexShrink: 1 }}>{f("hours.total", { hours: number(total, locale, 1) })}</Text>
                      <Button size="sm" label={f("hours.approveAll")} busy={busy === "hours" ? f("hours.approveAll") : false} onPress={() => void approve(data.awaitingApproval.map((h) => h.id))} />
                    </Stack>
                  </>
                )}
              </Card>
            </Section>

            {reports.length || openReports.length ? (
              <Section delay={220} px={16} pt={22}>
                <SectionHeader title={f("field.title")} link={openReports.length ? f("field.open", { count: openReports.length }) : f("field.allSorted")} />
                <Stack gap={10}>
                  {data.recentReports.slice(0, 6).map((r) => {
                    const look = r.resolvedAt ? { tone: "mute" as StatusTone, shape: "check" as StatusShape, word: f("field.sorted") } : { ...KIND_LOOK[r.kind], word: r.kind === "note" ? f("field.new") : f(`field.${r.kind}`) };
                    return (
                      <Card key={r.id} padded>
                        <Stack gap={10}>
                          <Stack row align="center" gap={10}>
                            <Avatar initials={initialsOf(r.authorName ?? "")} tint={tintFor(r.authorName ?? "")} size={32} />
                            <Stack grow gap={1}>
                              <Text size={14.5} weight={500} numberOfLines={1}>{r.authorName ?? ""}</Text>
                              <Text size={12.5} color="muted" numberOfLines={1}>{f("field.where", { job: r.projectName ?? "", time: relativeWhen(new Date(r.createdAt), now, locale) })}</Text>
                            </Stack>
                            <Status tone={look.tone} shape={look.shape}>{look.word}</Status>
                          </Stack>
                          <Text size={14.5} color="t2" leading={1.45}>{r.body}</Text>
                          {!r.resolvedAt ? (
                            <Stack row gap={8}>
                              <Button size="sm" label={f("blockers.answer")} onPress={() => { setAnswering(r); setAnswer(""); }} />
                              <Button size="sm" kind="secondary" label={f("blockers.sort")} onPress={() => void sort(r)} />
                            </Stack>
                          ) : null}
                        </Stack>
                      </Card>
                    );
                  })}
                </Stack>
              </Section>
            ) : null}

            {sites.length ? (
              <Section delay={260} px={16} pt={22}>
                <SectionHeader title={f("sites.title")} link={f("sites.all", { count: sites.length })} onLink={() => router.push(screenHref("Jobs", f("quick.jobs")))} />
                <Card>
                  <RowList>
                    {sites.map((j) => {
                      const on = j.crew.some((b) => b.clockedInAt);
                      return (
                        <ListRow key={j.jobId} title={j.jobName ?? ""} meta={j.address ?? f("sites.noAddress")} onPress={() => router.push(screenHref("Job", j.jobName ?? "", { id: j.jobId! }))}
                          trailing={<Status tone={on ? "ok" : "warn"} shape={on ? "live" : "clock"} plain>{on ? f("sites.onSite") : f("sites.booked")}</Status>} />
                      );
                    })}
                  </RowList>
                </Card>
              </Section>
            ) : null}

            <Section delay={300} px={16} pt={22}>
              <SectionHeader title={f("next.title")} link={f("next.schedule")} onLink={() => router.push(screenHref("Schedule", f("quick.schedule")))} />
              <Card>
                {upcoming.length === 0 ? <Empty icon="cal" iconTone="violet" title={f("next.empty")} body={f("next.emptyBody")} /> : (
                  <RowList>
                    {upcoming.map((n, i) => (
                      <ListRow key={i} title={n.title} meta={n.jobName && n.jobName !== n.title ? n.jobName : undefined} onPress={() => router.push(screenHref("Schedule", f("quick.schedule")))}
                        leading={<Stack w={64}><Num size={12.5} weight={400} color="muted">{n.allDay ? f("next.allDay") : time(new Date(n.startsAt), locale)}</Num></Stack>} trailing={<RowChevron />} />
                    ))}
                  </RowList>
                )}
              </Card>
            </Section>
          </>
        ) : null}
      </ExpandScrollView>

      <Sheet open={!!answering} onClose={() => setAnswering(null)} label={f("blockers.answerTitle", { who: answering?.authorName ?? "" })} closeLabel={f("close")}>
        <SheetTitle>{f("blockers.answerTitle", { who: answering?.authorName ?? "" })}</SheetTitle>
        <Stack px={16} pb={20} gap={14}>
          <Text size={13.5} color="muted" leading={1.45}>{answering?.body ?? ""}</Text>
          <TextField label={f("blockers.answerPh")} value={answer} onChangeText={setAnswer} autoFocus />
          <Text size={12.5} color="muted" leading={1.4}>{f("blockers.answerHint")}</Text>
          <Button size="lg" block label={f("blockers.send")} busy={busy === answering?.id ? f("blockers.send") : false} disabled={!answer.trim()} onPress={() => answering && void sort(answering, answer.trim())} />
        </Stack>
      </Sheet>
    </TabScreen>
  );
}
