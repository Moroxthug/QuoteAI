// AssistantProposals.dc.html. What the assistant would do, for a yes: a reminder for a late invoice, a follow-up for a quote nobody answered, an order
// for what is running low, a visit moved. Approve (held for 10 s with Undo, then it goes), Edit (a message's text), Dismiss, "Approve all"; the ones just
// decided; what the job assistant decided lately. States: default, empty, offline, view only, locked (plan), loading and can't load.
// Not drawn, for want of data: the board's weather and crew notes on a move (nothing makes move proposals yet: the forecast the app has reads today only),
// "Edit" on an order or a move opens the Supplier or the Schedule, and the board's ⋯ draws no menu, so it isn't here.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiFailure } from "@/lib/api";
import { badge, channelOf, jobLook, look, orderTotal, type Decided, type Suggestion } from "@/lib/assistant";
import { assistantApi } from "@/lib/assistantApi";
import { flushAssistantOutbox, outbox } from "@/lib/assistantSync";
import { money, time, dayDate, type Locale } from "@/lib/format";
import { screenHref } from "@/lib/nav";
import { useSession } from "@/lib/useSession";
import { ArrowLink, AssistantHead, AssistantTabs, DoBox, DoneCard, LockCard, MessageBody, MoveBody, OrderBody, ProposalCard } from "@/ui/Assistant";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { TextField } from "@/ui/Field";
import { Header } from "@/ui/Header";
import { Icon } from "@/ui/Icon";
import { ScrollPage, Section, Stack } from "@/ui/Layout";
import { Swirl } from "@/ui/Logo";
import { ListRow, SectionHeader } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Status } from "@/ui/Status";

type Closed = { s: Suggestion; queued: boolean; committed: boolean; activityId: string | null };

const HOLD_MS = 10_000;

