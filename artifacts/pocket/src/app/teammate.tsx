// Teammate.dc.html: one worker. Their name, trade and link, quick call and text, pay (rate, burden, real cost), the last two weeks of hours, their jobs, the personal link
// (send, revoke, or a pairing code for the crew phone), what they can do (add tasks) and deactivate. States: default, deactivated (a banner and Reactivate).
// Not built: the role grid and certificates (the server holds neither for a crew worker); the read-only state shows when the server refuses the change.
import { useMemo, useState } from "react";
import { Linking } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiFailure } from "@/lib/api";
import { tintFor } from "@/lib/clients";
import { copyText } from "@/lib/copy";
import { money, number, shortDate, type Locale } from "@/lib/format";
import { initialsOf } from "@/lib/invites";
import { screenHref } from "@/lib/nav";
import { hoursByJob, linkState, periodTotals, realHourlyCents } from "@/lib/team";
import { teamApi } from "@/lib/teamApi";
import { useSession } from "@/lib/useSession";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { Header } from "@/ui/Header";
import { Section, ScrollPage, Stack } from "@/ui/Layout";
import { Figures, Progress } from "@/ui/Numbers";
import { ListRow, RowList, SectionHeader } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { Status } from "@/ui/Status";
import { Switch } from "@/ui/Switch";
import { Num, Text } from "@/ui/Text";
import { QuickLink } from "@/ui/Crew";

