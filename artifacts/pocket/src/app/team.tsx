// Team.dc.html: the glance (crew, hours this month, to approve; the bars open under it), the workers (each opens in place: today, last 7 days, pay, link, with a pairing code
// for the crew phone), the time entries to approve (swipe: approve or reject), equipment, and the team members with seats, invites and access codes.
// Not built: a worker's certificates (the server holds none) and "today" on a worker's row (the Teammate screen has the week).
import { useMemo, useState, type ReactNode } from "react";
import { Linking } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiFailure } from "@/lib/api";
import { tintFor } from "@/lib/clients";
import { copyText } from "@/lib/copy";
import { entryFlags, equipmentMonth, hourBars, linkState, seatShare, seatsFull, teamKpis, validEmail, type MemberRow, type TimeRow } from "@/lib/team";
import { teamApi, type Worker } from "@/lib/teamApi";
import { money, number, shortDate, time, type Locale } from "@/lib/format";
import { initialsOf } from "@/lib/invites";
import { screenHref } from "@/lib/nav";
import { useSession } from "@/lib/useSession";
import { ACTION_BAR_SPACE } from "@/ui/ActionBar";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Chip, ChipWrap } from "@/ui/Chip";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { TextField } from "@/ui/Field";
import { ExpandCard, ExpandScrollView, XcActions, XcButton, XcCaption, XcDivider, XcRow } from "@/ui/Expand";
import { Header, PageTitle } from "@/ui/Header";
import { Section, Stack } from "@/ui/Layout";
import { Figures, Progress } from "@/ui/Numbers";
import { ListRow, RowList, SectionHeader } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { Status, type StatusShape, type StatusTone } from "@/ui/Status";
import { SwipeRow } from "@/ui/SwipeRow";
import { Num, Text } from "@/ui/Text";

const ROLES = ["office", "foreman", "viewer"] as const;
type Role = (typeof ROLES)[number];
const LINK_LOOK: Record<"active" | "sent" | "none", { tone: StatusTone; shape: StatusShape }> = { active: { tone: "ok", shape: "live" }, sent: { tone: "info", shape: "q1" }, none: { tone: "mute", shape: "off" } };
const FLAG_LOOK: Record<string, { tone: StatusTone; shape: StatusShape }> = { worker: { tone: "mute", shape: "dot" }, overtime: { tone: "warn", shape: "clock" }, offsite: { tone: "bad", shape: "alert" }, weekend: { tone: "info", shape: "dot" }, byHand: { tone: "mute", shape: "dot" } };

