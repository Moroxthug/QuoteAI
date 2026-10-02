// Imports.dc.html. Bring in clients or price items from a spreadsheet: pick what to import and where from, match the file's columns to quoteAI's fields (the pick button cycles; a preview
// shows the first rows), watch the rows go in, then see what was added, the clients that look like ones you have (Merge or Keep both) and the rows that were skipped (Fix or Skip).
// Steps: source, mapping, importing, done. A CSV or Excel file works for clients and price items; the server reads the sheet and the phone matches and sends it in chunks of 200.
// Not built: Jobs, QuickBooks, Jobber and the PDFs of old quotes (each opens Coming soon: the server has no import for them from this screen; the quote import by file or PDF is on the
// web), the "Run in background" and "Refresh" buttons (the import runs while the screen is open; Stop ends it and what was added stays), and the history of clients and price imports
// (the server keeps only the old-quote imports, which History shows).
import { useRef, useState } from "react";
import { Redirect, router } from "expo-router";
import { View } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiFailure } from "@/lib/api";
import { clientsApi } from "@/lib/clientsApi";
import { initialsOf } from "@/lib/invites";
import { number as num, shortDate, time, type Locale } from "@/lib/format";
import { FIELDS, KINDS, clientRows, nextField, planPrices, priceRows, ringOffset, suggest, type ClientRow, type Kind, type PriceProblem, type PriceRow } from "@/lib/imports";
import { importsApi, type RowError, type RowMatch, type Sheet } from "@/lib/importsApi";
import { comingSoonHref, screenHref } from "@/lib/nav";
import { useRole } from "@/lib/useRole";
import { useSession } from "@/lib/useSession";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { Header, PageTitle } from "@/ui/Header";
import { Icon } from "@/ui/Icon";
import { DoneHead, ImportLine, ImportSummary, MapHeader, MapRow, MatchRow, PreviewTable, RowNo, RunHead, StepBar, StepHead } from "@/ui/Imports";
import { ScrollPage, Section, Stack } from "@/ui/Layout";
import { SectionHeader } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Segmented } from "@/ui/Segmented";
import { Status } from "@/ui/Status";
import { Text } from "@/ui/Text";