const DAY = 86_400_000;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function Teammate() {
  const { t, i18n } = useTranslation();
  const m = (k: string, o?: Record<string, unknown>) => t(`tm.mate.${k}`, o) as string;
  const tm = (k: string, o?: Record<string, unknown>) => t(`tm.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { status } = useSession();
  const toast = useToast();
  const client = useQueryClient();
  const signedIn = status === "in" || status === "offline";
  const [from, to] = useMemo(() => { const now = new Date(); return [iso(new Date(now.getTime() - 13 * DAY)), iso(now)]; }, []);
  const workers = useQuery({ queryKey: ["team-workers"], queryFn: teamApi.workers, enabled: signedIn, retry: 1 });
  const entriesQ = useQuery({ queryKey: ["team-worker-entries", id, from], queryFn: () => teamApi.workerEntries(id!, from, to), enabled: signedIn && !!id, retry: 1 });
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  const w = workers.data?.items.find((x) => x.id === id);
  const entries = entriesQ.data?.items ?? [];
  const totals = useMemo(() => periodTotals(entries), [entries]);
  const jobs = useMemo(() => hoursByJob(entries), [entries]);
  const refresh = () => { void client.invalidateQueries({ queryKey: ["team-workers"] }); void client.invalidateQueries({ queryKey: ["team-worker-entries"] }); };
  const back = () => (router.canGoBack() ? router.back() : router.replace("/team"));
  const fail = (e: unknown) => toast({ message: e instanceof ApiFailure && e.status === 403 ? tm("members.plan") : m("failed") });
  const run = async (key: string, fn: () => Promise<unknown>, done?: string) => {
    setBusy(key);
    try { await fn(); if (done) toast({ message: done }); refresh(); } catch (e) { fail(e); } finally { setBusy(null); }
  };

  if (workers.isPending && !workers.data) return <Screen><Header title="" backLabel={m("back")} onBack={back} /><Section pt={16} px={16} gap={12}><Skeleton height={72} radius={22} /><Skeleton height={90} radius={22} /><Skeleton height={140} radius={22} /></Section></Screen>;
  if (!w) return <Screen><Header title="" backLabel={m("back")} onBack={back} /><Section pt={26} px={16}><Empty icon="user" iconTone="azure" title={m("notFound")} body={m("notFoundBody")} action={m("back")} onAction={back} /></Section></Screen>;

  const first = w.name.split(/\s+/)[0] ?? w.name;
  const l = linkState(w);
  const phone = w.phone ? w.phone.replace(/[^\d+]/g, "") : "";
  const real = w.hourlyRateCents != null ? realHourlyCents(w.hourlyRateCents, w.burdenPercent) : null;
  const toApproveShare = totals.hours > 0 ? totals.toApprove / totals.hours : 0;
  const overtimeShare = totals.hours > 0 ? totals.overtime / totals.hours : 0;
  const regularShare = Math.max(0, 1 - toApproveShare - overtimeShare);

  return (
    <Screen>
      <Header title="" backLabel={m("back")} onBack={back} />
      <ScrollPage bottom={48}>
        {!w.active ? <Section px={16} pt={4} pb={10}><Banner tone="warn" icon="warn" iconTone="amber" lead={m("inactiveLead", { name: first })}>{m("inactiveText")}</Banner></Section> : null}
        <Section px={20} pt={6} row align="center" gap={16}>
          <Avatar initials={initialsOf(w.name)} tint={tintFor(w.name)} size={72} />
          <Stack grow gap={5}>
            <Text size={24} weight={600} tracking={-0.035} accessibilityRole="header">{w.name}</Text>
            <Text size={13.5} color="muted">{[w.role, m("since", { date: shortDate(new Date(w.createdAt), locale) })].filter(Boolean).join(" · ")}</Text>
            <Stack row wrap gap={6} pt={2}>
              <Status tone="mute" shape="dot">{tm(`workers.${w.workerType === "subcontractor" ? "subcontractor" : "employee"}`)}</Status>
              <Status tone={l === "active" ? "ok" : l === "sent" ? "info" : "mute"} shape={l === "active" ? "live" : l === "sent" ? "q1" : "off"}>{tm(`link.${l}`)}</Status>
            </Stack>
          </Stack>
        </Section>

        <Section delay={30} px={16} pt={16}>
          <Stack row gap={8}>
            <QuickLink icon="phone" tone="sage" label={m("quick.call")} onPress={() => (phone ? void Linking.openURL(`tel:${phone}`) : toast({ message: tm("row.noEmail") }))} />
            <QuickLink icon="chat" tone="azure" label={m("quick.text")} onPress={() => (phone ? void Linking.openURL(`sms:${phone}`) : toast({ message: tm("row.noEmail") }))} />
            <QuickLink icon="clock" tone="teal" label={m("quick.hours")} onPress={() => router.push(screenHref("Timesheets", m("quick.hours")))} />
          </Stack>
        </Section>

        <Section delay={90} px={16} pt={24}>
          <SectionHeader title={m("pay")} link={w.payrollId ? m("payroll", { no: w.payrollId }) : m("noPayroll")} />
          <Card>
            <Stack>
              <Figures items={[
                { label: m("rate"), value: w.hourlyRateCents != null ? money(w.hourlyRateCents / 100, locale, { cents: true }) : "–", sub: m("perHour") },
                { label: m("burden"), value: `${number(w.burdenPercent, locale)} %`, sub: "" },
                { label: m("realCost"), value: real != null ? money(real / 100, locale, { cents: true }) : "–", sub: m("perHour") },
              ]} />
            </Stack>
          </Card>
        </Section>

        <Section delay={110} px={16} pt={24}>
          <SectionHeader title={m("period")} link={`${shortDate(new Date(`${from}T12:00:00`), locale)} – ${shortDate(new Date(`${to}T12:00:00`), locale)}`} />
          <Card padded>
            <Stack gap={14}>
              <Stack row align="center" justify="space-between" gap={10}>
                <Num size={32} weight={600} tracking={-0.04}>{`${number(totals.hours, locale, 1)} h`}</Num>
                <Num size={15} weight={600}>{money(totals.costCents / 100, locale, { cents: true })}</Num>
              </Stack>
              <Progress value={Math.min(1, regularShare + overtimeShare)} fill="inv" height={8} label={m("period")} />
              <Stack row wrap gap={14}>
                <Text size={12.5} color="muted">{`${number(totals.regular - totals.toApprove > 0 ? totals.regular - totals.toApprove : 0, locale, 1)} ${m("regular")}`}</Text>
                <Text size={12.5} color="warn">{`${number(totals.overtime, locale, 1)} ${m("overtime")}`}</Text>
                <Text size={12.5} color="muted">{`${number(totals.toApprove, locale, 1)} ${m("toApprove")}`}</Text>
              </Stack>
            </Stack>
          </Card>
        </Section>

        <Section delay={130} px={16} pt={24}>
          <SectionHeader title={m("jobs")} link={jobs.length ? m("jobsCount", { count: jobs.length }) : undefined} />
          <Card>
            {jobs.length === 0 ? <Empty icon="hammer" iconTone="clay" title={m("jobsNone")} body={m("jobsNoneBody")} /> : (
              <RowList>
                {jobs.map((j) => <ListRow key={j.projectId} title={j.name} onPress={() => router.push(screenHref("Job", j.name, { id: j.projectId }))} trailing={<Num size={14.5} weight={600}>{`${number(j.hours, locale, 1)} h`}</Num>} />)}
              </RowList>
            )}
          </Card>
        </Section>

        <Section delay={170} px={16} pt={24}>
          <SectionHeader title={m("link")} />
          <Card>
            <Stack px={16} pt={13} pb={13} gap={2}>
              <Text size={14.5} weight={500}>{l === "active" ? m("linkActive") : l === "sent" ? m("linkSent") : m("linkNone")}</Text>
              <Text size={12.5} color="muted" leading={1.4}>{l === "none" ? m("linkNoneSub") : w.lastTimeEntryAt ? tm("row.lastSeen", { date: shortDate(new Date(w.lastTimeEntryAt), locale) }) : tm("row.never")}</Text>
            </Stack>
            <Stack row gap={8} px={16} pb={16}>
              <Stack grow><Button size="sm" kind="secondary" block label={m("pairing")} busy={busy === "pair" ? m("pairing") : false} disabled={!w.active} onPress={() => void run("pair", async () => { setCode((await teamApi.pairingCode(w.id)).code); })} /></Stack>
              <Stack grow><Button size="sm" kind="secondary" block label={m("send")} busy={busy === "send" ? m("send") : false} disabled={!w.active || !w.email} onPress={() => void run("send", () => teamApi.sendLink(w.id), m("sent"))} /></Stack>
              <Stack grow><Button size="sm" kind="destructive" block label={m("revoke")} busy={busy === "revoke" ? m("revoke") : false} disabled={l === "none"} onPress={() => void run("revoke", () => teamApi.revokeLink(w.id), m("revoked"))} /></Stack>
            </Stack>
          </Card>
        </Section>

        <Section delay={190} px={16} pt={24}>
          <SectionHeader title={m("can")} />
          <Card>
            <Stack row align="center" gap={12} px={16} pt={12} pb={12}>
              <Stack grow gap={2}>
                <Text size={14.5} weight={500}>{m("addTasks")}</Text>
                <Text size={12.5} color="muted" leading={1.35}>{m("addTasksSub")}</Text>
              </Stack>
              <Switch value={w.canAddTasks} label={m("addTasks")} disabled={!w.active || busy === "tasks"} onChange={(v) => void run("tasks", () => teamApi.updateWorker(w.id, { canAddTasks: v }), m("saved"))} />
            </Stack>
          </Card>
        </Section>

        <Section delay={210} px={16} pt={24} gap={10}>
          {w.active
            ? <Button kind="destructive" size="lg" block label={m("deactivate", { name: first })} onPress={() => setConfirm(true)} />
            : <Button size="lg" block label={m("reactivate", { name: first })} busy={busy === "active" ? m("reactivate", { name: first }) : false} onPress={() => void run("active", () => teamApi.updateWorker(w.id, { active: true }), m("saved"))} />}
          {w.active ? <Text size={12.5} color="faint" align="center">{m("deactivateSub")}</Text> : null}
        </Section>
      </ScrollPage>

      <Sheet open={confirm} onClose={() => setConfirm(false)} label={m("deactivateTitle", { name: w.name })} closeLabel={tm("close")}>
        <Stack px={16} pb={20} gap={14} align="center">
          <Text size={19} weight={600} tracking={-0.03} align="center">{m("deactivateTitle", { name: w.name })}</Text>
          <Text size={13.5} color="muted" leading={1.45} align="center">{m("deactivateText")}</Text>
          <Stack gap={8} w={320}>
            <Button kind="destructive" size="lg" block label={m("deactivate", { name: first })} onPress={() => { setConfirm(false); void run("active", () => teamApi.updateWorker(w.id, { active: false }), m("saved")); }} />
            <Button kind="secondary" size="lg" block label={m("cancel")} onPress={() => setConfirm(false)} />
          </Stack>
        </Stack>
      </Sheet>

      <Sheet open={!!code} onClose={() => setCode(null)} label={tm("pair.title", { name: w.name })} closeLabel={tm("close")}>
        <SheetTitle>{tm("pair.title", { name: w.name })}</SheetTitle>
        <Stack px={16} pb={20} gap={14} align="center">
          <Text size={13.5} color="muted">{tm("pair.for")}</Text>
          <Num size={34} weight={600} tracking={0.08}>{code ?? ""}</Num>
          <Text size={12.5} color="muted" leading={1.4} align="center">{tm("row.pairingSub")}</Text>
          <Stack row gap={8}>
            <Button kind="secondary" label={tm("pair.copy")} onPress={() => code && void copyText(code).then((ok) => toast({ message: ok ? tm("pair.copied") : m("failed") }))} />
            <Button label={tm("pair.done")} onPress={() => setCode(null)} />
          </Stack>
        </Stack>
      </Sheet>
    </Screen>
  );
}
