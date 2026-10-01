// Job.dc.html, the Overview tab: what the crew raised from the field (Answer / Mark sorted), who is on it today, what is up next
// and the payment it releases, budget against actual with the share of the work done marked, permits and inspections, and notes.
// Not built: the board's suggested permit ("a wet bar sink usually needs a plumbing permit"), because the app doesn't know the kind of
// work; the server's suggestions need it.
import { useMemo, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { tintFor } from "@/lib/clients";
import { dateOnly } from "@/lib/jobs";
import { dayDate, money, relativeWhen, shortDate, time, type Locale } from "@/lib/format";
import { initialsOf } from "@/lib/invites";
import type { JobDetail } from "@/lib/jobDetail";
import { budgetBars, upNext } from "@/lib/jobPage";
import { jobsApi, type FieldReport as Report, type Permit } from "@/lib/jobsApi";
import { screenHref } from "@/lib/nav";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Chip, ChipWrap } from "@/ui/Chip";
import { Banner, Skeleton, useToast } from "@/ui/Feedback";
import { TextField } from "@/ui/Field";
import { Icon, type IconName, type Tone } from "@/ui/Icon";
import { BudgetBars, FieldReport } from "@/ui/JobPage";
import { Section, Stack } from "@/ui/Layout";
import { RowBody, RowList, SectionHeader } from "@/ui/Row";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { Status, type StatusShape, type StatusTone } from "@/ui/Status";
import { Num, Text } from "@/ui/Text";
import { usePrimary } from "./primary";

type Props = { d: JobDetail; id: string; locale: Locale };

const KIND: Record<Report["kind"], { tone: StatusTone; shape: StatusShape }> = { blocker: { tone: "warn", shape: "clock" }, materials: { tone: "info", shape: "dot" }, note: { tone: "mute", shape: "dot" } };
const PERMIT_KINDS = ["building", "electrical", "plumbing", "gas", "hvac", "demolition", "other"];

