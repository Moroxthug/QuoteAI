// ServiceCalls.dc.html: calls and visits on finished jobs. The glance (open calls, under warranty, first visit), Open / Done, a card per call (who, the job, what was reported,
// the warranty line, the charge, schedule a visit), the finished calls and the warranty by job. A visit is a block on the schedule, so the crew sees it.
// Not built: photos on a call (the server keeps none), "Text the client the time" and the call/quote secondary buttons; the warranty term is 12 months for every job.
import { useMemo, useState } from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiFailure } from "@/lib/api";
import { tintFor } from "@/lib/clients";
import { dateWithYear, money, shortDate, weekdayShort, type Locale } from "@/lib/format";
import { initialsOf } from "@/lib/invites";
import { screenHref } from "@/lib/nav";
import { doneCalls, openCalls, firstOpenWindow, visitDays, visitRange, warrantyState, windowOpen, warrantyTone, WINDOWS, type ServiceCall, type ServiceView } from "@/lib/serviceCalls";
import { teamApi } from "@/lib/teamApi";
import { useSession } from "@/lib/useSession";
import { ACTION_BAR_SPACE } from "@/ui/ActionBar";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Chip, ChipStrip, ChipWrap } from "@/ui/Chip";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { TextField } from "@/ui/Field";
import { Header } from "@/ui/Header";
import { Icon } from "@/ui/Icon";
import { Section, ScrollPage, Stack } from "@/ui/Layout";
import { Progress, StatStrip } from "@/ui/Numbers";
import { ListRow, RowList, SectionHeader } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Segmented } from "@/ui/Segmented";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { Status } from "@/ui/Status";
import { Num, Text } from "@/ui/Text";

type Filter = "open" | "done";

