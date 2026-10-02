// CrewTravel.dc.html. Mileage and per diem for an employee: the pay period's three figures, then a form (the day, the job; for mileage the route, the kilometres and
// "round trip"; for per diem the days away and "stayed overnight"; a note) that goes to the office to check before pay. Below, what was claimed this period with where
// each stands. Subcontractors bill travel on their own invoice, so they don't see this. With no signal it is kept on the phone and sent later.
// Not built: "Use map distance" (no map in the app yet) and the receipt photo (the server takes a claim without one).
import { useState } from "react";
import { RoleTabs } from "@/ui/TabShell";
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { tintFor } from "@/lib/clients";
import { periodDays, travelTotals, type CrewAllowance } from "@/lib/crew";
import { crewApi } from "@/lib/crewApi";
import { runOrQueue, uuid, useOutbox } from "@/lib/crewOutbox";
import { number, shortDate, type Locale } from "@/lib/format";
import { initialsOf } from "@/lib/invites";
import { useCrew } from "@/lib/useCrew";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { CrewHeader } from "@/ui/Crew";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { TextField } from "@/ui/Field";
import { Header } from "@/ui/Header";
import { Icon } from "@/ui/Icon";
import { Section, ScrollPage, Stack } from "@/ui/Layout";
import { Figures } from "@/ui/Numbers";
import { MenuList, MenuRow, RowBody, RowList, SectionHeader } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Segmented } from "@/ui/Segmented";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { Status, type StatusShape, type StatusTone } from "@/ui/Status";
import { Switch } from "@/ui/Switch";
import { MiniStepper } from "@/ui/JobSetup";
import { Num, Text } from "@/ui/Text";

const dayOf = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y!, m! - 1, d!, 12); };