export function Overview({ d, id, locale }: Props) {
  const { t } = useTranslation();
  const j = (k: string, o?: Record<string, unknown>) => t(`job.${k}`, o) as string;
  const toast = useToast();
  const client = useQueryClient();
  const now = useMemo(() => new Date(), []);
  const reports = useQuery({ queryKey: ["job-reports", id], queryFn: () => jobsApi.fieldReports(id), retry: 1, staleTime: 15_000 });
  const crew = useQuery({ queryKey: ["crew-today"], queryFn: jobsApi.crewToday, retry: 0, staleTime: 30_000 });
  const today = useQuery({
    queryKey: ["job-today", id],
    queryFn: () => jobsApi.schedule(new Date(now.getFullYear(), now.getMonth(), now.getDate()), new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), id),
    retry: 1, staleTime: 30_000,
  });
  const permits = useQuery({ queryKey: ["job-permits", id], queryFn: () => jobsApi.permits(id), retry: 0, staleTime: 30_000 });
  const notes = useQuery({ queryKey: ["job-notes", id], queryFn: () => jobsApi.notes(id), retry: 1, staleTime: 30_000 });
  const [answering, setAnswering] = useState<Report | null>(null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [permitOpen, setPermitOpen] = useState(false);
  const [permitKind, setPermitKind] = useState("other");
  const [permitName, setPermitName] = useState("");
  const [permitAuthority, setPermitAuthority] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");

  usePrimary({ label: j("primary.overview"), run: () => setNoteOpen(true) });

  const m = (cents: number, withCents = false) => money(cents / 100, locale, { cents: withCents });
  const pct = (n: number) => (locale === "fr-CA" ? `${n} %` : `${n}%`);
  const open = (reports.data?.reports ?? []).filter((r) => !r.resolvedAt);
  const clockedIn = new Map((crew.data?.enabled ? crew.data.clockedIn ?? [] : []).filter((c) => c.projectId === id).map((c) => [c.workerId, c.since]));
  const blocks = (today.data?.blocks ?? []).slice().sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  const next = upNext(d);
  const bars = budgetBars(d);
  const progress = d.job.progressPercent / 100;

  const resolve = async (r: Report, note?: string) => {
    setBusy(r.id);
    try {
      await jobsApi.resolveReport(r.id, note);
      void client.invalidateQueries({ queryKey: ["job-reports", id] });
      void client.invalidateQueries({ queryKey: ["crew-today"] });
      setAnswering(null);
      setAnswer("");
    } catch {
      toast({ message: j("failed") });
    } finally {
      setBusy(null);
    }
  };

  const addPermit = async () => {
    setBusy("permit");
    try {
      await jobsApi.addPermit(id, { title: permitName.trim() || j(`permits.kinds.${permitKind}`), kind: permitKind, authority: permitAuthority.trim() || undefined, status: "needed" });
      void client.invalidateQueries({ queryKey: ["job-permits", id] });
      setPermitOpen(false); setPermitName(""); setPermitAuthority(""); setPermitKind("other");
      toast({ message: j("permits.saved") });
    } catch {
      toast({ message: j("failed") });
    } finally {
      setBusy(null);
    }
  };

  const addNote = async () => {
    setBusy("note");
    try {
      await jobsApi.addNote(id, noteText.trim());
      void client.invalidateQueries({ queryKey: ["job-notes", id] });
      setNoteOpen(false); setNoteText("");
      toast({ message: j("notes.saved") });
    } catch {
      toast({ message: j("failed") });
    } finally {
      setBusy(null);
    }
  };

  const permitLook = (p: Permit): { icon: IconName; tone: Tone; tone2: StatusTone; shape: StatusShape; word: string } => {
    const inspection = p.inspectionAt && p.status !== "closed" ? new Date(p.inspectionAt) : null;
    if (inspection) return { icon: "cal", tone: "amber", tone2: "warn", shape: "clock", word: j("permits.inspection", { date: shortDate(inspection, locale) }) };
    switch (p.status) {
      case "issued": return { icon: "shield", tone: "azure", tone2: "info", shape: "q1", word: j("permits.status.issued") };
      case "applied": return { icon: "shield", tone: "azure", tone2: "warn", shape: "clock", word: j("permits.status.applied") };
      case "closed": return { icon: "check", tone: "sage", tone2: "ok", shape: "check", word: j("permits.status.closed") };
      case "not_required": return { icon: "shield", tone: "slate", tone2: "mute", shape: "off", word: j("permits.status.not_required") };
      default: return { icon: "shield", tone: "slate", tone2: "mute", shape: "draft", word: j("permits.status.needed") };
    }
  };

  const reportLoading = reports.isPending && !reports.data;

  return (
    <>
      <Section pt={22} px={16}>
        <SectionHeader title={j("field.title")} link={open.length ? j("field.open", { count: open.length }) : j("field.allSorted")} />
        {reportLoading ? <Skeleton height={120} radius={22} /> : open.length ? (
          <Card>
            <RowList>
              {open.map((r) => {
                const who = r.authorName ?? j("field.crewMember");
                return (
                  <FieldReport key={r.id} initials={initialsOf(who)} tint={tintFor(who)} who={who} when={relativeWhen(new Date(r.createdAt), now, locale)} kind={{ ...KIND[r.kind], word: j(`field.kind.${r.kind}`) }} text={r.body}>
                    <Button kind="secondary" size="sm" label={j("field.answer")} onPress={() => { setAnswering(r); setAnswer(""); }} />
                    <Button kind="link" size="sm" label={j("field.sorted")} busy={busy === r.id ? j("saving") : false} onPress={() => void resolve(r)} />
                  </FieldReport>
                );
              })}
            </RowList>
          </Card>
        ) : (
          <Banner tone="ok" icon="check" iconTone="sage" lead={j("field.clearLead")}>{j("field.clearBody")}</Banner>
        )}
      </Section>

      <Section pt={22} px={16}>
        <SectionHeader title={j("today.title")} link={j("today.schedule")} onLink={() => router.push(screenHref("Schedule", j("today.schedule")))} />
        {today.isPending && !today.data ? <Skeleton height={90} radius={22} /> : blocks.length ? (
          <Card>
            <RowList>
              {blocks.map((b) => {
                const who = b.collaboratorName ?? b.label ?? "";
                const since = b.collaboratorId ? clockedIn.get(b.collaboratorId) : undefined;
                const started = new Date(b.startsAt) <= now;
                const st: { tone: StatusTone; shape: StatusShape; word: string } = since ? { tone: "ok", shape: "live", word: j("today.onSite") }
                  : started && !b.allDay && crew.data?.enabled ? { tone: "warn", shape: "clock", word: j("today.notIn") } : { tone: "mute", shape: "dot", word: j("today.booked") };
                return (
                  <RowBody key={b.id} leading={<Avatar initials={initialsOf(who)} tint={tintFor(who)} size={34} />} title={who} meta={b.milestoneTitle || b.title || undefined}
                    trailing={<><Num size={12.5} weight={500} color="t2">{b.allDay ? j("today.allDay") : `${time(new Date(b.startsAt), locale)} – ${time(new Date(b.endsAt), locale)}`}</Num><Status tone={st.tone} shape={st.shape}>{st.word}</Status></>} />
                );
              })}
            </RowList>
          </Card>
        ) : (
          <Card padded><Text size={13.5} color="muted">{j("today.empty")}</Text></Card>
        )}
      </Section>

      <Section pt={22} px={16}>
        <SectionHeader title={j("next.title")} />
        {next ? (
          <Card>
            <RowBody leading={<Icon name="hammer" tone="violet" size={30} />} title={next.milestone.title}
              meta={next.tasksTotal === 0 ? (next.milestone.plannedEnd ? j("next.dueNoTasks", { date: dayDate(dateOnly(next.milestone.plannedEnd), locale) }) : j("next.noTasks"))
                : next.milestone.plannedEnd ? j("next.due", { date: dayDate(dateOnly(next.milestone.plannedEnd), locale), left: next.tasksLeft, total: next.tasksTotal }) : j("next.noDate", { left: next.tasksLeft, total: next.tasksTotal })}
              trailing={next.milestone.status === "in_progress" ? <Status tone="ok" shape="live">{j("next.inProgress")}</Status> : <Status tone="mute" shape="dot">{j("next.planned")}</Status>} />
            {next.payment ? (
              <View style={{ borderTopWidth: 0 }}>
                <RowBody title={next.payment.pct != null ? j("next.term", { label: next.payment.label, pct: pct(next.payment.pct) }) : j("next.termNoPct", { label: next.payment.label })} meta={j("next.releases")}
                  trailing={<><Num size={17} weight={600}>{m(next.payment.cents)}</Num><Text size={11.5} color="muted">{next.invoiced ? j("next.invoiced") : j("next.invoiceWhenDone")}</Text></>} />
              </View>
            ) : null}
          </Card>
        ) : (
          <Card padded><Text size={13.5} color="muted">{j("next.allDone")}</Text></Card>
        )}
      </Section>

      <Section pt={22} px={16}>
        <SectionHeader title={j("budget.title")} link={d.budgetTotalCents > 0 ? j("budget.of", { spent: m(d.costs.totalCents), planned: m(d.budgetTotalCents) }) : undefined} />
        {bars.length ? (
          <BudgetBars rows={bars.map((b) => ({ name: j(`budget.categories.${b.category}`), spent: m(b.spentCents), planned: m(b.plannedCents), ratio: b.ratio, tone: b.tone }))} mark={progress} markLabel={j("budget.mark", { pct: pct(d.job.progressPercent) })} />
        ) : <Card padded><Text size={13.5} color="muted">{j("budget.empty")}</Text></Card>}
      </Section>

      <Section pt={22} px={16}>
        <SectionHeader title={j("permits.title")} link={j("permits.add")} onLink={() => setPermitOpen(true)} />
        {permits.data?.permits.length ? (
          <Card>
            <RowList>
              {permits.data.permits.map((p) => {
                const look = permitLook(p);
                const meta = p.status === "closed" && p.closedAt ? j("permits.status.closed") + " " + shortDate(dateOnly(p.closedAt), locale) : [p.authority, p.referenceNumber].filter(Boolean).join(" · ");
                return <RowBody key={p.id} leading={<Icon name={look.icon} tone={look.tone} size={26} />} title={p.title} meta={meta || undefined} trailing={<Status tone={look.tone2} shape={look.shape}>{look.word}</Status>} />;
              })}
            </RowList>
          </Card>
        ) : permits.isPending ? <Skeleton height={70} radius={22} /> : <Card padded><Text size={13.5} color="muted">{j("permits.empty")}</Text></Card>}
      </Section>

      <Section pt={22} px={16}>
        <SectionHeader title={j("notes.title")} link={j("notes.add")} onLink={() => setNoteOpen(true)} />
        {notes.data?.notes.length ? (
          <Card>
            <RowList>
              {notes.data.notes.slice(0, 20).map((n) => {
                const icon: [IconName, Tone] = n.source === "voice" ? ["mic", "violet"] : n.source === "photo" ? ["camera", "indigo"] : ["pen", "slate"];
                return (
                  <View key={n.id} style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
                    <Text size={14.5} leading={1.45}>{n.body}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
                      <Icon name={icon[0]} tone={icon[1]} size={16} />
                      <Text size={12.5} color="muted" style={{ flexShrink: 1 }}>{j("notes.line", { source: j(`notes.source.${n.source}`), who: n.authorName ?? "", when: relativeWhen(new Date(n.createdAt), now, locale) })}</Text>
                    </View>
                  </View>
                );
              })}
            </RowList>
          </Card>
        ) : notes.isPending ? <Skeleton height={70} radius={22} /> : <Card padded><Text size={13.5} color="muted">{j("notes.empty")}</Text></Card>}
      </Section>

      <Sheet open={!!answering} onClose={() => setAnswering(null)} label={j("field.answerTitle", { name: answering?.authorName ?? j("field.crewMember") })} closeLabel={t("close")}>
        <SheetTitle>{j("field.answerTitle", { name: answering?.authorName ?? j("field.crewMember") })}</SheetTitle>
        <Stack px={20} gap={14} pb={20}>
          {answering ? <Text size={13.5} color="muted" leading={1.4}>{answering.body}</Text> : null}
          <TextField label={j("field.answerPlaceholder")} value={answer} onChangeText={setAnswer} multiline autoFocus />
          <Text size={12.5} color="muted">{j("field.answerSub", { name: answering?.authorName ?? j("field.crewMember") })}</Text>
          <Button label={j("field.answerSend")} block disabled={!answer.trim()} busy={busy === answering?.id ? j("saving") : false} onPress={() => answering && void resolve(answering, answer.trim())} />
        </Stack>
      </Sheet>

      <Sheet open={permitOpen} onClose={() => setPermitOpen(false)} label={j("permits.sheetTitle")} closeLabel={t("close")}>
        <SheetTitle>{j("permits.sheetTitle")}</SheetTitle>
        <Stack px={20} gap={14} pb={20}>
          <ChipWrap>{PERMIT_KINDS.map((k) => <Chip key={k} label={j(`permits.kinds.${k}`)} selected={permitKind === k} onPress={() => setPermitKind(k)} />)}</ChipWrap>
          <TextField label={j("permits.name")} value={permitName} onChangeText={setPermitName} placeholder={j(`permits.kinds.${permitKind}`)} />
          <TextField label={j("permits.authority")} value={permitAuthority} onChangeText={setPermitAuthority} placeholder={j("permits.authorityPlaceholder")} />
          <Button label={j("permits.save")} block busy={busy === "permit" ? j("saving") : false} onPress={() => void addPermit()} />
        </Stack>
      </Sheet>

      <Sheet open={noteOpen} onClose={() => setNoteOpen(false)} label={j("notes.sheetTitle")} closeLabel={t("close")}>
        <SheetTitle>{j("notes.sheetTitle")}</SheetTitle>
        <Stack px={20} gap={14} pb={20}>
          <TextField label={j("notes.placeholder")} value={noteText} onChangeText={setNoteText} multiline autoFocus />
          <Button label={j("notes.save")} block disabled={!noteText.trim()} busy={busy === "note" ? j("saving") : false} onPress={() => void addNote()} />
        </Stack>
      </Sheet>
    </>
  );
}
