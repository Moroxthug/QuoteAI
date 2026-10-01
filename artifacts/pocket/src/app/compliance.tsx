// Compliance.dc.html: tax and licence deadlines. States: default (the calendar), accountant (read-only: a banner, downloads instead of buttons that
// change things) and empty (the company hasn't said how it files: a few answers, then "Build my calendar"). Reads and writes /api/compliance/*.
// Not built: Upload proof and Remind me (the server keeps neither a file nor a per-item reminder), payroll remittances and the WSIB certificate as
// deadlines (the server derives sales tax, PST and T5018 deadlines; the rest are the company's own reminders).
import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiFailure, team } from "@/lib/api";
import {
  buildItems, canEditBooks, cycle, defaultSelection, doneVerb, featuredReturn, filePath, filterCounts, FILTERS, FISCAL_ENDS, FREQUENCIES, groups, isEmptyCalendar, isOpen, kpis, marks, monthTicks, netOf,
  previousReturn, setupOf, settingsFor, statusOf, taxName, DEFAULT_SETUP, type ComplianceSettings, type FilterKey, type Item, type PresetDto, type ReminderDto, type ReminderKind, type Setup,
} from "@/lib/compliance";
import { complianceApi } from "@/lib/complianceApi";
import { useComplianceText } from "@/lib/complianceText";
import { downloadCsv } from "@/lib/download";
import { money, splitMoney } from "@/lib/format";
import { screenHref } from "@/lib/nav";
import { useSession } from "@/lib/useSession";
import { MiniButton } from "@/ui/Books";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Chip, ChipStrip, ChipWrap } from "@/ui/Chip";
import { DeadlineItem, KpiThree, ReturnCard, SetupRow, Strip, StripSelected } from "@/ui/Compliance";
import { DateSheet } from "@/ui/DateSheet";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { SelectField, TextField } from "@/ui/Field";
import { Header } from "@/ui/Header";
import { Glyph, Icon } from "@/ui/Icon";
import { ScrollPage, Section, Stack } from "@/ui/Layout";
import { MenuList, MenuRow, RowList, SectionHeader } from "@/ui/Row";
import { Screen } from "@/ui/Screen";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { Text } from "@/ui/Text";

