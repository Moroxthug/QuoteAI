// SetTaxes.dc.html. The company's tax: the province's rate and its parts, where it works (the province, the GST/HST number, the job's province), the exempt clients
// (a rebate assigned to you, a certificate on file; add or remove one), whether materials and labour are priced apart, how tax shows on documents (a separate line
// or in the prices, on each line, with the number) and how the company files (monthly, quarterly or yearly, the next return and what was collected).
// States: default, view only, loading and can't load. Filing and the next return come from the compliance calendar and only show on a plan that has it.
// Saved but not read yet by the quote and invoice makers: the exempt clients, "Use the job's province", the split, how tax shows and the number on documents.
import { useMemo, useState } from "react";
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clientsApi } from "@/lib/clientsApi";
import { dayDate, type ComplianceOverview, type DeadlineDto } from "@/lib/compliance";
import { complianceApi } from "@/lib/complianceApi";
import { dateRange, money, percent, shortDate, type Locale } from "@/lib/format";
import { screenHref } from "@/lib/nav";
import { PROVINCES, PROVINCE_RATE, provinceCode, taxKey, type ProvinceCode } from "@/lib/newQuote";
import { fold } from "@/lib/search";
import { pageOf } from "@/lib/profile";
import { useProfile } from "@/lib/useProfile";
import { useRole } from "@/lib/useRole";
import { useSession } from "@/lib/useSession";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { Button } from "@/ui/Button";
import { Header } from "@/ui/Header";
import { ScrollPage, Section, Stack } from "@/ui/Layout";
import { Screen } from "@/ui/Screen";
import { Search } from "@/ui/Search";
import { ChoiceList, SetGroup, SetRow, SetSegment, SetValue, SheetNote } from "@/ui/Settings";
import { RowStatus, SetTitle, TaxCard } from "@/ui/SettingsPages";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { Switch } from "@/ui/Switch";

type Exempt = { clientId: string; reason: "rebate" | "exempt" };