type Step = "source" | "mapping" | "importing" | "done";
type Outcome = { kind: Exclude<Kind, "jobs">; fileName: string; at: Date; added: number; skipped: number; matches: RowMatch[]; errors: (RowError | PriceProblem)[] };
const CHUNK = 200;
const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = ["text/csv", "text/comma-separated-values", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/plain"];

export default function Imports() {
  const { t: tr, i18n } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`im.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const toast = useToast();
  const client = useQueryClient();
  const { role } = useRole();
  const canImport = role === "owner" || role === "admin" || role === "office";
  const qbQ = useQuery({ queryKey: ["qb-status"], queryFn: () => api<{ connected: boolean; lastSyncedAt?: string | null }>("/api/quickbooks/status"), enabled: signedIn, retry: 0, staleTime: 60_000 });
  const histQ = useQuery({ queryKey: ["import-batches"], queryFn: importsApi.batches, enabled: signedIn, retry: 1, staleTime: 30_000 });
  const [step, setStep] = useState<Step>("source");
  const [kind, setKind] = useState(0);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [map, setMap] = useState<number[]>([]);
  const [progress, setProgress] = useState({ done: 0, added: 0, phase: 0 });
  const [out, setOut] = useState<Outcome | null>(null);
  const [rev, setRev] = useState<Record<number, "yes" | "no">>({});
  const [errs, setErrs] = useState<Record<number, "fixed" | "skipped">>({});
  const [busy, setBusy] = useState(false);
  const stop = useRef(false);
  const rowsByNo = useRef(new Map<number, ClientRow>());

  if (status === "out") return <Redirect href="/" />;

  const kindKey = KINDS[kind] ?? "clients";
  const real = kindKey === "jobs" ? null : kindKey;
  const kindWord = t(`kindsLower.${kind}`) || "";
  const kindsList = tr("im.kinds", { returnObjects: true }) as unknown as string[];
  const kindLowerList = tr("im.kindsLower", { returnObjects: true }) as unknown as string[];
  const soon = (title: string) => router.push(comingSoonHref(title));
  const back = () => {
    if (step === "source") { if (router.canGoBack()) router.back(); else router.replace(screenHref("Menu", t("title"))); return; }
    if (step === "importing") { stop.current = true; return; }
    setStep(step === "done" ? "source" : "source");
  };
  const fail = (e: unknown) => toast({ message: e instanceof ApiFailure ? (e.status === 0 ? t("offline") : e.status === 403 ? t("noAccess") : t("failed")) : t("failed") });

  const pick = async () => {
    if (!real) { soon(kindsList[kind] ?? t("title")); return; }
    const r = await DocumentPicker.getDocumentAsync({ type: TYPES, copyToCacheDirectory: true, multiple: false });
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    if ((a.size ?? 0) > MAX_BYTES) { toast({ message: t("fileTooBig") }); return; }
    setBusy(true);
    const res = await importsApi.sheet({ uri: a.uri, name: a.name, type: a.mimeType ?? "text/csv" });
    setBusy(false);
    if (!res.ok) { toast({ message: res.status === 0 ? t("offline") : res.status === 403 ? t("noAccess") : t("fileFailed") }); return; }
    setSheet(res.data);
    setMap(suggest(res.data.headers, real));
    setStep("mapping");
  };

  const onTemplate = async () => {
    try { await Clipboard.setStringAsync(await importsApi.template()); toast({ message: t("templateCopied") }); } catch (e) { fail(e); }
  };

  const nameMapped = map.includes(0);
  const rowsFor = (): ClientRow[] | PriceRow[] => (!sheet || !real ? [] : real === "clients" ? clientRows(sheet.rows, map) : priceRows(sheet.rows, map));

  const start = async () => {
    if (!sheet || !real) return;
    if (!nameMapped) { toast({ message: t("map.needName") }); return; }
    stop.current = false;
    setRev({}); setErrs({});
    setProgress({ done: 0, added: 0, phase: 1 });
    setStep("importing");
    const outcome: Outcome = { kind: real, fileName: sheet.fileName, at: new Date(), added: 0, skipped: 0, matches: [], errors: [] };
    try {
      if (real === "clients") {
        const rows = clientRows(sheet.rows, map);
        rowsByNo.current = new Map(rows.map((r) => [r.row, r]));
        for (let i = 0; i < rows.length && !stop.current; i += CHUNK) {
          const r = await importsApi.clients(rows.slice(i, i + CHUNK));
          outcome.added += r.added; outcome.skipped += r.skipped; outcome.matches.push(...r.matches); outcome.errors.push(...r.errors);
          setProgress({ done: Math.min(rows.length, i + CHUNK), added: outcome.added, phase: 2 });
        }
      } else {
        const rows = priceRows(sheet.rows, map);
        const plan = planPrices(rows, await importsApi.catalog());
        outcome.skipped = plan.skipped; outcome.errors = plan.errors;
        for (let i = 0; i < plan.clean.length && !stop.current; i += CHUNK) {
          const chunk = plan.clean.slice(i, i + CHUNK);
          await importsApi.bulkPrices(chunk.map((p) => ({ nome: p.name, um: p.unit, prezzoUnitario: p.price ?? 0, ...(p.category ? { categoria: p.category } : null), ...(p.notes ? { note: p.notes } : null) })));
          outcome.added += chunk.length;
          setProgress({ done: Math.min(plan.clean.length, i + CHUNK), added: outcome.added, phase: 2 });
        }
      }
    } catch (e) { fail(e); }
    setOut(outcome);
    setProgress((p) => ({ ...p, phase: 3 }));
    setStep(outcome.added || outcome.matches.length || outcome.errors.length || outcome.skipped ? "done" : "mapping");
    void client.invalidateQueries({ queryKey: ["clients-overview"] });
    void client.invalidateQueries({ queryKey: ["price-book"] });
  };

  const decide = async (m: RowMatch, how: "yes" | "no") => {
    const row = rowsByNo.current.get(m.row);
    if (!row) return;
    try {
      if (how === "no") await importsApi.addClient({ name: row.name, phone: row.phone, email: row.email, address: row.address, notes: row.notes });
      else {
        const d = (await clientsApi.detail(m.existingId)).client;
        const fill: Record<string, string> = {};
        if (!d.email && row.email) fill.email = row.email;
        if (!d.phone && row.phone) fill.phone = row.phone;
        if (!d.address && row.address) fill.address = row.address;
        if (Object.keys(fill).length) await importsApi.fillClient(m.existingId, fill);
      }
      setRev((r) => ({ ...r, [m.row]: how }));
      void client.invalidateQueries({ queryKey: ["clients-overview"] });
    } catch (e) { fail(e); }
  };
  const fixRow = async (e: RowError | PriceProblem) => {
    if (e.why === "no_name" || e.why === "bad_price" || !("why" in e)) { setErrs((x) => ({ ...x, [e.row]: "skipped" })); return; }
    const row = rowsByNo.current.get(e.row);
    if (!row) return;
    try {
      await importsApi.addClient({ name: row.name, phone: e.why === "short_phone" ? undefined : row.phone, email: e.why === "bad_email" ? undefined : row.email, address: row.address, notes: row.notes });
      setErrs((x) => ({ ...x, [e.row]: "fixed" }));
      void client.invalidateQueries({ queryKey: ["clients-overview"] });
    } catch (err) { fail(err); }
  };

  const total = sheet?.total ?? 0;
  const ratio = total ? Math.round((progress.done / (real === "prices" ? Math.max(1, total) : total)) * 100) : 0;
  const pct = progress.phase >= 3 ? 100 : Math.min(100, ratio);
  const fieldWord = (i: number) => t(`fields.${real ?? "clients"}.${FIELDS[real ?? "clients"][i] ?? "skip"}`);
  const previewHead: [string, string, string] = real === "prices" ? [fieldWord(0), fieldWord(1), fieldWord(2)] : [fieldWord(0), fieldWord(1), fieldWord(3)];
  const previewRows = ((): [string, string, string][] => {
    if (!sheet || !real) return [];
    const r = rowsFor().slice(0, 3);
    return r.map((x) => real === "prices" ? [(x as PriceRow).name, (x as PriceRow).unit, (x as PriceRow).price === null ? "" : String((x as PriceRow).price)] : [(x as ClientRow).name, (x as ClientRow).phone ?? "", (x as ClientRow).address ?? ""]);
  })();

  const headerTitle = step === "source" ? "" : t("importTitle", { kind: kindWord });
  const reached = step === "mapping" ? 1 : step === "importing" || step === "done" ? (step === "done" ? 3 : 2) : 0;

  return (
    <Screen>
      <Header title={headerTitle} backLabel={t("back")} onBack={back} />
      <ScrollPage bottom={56}>
        {step === "source" ? (
          <>
            <Section pt={4} px={20}><PageTitle>{t("title")}</PageTitle></Section>
            {!canImport ? <Section pt={16} px={16}><Banner tone="info" icon="lock" iconTone="slate" lead={t("readOnly.lead")}>{t("readOnly.body")}</Banner></Section> : null}
            <Section delay={40} pt={16} px={16}><Segmented options={kindsList} value={kind} onChange={setKind} label={t("what")} /></Section>
            <Section delay={70} pt={18} px={16}>
              <SectionHeader title={t("from")} link={t("template")} onLink={() => void onTemplate()} />
              <Card>
                <ImportLine first left={<Icon name="file" tone="azure" size={28} />} title={t("sources.file.0")} sub={t("sources.file.1")} chevron onPress={canImport && !busy ? () => void pick() : undefined} />
                <ImportLine onPress={() => soon(t("sources.qbo.0"))} left={<Icon name="bank" tone="sage" size={28} />} title={t("sources.qbo.0")} sub={qbQ.data?.connected && qbQ.data.lastSyncedAt ? t("sources.qbo.1", { date: shortDate(new Date(qbQ.data.lastSyncedAt), locale) }) : undefined}
                  right={<Status tone={qbQ.data?.connected ? "ok" : "mute"} shape={qbQ.data?.connected ? "check" : "off"}>{qbQ.data?.connected ? t("sources.qbo.2") : t("sources.qbo.3")}</Status>} />
                <ImportLine onPress={() => soon(t("sources.jobber.0"))} left={<Icon name="sync" tone="teal" size={28} />} title={t("sources.jobber.0")} sub={t("sources.jobber.1")} right={<Status tone="mute" shape="off">{t("sources.jobber.2")}</Status>} />
                <ImportLine left={<Icon name="doc" tone="violet" size={28} />} title={t("sources.pdf.0")} sub={t("sources.pdf.1")} chevron onPress={() => soon(t("sources.pdf.0"))} />
              </Card>
            </Section>
            <Section delay={100} pt={22} px={16}>
              <SectionHeader title={t("history.title")} />
              {histQ.isPending ? <Skeleton height={120} radius={22} /> : (histQ.data?.items.length ?? 0) === 0 ? (
                <Card padded><Text size={13.5} color="muted">{t("history.none")}</Text></Card>
              ) : (
                <Card>
                  {histQ.data!.items.slice(0, 8).map((b, i) => (
                    <ImportLine key={b.id} first={i === 0} left={<Icon name={b.kind === "pdf" ? "doc" : "file"} tone={b.status === "error" ? "rose" : b.kind === "pdf" ? "violet" : "azure"} size={28} />} title={t("history.old", { file: b.fileName })} sub={t("history.rows", { date: shortDate(new Date(b.createdAt), locale), count: num(b.totalRows, locale) })}
                      right={<Status tone={b.status === "error" ? "bad" : "mute"} shape={b.status === "error" ? "x" : "check"}>{b.status === "error" ? t("history.failed") : b.status === "processing" ? t("history.working") : t("history.done")}</Status>} />
                  ))}
                </Card>
              )}
            </Section>
          </>
        ) : (
          <Section><StepBar reached={reached} label={t("steps", { n: Math.max(1, reached) })} /></Section>
        )}

        {step === "mapping" && sheet && real ? (
          <>
            <Section pt={18} px={20}><StepHead title={t("map.title")} sub={t("map.sub", { file: sheet.fileName, count: sheet.total, n: num(sheet.total, locale) })} /></Section>
            <Section delay={40} pt={16} px={16}>
              <Card>
                <MapHeader left={t("map.inFile")} right={t("map.inApp")} />
                {sheet.headers.map((h, i) => (
                  <MapRow key={`${h}-${i}`} col={h} example={sheet.rows[0]?.[i] ?? ""} to={fieldWord(map[i] ?? FIELDS[real].length - 1)} skip={(map[i] ?? 0) === FIELDS[real].length - 1}
                    label={t("map.goesTo", { col: h, field: fieldWord(map[i] ?? 0) })} onPick={() => setMap((m) => m.map((v, j) => (j === i ? nextField(m, i, real) : v)))} />
                ))}
              </Card>
            </Section>
            <Section delay={70} pt={22} px={16}>
              <SectionHeader title={t("map.preview")} link={t("map.firstOf", { total: num(sheet.total, locale) })} />
              <PreviewTable head={previewHead} rows={previewRows} />
            </Section>
            <Section pt={20} px={16}><Button size="lg" block label={t("map.importN", { count: num(sheet.total, locale), kind: kindWord })} disabled={!nameMapped || sheet.total === 0} onPress={() => void start()} /></Section>
          </>
        ) : null}

        {step === "importing" ? (
          <>
            <Section pt={36} px={20}><RunHead pct={pct} done={num(progress.done, locale)} total={num(real === "prices" ? Math.max(progress.done, total) : total, locale)} of={t("run.of")} title={t("run.title", { kind: kindWord })} sub={t("run.sub")} /></Section>
            <Section delay={60} pt={24} px={16}>
              <Card>
                <ImportLine first left={<Icon name="file" tone="azure" size={28} />} title={t("run.read")} sub={t("run.readSub", { rows: num(total, locale), cols: sheet?.headers.length ?? 0 })} right={<Status tone="mute" shape="check">{t("run.done")}</Status>} />
                <ImportLine left={<Icon name="users" tone="violet" size={28} />} title={t("run.dupes")} sub={t("run.dupesSub")} right={progress.phase >= 2 ? <Status tone="mute" shape="check">{t("run.done")}</Status> : <Status tone="ok" shape="live">{t("run.working")}</Status>} />
                <ImportLine left={<Icon name="plus" tone="sage" size={28} />} title={t("run.adding", { kind: kindWord })} sub={t("run.addingSub", { count: num(progress.added, locale) })} right={progress.phase >= 3 ? <Status tone="mute" shape="check">{t("run.done")}</Status> : progress.phase >= 2 ? <Status tone="ok" shape="live">{t("run.working")}</Status> : <Status tone="warn" shape="clock">{t("run.waiting")}</Status>} />
              </Card>
            </Section>
            <Section pt={20} px={16}><Button kind="secondary" size="md" block label={t("run.cancel")} onPress={() => { stop.current = true; }} /></Section>
          </>
        ) : null}

        {step === "done" && out ? (
          <>
            <Section pt={22} px={20}><DoneHead icon={<Icon name="check" tone="sage" size={48} />} title={out.added ? t("done.title", { count: num(out.added, locale), kind: t(`kindsLower.${out.kind === "clients" ? 0 : 1}`) }) : t("done.none")} sub={t("done.fileLine", { file: out.fileName, time: time(out.at, locale) })} /></Section>
            <Section delay={40} pt={18} px={16}>
              <ImportSummary items={[
                { label: t("done.added"), value: num(out.added + Object.values(rev).filter((v) => v === "no").length + Object.values(errs).filter((v) => v === "fixed").length, locale), tone: "ok" },
                { label: t("done.toCheck"), value: num(out.matches.filter((m) => !rev[m.row]).length, locale), tone: out.matches.some((m) => !rev[m.row]) ? "warn" : undefined },
                { label: t("done.skipped"), value: num(out.skipped + out.errors.filter((e) => !errs[e.row]).length, locale), tone: out.errors.some((e) => !errs[e.row]) ? "bad" : undefined },
              ]} />
            </Section>
            {out.matches.length ? (
              <Section delay={70} pt={22} px={16}>
                <SectionHeader title={t("done.same")} link={out.matches.filter((m) => !rev[m.row]).length ? t("done.left", { count: out.matches.filter((m) => !rev[m.row]).length }) : t("done.allDone")} />
                <Card>
                  {out.matches.map((m, i) => {
                    const d = rev[m.row];
                    return (
                      <MatchRow key={m.row} first={i === 0} avatar={<Avatar initials={initialsOf(m.name)} tint={((i % 4) + 1) as 1} />} name={m.name}
                        sub={d === "yes" ? t("done.mergedSub") : d === "no" ? t("done.newSub") : t(m.why === "email" ? "done.whyEmail" : "done.whyPhone", { name: m.existingName })}
                        state={<Status tone={d === "yes" ? "ok" : d === "no" ? "info" : "acc"} shape={d === "yes" ? "check" : d === "no" ? "dot" : "q2"}>{d === "yes" ? t("done.merged") : d === "no" ? t("done.newClient") : t("done.matched")}</Status>}
                        actions={d ? undefined : (
                          <>
                            <View style={{ flex: 1 }}><Button size="sm" label={t("done.merge")} block onPress={() => void decide(m, "yes")} /></View>
                            <View style={{ flex: 1 }}><Button size="sm" kind="secondary" label={t("done.keep")} block onPress={() => void decide(m, "no")} /></View>
                          </>
                        )} />
                    );
                  })}
                </Card>
              </Section>
            ) : null}
            {out.errors.length ? (
              <Section delay={100} pt={22} px={16}>
                <SectionHeader title={t("done.errors")} link={out.errors.filter((e) => !errs[e.row]).length ? t("done.rowsCount", { count: out.errors.filter((e) => !errs[e.row]).length }) : t("done.noneLeft")} />
                <Card>
                  {out.errors.map((e, i) => {
                    const s = errs[e.row];
                    const fixable = e.why === "short_phone" || e.why === "bad_email";
                    return (
                      <ImportLine key={e.row} first={i === 0} left={<RowNo>{t("done.row", { n: e.row })}</RowNo>} title={e.name || "—"} sub={s === "skipped" ? t("done.skippedFor") : s === "fixed" ? t("done.fixedWord") : t(`why.${e.why}`)} subTone={s ? undefined : "bad"}
                        right={s === "fixed" ? <Status tone="ok" shape="check">{t("done.fixedWord")}</Status> : s ? null : <Button size="sm" kind="secondary" label={fixable ? t("done.fix") : t("done.skip")} onPress={() => void fixRow(e)} />} />
                    );
                  })}
                </Card>
              </Section>
            ) : null}
            <Section delay={130} pt={22} px={16}>
              <Stack gap={8}>
                <Button size="lg" block label={out.kind === "clients" ? t("done.seeClients") : t("done.seePrices")} onPress={() => router.push(screenHref(out.kind === "clients" ? "Clients" : "PriceBook", t("title")))} />
                <Button kind="secondary" size="lg" block label={t("done.other")} onPress={() => { setStep("source"); setOut(null); setSheet(null); }} />
              </Stack>
            </Section>
          </>
        ) : null}
        {histQ.isError && step === "source" ? <Empty icon="warn" iconTone="clay" title={t("loadFailed.title")} body={t("loadFailed.body")} action={t("loadFailed.retry")} onAction={() => void histQ.refetch()} /> : null}
      </ScrollPage>
    </Screen>
  );
}