const ACT: Record<string, string> = { markFiled: "acts.markFiled", markPaid: "acts.markPaid", markRenewed: "acts.markRenewed", markDone: "acts.markDone" };
const TOAST: Record<string, string> = { markFiled: "toast.markFiled", markPaid: "toast.markPaid", markRenewed: "toast.markRenewed", markDone: "toast.markDone" };
const KINDS: ReminderKind[] = ["insurance", "licence", "workers_comp", "other"];
const RECURRENCES: ReminderDto["recurrence"][] = ["none", "monthly", "quarterly", "annual"];
const iso = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function Compliance() {
  const { t, i18n } = useTranslation();
  const x = useComplianceText();
  const { c, locale } = x;
  const { status } = useSession();
  const toast = useToast();
  const client = useQueryClient();
  const signedIn = status === "in" || status === "offline";
  const lang: "en" | "fr" = i18n.language === "fr" ? "fr" : "en";

  const orgsQ = useQuery({ queryKey: ["team-orgs"], queryFn: team.orgs, enabled: signedIn, retry: false });
  const role = orgsQ.data?.items.find((o) => o.orgId === orgsQ.data.activeOrgId)?.role ?? null;
  const acct = role === "accountant";
  const canEdit = canEditBooks(role);
  const you = useSession().user?.name ?? "";

  const overviewQ = useQuery({ queryKey: ["cp-overview"], queryFn: complianceApi.overview, enabled: signedIn, retry: 1 });
  const ov = overviewQ.data && overviewQ.data.enabled ? overviewQ.data : null;
  const items = useMemo(() => (ov ? buildItems(ov) : []), [ov]);
  const featured = useMemo(() => featuredReturn(items), [items]);
  const previous = useMemo(() => previousReturn(items, featured), [items, featured]);
  const useSheet = (p: { start: string; end: string } | null | undefined) => useQuery({ queryKey: ["cp-sheet", p?.start, p?.end], queryFn: () => complianceApi.worksheet(p!.start, p!.end), enabled: signedIn && !!p, retry: 0, staleTime: 60_000 });
  const sheet = useSheet(featured?.period);
  const prevSheet = useSheet(previous?.period);

  const [filter, setFilter] = useState<FilterKey>("all");
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [adding, setAdding] = useState(false);
  const [setup, setSetup] = useState<Setup>(DEFAULT_SETUP);
  const [building, setBuilding] = useState(false);
  useEffect(() => { if (ov && sel === null) setSel(defaultSelection(items)); }, [ov, items, sel]);

  const refresh = () => { for (const k of ["cp-overview", "cp-sheet"]) void client.invalidateQueries({ queryKey: [k] }); };
  const fmt = (cents: number): string => money(cents / 100, locale);

  const markDone = async (i: Item) => {
    setBusy(i.id);
    const verb = doneVerb(i);
    try {
      if (i.source === "deadline" && i.period) {
        await complianceApi.markFiled(i.kind as never, i.period.key);
        toast({ message: c(TOAST[verb]!) });
      } else {
        const r = await complianceApi.reminderDone(i.id.replace(/^reminder:/, ""));
        toast({ message: r.reminder ? c("toast.renewedNext", { date: x.d(r.reminder.dueDate) }) : c(TOAST[verb]!) });
      }
      refresh();
    } catch { toast({ message: c("toast.failed") }); } finally { setBusy(null); }
  };
  const undo = async (i: Item) => {
    if (!i.period) return;
    setBusy(i.id);
    try { await complianceApi.undoFiled(i.kind as never, i.period.key); toast({ message: c("toast.undone") }); refresh(); } catch { toast({ message: c("toast.failed") }); } finally { setBusy(null); }
  };
  const download = async (i: Item) => {
    const path = filePath(i);
    if (!path) return;
    setBusy(`file:${i.id}`);
    try { await downloadCsv(path, `${i.kind}-${i.period?.key ?? ""}.csv`); } catch (e) { toast({ message: e instanceof ApiFailure && e.offline ? c("loadFailed.body") : c("toast.downloadFailed") }); } finally { setBusy(null); }
  };
  const build = async () => {
    setBuilding(true);
    try { await complianceApi.saveSettings(settingsFor(setup)); toast({ message: c("toast.saved") }); setSel(null); refresh(); } catch { toast({ message: c("toast.failed") }); } finally { setBuilding(false); }
  };

  // ── Add a reminder ──
  const [rTitle, setRTitle] = useState("");
  const [rKind, setRKind] = useState<ReminderKind>("insurance");
  const [rRec, setRRec] = useState<ReminderDto["recurrence"]>("annual");
  const [rPreset, setRPreset] = useState<PresetDto | null>(null);
  const [rDue, setRDue] = useState<Date | null>(null);
  const [pickDate, setPickDate] = useState(false);
  const [saving, setSaving] = useState(false);
  const openAdd = () => {
    setMenu(false);
    setRTitle(""); setRKind("insurance"); setRRec("annual"); setRPreset(null);
    const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + 30);
    setRDue(d); setAdding(true);
  };
  const choosePreset = (p: PresetDto) => {
    setRPreset(p); setRTitle(p.title[lang] || p.title.en); setRKind(p.kind); setRRec(p.recurrence);
    if (p.usualDate) {
      const now = new Date(); const [mm, dd] = p.usualDate.split("-").map(Number) as [number, number];
      const d = new Date(now.getFullYear(), mm - 1, dd, 12); if (d < now) d.setFullYear(d.getFullYear() + 1);
      setRDue(d);
    }
  };
  const saveReminder = async () => {
    if (!rTitle.trim() || !rDue) return;
    setSaving(true);
    try {
      await complianceApi.addReminder({ kind: rKind, preset: rPreset?.id ?? null, title: rTitle.trim(), authority: rPreset?.authority ?? "", dueDate: iso(rDue), recurrence: rRec });
      toast({ message: c("toast.reminder") });
      setAdding(false); refresh();
    } catch { toast({ message: c("toast.failed") }); } finally { setSaving(false); }
  };

  const province = ov?.registrations.province ?? null;
  const tax = taxName(province);
  const company = orgsQ.data?.items.find((o) => o.orgId === orgsQ.data.activeOrgId)?.companyName ?? "";
  const sub = ov
    ? ov.settings.salesTaxFrequency
      ? c("sub", { company, province: province ? c(`prov.${province.toUpperCase()}`) : "", tax: c(`tax.${tax}`), frequency: c(`freqSub.${ov.settings.salesTaxFrequency}`) })
      : c("subPlain", { company, province: province ? c(`prov.${province.toUpperCase()}`) : "" })
    : "";
  const failed = overviewQ.isError && !overviewQ.data;
  const locked = overviewQ.data && !overviewQ.data.enabled;
  const loading = !failed && !locked && !ov;
  const empty = ov ? isEmptyCalendar(ov) : false;
  const back = () => (router.canGoBack() ? router.back() : router.replace("/menu"));
  const toSettings = () => router.push(screenHref("SetTaxes", c("setup.link")));

  const k = ov ? kpis(items, ov.filedThisYear) : null;
  const gs = groups(items, filter);
  const counts = filterCounts(items);
  const selected = items.find((i) => i.id === sel) ?? null;
  const net = sheet.data && featured ? netOf(sheet.data, featured.tax) : null;
  const prevNet = prevSheet.data && previous ? netOf(prevSheet.data, previous.tax) : null;
  const amountOf = (i: Item): string | undefined => (featured && i.id === featured.id && net ? fmt(net.netCents) : previous && i.id === previous.id && prevNet ? fmt(prevNet.netCents) : undefined);
  const word = (i: Item) => ({ ...statusOf(i.look), label: x.word(i) });

  const split = net ? splitMoney(Math.abs(net.netCents) / 100, locale) : null;
  const fileBtn = (i: Item) => (filePath(i) ? <MiniButton key="file" label={i.kind === "t5018" ? c("acts.summary") : c("acts.worksheet")} disabled={busy === `file:${i.id}`} onPress={() => void download(i)} /> : null);

  return (
    <Screen>
      <Header title={c("title")} backLabel={c("back")} onBack={back} moreLabel={c("more")} onMore={() => setMenu(true)} />
      <ScrollPage bottom={48}>
        <Section pt={8} px={20} gap={4}>
          <Text size={24} weight={600} tracking={-0.035} leading={1.2} accessibilityRole="header">{c("h1")}</Text>
          {sub ? <Text size={13.5} color="muted">{sub}</Text> : null}
        </Section>

        {failed ? (
          <Section pt={26} px={16}><Empty icon="warn" iconTone="clay" title={c("loadFailed.title")} body={c("loadFailed.body")} action={c("retry")} onAction={refresh} /></Section>
        ) : locked ? (
          <Section pt={26} px={16}><Empty icon="shield" iconTone="sage" title={c("locked.title")} body={c("locked.body")} /></Section>
        ) : loading ? (
          <Section pt={16} px={16} gap={12}><Skeleton height={86} radius={22} /><Skeleton height={230} radius={22} /><Skeleton height={190} radius={22} /></Section>
        ) : ov && empty ? (
          <>
            {acct ? <Section delay={30} pt={14} px={16}><Banner tone="info" icon="eye" iconTone="sky" lead={c("banner.lead")}>{c("banner.body", { name: you })}</Banner></Section> : null}
            <Section pt={40}><Empty icon="cal" iconTone="sky" title={c("empty.title")} body={c("empty.body")} /></Section>
            {canEdit ? (
              <Section delay={60} pt={4} px={16}>
                <Card>
                  <RowList>
                    <SetupRow icon="percent" tone="violet" label={c("setup.filing", { tax: c(`tax.${tax}`) })} value={c(`freq.${setup.frequency}`)} onPress={() => setSetup({ ...setup, frequency: cycle(FREQUENCIES, setup.frequency) })} />
                    <SetupRow icon="cal" tone="sky" label={c("setup.fye")} value={x.d(`2026-${setup.fiscalYearEnd}`)} onPress={() => setSetup({ ...setup, fiscalYearEnd: cycle(FISCAL_ENDS, setup.fiscalYearEnd) })} />
                    <SetupRow icon="receipt" tone="amber" label={c("setup.instalments")} value={setup.instalments ? c("setup.quarterly") : c("setup.none")} onPress={() => setSetup({ ...setup, instalments: !setup.instalments })} />
                    <SetupRow icon="users" tone="indigo" label={c("setup.t5018")} value={setup.t5018 ? c("setup.on") : c("setup.off")} onPress={() => setSetup({ ...setup, t5018: !setup.t5018 })} />
                  </RowList>
                </Card>
                <Stack pt={16}><Button block size="lg" label={c("empty.build")} busy={building ? c("empty.building") : false} onPress={() => void build()} /></Stack>
                <Stack pt={6}><Button block kind="link" size="md" label={c("empty.settings")} onPress={toSettings} /></Stack>
              </Section>
            ) : null}
          </>
        ) : ov && k ? (
          <>
            {acct ? <Section delay={30} pt={14} px={16}><Banner tone="info" icon="eye" iconTone="sky" lead={c("banner.lead")}>{c("banner.body", { name: you })}</Banner></Section> : null}

            <Section delay={50} pt={16} px={16}>
              <KpiThree items={[
                { label: c("kpi.late"), value: String(k.late), sub: k.lateFirst ? x.title(k.lateFirst) : c("kpi.lateNone"), tone: k.late ? "bad" : undefined },
                { label: c("kpi.next"), value: String(k.next30), sub: k.nextTwo.length ? k.nextTwo.map((i) => (i.source === "deadline" ? (i.kind === "t5018" ? "T5018" : c(`tax.${i.tax}`).replace(/^(GST|TPS)\//, "")) : i.authority || i.title)).join(", ") : c("kpi.nextNone") },
                { label: c("kpi.filed", { year: ov.today.slice(0, 4) }), value: String(k.filedYear), sub: k.filedYear > 0 && k.onTimeYear < k.filedYear ? c("kpi.someOnTime", { count: k.onTimeYear }) : c("kpi.onTime") },
              ]} />
            </Section>

            {featured ? (
              <Section delay={80} pt={12} px={16}>
                <ReturnCard icon="percent" tone="violet" title={c("hst.title", { tax: x.taxName(featured.tax), period: x.periodOf(featured) })}
                  sub={featured.look === "filed" ? c("hst.subFiled", { range: featured.period ? x.rangeText(featured.period.start, featured.period.end) : "", date: featured.filedOn ? x.d(featured.filedOn) : "" }) : c("hst.sub", { range: featured.period ? x.rangeText(featured.period.start, featured.period.end) : "", date: x.d(featured.due) })}
                  status={word(featured)} caption={net && net.netCents < 0 ? c("hst.refund") : c("hst.net")} whole={split ? split.whole : "–"} cents={split ? split.cents : ""}
                  three={[
                    { label: c("hst.collected"), value: net ? fmt(net.collectedCents) : "–" },
                    { label: c("hst.credits"), value: net ? `−${fmt(net.creditsCents)}` : "–" },
                    { label: c("hst.days"), value: featured.look === "filed" ? "–" : String(Math.max(0, featured.daysLeft)) },
                  ]}>
                  <Button block kind="secondary" size="md" label={c("hst.worksheet")} busy={busy === `file:${featured.id}` ? c("hst.loading") : false} onPress={() => void download(featured)} />
                  {canEdit ? (
                    <Button block size="md" label={featured.filedToday || featured.look === "filed" ? c("hst.undoFiled") : c("hst.markFiled")} busy={busy === featured.id ? c("empty.building") : false}
                      onPress={() => void (featured.look === "filed" ? undo(featured) : markDone(featured))} />
                  ) : null}
                </ReturnCard>
              </Section>
            ) : null}

            <Section delay={110} pt={22} px={16}>
              <SectionHeader title={c("calendar.title")} link={c("calendar.link")} />
              <Card padded>
                <Strip label={c("calendar.aria")} selected={sel}
                  ticks={monthTicks(ov.today).map((m) => ({ key: m.month, pct: m.pct, label: new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(Number(m.month.slice(0, 4)), Number(m.month.slice(5)) - 1, 1, 12)).replace(/^./, (s) => s.toUpperCase()) }))}
                  marks={marks(items).map((m) => { const it = items.find((i) => i.id === m.id)!; return { ...m, date: x.d(m.due), aria: c("calendar.mark", { title: x.title(it), date: x.d(m.due) }) }; })}
                  onPick={setSel} />
                {selected ? <Stack pt={0}><StripSelected title={x.title(selected)} when={x.when(selected)} status={word(selected)} /></Stack> : null}
              </Card>
            </Section>

            <Section delay={130} pt={16}>
              <ChipStrip label={c("filter")}>
                {FILTERS.map((f) => <Chip key={f} label={c(`filters.${f}`)} count={counts[f]} selected={filter === f} onPress={() => setFilter(f)} />)}
              </ChipStrip>
            </Section>

            {gs.map((g) => (
              <Section key={g.key} delay={150} pt={18} px={16}>
                <SectionHeader title={c(`groups.${g.key}`)} link={g.key === "filed" ? c("groupSub.filed") : g.key === "later" ? undefined : c(`groupSub.${g.key}`, { count: g.items.length })} />
                <Card>
                  {g.items.map((i, n) => {
                    const open = sel === i.id;
                    return (
                      <DeadlineItem key={i.id} first={n === 0} icon={i.icon.icon} tone={i.icon.tone} title={x.title(i)} sub={x.sub(i)} status={word(i)} amount={amountOf(i)} selected={open} expanded={open}
                        onPress={() => setSel(i.id)}>
                        {canEdit && isOpen(i) ? <MiniButton label={c(ACT[doneVerb(i)]!)} disabled={busy === i.id} onPress={() => void markDone(i)} /> : null}
                        {canEdit && i.look === "filed" && i.filedToday && i.source === "deadline" ? <MiniButton label={c("acts.undo")} disabled={busy === i.id} onPress={() => void undo(i)} /> : null}
                        {acct ? fileBtn(i) : null}
                      </DeadlineItem>
                    );
                  })}
                </Card>
              </Section>
            ))}
            {gs.length === 0 ? (
              <Section pt={20}><Empty icon="check" iconTone="sage" title={c("noMatch.title")} body={c("noMatch.body")} /></Section>
            ) : null}

            <Section delay={190} pt={22} px={16}>
              <SectionHeader title={c("setup.title")} link={c("setup.link")} onLink={toSettings} />
              <Card>
                <RowList>
                  <SetupRow icon="percent" tone="violet" label={c("setup.filing", { tax: c(`tax.${tax}`) })} value={ov.settings.salesTaxFrequency ? c(`freq.${ov.settings.salesTaxFrequency}`) : c("setup.none")} onPress={toSettings} />
                  <SetupRow icon="cal" tone="sky" label={c("setup.fye")} value={x.d(`2026-${setupOf(ov.settings).fiscalYearEnd}`)} onPress={toSettings} />
                  <SetupRow icon="receipt" tone="amber" label={c("setup.instalments")} value={ov.settings.instalments ? c("setup.quarterly") : c("setup.none")} onPress={toSettings} />
                  <SetupRow icon="users" tone="indigo" label={c("setup.t5018")} value={ov.settings.t5018 ? c("setup.on") : c("setup.off")} onPress={toSettings} />
                </RowList>
              </Card>
              {canEdit ? (
                <Stack pt={12}><Button block kind="secondary" label={c("addReminder")} icon={<Glyph name="plus" size={14} weight={2.4} />} onPress={openAdd} /></Stack>
              ) : null}
            </Section>
          </>
        ) : null}
      </ScrollPage>

      <Sheet open={menu} onClose={() => setMenu(false)} label={c("more")} closeLabel={c("close")}>
        <MenuList>
          {canEdit ? <MenuRow icon={<Icon name="plus" tone="violet" size={28} />} title={c("menu.add")} sub={c("menu.addSub")} chevron={false} onPress={openAdd} /> : null}
          <MenuRow icon={<Icon name="percent" tone="azure" size={28} />} title={c("menu.settings")} sub={c("menu.settingsSub")} onPress={() => { setMenu(false); toSettings(); }} />
        </MenuList>
      </Sheet>

      <Sheet open={adding} onClose={() => setAdding(false)} label={c("sheet.title")} closeLabel={c("close")}>
        <SheetTitle>{c("sheet.title")}</SheetTitle>
        <Stack pb={20} gap={14}>
          {ov && ov.presets.length > 0 ? (
            <Stack gap={8}>
              <Stack px={20}><Text size={12.5} color="muted">{c("sheet.from")}</Text></Stack>
              <ChipWrap>{ov.presets.map((p) => <Chip key={p.id} label={p.title[lang] || p.title.en} selected={rPreset?.id === p.id} onPress={() => choosePreset(p)} />)}</ChipWrap>
            </Stack>
          ) : null}
          <Stack px={16}><TextField label={c("sheet.name")} value={rTitle} onChangeText={setRTitle} placeholder={c("sheet.namePh")} /></Stack>
          <Stack gap={8}>
            <ChipWrap>{KINDS.map((kd) => <Chip key={kd} label={c(`sheet.kind.${kd}`)} selected={rKind === kd} onPress={() => setRKind(kd)} />)}</ChipWrap>
          </Stack>
          <Stack px={16}><SelectField label={c("sheet.due")} value={rDue ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(rDue) : ""} mono onPress={() => setPickDate(true)} /></Stack>
          <Stack gap={8}>
            <Stack px={20}><Text size={12.5} color="muted">{c("sheet.repeat")}</Text></Stack>
            <ChipWrap>{RECURRENCES.map((r) => <Chip key={r} label={c(`sheet.rec.${r}`)} selected={rRec === r} onPress={() => setRRec(r)} />)}</ChipWrap>
          </Stack>
          <Stack px={16}><Button block label={c("sheet.save")} disabled={!rTitle.trim() || !rDue} busy={saving ? c("sheet.saving") : false} onPress={() => void saveReminder()} /></Stack>
        </Stack>
      </Sheet>
      <DateSheet open={pickDate} onClose={() => setPickDate(false)} title={c("sheet.due")} closeLabel={c("close")} prevLabel={c("sheet.prev")} nextLabel={c("sheet.next")} locale={locale} value={rDue} onPick={(d) => { setRDue(d); setPickDate(false); }} />
    </Screen>
  );
}
