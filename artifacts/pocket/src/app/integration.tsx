// Integration.dc.html (QuickBooks Online). Not connected: what it does, how connecting works (Intuit's own sign-in page), what quoteAI can and cannot do, Connect. Connected: Sync on
// or off, the company, the last sync and Run now, what syncs, the matching of tax codes and accounts to QuickBooks (a sheet lists the company's own), the recent syncs with Retry on
// a failure, "Send older invoices" and Disconnect. States: connected, needs attention (items failed), not connected, loading and can't load.
// Read by the server: the on/off switch, "Payments" (the pull from QuickBooks), the matching and the log. "Invoices" and "Clients" always sync, and "Expenses" go in once a payment
// account is chosen, so they show as On (not a switch). Not built: "Connected by / since" (the server keeps the date, not who), the sync log's time of day shows the hour only.
import { useState } from "react";
import { Redirect, router } from "expo-router";
import { Linking } from "react-native";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiFailure } from "@/lib/api";
import { invoicesApi } from "@/lib/invoicesApi";
import { dateWithYear, time, type Locale } from "@/lib/format";
import { failuresOf, logLines, lookOf, mapRows, shortError, unmatchedTax, type MapRowSpec } from "@/lib/quickbooks";
import { quickbooksApi, type Accounts } from "@/lib/quickbooksApi";
import { screenHref } from "@/lib/nav";
import { useRole } from "@/lib/useRole";
import { useSession } from "@/lib/useSession";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { Header } from "@/ui/Header";
import { Icon } from "@/ui/Icon";
import { ImportLine } from "@/ui/Imports";
import { ScrollPage, Section, Stack } from "@/ui/Layout";
import { AppHead, ButtonNote, CardNote, CheckCard, MappedTo, MatchLine, StepsCard, SyncLine } from "@/ui/QuickBooks";
import { SectionHeader } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { ChoiceList, SetButton, SetGroup, SetRow, SheetNote } from "@/ui/Settings";
import { RowStatus } from "@/ui/SettingsPages";
import { Status } from "@/ui/Status";
import { Switch } from "@/ui/Switch";
import { Text } from "@/ui/Text";

const LOOK = { on: { tone: "ok", shape: "check" }, attention: { tone: "bad", shape: "alert" }, paused: { tone: "warn", shape: "pause" }, off: { tone: "mute", shape: "off" } } as const;
type Picking = { row: MapRowSpec } | null;

