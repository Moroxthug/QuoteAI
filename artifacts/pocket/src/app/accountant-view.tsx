// AccountantView.dc.html: what the company's accountant sees, read-only: the month of books and how finished each part is, the files to
// download, the sales tax and the next deadlines, and the thread of comments. States: default and accessEnded (the company turned the access
// off: the phone remembers the company it last opened and finds it gone from the person's list). Reads /api/accountant/*, /api/compliance/*.
import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { accessEnded, canSend, checks, companyInitials, exportsFor, monthDate, monthEnd, monthState, type Check } from "@/lib/accountant";
import { accountantApi } from "@/lib/accountantApi";
import { team } from "@/lib/api";
import { buildItems, featuredReturn, isOpen, netOf, previousReturn, statusOf, type Worksheet } from "@/lib/compliance";
import { complianceApi } from "@/lib/complianceApi";
import { useComplianceText } from "@/lib/complianceText";
import { KNOWN_KEY, mergeKnown, parseKnown, type KnownOrg } from "@/lib/companyPicker";
import { downloadCsv } from "@/lib/download";
import { money, shortDate, time } from "@/lib/format";
import { initialsOf } from "@/lib/invites";
import { kvGet, kvSet } from "@/lib/kv";
import { screenHref } from "@/lib/nav";
import { getActiveOrg, setActiveOrg } from "@/lib/session";
import { useSession } from "@/lib/useSession";
import { CheckLine, CommentBox, CommentBubble, CompanyHeader, DeadlineRow, FileRow, MonthHead, TaxCard, Thread } from "@/ui/Accountant";
import { Card } from "@/ui/Card";
import { Chip, ChipStrip } from "@/ui/Chip";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import type { IconName, Tone } from "@/ui/Icon";
import { ScrollPage, Section, Stack } from "@/ui/Layout";
import { RowList, SectionHeader } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

const FILE_LOOK: Record<string, { icon: IconName; tone: Tone }> = { transactions: { icon: "file", tone: "sage" }, tax: { icon: "percent", tone: "violet" }, payroll: { icon: "bank", tone: "azure" } };

