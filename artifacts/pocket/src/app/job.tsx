// Job.dc.html. One job: its status and dates, the name and the client, the progress card (milestones, four figures), the three quick
// actions (On my way, Add photo, Voice note) and ten tabs: Overview, Schedule, Change orders, Costs, Invoices, Team, Photos, Messages,
// Documents, Assistant. The tabs stay under the quick actions while the page scrolls; the floating bar's one action follows the tab.
// States built: loading, can't load, not found, offline (the last data), a job on hold and a finished one. Not on the board: the "more"
// menu (edit the plan, put on hold or resume, mark complete, archive) and the rename sheet.
import { useCallback, useMemo, useState } from "react";
import { Linking, ScrollView, View } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiFailure } from "@/lib/api";
import { tintFor } from "@/lib/clients";
import { dateRange, money, type Locale } from "@/lib/format";
import { initialsOf } from "@/lib/invites";
import { dateOnly } from "@/lib/jobs";
import { figures, jobWindow, milestoneCounts, segments, TAB_ORDER, type JobTab } from "@/lib/jobPage";
import { jobsApi } from "@/lib/jobsApi";
import { addJobPhoto } from "@/lib/jobPhotos";
import { useDictation } from "@/lib/newQuoteInput";
import { screenHref } from "@/lib/nav";
import { useRememberOpened } from "@/lib/recents";
import { useSession } from "@/lib/useSession";
import { ChangeOrders } from "@/jobTabs/ChangeOrders";
import { Costs } from "@/jobTabs/Costs";
import { Invoices } from "@/jobTabs/Invoices";
import { Ask } from "@/jobTabs/Ask";
import { Documents } from "@/jobTabs/Documents";
import { Messages } from "@/jobTabs/Messages";
import { Overview } from "@/jobTabs/Overview";
import { Photos } from "@/jobTabs/Photos";
import { RecordSheet } from "@/jobTabs/RecordSheet";
import { Schedule } from "@/jobTabs/Schedule";
import { Team } from "@/jobTabs/Team";
import { PrimaryContext, type Primary } from "@/jobTabs/primary";
import { ActionBar, ACTION_BAR_SPACE } from "@/ui/ActionBar";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Empty, Skeleton, useToast } from "@/ui/Feedback";
import { TextField } from "@/ui/Field";
import { Header } from "@/ui/Header";
import { Icon } from "@/ui/Icon";
import { ClientRow, JobTabs, ProgressCard, QuickTiles, StatusDates, TitleRow } from "@/ui/JobPage";
import { Section, Stack } from "@/ui/Layout";
import { MenuList, MenuRow } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import type { StatusShape, StatusTone } from "@/ui/Status";
import { Text } from "@/ui/Text";

const LOOK: Record<string, { tone: StatusTone; shape: StatusShape }> = {
  setup: { tone: "acc", shape: "q2" }, planning: { tone: "info", shape: "q1" }, active: { tone: "ok", shape: "live" }, suspended: { tone: "warn", shape: "pause" }, completed: { tone: "mute", shape: "check" },
};