export default function ServiceCalls() {
  const { t, i18n } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`svc.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { status } = useSession();
  const toast = useToast();
  const client = useQueryClient();
  const signedIn = status === "in" || status === "offline";
  const q = useQuery({ queryKey: ["service-calls"], queryFn: () => api<ServiceView>("/api/service-calls"), enabled: signedIn, retry: 1 });
  const workers = useQuery({ queryKey: ["team-workers"], queryFn: teamApi.workers, enabled: signedIn, retry: 1 });
  const [filter, setFilter] = useState<Filter>("open");
  const [readOnly, setReadOnly] = useState(false);
  const [booking, setBooking] = useState<ServiceCall | null>(null);
  const [day, setDay] = useState(0);
  const [win, setWin] = useState(0);
  const [who, setWho] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [logJob, setLogJob] = useState<string | null>(null);
  const [issue, setIssue] = useState("");
  const [note, setNote] = useState("");
  const [by, setBy] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const now = useMemo(() => new Date(), []);
  const days = useMemo(() => visitDays(now), [now]);

  const data = q.data;
  const calls = data?.calls ?? [];
  const open = openCalls(calls);
  const done = doneCalls(calls);
  const refresh = () => void client.invalidateQueries({ queryKey: ["service-calls"] });
  const back = () => (router.canGoBack() ? router.back() : router.replace("/menu"));
  const fail = (e: unknown) => {
    if (e instanceof ApiFailure && e.status === 403) { setReadOnly(true); toast({ message: s("act.readOnly") }); } else toast({ message: s("act.failed") });
  };
  const patch = async (key: string, id: string, body: Record<string, unknown>, ok = s("act.saved")) => {
    setBusy(key);
    try { await api(`/api/service-calls/${encodeURIComponent(id)}`, { method: "PATCH", body }); toast({ message: ok }); refresh(); return true; } catch (e) { fail(e); return false; } finally { setBusy(null); }
  };
  const dayLabel = (d: Date) => `${weekdayShort(d, locale)} ${shortDate(d, locale)}`;
  const windowLabel = (i: number) => (t("svc.windows", { returnObjects: true }) as unknown as string[])[i] ?? "";

  const openBooking = (c: ServiceCall) => { setBooking(c); setDay(0); setWin(firstOpenWindow(days[0]!, now)); setWho(c.workerId); };
  const book = async () => {
    if (!booking) return;
    const r = visitRange(days[day]!, win);
    if (await patch(`book${booking.id}`, booking.id, { visit: { ...r, workerId: who } }, s("sheet.booked"))) setBooking(null);
  };
  const logCall = async () => {
    if (!logJob || !issue.trim()) return;
    setBusy("log");
    try { await api("/api/service-calls", { method: "POST", body: { projectId: logJob, issue: issue.trim(), note: note.trim() || undefined, reportedBy: by.trim() || undefined } }); toast({ message: s("act.saved") }); setLogOpen(false); setIssue(""); setNote(""); setBy(""); refresh(); }
    catch (e) { fail(e); } finally { setBusy(null); }
  };

  const card = (c: ServiceCall) => {
    const ws = warrantyState(c);
    const until = c.warrantyEndsAt ? dateWithYear(new Date(c.warrantyEndsAt), now, locale) : "";
    const booked = c.status === "booked" && c.visitStartsAt;
    const visitDay = booked ? new Date(c.visitStartsAt!) : null;
    const how = s(`channel.${c.channel}`);
    return (
      <Section key={c.id} pt={14} px={16}>
        <Card>
          <Stack row align="center" gap={12} px={16} pt={16}>
            <Avatar initials={initialsOf(c.clientName ?? c.jobName ?? "")} tint={tintFor(c.clientName ?? c.jobName ?? "")} size={38} />
            <Stack grow gap={1}>
              <Text size={14.5} weight={500} numberOfLines={1}>{c.clientName ?? c.jobName ?? ""}</Text>
              <Text size={12.5} color="muted" numberOfLines={1} onPress={() => router.push(screenHref("Job", c.jobName ?? "", { id: c.projectId }))}>{c.jobDoneAt ? s("jobDone", { job: c.jobName ?? "", date: dateWithYear(new Date(c.jobDoneAt), now, locale) }) : c.jobName ?? ""}</Text>
            </Stack>
            <Status tone={booked ? "info" : "warn"} shape={booked ? "q1" : "alert"}>{s(booked ? "status.booked" : "status.open")}</Status>
          </Stack>
          <Stack px={16} pt={14} gap={6}>
            <Text size={17} weight={600} tracking={-0.02}>{c.issue}</Text>
            <Text size={12.5} color="muted">{c.reportedBy ? s("reportedBy", { date: shortDate(new Date(c.reportedAt), locale), who: c.reportedBy, how }) : s("reported", { date: shortDate(new Date(c.reportedAt), locale), how })}</Text>
            {c.note ? <Text size={14.5} color="t2" leading={1.45}>{c.note}</Text> : null}
          </Stack>
          <Stack row align="center" gap={12} mt={14} px={14} pt={12} pb={12}>
            <Icon name="shield" tone={ws === "covered" ? "sage" : "stone"} size={26} />
            <Stack grow gap={1}>
              <Text size={13.5} weight={500}>{ws === "covered" ? s("warranty.covered", { date: until }) : ws === "ended" ? s("warranty.ended", { date: until }) : s("warranty.unfinished")}</Text>
              <Text size={12.5} color="muted">{ws === "covered" ? s("warranty.sub", { months: data?.warrantyMonths ?? 12 }) : ws === "ended" ? s("warranty.subEnded") : s("warranty.subNone")}</Text>
            </Stack>
          </Stack>
          {booked ? (
            <Stack row align="center" gap={12} px={16} pt={12}>
              <Icon name="cal" tone="azure" size={26} />
              <Stack grow gap={1}>
                <Text size={13.5} weight={500}>{s("act.visit", { day: dayLabel(visitDay!), window: windowLabel(WINDOWS.findIndex((w) => w.from === visitDay!.getHours())) })}</Text>
                {c.workerName ? <Text size={12.5} color="muted">{s("act.who", { name: c.workerName.split(/\s+/)[0] })}</Text> : null}
              </Stack>
            </Stack>
          ) : null}
          <Stack px={16} pt={14} pb={16} gap={12}>
            <Segmented label={s("charge.label")} options={[s("charge.none"), s("charge.bill")]} value={c.billing === "warranty" ? 0 : 1}
              onChange={(i) => { if (readOnly) return toast({ message: s("act.readOnly") }); void patch(`bill${c.id}`, c.id, { billing: i === 0 ? "warranty" : "billable" }); }} />
            {!readOnly ? (
              <Stack row gap={8}>
                <Stack grow><Button block kind={booked ? "secondary" : "primary"} label={booked ? s("act.reschedule") : s("act.schedule")} onPress={() => openBooking(c)} /></Stack>
                <Stack grow><Button block kind="secondary" label={s("act.done")} busy={busy === `done${c.id}` ? s("act.done") : false} onPress={() => void patch(`done${c.id}`, c.id, { status: "done" })} /></Stack>
              </Stack>
            ) : null}
          </Stack>
        </Card>
      </Section>
    );
  };

  const finished = data?.warranty ?? [];
  return (
    <Screen>
      <Header title="" backLabel={s("back")} onBack={back} moreLabel={s("more")} onMore={() => setLogOpen(true)} />
      <ScrollPage bottom={ACTION_BAR_SPACE}>
        <Section px={20}>
          <Text size={28} weight={600} tracking={-0.04} leading={1.12} accessibilityRole="header">{s("title")}</Text>
          <Text size={13.5} color="muted">{s("sub")}</Text>
        </Section>
        {q.isError && !data ? <Section pt={26} px={16}><Empty icon="warn" iconTone="clay" title={s("loadFailed.title")} body={s("loadFailed.body")} action={s("loadFailed.retry")} onAction={() => void q.refetch()} /></Section>
          : q.isPending && !data ? <Section pt={16} px={16} gap={12}><Skeleton height={74} radius={22} /><Skeleton height={44} radius={14} /><Skeleton height={260} radius={22} /></Section>
          : (
            <>
              {status === "offline" ? <Section px={16} pt={12}><Banner tone="warn" icon="cloud" iconTone="amber" lead={s("offline.lead")}>{s("offline.text")}</Banner></Section> : null}
              {readOnly ? <Section px={16} pt={12}><Banner tone="info" icon="eye" iconTone="azure" lead={s("readOnly.lead")}>{s("readOnly.text")}</Banner></Section> : null}
              {calls.length === 0 && finished.length === 0 ? (
                <Section pt={40} px={16}><Empty icon="shield" iconTone="sage" title={s("empty.title")} body={s("empty.body")} action={s("empty.action")} actionKind="secondary" onAction={() => setLogOpen(true)} /></Section>
              ) : (
                <>
                  <Section delay={40} pt={16} px={16}>
                    <StatStrip items={[
                        { label: s("kpi.open"), value: String(data?.kpis.open ?? 0), sub: s("kpi.booked", { count: data?.kpis.booked ?? 0 }) },
                        { label: s("kpi.warranty"), value: String(data?.kpis.underWarranty ?? 0), sub: s("kpi.finished") },
                        { label: s("kpi.first"), value: data?.kpis.firstVisitDays != null ? s("kpi.days", { days: data.kpis.firstVisitDays }) : "–", sub: data?.kpis.firstVisitDays != null ? s("kpi.onAvg") : s("kpi.none") },
                      ]} />
                  </Section>
                  <Section delay={70} pt={14}>
                    <ChipStrip label={s("filters.label")}>
                      <Chip label={s("filters.open")} count={open.length} selected={filter === "open"} onPress={() => setFilter("open")} />
                      <Chip label={s("filters.done")} count={done.length} selected={filter === "done"} onPress={() => setFilter("done")} />
                    </ChipStrip>
                  </Section>
                  {filter === "open" ? open.map(card) : (
                    <Section pt={14} px={16}>
                      <Card>
                        {done.length === 0 ? <Empty icon="check" iconTone="sage" title={s("doneEmpty.title")} body={s("doneEmpty.body")} /> : (
                          <RowList>
                            {done.map((d) => (
                              <ListRow key={d.id} title={d.issue} meta={s("doneRow", { client: d.clientName ?? d.jobName ?? "", when: shortDate(new Date(d.doneAt ?? d.reportedAt), locale) })} onPress={() => router.push(screenHref("Job", d.jobName ?? "", { id: d.projectId }))}
                                trailing={<><Num size={14.5} weight={600}>{money(d.amountCents / 100, locale, { cents: true })}</Num><Status plain tone={d.billing === "billable" ? "ok" : "mute"} shape="check">{d.billing === "billable" ? s("doneBilled") : s("doneNoCharge")}</Status></>} />
                            ))}
                          </RowList>
                        )}
                      </Card>
                    </Section>
                  )}
                  <Section delay={150} pt={24} px={16}>
                    <SectionHeader title={s("byJob.title")} link={s("byJob.note")} />
                    <Card>
                      {finished.length === 0 ? <Empty icon="shield" iconTone="sage" title={s("byJob.empty")} body={s("byJob.emptyBody")} /> : (
                        <RowList>
                          {finished.map((w) => {
                            const tone = warrantyTone(w);
                            return (
                              <Stack key={w.projectId} gap={8} px={16} pt={13} pb={13}>
                                <Stack row align="center" justify="space-between" gap={12}>
                                  <Stack grow gap={2}>
                                    <Text size={14.5} weight={500} numberOfLines={1}>{[w.clientName, w.jobName].filter(Boolean).join(" · ")}</Text>
                                    <Text size={12.5} color="muted">{s(w.covered ? "byJob.finished" : "byJob.finishedEnded", { date: dateWithYear(new Date(w.completedAt), now, locale), until: dateWithYear(new Date(w.endsAt), now, locale) })}</Text>
                                  </Stack>
                                  <Status tone={tone === "covered" ? "ok" : tone === "soon" ? "warn" : "mute"} shape={tone === "covered" ? "check" : tone === "soon" ? "clock" : "off"}>{s(`byJob.${tone}`)}</Status>
                                </Stack>
                                <Progress value={w.elapsedPercent / 100} fill={tone === "ended" ? "line2" : tone === "soon" ? "warn-dot" : "ok-dot"} height={4} label={w.jobName} />
                              </Stack>
                            );
                          })}
                        </RowList>
                      )}
                    </Card>
                  </Section>
                </>
              )}
            </>
          )}
      </ScrollPage>

      <Sheet open={!!booking} onClose={() => setBooking(null)} label={s("sheet.title")} closeLabel={s("close")}>
        <SheetTitle>{s("sheet.title")}</SheetTitle>
        <Stack px={16} pb={20} gap={16}>
          <Text size={12.5} color="muted">{booking ? `${booking.clientName ?? booking.jobName ?? ""} · ${booking.issue.toLowerCase()}` : ""}</Text>
          <Stack gap={8}><Text size={12.5} color="muted">{s("sheet.day")}</Text><ChipWrap>{days.map((d, i) => <Chip key={i} label={dayLabel(d)} selected={day === i} onPress={() => { setDay(i); if (!windowOpen(d, win, now)) setWin(firstOpenWindow(d, now)); }} />)}</ChipWrap></Stack>
          <Stack gap={8}><Text size={12.5} color="muted">{s("sheet.window")}</Text><ChipWrap>{WINDOWS.map((_, i) => <Chip key={i} label={windowLabel(i)} selected={win === i} disabled={!windowOpen(days[day]!, i, now)} onPress={() => setWin(i)} />)}</ChipWrap></Stack>
          <Stack gap={8}>
            <Text size={12.5} color="muted">{s("sheet.who")}</Text>
            <ChipWrap>
              <Chip label={s("sheet.noOne")} selected={who === null} onPress={() => setWho(null)} />
              {(workers.data?.items ?? []).filter((w) => w.active).map((w) => <Chip key={w.id} label={w.name.split(/\s+/)[0] ?? w.name} selected={who === w.id} onPress={() => setWho(w.id)} />)}
            </ChipWrap>
          </Stack>
          <Button size="lg" block label={s("sheet.book", { day: dayLabel(days[day]!), window: windowLabel(win) })} busy={busy?.startsWith("book") ? s("sheet.booking") : false} onPress={() => void book()} />
        </Stack>
      </Sheet>

      <Sheet open={logOpen} onClose={() => setLogOpen(false)} label={s("logSheet.title")} closeLabel={s("close")}>
        <SheetTitle>{s("logSheet.title")}</SheetTitle>
        <Stack px={16} pb={20} gap={14}>
          {finished.length === 0 ? <Text size={13.5} color="muted" leading={1.45}>{s("logSheet.noJobs")}</Text> : (
            <>
              <Stack gap={8}><Text size={12.5} color="muted">{s("logSheet.job")}</Text><ChipWrap>{finished.slice(0, 12).map((w) => <Chip key={w.projectId} label={w.jobName} selected={logJob === w.projectId} onPress={() => setLogJob(w.projectId)} />)}</ChipWrap></Stack>
              <TextField label={s("logSheet.issue")} value={issue} onChangeText={setIssue} placeholder={s("logSheet.issuePh")} />
              <TextField label={s("logSheet.note")} value={note} onChangeText={setNote} placeholder={s("logSheet.notePh")} />
              <TextField label={s("logSheet.by")} value={by} onChangeText={setBy} placeholder={s("logSheet.byPh")} />
              <Button size="lg" block label={s("logSheet.save")} busy={busy === "log" ? s("logSheet.saving") : false} disabled={!logJob || !issue.trim()} onPress={() => void logCall()} />
            </>
          )}
        </Stack>
      </Sheet>
    </Screen>
  );
}