export default function Integration() {
  const { t: tr, i18n } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`qb.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const toast = useToast();
  const client = useQueryClient();
  const { role } = useRole();
  const canEdit = role === "owner" || role === "admin";
  const statusQ = useQuery({ queryKey: ["qb-status"], queryFn: quickbooksApi.status, enabled: signedIn, retry: 1, staleTime: 15_000 });
  const c = statusQ.data;
  const logQ = useQuery({ queryKey: ["qb-log"], queryFn: quickbooksApi.log, enabled: signedIn && !!c?.connected, retry: 0, staleTime: 15_000 });
  const invQ = useQuery({ queryKey: ["invoices"], queryFn: invoicesApi.list, enabled: signedIn && !!c?.connected, retry: 0, staleTime: 60_000 });
  const [picking, setPicking] = useState<Picking>(null);
  const accQ = useQuery({ queryKey: ["qb-accounts"], queryFn: quickbooksApi.accounts, enabled: !!picking, retry: 0, staleTime: 60_000 });
  const [disc, setDisc] = useState(false);
  const [busy, setBusy] = useState<"" | "run" | "back" | "connect" | "save">("");
  const [retrying, setRetrying] = useState("");

  if (status === "out") return <Redirect href="/" />;

  const entries = logQ.data?.entries ?? [];
  const fails = failuresOf(entries);
  const look = lookOf(c, fails.length);
  const lines = logLines(entries, (invQ.data?.items ?? []).map((i) => ({ id: i.id, number: i.number, clientName: i.clientName })));
  const rows = c ? mapRows(c) : [];
  const unmatched = c ? unmatchedTax(c) : [];
  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("Integrations", t("title"))));
  const refresh = () => { void client.invalidateQueries({ queryKey: ["qb-status"] }); void client.invalidateQueries({ queryKey: ["qb-log"] }); };
  const fail = (e: unknown) => toast({ message: e instanceof ApiFailure ? (e.status === 0 ? t("toast.offline") : e.status === 403 ? t("toast.noAccess") : e.status === 502 ? t("match.loadFailed") : t("toast.failed")) : t("toast.failed") });

  const connect = async () => {
    setBusy("connect");
    try { const r = await quickbooksApi.connect(); await Linking.openURL(r.url); toast({ message: t("connect.back") }); }
    catch (e) { toast({ message: e instanceof ApiFailure && e.status === 403 ? t("connect.plan") : e instanceof ApiFailure && e.status === 503 ? t("connect.unavailable") : t("toast.failed") }); }
    setBusy("");
  };
  const toggle = async (on: boolean) => { try { await quickbooksApi.toggle(on); refresh(); } catch (e) { fail(e); } };
  const runNow = async () => { setBusy("run"); try { await quickbooksApi.pull(); toast({ message: t("sync.ran") }); refresh(); } catch (e) { fail(e); } setBusy(""); };
  const backfill = async () => { setBusy("back"); try { await quickbooksApi.backfill(); toast({ message: t("back2.done") }); refresh(); } catch (e) { fail(e); } setBusy(""); };
  const disconnect = async () => { try { await quickbooksApi.disconnect(); setDisc(false); toast({ message: t("disconnect.done") }); refresh(); } catch (e) { fail(e); } };
  const retry = async (entityType: string, entityId: string) => {
    setRetrying(`${entityType}:${entityId}`);
    try { await quickbooksApi.retry(entityType, entityId); toast({ message: t("log.retried") }); refresh(); } catch (e) { fail(e); }
    setRetrying("");
  };
  const setPulls = async (v: boolean) => { try { await quickbooksApi.mapping({ pullPayments: v }); refresh(); } catch (e) { fail(e); } };

  const choose = async (ref: { id: string; name: string } | null) => {
    if (!picking) return;
    const r = picking.row;
    setBusy("save");
    try {
      await quickbooksApi.mapping(r.kind === "tax" ? { taxCodeMap: { [r.label]: ref } } : r.kind === "income" ? { incomeAccount: ref } : r.kind === "deposit" ? { depositAccount: ref } : r.kind === "payment" ? { paymentAccount: ref } : { categoryMap: { materials: ref } });
      toast({ message: t("match.saved") });
      setPicking(null);
      refresh();
    } catch (e) { fail(e); }
    setBusy("");
  };
  const optionsFor = (a: Accounts | undefined, r: MapRowSpec): { id: string; name: string }[] => !a ? [] : r.kind === "tax" ? a.taxCodes : r.kind === "income" ? a.incomeAccounts : r.kind === "deposit" ? a.depositAccounts : r.kind === "payment" ? a.paymentAccounts : a.expenseAccounts;
  const titleOf = (r: MapRowSpec): [string, string] => (r.kind === "tax" ? [r.label, t("match.tax")] : (tr(`qb.match.${r.kind}`, { returnObjects: true }) as unknown as [string, string]));

  const loading = statusQ.isPending && !c;
  const stateWord = t(`state.${look}`);

  return (
    <Screen>
      <Header title="" backLabel={t("back")} onBack={back} />
      <ScrollPage bottom={56}>
        <Section pt={6} px={20}><AppHead icon={<Icon name="bars" tone="sage" size={52} />} name={t("title")} sub={t("kind")} /></Section>
        <Section delay={30} pt={12} px={20}><Status tone={LOOK[look].tone} shape={LOOK[look].shape}>{stateWord}</Status></Section>
        {!canEdit && c ? <Section pt={16} px={16}><Banner tone="info" icon="lock" iconTone="slate" lead={t("readOnly.lead")}>{t("readOnly.body")}</Banner></Section> : null}

        {loading ? (
          <Section pt={18} px={16} gap={14}><Skeleton height={220} radius={22} /><Skeleton height={200} radius={22} /></Section>
        ) : !c ? (
          <Empty icon="warn" iconTone="clay" title={t("loadFailed.title")} body={t("loadFailed.body")} action={t("loadFailed.retry")} onAction={() => void statusQ.refetch()} />
        ) : c.connected ? (
          <>
            {fails.length ? (
              <Section delay={50} pt={16} px={16}>
                <Banner tone="bad" icon="warn" iconTone="rose" lead={t(fails.length === 1 ? "failed.lead_one" : "failed.lead_other", { count: fails.length })}>{unmatched.length ? t("failed.tax", { tax: unmatched[0] }) : shortError(fails[0]?.error)}</Banner>
                {unmatched.length && canEdit ? <Stack pt={10} align="flex-start"><Button size="sm" kind="secondary" label={t("failed.match")} onPress={() => setPicking({ row: rows.find((r) => r.kind === "tax" && r.label === unmatched[0])! })} /></Stack> : null}
              </Section>
            ) : null}
            <Section delay={70}>
              <SetGroup first>
                <SetRow first icon="sync" tone="sage" label={t("sync.title")} sub={look === "paused" ? t("sync.off") : t("sync.on")} control={<Switch value={c.isEnabled !== false} onChange={(v) => void toggle(v)} label={t("sync.title")} disabled={!canEdit} />} />
                <SetRow icon="building" tone="slate" label={t("sync.company")} sub={c.companyName ?? ""} />
                <SetRow icon="clock" tone="azure" label={t("sync.last")} sub={c.lastSyncedAt ? `${dateWithYear(new Date(c.lastSyncedAt), new Date(), locale)}, ${time(new Date(c.lastSyncedAt), locale)}` : t("sync.never")} control={<SetButton label={busy === "run" ? t("sync.running") : t("sync.now")} onPress={() => void runNow()} disabled={!canEdit || busy === "run"} />} />
              </SetGroup>
            </Section>
            <Section delay={100}>
              <SetGroup title={t("what.title")}>
                <SetRow first icon="receipt" tone="amber" label={t("what.invoices.0")} sub={t("what.invoices.1")} control={<RowStatus tone="ok" shape="check">{t("what.on")}</RowStatus>} />
                <SetRow icon="card" tone="violet" label={t("what.payments.0")} sub={t("what.payments.1")} control={<Switch value={!!c.pullPayments} onChange={(v) => void setPulls(v)} label={t("what.payments.0")} disabled={!canEdit} />} />
                <SetRow icon="users" tone="azure" label={t("what.clients.0")} sub={t("what.clients.1")} control={<RowStatus tone="ok" shape="check">{t("what.on")}</RowStatus>} />
                <SetRow icon="box" tone="clay" label={t("what.expenses.0")} sub={t("what.expenses.1")} control={c.hasPaymentAccount ? <RowStatus tone="ok" shape="check">{t("what.on")}</RowStatus> : <RowStatus tone="warn" shape="alert">{t("what.needsAccount")}</RowStatus>} />
              </SetGroup>
            </Section>
            <Section delay={130} pt={24} px={16}>
              <SectionHeader title={t("match.title")} link={t("match.sub")} />
              <Card>
                {rows.map((r, i) => {
                  const [name, kind] = titleOf(r);
                  return <MatchLine key={r.key} first={i === 0} title={name} sub={kind} label={`${name}, ${kind}`} onPress={canEdit ? () => setPicking({ row: r }) : undefined}
                    right={r.to ? <MappedTo name={r.to} /> : <Status tone="bad" shape="x">{t("match.none")}</Status>} />;
                })}
              </Card>
            </Section>
            <Section delay={160} pt={24} px={16}>
              <SectionHeader title={t("log.title")} />
              <Card>
                {lines.length === 0 ? <CardNote>{t("log.none")}</CardNote> : lines.map((l, i) => (
                  <SyncLine key={l.id} first={i === 0} icon={<Icon name={l.failed ? "warn" : l.kind === "invoice" ? "receipt" : l.kind === "payment" ? "card" : l.kind === "expense" ? "box" : "sync"} tone={l.failed ? "rose" : l.kind === "invoice" ? "amber" : l.kind === "payment" ? "violet" : "clay"} size={28} />}
                    title={[t(`log.${l.kind}`), l.title].filter(Boolean).join(" · ")} sub={l.failed ? shortError(l.error) : t("log.ok")} subTone={l.failed ? "bad" : undefined}
                    status={<Status tone={l.failed ? "bad" : "ok"} shape={l.failed ? "x" : "check"}>{l.failed ? t("log.failed") : t("log.sent")}</Status>} time={time(new Date(l.at), locale)}
                    action={l.failed && l.retryable && canEdit ? { label: retrying === `${l.entityType}:${l.entityId}` ? t("log.retrying") : t("log.retry"), onPress: () => void retry(l.entityType, l.entityId), busy: !!retrying } : undefined} />
                ))}
              </Card>
            </Section>
            <Section delay={190}>
              <SetGroup>
                <SetRow first icon="export" tone="slate" label={t("back2.title")} sub={t("back2.sub")} control={<SetButton label={busy === "back" ? t("back2.sending") : t("back2.button")} onPress={() => void backfill()} disabled={!canEdit || busy === "back"} />} />
              </SetGroup>
            </Section>
            {canEdit ? (
              <Section delay={210} pt={24} px={16}>
                <Button kind="destructive" block label={t("disconnect.button")} onPress={() => setDisc(true)} />
                <ButtonNote>{t("disconnect.note")}</ButtonNote>
              </Section>
            ) : null}
          </>
        ) : (
          <>
            <Section delay={60} pt={18} px={16}>
              <Card>
                {(tr("qb.does", { returnObjects: true }) as unknown as string[][]).map((d, i) => (
                  <ImportLine key={d[0]} first={i === 0} left={<Icon name={i === 0 ? "receipt" : i === 1 ? "card" : "box"} tone={i === 0 ? "amber" : i === 1 ? "violet" : "clay"} size={28} />} title={d[0]!} sub={d[1]} />
                ))}
              </Card>
            </Section>
            <Section delay={100} pt={24} px={16}>
              <SectionHeader title={t("steps.title")} link={t("steps.about")} />
              <StepsCard steps={(tr("qb.steps.list", { returnObjects: true }) as unknown as string[][]).map((s) => ({ title: s[0]!, sub: s[1]! }))} />
            </Section>
            <Section delay={140} pt={24} px={16}>
              <SectionHeader title={t("can.title")} />
              <CheckCard yes={tr("qb.can.yes", { returnObjects: true }) as unknown as string[]} no={tr("qb.can.no", { returnObjects: true }) as unknown as string[]} note={t("steps.safe")} />
            </Section>
            <Section delay={170} pt={20} px={16}>
              <Button size="lg" block label={busy === "connect" ? t("connect.opening") : t("connect.button")} onPress={() => void connect()} disabled={!canEdit || busy === "connect"} />
            </Section>
          </>
        )}
      </ScrollPage>

      <Sheet open={!!picking} onClose={() => setPicking(null)} label={t("match.pick")} closeLabel={t("close")}>
        <Stack px={16} pb={24} gap={12}>
          <SheetTitle>{picking ? titleOf(picking.row)[0] : ""}</SheetTitle>
          <SheetNote>{picking?.row.kind === "tax" ? t("match.pickTax") : t("match.pickAccounts")}</SheetNote>
          {accQ.isPending ? <Skeleton height={160} radius={16} /> : accQ.isError ? <Text size={13.5} color="bad">{t("match.loadFailed")}</Text> : (
            <ChoiceList items={optionsFor(accQ.data, picking!.row).map((o) => ({ id: o.id, name: o.name }))} chosen={null} onPick={(id) => { const o = optionsFor(accQ.data, picking!.row).find((x) => x.id === id); if (o) void choose(o); }} />
          )}
          <Stack pt={4}><Button kind="secondary" size="md" block label={t("match.clear")} disabled={busy === "save"} onPress={() => void choose(null)} /></Stack>
        </Stack>
      </Sheet>

      <Sheet open={disc} onClose={() => setDisc(false)} label={t("disconnect.title")} closeLabel={t("close")}>
        <Stack px={16} pb={30} gap={12}>
          <SheetTitle>{t("disconnect.title")}</SheetTitle>
          <SheetNote>{t("disconnect.body")}</SheetNote>
          <Button kind="destructive" size="lg" block label={t("disconnect.go")} onPress={() => void disconnect()} />
          <Button kind="secondary" size="lg" block label={t("disconnect.keep")} onPress={() => setDisc(false)} />
        </Stack>
      </Sheet>
    </Screen>
  );
}