export default function Job() {
  const { t, i18n } = useTranslation();
  const j = (k: string, o?: Record<string, unknown>) => t(`job.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const lang: "en" | "fr" = i18n.language === "fr" ? "fr" : "en";
  const { id, tab: tabParam } = useLocalSearchParams<{ id?: string; tab?: string }>();
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const toast = useToast();
  const client = useQueryClient();
  const q = useQuery({ queryKey: ["job", id], queryFn: () => jobsApi.get(id!), enabled: signedIn && !!id, retry: 1, staleTime: 15_000 });
  const [tab, setTab] = useState<JobTab>((TAB_ORDER as string[]).includes(tabParam ?? "") ? (tabParam as JobTab) : "overview");
  const [primary, setPrimary] = useState<Primary | null>(null);
  const [menu, setMenu] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [name, setName] = useState("");
  const [record, setRecord] = useState(false);
  const [omw, setOmw] = useState<"idle" | "busy" | "sent">("idle");
  const dictation = useDictation();
  const d = q.data;
  useRememberOpened(d ? { type: "jobs", id: d.job.id, title: d.job.name, sub: d.job.address } : null);
  const setPrimaryStable = useCallback((p: Primary | null) => setPrimary(p), []);
  const win = useMemo(() => (d ? jobWindow(d) : null), [d]);
  if (status === "out") return <Redirect href="/" />;

  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("Jobs", t("tabs.jobs"))));
  const header = (more?: () => void, title = "") => <Header title={title} subtle backLabel={j("back")} onBack={back} moreLabel={j("more")} onMore={more} />;
  const refresh = () => { void client.invalidateQueries({ queryKey: ["job", id] }); void client.invalidateQueries({ queryKey: ["jobs"] }); };

  if (q.error instanceof ApiFailure && q.error.status === 404) {
    return <Screen>{header()}<Section pt={26} px={16}><Empty icon="cone" iconTone="amber" title={j("notFound.title")} body={j("notFound.body")} action={j("notFound.action")} onAction={back} /></Section></Screen>;
  }
  if (q.isError && !d) {
    return <Screen>{header()}<Section pt={26} px={16}><Empty icon="warn" iconTone="clay" title={j("loadFailed.title")} body={j("loadFailed.body")} action={j("loadFailed.retry")} onAction={() => void q.refetch()} /></Section></Screen>;
  }
  if (!d) {
    return <Screen>{header()}<Section pt={14} px={20} gap={12}><Skeleton width={150} height={22} radius={11} /><Skeleton height={30} radius={8} /><Skeleton height={36} radius={18} /><Skeleton height={230} radius={22} /><Skeleton height={78} radius={18} /></Section></Screen>;
  }

  const job = d.job;
  const f = figures(d);
  const counts = milestoneCounts(d.milestones);
  const m = (cents: number) => money(cents / 100, locale, { cents: false });
  const pct = (n: number) => (locale === "fr-CA" ? `${n} %` : `${n}%`);
  const state = job.setupStatus === "pending_review" && job.status !== "completed" ? "setup" : job.status;
  const look = { ...LOOK[state]!, word: state === "setup" ? j("status.setup") : j(`status.${job.status}`) };
  const number = job.contract?.contractNumber ?? job.quote?.number ?? "";
  const clientName = job.client?.name;

  const cells = [
    { label: j("cells.contract"), value: m(f.contractCents), sub: f.changeOrdersCents > 0 ? j("cells.inclCo", { count: d.changeOrders.filter((c) => c.status === "signed").length || 1, amount: m(f.changeOrdersCents) }) : j("cells.taxIncluded") },
    { label: j("cells.invoiced"), value: m(f.invoicedCents), sub: f.invoicedCents > 0 ? [j("cells.invoicedIn", { amount: m(f.collectedCents) }), f.overdueCents > 0 ? j("cells.invoicedLate", { amount: m(f.overdueCents) }) : ""].filter(Boolean).join(" · ") : j("cells.nothingInvoiced") },
    { label: j("cells.costs"), value: m(f.costCents), sub: [f.costPct != null ? j("cells.costsOfBudget", { pct: pct(f.costPct) }) : j("cells.costsNoBudget"), f.pendingReceipts ? j("cells.toReview", { count: f.pendingReceipts }) : ""].filter(Boolean).join(" · ") },
    { label: j("cells.margin"), value: pct(f.marginPct), valueTone: f.onTarget ? ("ink" as const) : ("warn" as const), sub: j(f.onTarget ? "cells.onTarget" : "cells.offTarget", { amount: m(f.marginCents) }) },
  ];

  const sendOmw = async () => {
    if (omw !== "idle") return;
    if (!job.clientId) { toast({ message: j("quick.noClient") }); return; }
    setOmw("busy");
    try {
      await jobsApi.onMyWay(job.id, lang);
      setOmw("sent");
    } catch (e) {
      setOmw("idle");
      const code = e instanceof ApiFailure ? e.code : undefined;
      toast({ message: code === "NO_PHONE" ? j("quick.noPhone") : code === "NO_CLIENT" ? j("quick.noClient") : e instanceof ApiFailure && e.status === 409 ? j("quick.optedOut") : j("quick.omwFailed") });
    }
  };

  const addPhoto = async () => {
    const r = await addJobPhoto(job.id);
    if (r === "ok") { void client.invalidateQueries({ queryKey: ["job-photos", job.id] }); setTab("photos"); toast({ message: j("quick.photoAdded") }); }
    else if (r !== "cancelled") toast({ message: r === "denied" ? j("quick.denied") : r === "unavailable" ? j("quick.unavailable") : j("quick.photoFailed") });
  };
  const voice = async () => {
    const r = await dictation.toggle();
    if (!r) return;
    if (!r.ok) { toast({ message: r.problem === "denied" ? j("quick.denied") : r.problem === "unavailable" ? j("quick.unavailable") : j("quick.voiceFailed") }); return; }
    if (!r.text.trim()) { toast({ message: j("quick.voiceFailed") }); return; }
    try { await jobsApi.addNote(job.id, r.text.trim()); void client.invalidateQueries({ queryKey: ["job-notes", job.id] }); toast({ message: j("quick.voiceSaved") }); } catch { toast({ message: j("failed") }); }
  };

  const setStatus = async (s: "active" | "suspended" | "completed") => {
    setMenu(false);
    try { await jobsApi.setStatus(job.id, s); refresh(); } catch (e) { toast({ message: e instanceof ApiFailure && e.status === 409 ? e.message : j("failed") }); }
  };
  const archive = async () => {
    setMenu(false);
    try { await jobsApi.archive(job.id); void client.invalidateQueries({ queryKey: ["jobs"] }); back(); } catch { toast({ message: j("failed") }); }
  };
  const rename = async () => {
    const next = name.trim();
    if (!next) return;
    try { await jobsApi.rename(job.id, next); setRenameOpen(false); refresh(); } catch { toast({ message: j("failed") }); }
  };

  const tabs = TAB_ORDER.map((k) => ({ key: k, label: j(`tabs.${k}`) }));
  const primaryLabel = primary?.label ?? j(`primary.${tab === "inv" ? "invNone" : tab === "photos" ? "photos" : tab}`);
  const onRecord = () => setRecord(true);
  const content = tab === "overview" ? <Overview d={d} id={job.id} locale={locale} onRecord={onRecord} />
    : tab === "schedule" ? <Schedule d={d} id={job.id} locale={locale} onRecord={onRecord} />
    : tab === "co" ? <ChangeOrders d={d} id={job.id} locale={locale} />
    : tab === "costs" ? <Costs d={d} id={job.id} locale={locale} />
    : tab === "inv" ? <Invoices d={d} id={job.id} locale={locale} />
    : tab === "team" ? <Team d={d} id={job.id} locale={locale} />
    : tab === "photos" ? <Photos id={job.id} locale={locale} />
    : tab === "msg" ? <Messages d={d} id={job.id} locale={locale} />
    : tab === "docs" ? <Documents d={d} id={job.id} locale={locale} onTab={(k) => setTab(k)} />
    : tab === "ask" ? <Ask /> : (
    <Section pt={22} px={16}><Card padded><Text size={13.5} color="muted">{j(`tabs.${tab}`)}</Text></Card></Section>
  );

  return (
    <PrimaryContext.Provider value={setPrimaryStable}>
      <Screen floating={<ActionBar label={primaryLabel} onPress={() => primary?.run()} busy={primary?.busy} done={primary?.done} disabled={!primary || primary.disabled} moreLabel={j("more")} onMore={() => setMenu(true)} />}>
        {header(() => setMenu(true), number)}
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" stickyHeaderIndices={[3]} contentContainerStyle={{ paddingBottom: ACTION_BAR_SPACE }}>
          <Section px={20} pt={8}>
            <StatusDates status={look} dates={win ? dateRange(dateOnly(win.from), dateOnly(win.to), locale) : undefined} />
            <TitleRow title={job.name} renameLabel={j("rename")} onRename={() => { setName(job.name); setRenameOpen(true); }} />
            <ClientRow avatar={<Avatar initials={initialsOf(clientName ?? job.name)} tint={tintFor(clientName ?? job.name)} size={32} />} name={clientName ?? j("noClient")} address={job.address || undefined}
              action={job.address ? j("map") : undefined} onAction={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`)} />
          </Section>
          <Section delay={50} pt={18} px={16}>
            <ProgressCard left={counts.total ? j("milestonesDone", { done: counts.done, total: counts.total }) : j("noMilestones")} pct={pct(job.progressPercent)} segments={counts.total ? segments(d.milestones) : [{ state: "todo", fill: 0 }]} cells={cells} />
          </Section>
          <Section delay={90} pt={12} pb={20} px={16}>
            <QuickTiles items={[
              { key: "omw", icon: "send", tone: "teal", label: omw === "sent" ? j("quick.omwSent") : j("quick.omw"), onPress: () => void sendOmw(), busy: omw === "busy" },
              { key: "photo", icon: "camera", tone: "indigo", label: j("quick.photo"), onPress: () => void addPhoto() },
              { key: "voice", icon: "mic", tone: "violet", label: dictation.state === "listening" ? j("quick.listening") : dictation.state === "busy" ? j("quick.writing") : j("quick.voice"), onPress: () => void voice(), busy: dictation.state === "busy" },
            ]} />
          </Section>
          <JobTabs tabs={tabs} active={tab} onChange={(k) => setTab(k as JobTab)} label={j("tabsLabel")} />
          <View>{content}</View>
        </ScrollView>

        <RecordSheet id={job.id} open={record} onClose={() => setRecord(false)} />
        <Sheet open={menu} onClose={() => setMenu(false)} label={j("more")} closeLabel={t("close")}>
          <SheetTitle>{job.name}</SheetTitle>
          <MenuList>
            <MenuRow icon={<Icon name="list" tone="violet" size={28} />} title={t("jobSetup.menu.title")} onPress={() => { setMenu(false); router.push(screenHref("JobSetup", t("jobSetup.menu.title"), { id: job.id })); }} />
            {job.status === "active" ? <MenuRow icon={<Icon name="clock" tone="amber" size={28} />} title={t("job.menu.hold")} chevron={false} onPress={() => void setStatus("suspended")} /> : null}
            {job.status === "suspended" || job.status === "planning" ? <MenuRow icon={<Icon name="bolt" tone="sage" size={28} />} title={t("job.menu.resume")} chevron={false} onPress={() => void setStatus("active")} /> : null}
            {job.status !== "completed" ? <MenuRow icon={<Icon name="check" tone="sage" size={28} />} title={t("job.menu.complete")} chevron={false} onPress={() => void setStatus("completed")} /> : null}
            <MenuRow icon={<Icon name="box" tone="stone" size={28} />} title={t("job.menu.archive")} chevron={false} onPress={() => void archive()} />
          </MenuList>
        </Sheet>

        <Sheet open={renameOpen} onClose={() => setRenameOpen(false)} label={j("renameTitle")} closeLabel={t("close")}>
          <SheetTitle>{j("renameTitle")}</SheetTitle>
          <Stack px={20} gap={14} pb={20}>
            <TextField label={j("renamePlaceholder")} value={name} onChangeText={setName} autoFocus />
            <Button label={j("renameSave")} block disabled={!name.trim()} onPress={() => void rename()} />
          </Stack>
        </Sheet>
      </Screen>
    </PrimaryContext.Provider>
  );
}