export default function SetTaxes() {
  const { t: tr, i18n } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`stx.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const toast = useToast();
  const client = useQueryClient();
  const { profile, q, save } = useProfile();
  const { isOwner } = useRole();
  const clientsQ = useQuery({ queryKey: ["clients-overview"], queryFn: clientsApi.overview, enabled: signedIn, retry: 1, staleTime: 30_000 });
  const compQ = useQuery({ queryKey: ["compliance"], queryFn: complianceApi.overview, enabled: signedIn, retry: 0, staleTime: 60_000 });
  const comp = compQ.data && compQ.data.enabled ? (compQ.data as Extract<ComplianceOverview, { enabled: true }>) : null;
  const [provinceOpen, setProvinceOpen] = useState(false);
  const [exOpen, setExOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [picked, setPicked] = useState<string | null>(null);

  const page = pageOf(profile, "tax");
  const exempt: Exempt[] = page.exempt ?? [];
  const clients = clientsQ.data?.items ?? [];

  const worksheetQ = useQuery({
    queryKey: ["tax-worksheet", comp?.deadlines.find((d) => d.kind === "sales_tax" && !d.filedAt)?.key ?? "none"],
    queryFn: () => {
      const d = comp!.deadlines.find((x) => x.kind === "sales_tax" && !x.filedAt)!;
      return complianceApi.worksheet(d.periodStart, d.periodEnd);
    },
    enabled: !!comp?.deadlines.some((d) => d.kind === "sales_tax" && !d.filedAt), retry: 0, staleTime: 60_000,
  });

  const savePage = async (patch: Record<string, unknown>) => {
    const r = await save({ pocketSettings: { tax: patch } });
    if (!r.ok) toast({ message: r.status === 403 ? t("noAccess") : r.status === 0 ? t("offline") : t("failed") });
  };
  const saveProvince = async (code: ProvinceCode) => {
    setProvinceOpen(false);
    const r = await save({ province: code });
    if (!r.ok) toast({ message: r.status === 403 ? t("noAccess") : r.status === 0 ? t("offline") : t("failed") });
  };
  const saveFreq = async (i: number) => {
    const salesTaxFrequency = (["monthly", "quarterly", "annual"] as const)[i]!;
    try { await complianceApi.saveSettings({ ...(comp?.settings ?? {}), salesTaxFrequency }); void client.invalidateQueries({ queryKey: ["compliance"] }); void client.invalidateQueries({ queryKey: ["tax-worksheet"] }); }
    catch { toast({ message: t("failed") }); }
  };

  if (status === "out") return <Redirect href="/" />;

  const loading = q.isPending && !profile;
  const failed = q.isError && !profile;
  const canEdit = isOwner;
  const code = provinceCode(profile?.province) ?? "ON";
  const rate = PROVINCE_RATE[code];
  const comps = profile?.taxProfile?.components ?? [];
  const taxWord = tr(`nq.tax.${taxKey(code)}`);
  const pct = (n: number) => percent(n / 100, locale, n % 1 ? 3 : 0);
  const provName = tr(`onboarding.provinces.${code}.name`);
  // The parts: a single HST is the federal 5 % and the province's share; GST plus another tax is each; GST alone has none to split.
  const parts = comps.length > 1 ? comps.map((c) => ({ label: c.code === "GST" ? t("parts.federal") : t("parts.provincial", { name: provName }), value: pct(c.rate) }))
    : comps.length === 1 && comps[0]!.code === "HST" ? [{ label: t("parts.federal"), value: pct(5) }, { label: t("parts.provincial", { name: provName }), value: pct(comps[0]!.rate - 5) }] : [];
  const company = profile?.companyName ?? "";
  const gst = profile?.gstHstNumber ?? "";
  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("Settings", t("title"))));

  const next: DeadlineDto | undefined = comp?.deadlines.find((d) => d.kind === "sales_tax" && !d.filedAt);
  const freq = comp?.settings.salesTaxFrequency ?? null;
  const freqIdx = freq === "monthly" ? 0 : freq === "annual" ? 2 : 1;
  const net = worksheetQ.data ? worksheetQ.data.summary.gstHst.netCents + (worksheetQ.data.summary.qst?.netCents ?? 0) : null;

  const exName = (id: string) => clients.find((c) => c.id === id)?.name ?? "";
  const setExempt = async (clientId: string, reason: Exempt["reason"] | null) => {
    const rest = exempt.filter((e) => e.clientId !== clientId);
    await savePage({ exempt: reason ? [...rest, { clientId, reason }] : rest });
    setPicked(null); setExOpen(false); setTerm("");
  };
  const listed = useMemo(() => clients.filter((c) => !term.trim() || fold(`${c.name} ${c.city ?? ""}`).includes(fold(term))), [clients, term]);
  const pickedClient = clients.find((c) => c.id === picked);
  const pickedState = exempt.find((e) => e.clientId === picked);

  return (
    <Screen>
      <Header title="" backLabel={t("back")} onBack={back} />
      <ScrollPage bottom={56}>
        <SetTitle title={t("title")} lede={gst ? t("lede", { company }) : t("ledeNone", { company })} />
        {failed ? (
          <Section pt={26} px={16}><Empty icon="warn" iconTone="clay" title={t("loadFailed.title")} body={t("loadFailed.body")} action={t("retry")} onAction={() => void q.refetch()} /></Section>
        ) : loading ? (
          <Section pt={18} px={16} gap={14}><Skeleton height={150} radius={22} /><Skeleton height={190} radius={22} /><Skeleton height={190} radius={22} /></Section>
        ) : (
          <>
            {!canEdit ? <Section pt={16} px={16}><Banner tone="info" icon="eye" iconTone="sky" lead={t("viewOnly.lead")}>{t("viewOnly.body")}</Banner></Section> : null}
            <Section delay={40} pt={18} px={16}><TaxCard province={provName} rate={pct(rate)} tag={taxWord} parts={parts} /></Section>

            <Section delay={80}>
              <SetGroup title={t("g.prov")}>
                <SetRow first icon="pin" tone="clay" label={t("province.label")} sub={t("province.sub")} control={<SetValue value={provName} chevron />} onPress={canEdit ? () => setProvinceOpen(true) : undefined} />
                <SetRow icon="receipt" tone="violet" label={t("gst.label")} sub={t("gst.sub")} control={<SetValue value={gst || t("gst.none")} mono />} />
                <SetRow icon="house" tone="amber" label={t("byJob.label")} sub={t("byJob.sub", { province: provName })} control={<Switch value={page.byJobProvince ?? true} onChange={(v) => void savePage({ byJobProvince: v })} label={t("byJob.label")} disabled={!canEdit} />} />
              </SetGroup>
            </Section>

            <Section delay={130}>
              <SetGroup title={t("g.ex")} foot={t("ex.foot")}>
                {exempt.map((e, i) => (
                  <SetRow key={e.clientId} first={i === 0} icon="user" tone={e.reason === "rebate" ? "teal" : "sky"} label={exName(e.clientId) || "…"} sub={t(`ex.${e.reason}`)} control={<SetValue value={t(`ex.${e.reason}Tag`)} chevron />}
                    onPress={() => router.push(screenHref("Client", exName(e.clientId), { id: e.clientId }))} />
                ))}
                {canEdit ? <SetRow first={exempt.length === 0} icon="plus" tone="slate" label={t("ex.add")} sub={t("ex.addSub")} onPress={() => { setPicked(null); setTerm(""); setExOpen(true); }} /> : null}
              </SetGroup>
            </Section>

            <Section delay={180}>
              <SetGroup title={t("g.split")} foot={t("split.foot")}>
                <SetRow first icon="bricks" tone="stone" label={t("split.label")} sub={t(page.split ? "split.on" : "split.off")} control={<Switch value={page.split ?? false} onChange={(v) => void savePage({ split: v })} label={t("split.label")} disabled={!canEdit} />} />
              </SetGroup>
            </Section>

            <Section delay={230}>
              <SetGroup title={t("g.docs")}>
                <SetRow first icon="doc" tone="azure" label={t("show.label")} below={<SetSegment options={[t("show.line"), t("show.included")]} value={page.showAs === "included" ? 1 : 0} onChange={(i) => void savePage({ showAs: i === 1 ? "included" : "line" })} label={t("show.label")} disabled={!canEdit} />} />
                <SetRow icon="list" tone="lilac" label={t("perLine.label")} sub={t("perLine.sub")} control={<Switch value={page.perLine ?? false} onChange={(v) => void savePage({ perLine: v })} label={t("perLine.label")} disabled={!canEdit} />} />
                <SetRow icon="receipt" tone="violet" label={t("showNum.label")} sub={t("showNum.sub")} control={<Switch value={page.showNumber ?? true} onChange={(v) => void savePage({ showNumber: v })} label={t("showNum.label")} disabled={!canEdit} />} />
              </SetGroup>
            </Section>

            {comp ? (
              <Section delay={280}>
                <SetGroup title={t("g.file")} foot={t("fileFoot")}>
                  <SetRow first icon="cal" tone="teal" label={t("freq.label")} below={<SetSegment options={[t("freq.monthly"), t("freq.quarterly"), t("freq.annual")]} value={freqIdx} onChange={(i) => void saveFreq(i)} label={t("freq.label")} disabled={!canEdit} />} />
                  <SetRow icon="clock" tone="amber" label={t("next.label")} sub={next ? dateRange(dayDate(next.periodStart), dayDate(next.periodEnd), locale) : t("next.none")}
                    control={next ? <RowStatus tone={next.daysLeft < 0 ? "bad" : "warn"} shape={next.daysLeft < 0 ? "alert" : "clock"}>{t("next.due", { date: shortDate(dayDate(next.dueDate), locale) })}</RowStatus> : undefined} />
                  <SetRow icon="bank" tone="sage" label={t("collected.label")} sub={t("collected.sub")} control={<SetValue value={net != null ? money(net / 100, locale) : ""} mono chevron />} onPress={() => router.push(screenHref("Books", t("collected.label")))} />
                </SetGroup>
              </Section>
            ) : null}
          </>
        )}
      </ScrollPage>

      <Sheet open={provinceOpen} onClose={() => setProvinceOpen(false)} label={t("province.sheet")} closeLabel={t("close")}>
        <Stack px={16} pb={30} gap={4}>
          <SheetTitle>{t("province.sheet")}</SheetTitle>
          <ChoiceList chosen={code} items={PROVINCES.map((c) => ({ id: c, name: tr(`onboarding.provinces.${c}.name`), sub: tr(`onboarding.provinces.${c}.tax`) }))} onPick={(c) => void saveProvince(c as ProvinceCode)} />
        </Stack>
      </Sheet>

      <Sheet open={exOpen} onClose={() => { setExOpen(false); setPicked(null); }} label={t("ex.sheet")} closeLabel={t("close")}>
        <Stack px={16} pb={30} gap={4}>
          <SheetTitle>{pickedClient ? pickedClient.name : t("ex.sheet")}</SheetTitle>
          {pickedClient ? (
            <>
              <SheetNote>{t("ex.reason")}</SheetNote>
              <ChoiceList chosen={pickedState?.reason ?? null} items={[{ id: "rebate", name: t("ex.rebateTag"), sub: t("ex.rebate") }, { id: "exempt", name: t("ex.exemptTag"), sub: t("ex.exempt") }]} onPick={(r) => void setExempt(pickedClient.id, r as Exempt["reason"])} />
              {pickedState ? <Stack pt={14}><Button kind="destructive" size="md" label={t("ex.remove")} block onPress={() => void setExempt(pickedClient.id, null)} /></Stack> : null}
            </>
          ) : (
            <>
              <SheetNote>{t("ex.sheetSub")}</SheetNote>
              <Search label={t("ex.search")} placeholder={t("ex.search")} value={term} onChangeText={setTerm} autoCorrect={false} autoCapitalize="none" />
              <Stack pt={8}>
                {clients.length === 0 ? <Empty icon="user" iconTone="slate" title={t("ex.noClients")} body="" /> : (
                  <ChoiceList chosen={null} items={listed.slice(0, 40).map((c) => ({ id: c.id, name: c.name, sub: exempt.find((e) => e.clientId === c.id) ? t(`ex.${exempt.find((e) => e.clientId === c.id)!.reason}Tag`) : [c.address, c.city].filter(Boolean).join(", ") }))} onPick={(id) => setPicked(id)} />
                )}
              </Stack>
            </>
          )}
        </Stack>
      </Sheet>
    </Screen>
  );
}