export default function AssistantProposals() {
  const { t: tr, i18n } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`as.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const toast = useToast();
  const client = useQueryClient();
  const q = useQuery({ queryKey: ["assistant", "overview"], queryFn: assistantApi.overview, enabled: signedIn, retry: 1, staleTime: 15_000 });
  const data = q.data;

  const [closed, setClosed] = useState<Closed[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const held = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; draft?: string }>());
  const closedRef = useRef<Closed[]>([]);
  closedRef.current = closed;

  const money2 = (cents: number) => money(cents / 100, locale);
  const offline = q.isError || status === "offline";
  const refresh = useCallback(() => { void client.invalidateQueries({ queryKey: ["assistant"] }); }, [client]);

  // What waited on the phone goes out once there is a connection.
  useEffect(() => {
    if (!signedIn || !q.isSuccess) return;
    let live = true;
    void flushAssistantOutbox().then((n) => {
      if (!live || !n) return;
      setClosed((c) => c.map((x) => (x.queued ? { ...x, queued: false, committed: true } : x)));
      refresh();
    });
    return () => { live = false; };
  }, [signedIn, q.isSuccess, q.dataUpdatedAt, refresh]);

  const failText = (e: unknown): string => {
    if (e instanceof ApiFailure) {
      if (e.status === 403) return t(e.code === "PLAN_REQUIRED" ? "p.toast.plan" : "p.toast.noAccess");
      if (e.status === 404 || e.status === 409) return t("p.toast.gone");
    }
    return t("p.toast.failed");
  };

  const commit = useCallback(async (id: string, draft?: string) => {
    held.current.delete(id);
    try {
      const out = await assistantApi.approve(id, draft);
      setClosed((c) => c.map((x) => (x.s.id === id ? { ...x, committed: true, activityId: out.activityId } : x)));
      refresh();
    } catch (e) {
      if (e instanceof ApiFailure && e.offline) {
        await outbox.queue({ type: "approve", id, draft });
        setClosed((c) => c.map((x) => (x.s.id === id ? { ...x, queued: true } : x)));
        return;
      }
      if (e instanceof ApiFailure && e.status === 409) { refresh(); return; }
      setClosed((c) => c.filter((x) => x.s.id !== id));
      toast({ message: failText(e) });
      refresh();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, toast]);

  // Leaving with something held sends it now: it was approved.
  useEffect(() => () => { for (const [id, h] of held.current) { clearTimeout(h.timer); void commitLater(id, h.draft); } }, []);
  const commitLater = (id: string, draft?: string) => assistantApi.approve(id, draft).catch(() => outbox.queue({ type: "approve", id, draft }));

  const doneOf = (s: Suggestion): { text: string; word: string; tone: "info" | "ok"; shape: "q1" | "check" } => {
    const p = s.payload;
    switch (s.kind) {
      case "reminder": return { text: t("p.done.reminder", { name: p.toName ?? "" }), word: t("p.word.Sent"), tone: "info", shape: "q1" };
      case "followup": return { text: t("p.done.followup", { name: p.toName ?? "" }), word: t("p.word.Sent"), tone: "info", shape: "q1" };
      case "order": return { text: t("p.done.order", { count: p.lines?.length ?? 0, supplier: p.supplierName ?? "" }), word: t("p.word.Listed"), tone: "info", shape: "q1" };
      case "move": return { text: t("p.done.move", { title: p.blockTitle ?? p.jobName ?? "" }), word: t("p.word.Moved"), tone: "ok", shape: "check" };
    }
  };
  const titleOf = (s: Suggestion): string => {
    const p = s.payload;
    switch (s.kind) {
      case "reminder": return t("p.t.reminder", { name: p.toName ?? "" });
      case "followup": return t("p.t.followup", { name: p.toName ?? "" });
      case "order": return t("p.t.order", { count: p.lines?.length ?? 0, item: p.lines?.[0]?.name ?? "", supplier: p.supplierName ?? "" });
      case "move": return t("p.t.move", { title: p.blockTitle ?? p.jobName ?? "" });
    }
  };

  const approve = (list: Suggestion[]) => {
    if (!list.length) return;
    const ids = list.map((s) => s.id);
    setEditing(null);
    setClosed((c) => [...c.filter((x) => !ids.includes(x.s.id)), ...list.map((s) => ({ s, queued: offline, committed: false, activityId: null }))]);
    if (offline) {
      for (const s of list) void outbox.queue({ type: "approve", id: s.id, draft: drafts[s.id] });
    } else {
      for (const s of list) {
        const draft = drafts[s.id];
        held.current.set(s.id, { draft, timer: setTimeout(() => void commit(s.id, draft), HOLD_MS) });
      }
    }
    const one = list[0]!;
    toast({
      lead: list.length === 1 ? (offline ? t("p.toast.saved") : t("p.toast.approved")) : t("p.toast.many", { count: list.length }),
      message: list.length === 1 ? (offline ? t("p.toast.sentLater") : `${doneOf(one).text}.`) : offline ? t("p.toast.manyLater") : t("p.toast.manyOn"),
      action: t("undo"), onAction: () => undoApprove(ids), duration: HOLD_MS, countdown: true,
    });
  };

  const undoApprove = (ids: string[]) => {
    for (const id of ids) {
      const h = held.current.get(id);
      if (h) { clearTimeout(h.timer); held.current.delete(id); }
      void outbox.drop("approve", id);
    }
    setClosed((c) => c.filter((x) => !ids.includes(x.s.id)));
  };

  const undoDone = async (c: Closed) => {
    if (!c.committed) { undoApprove([c.s.id]); return; }
    if (!c.activityId) return;
    try {
      await assistantApi.undo(c.activityId);
      setClosed((x) => x.filter((y) => y.s.id !== c.s.id));
      toast({ lead: t("p.toast.undone"), message: "" });
      refresh();
    } catch { toast({ message: t("p.toast.restoreFailed") }); }
  };

  const dismiss = async (s: Suggestion) => {
    setEditing(null);
    setDismissed((d) => [...d, s.id]);
    try {
      await assistantApi.dismiss(s.id);
      toast({
        lead: t("p.toast.dismissed"), message: t("p.toast.dismissedSub"), action: t("undo"), duration: HOLD_MS, countdown: true,
        onAction: () => { void assistantApi.restore(s.id).then(() => { setDismissed((d) => d.filter((x) => x !== s.id)); refresh(); }).catch(() => toast({ message: t("p.toast.restoreFailed") })); },
      });
      refresh();
    } catch (e) {
      setDismissed((d) => d.filter((x) => x !== s.id));
      toast({ message: e instanceof ApiFailure && e.offline ? t("p.toast.failed") : failText(e) });
    }
  };

  const canApprove = data?.canApprove ?? false;
  const locked = !!data && !data.enabled;
  const pending = useMemo(() => (data?.pending ?? []).filter((s) => !dismissed.includes(s.id)), [data, dismissed]);
  const closedIds = closed.map((c) => c.s.id);
  const open = pending.filter((s) => !closedIds.includes(s.id));
  const all = useMemo(() => {
    const ids = new Set(pending.map((s) => s.id));
    return [...pending, ...closed.filter((c) => !ids.has(c.s.id)).map((c) => c.s)].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [pending, closed]);
  const n = open.length;
  const loading = q.isPending && !data;
  const failed = q.isError && !data;

  const titleText = locked ? t("p.title.locked") : n === 0 ? t("p.title.none") : n <= 4 ? t(`p.title.n${n}`) : t("p.title.more", { count: n });
  const subText = locked ? t("p.sub.locked") : n ? t("p.sub.some") : t("p.sub.none");

  if (status === "out") return <Redirect href="/" />;

  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("SmartHome", t("brand"))));
  const goPlan = () => router.push(screenHref("SetPlan", t("locked.action")));
  const toActivity = () => router.push(screenHref("AssistantActivity", t("tabs.activity")));
  const toPermissions = () => router.push(screenHref("AssistantPermissions", t("tabs.permissions")));

  const card = (s: Suggestion) => {
    const p = s.payload;
    const look1 = look(s.kind);
    const c = closed.find((x) => x.s.id === s.id);
    if (c) {
      const d = doneOf(s);
      return (
        <DoneCard key={s.id} icon={look1.icon} tone={look1.tone} text={c.queued ? titleOf(s) : d.text}
          status={c.queued ? <Status tone="warn" shape="clock">{t("p.word.queued")}</Status> : <Status tone={d.tone} shape={d.shape}>{d.word}</Status>}
          undo={!c.committed || (c.activityId && (s.kind === "order" || s.kind === "move")) ? () => void undoDone(c) : undefined} undoLabel={t("undo")} />
      );
    }
    const channel = channelOf(p);
    const message = s.kind === "reminder" || s.kind === "followup";
    const isEditing = editing === s.id;
    const meta =
      s.kind === "reminder" ? t("p.meta.reminder", { count: p.daysLate ?? 0, number: p.number ?? "", amount: money2(p.balanceCents ?? 0) })
      : s.kind === "followup" ? t("p.meta.followup", { count: p.daysSent ?? 0, number: p.number ?? "", amount: money2(p.totalCents ?? 0) })
      : s.kind === "order" ? t("p.meta.order", { supplier: p.supplierName ?? "", destination: tr(`as.p.dest.${p.destination ?? "Shop"}`, { defaultValue: p.destination ?? "" }) })
      : t("p.meta.move", { job: p.jobName ?? "" });
    const why =
      s.kind === "reminder" ? t("p.why_.reminder", { count: p.daysLate ?? 0 })
      : s.kind === "followup" ? t("p.why_.followup", { count: p.daysSent ?? 0 })
      : s.kind === "order" ? `${t((p.lines?.length ?? 0) > 1 ? "p.why_.orderMany" : "p.why_.order", { names: (p.lines ?? []).slice(0, 3).map((l) => l.name).join(", ") })}${p.overLimit ? ` ${t("p.why_.over", { limit: money((data?.spendLimitCents ?? 0) / 100, locale, { cents: false }) })}` : ""}`
      : t("p.why_.move");
    const lines = (p.lines ?? []).map((l) => ({ name: `${l.qty} × ${l.name}`, amount: l.unitPriceCents == null ? "" : money2(Math.round(l.qty * l.unitPriceCents)) }));
    return (
      <ProposalCard key={s.id} icon={look1.icon} tone={look1.tone} title={titleOf(s)} meta={meta} why={why} whyLabel={t("p.why")}
        actions={isEditing ? (
          <>
            <Button size="md" label={t("p.save")} grow onPress={() => approve([s])} />
            <Button size="md" kind="secondary" label={t("p.cancel")} onPress={() => setEditing(null)} />
          </>
        ) : (
          <>
            <Button size="md" label={t("p.approve")} grow disabled={!canApprove} onPress={() => approve([s])} />
            {message ? <Button size="md" kind="secondary" label={t("p.edit")} disabled={!canApprove} onPress={() => { setDrafts((d) => ({ ...d, [s.id]: d[s.id] ?? p.draft ?? "" })); setEditing(s.id); }} />
              : <Button size="md" kind="secondary" label={t("p.edit")} disabled={!canApprove} onPress={() => router.push(s.kind === "order" && p.supplierId ? screenHref("Supplier", p.supplierName ?? "", { id: p.supplierId }) : screenHref("Schedule", t("p.channel.move")))} />}
            <Button size="md" kind="ghost" label={t("p.dismiss")} disabled={!canApprove} onPress={() => void dismiss(s)} />
          </>
        )}>
        {isEditing && message ? (
          <Stack px={16} pt={14}>
            <TextField label={t(`p.editLabel.${channel}`, { name: p.toName ?? "" })} multiline value={drafts[s.id] ?? ""} onChangeText={(v) => setDrafts((d) => ({ ...d, [s.id]: v }))} maxHeight={220} />
          </Stack>
        ) : (
          <DoBox label={s.kind === "order" ? t("p.willOrder") : s.kind === "move" ? t("p.willMove") : channel === "sms" ? t("p.willText") : t("p.willEmail")}
            channel={message ? t(`p.channel.${channel}`, { name: p.toName ?? "" }) : s.kind === "order" ? t("p.channel.order") : t("p.channel.move")}>
            {message ? <MessageBody subject={channel === "email" ? p.subject : undefined} text={drafts[s.id] ?? p.draft ?? ""} /> : null}
            {s.kind === "order" ? <OrderBody lines={lines} totalLabel={t("p.total")} total={money2(p.totalCents ?? orderTotal(p.lines ?? []))} /> : null}
            {s.kind === "move" ? <MoveBody from={p.from ? dayDate(new Date(p.from), locale) : ""} to={p.moveTo ? dayDate(new Date(p.moveTo), locale) : ""} arrowLabel={t("p.willMove")} /> : null}
          </DoBox>
        )}
      </ProposalCard>
    );
  };

  const recentRow = (r: Decided, i: number) => {
    const when = time(new Date(r.at), locale);
    const job = r.source === "job";
    const sug: Suggestion | null = !job && r.payload ? { id: r.id, kind: r.kind as Suggestion["kind"], payload: r.payload, createdAt: r.at } : null;
    const icon = job ? jobLook(r.kind) : look(r.kind);
    const title = job ? r.summary ?? "" : sug ? (r.status === "approved" ? doneOf(sug).text : titleOf(sug)) : "";
    const sub = job && r.project ? t("p.recent.sub", { project: r.project, time: when }) : t("p.recent.subNone", { time: when });
    const openInvoice = job && r.status === "approved" && r.invoiceId;
    return (
      <ListRow key={`${r.source}-${r.id}-${i}`} title={title} meta={sub}
        leading={<Icon name={icon.icon} tone={icon.tone} size={26} />}
        trailing={openInvoice ? <Button size="sm" kind="secondary" label={t("p.recent.open")} onPress={() => router.push(screenHref("Invoice", title, { id: r.invoiceId! }))} />
          : <Status tone={r.status === "approved" ? "ok" : r.status === "dismissed" ? "mute" : "bad"} shape={r.status === "approved" ? "check" : "x"}>{t(`p.recent.${r.status === "approved" ? "Approved" : r.status === "dismissed" ? "Dismissed" : "Failed"}`)}</Status>} />
    );
  };

  return (
    <Screen>
      <Header title={t("brand")} titleIcon={<Swirl />} backLabel={t("back")} onBack={back} />
      <ScrollPage bottom={96} sticky={[0]}>
        <AssistantTabs active={0} count={locked || loading || failed ? undefined : n ? badge(n) : undefined} onTab={(i) => { if (i === 1) router.replace(screenHref("AssistantActivity", t("tabs.activity"))); if (i === 2) router.replace(screenHref("AssistantPermissions", t("tabs.permissions"))); }} />
        <Section>
          <AssistantHead title={loading || failed ? t("brand") : titleText} sub={loading || failed ? undefined : subText} />
          {!loading && !failed && !locked ? <Stack px={20}><ArrowLink label={t("p.link")} onPress={toPermissions} /></Stack> : null}
        </Section>

        {failed ? (
          <Section pt={26} px={16}><Empty icon="warn" iconTone="clay" title={t("loadFailed.title")} body={t("loadFailed.body")} action={t("retry")} onAction={() => void q.refetch()} /></Section>
        ) : loading ? (
          <Section pt={22} px={16} gap={12}><Skeleton height={300} radius={22} /><Skeleton height={230} radius={22} /></Section>
        ) : (
          <>
            {offline ? <Section pt={14} px={16}><Banner tone="warn" icon="cloud" iconTone="amber" lead={t("offline.lead")}>{t("p.offline")}</Banner></Section> : null}
            {!locked && !canApprove ? <Section pt={14} px={16}><Banner tone="info" icon="eye" iconTone="sky" lead={t("p.readOnly.lead")}>{t("p.readOnly.body")}</Banner></Section> : null}
            {locked ? (
              <Section delay={60} pt={18} px={16}>
                <LockCard title={t("locked.title")} body={t("locked.body")} tag={t("locked.tag")} note={t("locked.note")} action={t("locked.action")} onAction={goPlan} />
              </Section>
            ) : null}

            {!locked && all.length ? (
              <Section delay={60} pt={22} px={16}>
                <SectionHeader title={n ? t("p.waiting") : t("p.justApproved")} link={n > 1 && canApprove ? t("p.approveAll", { count: n }) : undefined} onLink={() => approve(open)} />
                <Stack gap={12}>{all.map(card)}</Stack>
              </Section>
            ) : null}

            {!locked && all.length === 0 ? (
              <Section pt={44}>
                <Empty icon="check" iconTone="sage" title={t("p.clear.title")} body={t("p.clear.body")} action={t("p.clear.action")} actionKind="secondary" onAction={toActivity} />
              </Section>
            ) : null}

            {!locked && data && data.recent.length ? (
              <Section delay={120} pt={26} px={16}>
                <SectionHeader title={t("p.recent.title")} link={t("p.recent.link")} onLink={toActivity} />
                <Card>{data.recent.map(recentRow)}</Card>
              </Section>
            ) : null}
          </>
        )}
      </ScrollPage>
    </Screen>
  );
}