export default function AccountantView() {
  const { t, i18n } = useTranslation();
  const a = (k: string, o?: Record<string, unknown>) => t(`ac.${k}`, o) as string;
  const x = useComplianceText();
  const { locale } = x;
  const { status, user } = useSession();
  const toast = useToast();
  const client = useQueryClient();
  const signedIn = status === "in" || status === "offline";

  // Which company this phone last opened, and whether it is still in the person's list.
  const orgsQ = useQuery({ queryKey: ["team-orgs"], queryFn: team.orgs, enabled: signedIn, retry: false });
  const [stored, setStored] = useState<string | null | undefined>(undefined);
  const [known, setKnown] = useState<KnownOrg[] | null>(null);
  useEffect(() => {
    void getActiveOrg().then(setStored);
    void kvGet(KNOWN_KEY).then((raw) => setKnown(parseKnown(raw)));
  }, []);
  const ready = orgsQ.isSuccess && stored !== undefined && known !== null;
  const end = useMemo(() => (ready ? accessEnded(orgsQ.data.items, stored ?? null, known) : { ended: false, company: "" }), [ready, orgsQ.data, stored, known]);
  useEffect(() => {
    if (!ready || end.ended) return;
    void kvSet(KNOWN_KEY, JSON.stringify(mergeKnown(known, orgsQ.data.items, orgsQ.data.activeOrgId, new Date())));
    // Remember the company on this phone, so that if the access is turned off later the phone can tell.
    if (!stored && orgsQ.data.items.some((o) => o.orgId === orgsQ.data.activeOrgId && !o.isOwn)) void setActiveOrg(orgsQ.data.activeOrgId);
  }, [ready, end.ended, known, stored, orgsQ.data]);

  const live = signedIn && (ready ? !end.ended : orgsQ.isError);
  const [picked, setPicked] = useState<string | null>(null);
  const ovQ = useQuery({ queryKey: ["ac-overview", picked], queryFn: () => accountantApi.overview(picked ?? undefined), enabled: live, retry: 1 });
  const ov = ovQ.data && ovQ.data.enabled ? ovQ.data : null;
  const month = ov?.month ?? null;
  const commentsQ = useQuery({ queryKey: ["ac-comments", month], queryFn: () => accountantApi.comments(month!), enabled: live && !!month, retry: 1 });
  const cpQ = useQuery({ queryKey: ["cp-overview"], queryFn: complianceApi.overview, enabled: live && !!ov, retry: 1 });
  const cp = cpQ.data && cpQ.data.enabled ? cpQ.data : null;
  const items = useMemo(() => (cp ? buildItems(cp) : []), [cp]);
  const featured = useMemo(() => featuredReturn(items), [items]);
  const previous = useMemo(() => previousReturn(items, featured), [items, featured]);
  const useSheet = (p: { start: string; end: string } | null | undefined) => useQuery({ queryKey: ["cp-sheet", p?.start, p?.end], queryFn: () => complianceApi.worksheet(p!.start, p!.end), enabled: live && !!p, retry: 0, staleTime: 60_000 });
  const sheet = useSheet(featured?.period);
  const prevSheet = useSheet(previous?.period);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [got, setGot] = useState<ReadonlySet<string>>(new Set());

  const refresh = () => {
    for (const k of ["ac-overview", "ac-comments", "cp-overview", "cp-sheet", "team-orgs"]) void client.invalidateQueries({ queryKey: [k] });
  };
  const send = async () => {
    if (!month || !canSend(draft) || sending) return;
    setSending(true);
    try {
      await accountantApi.comment(month, draft.trim());
      setDraft("");
      await client.invalidateQueries({ queryKey: ["ac-comments", month] });
    } catch { toast({ message: a("comments.failed") }); } finally { setSending(false); }
  };
  const download = async (key: string, path: string, fallback: string) => {
    setBusy(key);
    try { await downloadCsv(path, fallback); setGot((g) => new Set(g).add(key)); } catch { toast({ message: a("exports.failed") }); } finally { setBusy(null); }
  };

  const monthName = (m: string): string => x.cap(new Intl.DateTimeFormat(locale, { month: "long" }).format(monthDate(m)));
  const shortDay = (iso: string): string => shortDate(new Date(iso), locale);
  const failed = ovQ.isError && !ovQ.data;
  const loading = !failed && (!ready && !orgsQ.isError ? true : live && ovQ.isPending && !ovQ.data);
  const locked = ovQ.data && !ovQ.data.enabled;
  const open = ov ? ov.months.find((m) => m.month === ov.month) : undefined;
  const parts: Check[] = ov ? checks(ov) : [];
  const chooseCompany = () => router.push(screenHref("CompanyPicker", t("companyPicker.title")));
  const company = ov?.company.name ?? end.company;

  const partNote = (c: Check): string => {
    if (c.key === "bank") return c.complete ? a("checks.bank.done") : a("checks.bank.left", { count: c.total - c.done });
    if (c.key === "receipts") return c.complete ? a("checks.receipts.done", { amount: money(30, locale, { cents: false }) }) : a("checks.receipts.missing", { count: c.total - c.done });
    if (c.key === "invoices") return c.drafts ? a("checks.invoices.withDrafts", { issued: a("checks.invoices.count", { count: c.done }), drafts: a("checks.invoices.drafts", { count: c.drafts }) }) : a("checks.invoices.count", { count: c.total });
    const dates = new Intl.ListFormat(locale, { type: "conjunction" }).format((c.periods ?? []).map((p) => x.d(p.end)));
    return a("checks.payroll.ends", { dates });
  };

  const tax = featured?.tax ?? "";
  const fmt = (cents: number) => money(cents / 100, locale);
  const sheetNet = sheet.data && featured ? netOf(sheet.data as Worksheet, tax) : null;
  const prevNet = prevSheet.data && previous ? netOf(prevSheet.data as Worksheet, previous.tax) : null;
  const upcoming = items.filter((i) => isOpen(i) && i.id !== featured?.id).slice(0, 3);
  const comments = commentsQ.data?.items ?? [];

  return (
    <Screen>
      <ScrollPage bottom={48}>
        <Section>
          <CompanyHeader initials={companyInitials(company)} kicker={a("kicker")} name={company} avatar={initialsOf(user?.name ?? "")} avatarLabel={a("switchAria", { name: user?.name ?? "" })} onAvatar={chooseCompany} />
        </Section>
        <Section delay={40} pt={12} px={20} gap={5}>
          <Text size={28} weight={600} tracking={-0.04} leading={1.15} accessibilityRole="header">{a("title")}</Text>
          <Text size={13.5} color="muted">{ov && ov.company.ownerName ? a("share", { you: ov.you.name, owner: ov.company.ownerName }) : (user?.name ?? "")}</Text>
        </Section>

        {end.ended ? (
          <Section delay={60} pt={16} px={16}>
            <Card><Empty icon="lock" iconTone="azure" title={a("ended.title")} body={a("ended.body", { company: end.company })} action={a("ended.other")} onAction={chooseCompany} actionKind="secondary" /></Card>
          </Section>
        ) : failed ? (
          <Section pt={26} px={16}><Empty icon="warn" iconTone="clay" title={a("loadFailed.title")} body={a("loadFailed.body")} action={a("retry")} onAction={refresh} /></Section>
        ) : locked ? (
          <Section pt={26} px={16}><Empty icon="bank" iconTone="sage" title={a("locked.title")} body={a("locked.body")} /></Section>
        ) : loading || !ov ? (
          <Section pt={16} px={16} gap={12}><Skeleton height={64} radius={16} /><Skeleton height={34} radius={17} /><Skeleton height={260} radius={22} /><Skeleton height={200} radius={22} /></Section>
        ) : (
          <>
            <Section delay={60} pt={16} px={16}>
              <Banner tone="info" icon="lock" iconTone="azure" lead={a("banner.lead")}>{a("banner.body")}</Banner>
            </Section>

            <Section delay={90} pt={24}>
              <Stack px={20}><SectionHeader title={a("month")} link={ov.fiscalYearEnd ? a("fiscal", { date: x.d(`2026-${ov.fiscalYearEnd}`) }) : undefined} /></Stack>
              <Stack pb={12}>
                <ChipStrip label={a("monthLabel")}>
                  {ov.months.map((m) => <Chip key={m.month} label={monthName(m.month)} selected={m.month === ov.month} onPress={() => setPicked(m.month)} />)}
                </ChipStrip>
              </Stack>
              <Stack px={16}>
                <Card>
                  <MonthHead name={`${monthName(ov.month)} ${ov.month.slice(0, 4)}`}
                    sub={open?.closed ? (open.closed.by ? a("sub.closedBy", { name: open.closed.by, date: shortDay(open.closed.at) }) : a("sub.closed", { date: shortDay(open.closed.at) })) : a("sub.open")}
                    status={monthState(open) === "closed" ? { tone: "mute", shape: "check", label: a("state.closed") } : { tone: "ok", shape: "live", label: a("state.inProgress") }} />
                  {parts.length === 0 ? <Stack px={16} pt={8} pb={16}><Text size={13.5} color="muted">{a("checks.empty", { month: monthName(ov.month) })}</Text></Stack> : (
                    parts.map((c, i) => (
                      <CheckLine key={c.key} first={i === 0} label={a(`checks.${c.key}.title`)} complete={c.complete} pct={c.pct} note={partNote(c)}
                        value={c.key === "invoices" ? fmt(c.cents ?? 0) : a("of", { done: c.done, total: c.total })} />
                    ))
                  )}
                </Card>
              </Stack>
            </Section>

            <Section delay={120} pt={24} px={16}>
              <SectionHeader title={a("exports.title")} link={monthName(ov.month)} />
              <Card>
                <RowList>
                  {exportsFor(ov.month, !!ov.payroll, monthEnd(ov.month)).map((f) => {
                    const key = `${f.key}:${ov.month}`;
                    const title = f.key === "tax" ? a("exports.tax.title") : a(`exports.${f.key}.title`);
                    return (
                      <FileRow key={key} icon={FILE_LOOK[f.key]!.icon} tone={FILE_LOOK[f.key]!.tone} title={title} sub={a(`exports.${f.key}.sub`)}
                        done={got.has(key)} doneLabel={a("exports.downloaded")} busy={busy === key} button={a("exports.download")} buttonLabel={a("exports.downloadAria", { file: title, month: monthName(ov.month) })}
                        onPress={() => void download(key, f.path, f.fallback)} />
                    );
                  })}
                </RowList>
              </Card>
            </Section>

            <Section delay={150} pt={24} px={16}>
              <SectionHeader title={featured ? x.taxName(tax) : a("tax.deadlines")} link={a("tax.link")} onLink={() => router.push(screenHref("Compliance", t("cp.title")))} />
              {cpQ.isPending && !cpQ.data ? <Skeleton height={190} radius={22} /> : featured ? (
                <TaxCard
                  left={a("tax.period", { period: x.periodOf(featured), range: featured.period ? x.rangeText(featured.period.start, featured.period.end) : "" })}
                  right={a(`tax.freq.${featured.period?.frequency ?? "quarterly"}`)}
                  figure={sheetNet ? fmt(sheetNet.netCents) : "–"}
                  status={{ ...statusOf(featured.look), label: featured.look === "filed" ? a("tax.filed", { date: featured.filedOn ? x.d(featured.filedOn) : "" }) : featured.look === "overdue" ? t("cp.words.late", { count: -featured.daysLeft }) : a("tax.due", { date: x.d(featured.due) }) }}
                  lines={[
                    ...(sheetNet ? [{ label: a("tax.collected", { tax: x.taxName(tax) }), value: fmt(sheetNet.collectedCents) }, { label: a("tax.credits"), value: `−${fmt(sheetNet.creditsCents)}` }] : []),
                    ...(previous && prevNet ? [{ label: a("tax.previous", { period: x.periodOf(previous), date: previous.filedOn ? x.d(previous.filedOn) : "" }), value: fmt(prevNet.netCents), muted: true }] : []),
                  ]} />
              ) : upcoming.length === 0 ? <Card><Stack px={16} pt={16} pb={16}><Text size={13.5} color="muted">{a("tax.none")}</Text></Stack></Card> : null}
              {upcoming.length > 0 ? (
                <Stack mt={featured ? 10 : 0}>
                  <Card>
                    <RowList>
                      {upcoming.map((i) => (
                        <DeadlineRow key={i.id} icon={i.icon.icon} tone={i.icon.tone} title={x.title(i)} sub={x.sub(i)} status={{ ...statusOf(i.look), label: x.word(i) }}
                          onPress={() => router.push(screenHref("Compliance", t("cp.title")))} />
                      ))}
                    </RowList>
                  </Card>
                </Stack>
              ) : null}
            </Section>

            <Section delay={180} pt={24} px={16}>
              <SectionHeader title={a("comments.title")} link={monthName(ov.month)} />
              <Card padded>
                {commentsQ.isPending && !commentsQ.data ? <Skeleton height={80} radius={18} /> : comments.length === 0 ? (
                  <Text size={13.5} color="muted">{a("comments.empty", { owner: ov.company.ownerName || ov.company.name, month: monthName(ov.month) })}</Text>
                ) : (
                  <Thread>
                    {comments.map((c) => {
                      const at = new Date(c.at);
                      return <CommentBubble key={c.id} mine={c.mine} who={c.mine ? a("comments.you") : c.authorName} when={`${shortDate(at, locale)}, ${time(at, locale)}`} text={c.body} />;
                    })}
                  </Thread>
                )}
                {commentsQ.data?.canWrite === false ? (
                  <Stack pt={14}><Text size={12.5} color="faint">{a("comments.readOnly")}</Text></Stack>
                ) : (
                  <>
                    <Stack pt={16}><CommentBox value={draft} onChange={setDraft} onSend={() => void send()} placeholder={a("comments.placeholder")} sendLabel={a("comments.send")} busy={sending} /></Stack>
                    <Stack pt={10} px={2}><Text size={12.5} color="faint">{a("comments.note", { company: ov.company.ownerName || ov.company.name })}</Text></Stack>
                  </>
                )}
              </Card>
            </Section>
          </>
        )}
      </ScrollPage>
    </Screen>
  );
}