export default function CrewTravel() {
  const { t, i18n } = useTranslation();
  const c = (k: string, o?: Record<string, unknown>) => t(`crew.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const crew = useCrew();
  const toast = useToast();
  const client = useQueryClient();
  const outbox = useOutbox();
  const [kind, setKind] = useState(0);
  const [dayIx, setDayIx] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [km, setKm] = useState(14);
  const [round, setRound] = useState(true);
  const [days, setDays] = useState(2);
  const [night, setNight] = useState(true);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | "sent" | "saved">(null);
  const [pick, setPick] = useState(false);
  const view = crew.view;

  if (!crew.loading && crew.unpaired) return <Redirect href="/crew-pair" />;
  if (crew.problem) return <Redirect href={{ pathname: "/crew-expired", params: { state: crew.problem } } as never} />;
  if (crew.loading || !view) return <Screen><Section pt={72} px={20} gap={14}><Skeleton width={200} height={28} radius={10} /><Skeleton height={420} radius={22} /></Section></Screen>;

  const company = view.companyName || c("expired.yourCompany");
  const header = <Header title="" backLabel={c("back")} onBack={() => (router.canGoBack() ? router.back() : router.replace("/crew-now"))} />;
  if (!view.travel || (!view.travel.km && !view.travel.perDiem)) {
    return <Screen>{header}<Section pt={26} px={16}><Empty icon="truck" iconTone="amber" title={c("travel.title")} body={view.worker.role && !view.travel ? c("travel.notForSubs") : c("travel.notOffered")} /></Section></Screen>;
  }

  const period = periodDays(view.today);
  const dayChoices = period.slice(0, 7);
  const day = dayChoices[dayIx]!;
  const jobs = view.jobs;
  const chosen = jobId ?? view.activeEntry?.projectId ?? view.todayJobs[0]?.id ?? jobs[0]?.id ?? null;
  const job = jobs.find((j) => j.id === chosen);
  const items = view.allowances.filter((a) => period.includes(a.date));
  const totals = travelTotals(items);
  const queued = outbox.filter((o) => o.kind === "allowance");
  const total = round ? km * 2 : km;
  const dayLabel = dayIx === 0 ? `${c("hours.today")}, ${new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric" }).format(dayOf(day))}` : new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric" }).format(dayOf(day));
  const periodLabel = c("travel.period", { from: shortDate(dayOf(period[period.length - 1]!), locale), to: shortDate(dayOf(period[0]!), locale) });
  const sendLabel = kind === 0 ? c("travel.sendKm", { count: total }) : c("travel.sendDays", { count: days });
  const saveLabel = kind === 0 ? c("travel.saveKm", { count: total }) : c("travel.saveDays", { count: days });
  const offline = crew.stale;

  const submit = async () => {
    if (kind === 0 && !from.trim()) { toast({ message: c("travel.fromNeeded") }); return; }
    const noteText = kind === 0 ? [`${from.trim()} → ${to.trim() || job?.name || ""}`, round ? c("travel.thereBack") : c("travel.oneWay"), note.trim()].filter(Boolean).join(" · ") : [night ? c("travel.overnightTag") : "", note.trim()].filter(Boolean).join(" · ");
    const body = { kind: kind === 0 ? ("mileage" as const) : ("per_diem" as const), quantity: kind === 0 ? total : days, date: day, projectId: chosen, note: noteText.slice(0, 300) };
    setBusy(true);
    const ref = uuid();
    try {
      const r = await runOrQueue(() => crewApi.allowance(crew.path!, { ...body, clientRef: ref }), { kind: "allowance", id: ref, body, label: "allowance" });
      setDone(r.done ? "sent" : "saved");
      setNote("");
      if (r.done) void client.invalidateQueries({ queryKey: ["crew", crew.path] });
    } catch {
      toast({ message: c("travel.failed") });
    } finally {
      setBusy(false);
    }
  };

  const look = (a: CrewAllowance): { tone: StatusTone; shape: StatusShape; word: string } =>
    a.status === "approved" || a.status === "paid" ? { tone: "ok", shape: "check", word: c(`travel.status.${a.status}`) } : a.status === "rejected" ? { tone: "bad", shape: "alert", word: c("travel.status.rejected") } : { tone: "warn", shape: "clock", word: c("travel.status.submitted") };

  return (
    <Screen floating={<RoleTabs active="travel" />}>
      {header}
      <ScrollPage bottom={40}>
        <CrewHeader company={company} initials={initialsOf(company)} switchLabel={c("switchCompany")} worker={initialsOf(view.worker.name)} tint={tintFor(view.worker.name)} workerLabel={view.worker.name} />
        <Section px={20} pt={14} gap={5}>
          <Text size={28} weight={600} tracking={-0.04} leading={1.15} accessibilityRole="header">{c("travel.title")}</Text>
          <Text size={13.5} color="muted">{periodLabel}</Text>
        </Section>
        <Section delay={40} px={16} pt={16}>
          <Card padded><Figures items={[
            { label: c("travel.distance"), value: `${number(totals.km, locale)} km`, sub: c("travel.perPeriod") },
            { label: c("travel.daysAway"), value: number(totals.days, locale), sub: c("travel.perDiemWord") },
            { label: c("travel.waiting"), value: String(totals.waiting + queued.length), sub: c("travel.onOffice") },
          ]} /></Card>
        </Section>
        {offline ? <Section px={16} pt={12}><Banner tone="info" icon="cloud" iconTone="amber" lead={c("offline")} /></Section> : null}

        <Section delay={80} px={16} pt={16} gap={14}>
          {done ? <Banner tone="ok" icon="check" iconTone="sage" lead={done === "sent" ? c("travel.sent") : c("travel.savedMsg")}>{done === "sent" ? c("travel.sentSub") : c("travel.savedSub")}</Banner> : null}
          {view.travel.km && view.travel.perDiem ? <Segmented label={c("travel.title")} options={[c("travel.mileage"), c("travel.perDiem")]} value={kind} onChange={(i) => { setKind(i); setDone(null); }} /> : null}
          <Card>
            <Stack row align="center" gap={12} px={16} pt={12} pb={12}>
              <Icon name="cal" tone="azure" size={28} />
              <Stack grow gap={1}><Text size={12.5} color="muted">{c("travel.day")}</Text><Text size={14.5} weight={500}>{dayLabel}</Text></Stack>
              <Button kind="link" size="sm" label={c("travel.earlier")} onPress={() => setDayIx((dayIx + 1) % dayChoices.length)} />
            </Stack>
            <Stack row align="center" gap={12} px={16} pt={12} pb={12}>
              <Icon name="house" tone="clay" size={28} />
              <Stack grow gap={1}><Text size={12.5} color="muted">{c("travel.job")}</Text><Text size={14.5} weight={500} numberOfLines={1}>{job?.name ?? ""}</Text></Stack>
              {jobs.length > 1 ? <Button kind="link" size="sm" label={c("travel.change")} onPress={() => setPick(true)} /> : null}
            </Stack>
          </Card>
          {kind === 0 ? (
            <Card padded>
              <Stack gap={12}>
                <Text size={13.5} weight={600}>{c("travel.route")}</Text>
                <TextField label={c("travel.from")} value={from} onChangeText={setFrom} placeholder={c("travel.fromPh")} />
                <TextField label={c("travel.to")} value={to} onChangeText={setTo} placeholder={job?.address ?? c("travel.toPh")} />
                <Stack row align="center" justify="space-between">
                  <Stack gap={1}><Num size={28} weight={600} tracking={-0.03}>{`${total} km`}</Num><Text size={12.5} color="muted">{round ? c("travel.thereBack") : c("travel.oneWay")}</Text></Stack>
                  <MiniStepper decLabel={c("travel.kmLess")} incLabel={c("travel.kmMore")} onDec={() => setKm(Math.max(1, km - 1))} onInc={() => setKm(km + 1)} canDec={km > 1} />
                </Stack>
                <Stack row align="center" justify="space-between" gap={12}>
                  <Stack grow gap={1}><Text size={14.5} weight={500}>{c("travel.roundTrip")}</Text><Text size={12.5} color="muted">{c("travel.roundTripSub")}</Text></Stack>
                  <Switch value={round} onChange={setRound} label={c("travel.roundTrip")} />
                </Stack>
              </Stack>
            </Card>
          ) : (
            <Card padded>
              <Stack gap={12}>
                <Stack row align="center" justify="space-between">
                  <Stack gap={1}><Num size={28} weight={600} tracking={-0.03}>{String(days)}</Num><Text size={12.5} color="muted">{c("travel.daysAwayCount", { count: days })}</Text></Stack>
                  <MiniStepper decLabel={c("travel.daysLess")} incLabel={c("travel.daysMore")} onDec={() => setDays(Math.max(1, days - 1))} onInc={() => setDays(Math.min(14, days + 1))} canDec={days > 1} />
                </Stack>
                <Stack row align="center" justify="space-between" gap={12}>
                  <Stack grow gap={1}><Text size={14.5} weight={500}>{c("travel.overnight")}</Text><Text size={12.5} color="muted">{c("travel.overnightSub")}</Text></Stack>
                  <Switch value={night} onChange={setNight} label={c("travel.overnight")} />
                </Stack>
              </Stack>
            </Card>
          )}
          <TextField label={c("travel.note")} value={note} onChangeText={setNote} placeholder={kind === 0 ? c("travel.notePhKm") : c("travel.notePhDiem")} multiline />
          <Button size="lg" block label={offline ? saveLabel : sendLabel} busy={busy ? "…" : false} disabled={!chosen} onPress={() => void submit()} />
          <Text size={12.5} color="faint" align="center">{c("travel.checks", { name: c("hours.the") })}</Text>
        </Section>

        <Section delay={120} px={16} pt={24}>
          <SectionHeader title={c("travel.claimed")} link={String(items.length + queued.length)} />
          <Card>
            <RowList>
              {queued.map((o) => <RowBody key={o.id} title={(o.body as { kind: string }).kind === "mileage" ? c("travel.kmOne", { count: (o.body as { quantity: number }).quantity }) : c("travel.away", { count: (o.body as { quantity: number }).quantity })} meta={c("travel.savedSub")} trailing={<Status tone="mute" shape="draft">{c("travel.status.saved")}</Status>} />)}
              {items.map((a) => (
                <RowBody key={a.id} title={a.kind === "mileage" ? c("travel.kmOne", { count: a.quantity }) : c("travel.away", { count: a.quantity })} meta={a.note || a.projectName || undefined}
                  trailing={<><Status tone={look(a).tone} shape={look(a).shape}>{look(a).word}</Status><Text size={11.5} color="faint">{shortDate(dayOf(a.date), locale)}</Text></>} />
              ))}
              {!items.length && !queued.length ? <Stack px={16} pt={14} pb={14}><Text size={13.5} color="muted">{c("travel.none")}</Text></Stack> : null}
            </RowList>
          </Card>
        </Section>
      </ScrollPage>
      <Sheet open={pick} onClose={() => setPick(false)} label={c("clock.pickJob")} closeLabel={c("close")}>
        <SheetTitle>{c("clock.pickJob")}</SheetTitle>
        <MenuList>{jobs.map((j) => <MenuRow key={j.id} icon={<Icon name="cone" tone="amber" size={28} />} title={j.name} sub={j.address ?? undefined} chevron={false} onPress={() => { setJobId(j.id); setPick(false); }} />)}</MenuList>
      </Sheet>
    </Screen>
  );
}