export default function Team() {
  const { t, i18n } = useTranslation();
  const m = (k: string, o?: Record<string, unknown>) => t(`tm.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { status } = useSession();
  const toast = useToast();
  const client = useQueryClient();
  const signedIn = status === "in" || status === "offline";
  const workersQ = useQuery({ queryKey: ["team-workers"], queryFn: teamApi.workers, enabled: signedIn, retry: 1 });
  const entriesQ = useQuery({ queryKey: ["team-entries"], queryFn: () => teamApi.entries("submitted"), enabled: signedIn, retry: 1 });
  const equipQ = useQuery({ queryKey: ["team-equipment"], queryFn: teamApi.equipment, enabled: signedIn, retry: 1 });
  const membersQ = useQuery({ queryKey: ["team-members"], queryFn: teamApi.members, enabled: signedIn, retry: 1 });
  const [swiped, setSwiped] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pairing, setPairing] = useState<{ worker: Worker; code: string } | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("office");
  const [codes, setCodes] = useState<string[] | null>(null);

  const workers = workersQ.data?.items ?? [];
  const entries = entriesQ.data?.items ?? [];
  const equipment = equipQ.data?.items ?? [];
  const members = membersQ.data?.items ?? [];
  const seats = membersQ.data?.seats;
  const kpis = useMemo(() => teamKpis(workers, entries), [workers, entries]);
  const bars = useMemo(() => hourBars(workers), [workers]);
  const month = new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date());
  const failed = (workersQ.isError && !workersQ.data) || (entriesQ.isError && !entriesQ.data);
  const loading = (workersQ.isPending && !workersQ.data) || (entriesQ.isPending && !entriesQ.data);
  const refresh = () => { for (const k of ["team-workers", "team-entries", "team-equipment", "team-members"]) void client.invalidateQueries({ queryKey: [k] }); };
  const fail = (e: unknown, fallback: string) => toast({ message: e instanceof ApiFailure && e.status === 403 && /PLAN/.test(e.code ?? "") ? m("members.plan") : e instanceof ApiFailure && e.code === "SEAT_LIMIT" ? m("members.full") : e instanceof ApiFailure && e.code === "ALREADY_MEMBER" ? m("members.already") : fallback });

  const approve = async (ids: string[]) => {
    setBusy("approve"); setSwiped(null);
    try { const r = await teamApi.approve(ids); toast({ message: m("entries.approved", { count: r.approved }) }); refresh(); } catch (e) { fail(e, m("entries.failed")); } finally { setBusy(null); }
  };
  const reject = async (id: string) => {
    setBusy(id); setSwiped(null);
    try { await teamApi.reject(id); toast({ message: m("entries.rejected") }); refresh(); } catch (e) { fail(e, m("entries.failed")); } finally { setBusy(null); }
  };
  const makePairing = async (w: Worker) => {
    setBusy(`pair${w.id}`);
    try { const r = await teamApi.pairingCode(w.id); setPairing({ worker: w, code: r.code }); }
    catch (e) { toast({ message: e instanceof ApiFailure && e.code === "INACTIVE" ? m("pair.inactive") : e instanceof ApiFailure && e.status === 403 ? m("pair.plan") : m("pair.failed") }); }
    finally { setBusy(null); }
  };
  const sendLink = async (w: Worker) => {
    setBusy(`link${w.id}`);
    try { await teamApi.sendLink(w.id); toast({ message: m("row.sendDone") }); refresh(); } catch (e) { fail(e, m("entries.failed")); } finally { setBusy(null); }
  };
  const invite = async () => {
    setBusy("invite");
    try { await teamApi.invite(email.trim(), role); toast({ message: m("members.sent") }); setEmail(""); setInviteOpen(false); refresh(); } catch (e) { fail(e, m("members.failed")); } finally { setBusy(null); }
  };
  const makeCodes = async () => {
    setBusy("codes");
    try { const r = await teamApi.codes(4, role); setCodes(r.codes.map((c) => c.code)); refresh(); }
    catch (e) { toast({ message: e instanceof ApiFailure && e.code === "SEAT_LIMIT" ? m("codes.full") : e instanceof ApiFailure && e.status === 403 ? m("members.plan") : m("codes.failed") }); }
    finally { setBusy(null); }
  };
  const copy = async (text: string, done: string) => { toast({ message: (await copyText(text)) ? done : m("entries.failed") }); };

  const flagLabel = (e: TimeRow, f: string) => (f === "overtime" ? `${m("entries.flags.overtime")} ${number(e.overtimeHours, locale, 1)} h` : m(`entries.flags.${f}`));
  const roleLabel = (r: string) => m(`members.roles.${r}`);
  const memberLine = (x: MemberRow) => (x.status === "invited" || !x.joinedAt
    ? x.kind === "code" ? m("members.codeSub", { hint: x.codeHint ?? "" }) : m("members.invitedOn", { date: shortDate(new Date(x.invitedAt), locale) })
    : m("members.joinedOn", { date: shortDate(new Date(x.joinedAt), locale) }));

  const workerRow = (w: Worker): ReactNode => {
    const l = linkState(w);
    const look = LINK_LOOK[l];
    const mine = entries.filter((e) => e.workerId === w.id);
    const rate = w.hourlyRateCents != null ? m("workers.rate", { rate: money(w.hourlyRateCents / 100, locale, { cents: true }), pct: number(w.burdenPercent, locale) }) : m("workers.rateNone");
    const phone = w.phone ? w.phone.replace(/[^\d+]/g, "") : "";
    return (
      <ExpandCard key={w.id} id={`w-${w.id}`} variant="row" list="workers" label={w.name}
        head={
          <Stack row align="center" gap={12} grow>
            <Avatar initials={initialsOf(w.name)} tint={tintFor(w.name)} size={38} />
            <Stack grow gap={2}>
              <Text size={14.5} weight={500} numberOfLines={1}>{w.name}</Text>
              <Text size={12.5} color="muted" numberOfLines={1}>{[m(`workers.${w.workerType === "subcontractor" ? "subcontractor" : "employee"}`), w.role].filter(Boolean).join(" · ")}</Text>
              <Text size={12.5} color="muted" numberOfLines={1}>{rate}</Text>
            </Stack>
            <Stack align="flex-end" gap={4}>
              <Num size={14.5} weight={600}>{`${number(w.hoursThisMonth, locale, 1)} h`}</Num>
              <Status tone={look.tone} shape={look.shape}>{m(`link.${l}`)}</Status>
            </Stack>
          </Stack>}>
        <XcDivider />
        <XcRow first title={m("row.lastWeek")} sub={mine.length ? m("row.pending", { count: mine.length }) : m("row.allApproved")}
          right={mine.length ? <><Num size={14.5} weight={600}>{`${number(mine.reduce((s, e) => s + e.hours, 0), locale, 1)} h`}</Num><XcButton label={m("row.approve")} onPress={() => void approve(mine.map((e) => e.id))} /></> : undefined} />
        <XcRow title={m("row.linkRow")} sub={w.lastTimeEntryAt ? m("row.lastSeen", { date: shortDate(new Date(w.lastTimeEntryAt), locale) }) : m("row.never")}
          right={<><Status plain tone={look.tone} shape={look.shape}>{m(`link.${l}`)}</Status>{w.email ? <XcButton tone="soft" label={m("row.send")} onPress={() => void sendLink(w)} /> : null}</>} />
        {!w.email && l === "none" ? <Text size={12.5} color="muted" leading={1.4}>{m("row.noEmail")}</Text> : null}
        <XcRow title={m("row.pairing")} sub={m("row.pairingSub")} right={<XcButton label={busy === `pair${w.id}` ? "…" : m("row.pairingMake")} onPress={() => void makePairing(w)} />} />
        <XcActions link={phone ? m("row.call") : m("row.open", { name: w.name.split(/\s+/)[0] ?? w.name })} onLink={() => (phone ? void Linking.openURL(`tel:${phone}`) : router.push(screenHref("Teammate", w.name, { id: w.id })))}
          main={m("row.open", { name: w.name.split(/\s+/)[0] ?? w.name })} onMain={() => router.push(screenHref("Teammate", w.name, { id: w.id }))} />
      </ExpandCard>
    );
  };

  return (
    <Screen>
      <Header title="" backLabel={m("back")} onBack={() => (router.canGoBack() ? router.back() : router.replace("/menu"))} />
      <ExpandScrollView contentContainerStyle={{ paddingBottom: ACTION_BAR_SPACE }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Section px={20}><PageTitle>{m("title")}</PageTitle></Section>
        {failed ? (
          <Section pt={26} px={16}><Empty icon="warn" iconTone="clay" title={m("loadFailed.title")} body={m("loadFailed.body")} action={m("retry")} onAction={refresh} /></Section>
        ) : loading ? (
          <Section pt={16} px={16} gap={12}><Skeleton height={74} radius={22} /><Skeleton height={220} radius={22} /><Skeleton height={140} radius={22} /></Section>
        ) : (
          <>
            <Section delay={40} pt={16} px={16}>
              <ExpandCard id="kpi" compact label={m("glance")}
                head={<Figures items={[
                  { label: m("kpi.crew"), value: String(kpis.crew), sub: [m("kpi.staff", { count: kpis.staff }), kpis.subs ? m("kpi.subs", { count: kpis.subs }) : ""].filter(Boolean).join(" · ") },
                  { label: m("kpi.hours"), value: number(kpis.monthHours, locale) },
                  { label: m("kpi.toApprove"), value: String(kpis.pending), sub: kpis.pending ? m("kpi.hoursSub", { hours: number(kpis.pendingHours, locale, 1) }) : m("kpi.allClear"), subTone: kpis.pending ? "warn" : "ok" },
                ]} />}>
                <XcDivider />
                <XcCaption>{m("kpi.bars", { month })}</XcCaption>
                <Stack gap={9} pt={8} pb={10}>
                  {bars.map((b) => (
                    <Stack key={b.id} row align="center" gap={10}>
                      <Stack w={62}><Text size={12.5} color="t2" numberOfLines={1}>{b.name}</Text></Stack>
                      <Stack grow><Progress value={b.width / 100} fill="inv" height={6} label={b.name} /></Stack>
                      <Stack w={54} align="flex-end"><Num size={12.5} weight={600}>{number(b.hours, locale, 1)}</Num></Stack>
                    </Stack>
                  ))}
                </Stack>
              </ExpandCard>
            </Section>

            <Section delay={70} pt={22} px={16}>
              <SectionHeader title={m("workers.title")} link={m("workers.thisMonth")} />
              <Card>
                {workers.length === 0 ? <Empty icon="users" iconTone="azure" title={m("workers.empty")} body={m("workers.emptyBody")} /> : <RowList>{workers.filter((w) => w.active).map(workerRow)}</RowList>}
              </Card>
            </Section>

            <Section delay={100} pt={22} px={16}>
              <SectionHeader title={m("entries.title")} link={entries.length ? m("entries.approveAll") : undefined} onLink={() => void approve(entries.map((e) => e.id))} />
              <Card>
                {entries.length === 0 ? <Empty icon="check" iconTone="sage" title={m("entries.allDone")} body={m("entries.allDoneSub")} /> : (
                  <RowList>
                    {entries.map((e) => {
                      const flags = entryFlags(e);
                      return (
                        <SwipeRow key={e.id} card={false} open={swiped === e.id} onOpenChange={(o) => setSwiped(o ? e.id : null)} accessibilityLabel={e.workerName ?? ""}
                          actions={[
                            { key: "approve", label: m("entries.approve"), icon: "check", iconTone: "sage", tone: "ok", onPress: () => void approve([e.id]) },
                            { key: "reject", label: m("entries.reject"), icon: "warn", iconTone: "rose", tone: "bad", onPress: () => void reject(e.id) },
                          ]}>
                          <Stack row align="flex-start" gap={12} px={16} pt={14} pb={14}>
                            <Avatar initials={initialsOf(e.workerName ?? "")} tint={tintFor(e.workerName ?? "")} size={34} />
                            <Stack grow gap={3}>
                              <Text size={14.5} weight={500}>{e.workerName ?? ""}</Text>
                              <Text size={12.5} color="muted">{[shortDate(new Date(`${e.date}T12:00:00`), locale), e.clockInAt && e.clockOutAt ? m("entries.span", { from: time(new Date(e.clockInAt), locale), to: time(new Date(e.clockOutAt), locale) }) : ""].filter(Boolean).join(" · ")}</Text>
                              <Text size={12.5} color="muted">{e.projectName ?? ""}</Text>
                              <Stack row wrap gap={5} pt={4}>{flags.map((f) => <Status key={f} tone={FLAG_LOOK[f]!.tone} shape={FLAG_LOOK[f]!.shape}>{flagLabel(e, f)}</Status>)}</Stack>
                            </Stack>
                            <Num size={15} weight={600}>{`${number(e.hours, locale, 1)} h`}</Num>
                          </Stack>
                        </SwipeRow>
                      );
                    })}
                  </RowList>
                )}
              </Card>
            </Section>

            <Section delay={130} pt={22} px={16}>
              <SectionHeader title={m("equipment.title")} link={equipment.length ? m("equipment.month", { amount: money(equipmentMonth(equipment) / 100, locale) }) : undefined} />
              <Card>
                {equipment.length === 0 ? <Empty icon="truck" iconTone="teal" title={m("equipment.empty")} body={m("equipment.emptyBody")} /> : (
                  <RowList>
                    {equipment.filter((q) => q.active).map((q) => {
                      const own = q.ownership === "rented" ? { tone: "info" as StatusTone, shape: "q1" as StatusShape } : q.ownership === "financed" ? { tone: "acc" as StatusTone, shape: "q2" as StatusShape } : { tone: "mute" as StatusTone, shape: "dot" as StatusShape };
                      return (
                        <ListRow key={q.id} title={q.name} meta={m("equipment.perUnit", { rate: money(q.usageRateCents / 100, locale), unit: m(`equipment.units.${q.usageUnit}`) })} note={q.financing ?? undefined}
                          trailing={<><Num size={14.5} weight={600}>{money(q.usageCentsThisMonth / 100, locale)}</Num><Status tone={own.tone} shape={own.shape}>{m(`equipment.${q.ownership === "rented" || q.ownership === "financed" ? q.ownership : "owned"}`)}</Status></>} />
                      );
                    })}
                  </RowList>
                )}
              </Card>
            </Section>

            <Section delay={160} pt={22} px={16}>
              <SectionHeader title={m("members.title")} link={m("members.logins")} />
              <Card>
                <Stack row align="center" gap={14} px={16} pt={16} pb={14}>
                  <Stack grow gap={8}>
                    <Text size={14.5}>{m("members.seats", { used: seats?.used ?? members.length + 1, limit: seats?.limit ?? 1 })}</Text>
                    <Progress value={seatShare(seats) / 100} fill="inv" height={6} label={m("members.seats", { used: seats?.used ?? 0, limit: seats?.limit ?? 0 })} />
                  </Stack>
                  <Button size="sm" kind="secondary" label={m("members.invite")} onPress={() => setInviteOpen((o) => !o)} />
                </Stack>
                <RowList>
                  {members.map((x) => (
                    <ListRow key={x.id} title={x.name ?? x.email ?? m("codes.title")} meta={memberLine(x)}
                      leading={<Avatar initials={x.name ? initialsOf(x.name) : "@"} tint={tintFor(x.name ?? x.email ?? x.id)} size={38} />}
                      trailing={<Status tone={x.status === "invited" ? "info" : "mute"} shape={x.status === "invited" ? "q1" : "dot"}>{roleLabel(x.role)}</Status>} />
                  ))}
                </RowList>
              </Card>
              <Stack pt={12}>
                <Card>
                  <Stack row align="center" gap={12} px={16} pt={14} pb={14}>
                    <Stack grow gap={2}>
                      <Text size={14.5} weight={500}>{m("codes.title")}</Text>
                      <Text size={12.5} color="muted">{codes ? m("codes.made", { count: codes.length, role: roleLabel(role) }) : m("codes.sub")}</Text>
                    </Stack>
                    <Button size="sm" kind="secondary" label={codes ? m("codes.done") : m("codes.make")} busy={busy === "codes" ? m("codes.make") : false} onPress={() => (codes ? setCodes(null) : void makeCodes())} />
                  </Stack>
                  {codes ? (
                    <Stack px={16} pb={16} gap={10}>
                      <Banner tone="warn" icon="warn" iconTone="amber" lead={m("codes.shownOnce")}>{m("codes.copyPrint")}</Banner>
                      <Stack row wrap gap={8}>
                        {codes.map((c) => <Stack key={c} w={160} h={44} align="center" justify="center"><Num size={15} weight={600} tracking={0.08}>{c}</Num></Stack>)}
                      </Stack>
                      <Button size="sm" kind="secondary" label={m("codes.copyAll")} onPress={() => void copy(codes.join("\n"), m("pair.copied"))} />
                    </Stack>
                  ) : null}
                </Card>
              </Stack>
            </Section>
          </>
        )}
      </ExpandScrollView>

      <Sheet open={inviteOpen} onClose={() => setInviteOpen(false)} label={m("members.invite")} closeLabel={m("close")}>
        <SheetTitle>{m("members.invite")}</SheetTitle>
        <Stack px={16} pb={20} gap={14}>
          <TextField label={m("members.email")} value={email} onChangeText={setEmail} placeholder={m("members.emailPh")} keyboardType="email-address" autoCapitalize="none" autoFocus />
          <Stack gap={8}>
            <Text size={12.5} color="muted">{m("members.role")}</Text>
            <ChipWrap>{ROLES.map((r) => <Chip key={r} label={roleLabel(r)} selected={role === r} onPress={() => setRole(r)} />)}</ChipWrap>
            <Text size={12.5} color="muted">{m(`members.roleNote.${role}`)}</Text>
          </Stack>
          {seatsFull(seats) ? <Banner tone="warn" icon="warn" iconTone="amber" lead={m("members.full")} /> : null}
          <Button size="lg" block label={m("members.send")} busy={busy === "invite" ? m("members.send") : false} disabled={!validEmail(email) || seatsFull(seats)} onPress={() => void invite()} />
        </Stack>
      </Sheet>

      <Sheet open={!!pairing} onClose={() => setPairing(null)} label={m("pair.title", { name: pairing?.worker.name ?? "" })} closeLabel={m("close")}>
        <SheetTitle>{m("pair.title", { name: pairing?.worker.name ?? "" })}</SheetTitle>
        <Stack px={16} pb={20} gap={14} align="center">
          <Text size={13.5} color="muted">{m("pair.for")}</Text>
          <Num size={34} weight={600} tracking={0.08}>{pairing?.code ?? ""}</Num>
          <Text size={12.5} color="muted" leading={1.4} align="center">{m("row.pairingSub")}</Text>
          <Stack row gap={8}>
            <Button kind="secondary" label={m("pair.copy")} onPress={() => pairing && void copy(pairing.code, m("pair.copied"))} />
            <Button label={m("pair.done")} onPress={() => setPairing(null)} />
          </Stack>
        </Stack>
      </Sheet>
    </Screen>
  );
}
