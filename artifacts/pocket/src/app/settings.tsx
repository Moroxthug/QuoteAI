// Settings.dc.html. The hub: the assistant's voice, language, speaking and asking before sending; the company's pages (details, taxes, invoices, quotes,
// templates, messaging, widget); roles, connected apps, what the assistant can do, customize home; the quote defaults (province, deposit, valid for, materials
// markup, a copy to me); the notifications this person gets; display (light / dark / auto, units, text size); security (sign-in, Face ID, export my data);
// the plan and help. Every switch and stepper saves at once (rolled back, with a toast, when the server says no) and a search narrows the rows.
// Saved but not read yet by the rest of the app: nothing here is read by the quote or invoice makers except the quote defaults (valid for, markup, units,
// the copy, the deposit) which they already used. Face ID needs a module this build doesn't have (the row is there, off, and says so).
import { useMemo, useState, type ReactNode } from "react";
import { Linking, View } from "react-native";
import Constants from "expo-constants";
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useGetSubscription } from "@workspace/api-client-react";
import { ApiFailure, api } from "@/lib/api";
import { percent, shortDate, type Locale } from "@/lib/format";
import { PROVINCES, provinceCode, taxKey, PROVINCE_RATE } from "@/lib/newQuote";
import { netOf, scheduleOf, depositOf, withDeposit } from "@/lib/profile";
import { profileApi, type MemberPrefs } from "@/lib/profileApi";
import { screenHref } from "@/lib/nav";
import { fold } from "@/lib/search";
import { useProfile } from "@/lib/useProfile";
import { useRole } from "@/lib/useRole";
import { useSession } from "@/lib/useSession";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { Header, PageTitle } from "@/ui/Header";
import { ScrollPage, Section, Stack } from "@/ui/Layout";
import { Search } from "@/ui/Search";
import { Hairline } from "@/ui/Card";
import { Screen } from "@/ui/Screen";
import { ChoiceList, SetGroup, SetRow, SetSegment, SetStepper, SetValue, SheetNote, VersionFoot, VoicePicker } from "@/ui/Settings";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { Switch } from "@/ui/Switch";
import { useTheme } from "@/ui/theme";

type Row = { id: string; hay: string; node: (first: boolean) => ReactNode };
type Group = { key: string; title: string; rows: Row[]; voice?: ReactNode };

export default function Settings() {
  const { t: tr, i18n } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`st.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { status } = useSession();
  const toast = useToast();
  const client = useQueryClient();
  const { profile, q, save, signedIn } = useProfile();
  const { isOwner } = useRole();
  const prefsQ = useQuery({ queryKey: ["member-prefs"], queryFn: profileApi.prefs, enabled: signedIn, retry: 1, staleTime: 60_000 });
  const pushQ = useQuery({ queryKey: ["push-preferences"], queryFn: profileApi.push, enabled: signedIn, retry: 1, staleTime: 60_000 });
  const sub = useGetSubscription({ query: { enabled: signedIn, retry: false } } as never);
  const { appearance, setAppearance, textSize, setTextSize } = useTheme();
  const [term, setTerm] = useState("");
  const [provinceOpen, setProvinceOpen] = useState(false);

  const prefs: MemberPrefs = prefsQ.data?.preferences ?? {};
  const muted = new Set(pushQ.data?.muted ?? []);
  const canEdit = isOwner;

  const savePrefs = async (p: MemberPrefs) => {
    const before = client.getQueryData<{ preferences: MemberPrefs }>(["member-prefs"]);
    client.setQueryData(["member-prefs"], { preferences: { ...(before?.preferences ?? {}), ...p } });
    try { client.setQueryData(["member-prefs"], await profileApi.savePrefs(p)); }
    catch (e) { if (before) client.setQueryData(["member-prefs"], before); toast({ message: e instanceof ApiFailure && e.offline ? t("toast.offline") : t("toast.failed") }); }
  };
  const flipPush = async (category: string, on: boolean) => {
    const next = on ? [...muted].filter((c) => c !== category) : [...muted, category];
    const before = client.getQueryData(["push-preferences"]);
    client.setQueryData(["push-preferences"], { categories: pushQ.data?.categories ?? [], muted: next });
    try { client.setQueryData(["push-preferences"], await profileApi.savePush(next)); }
    catch (e) { client.setQueryData(["push-preferences"], before); toast({ message: e instanceof ApiFailure && e.offline ? t("toast.offline") : t("toast.failed") }); }
  };
  const saveProfile = async (patch: Parameters<typeof save>[0]) => {
    const r = await save(patch);
    if (!r.ok) toast({ message: r.status === 403 ? t("toast.noAccess") : r.status === 0 ? t("toast.offline") : t("toast.failed") });
    return r.ok;
  };

  if (status === "out") return <Redirect href="/" />;

  const loading = q.isPending && !profile;
  const failed = q.isError && !profile;
  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("Menu", t("back"))));
  const go = (name: string, label: string) => () => router.push(screenHref(name, label));
  const code = provinceCode(profile?.province);
  const taxWord = tr(`nq.tax.${taxKey(code ?? "ON")}`);
  const taxValue = code ? `${taxWord} ${percent(PROVINCE_RATE[code] / 100, locale, PROVINCE_RATE[code] % 1 ? 3 : 0)}` : "";
  const schedule = scheduleOf(profile);
  const deposit = depositOf(schedule);
  const dep = (v: number) => {
    const s = withDeposit(schedule, v, t("deposit.term"));
    if (!s) { toast({ message: t("deposit.tooBig") }); return; }
    void saveProfile({ defaultPaymentSchedule: s });
  };
  const net = netOf(schedule);
  const netWord = t(`invoices.net.${net}`);
  const smsOn = profile?.automationSettings.smsEnabled ?? false;
  const planName = (sub.data as { plan?: string; periodEnd?: string } | undefined)?.plan;
  const planSub = planName
    ? t("plan.sub", { plan: planName.charAt(0).toUpperCase() + planName.slice(1), date: (sub.data as { periodEnd?: string }).periodEnd ? shortDate(new Date((sub.data as { periodEnd: string }).periodEnd), locale) : "" })
    : t("plan.subNone");

  const sw = (id: string, icon: Parameters<typeof SetRow>[0]["icon"], tone: Parameters<typeof SetRow>[0]["tone"], label: string, sub: string, on: boolean, onChange: (v: boolean) => void, disabled?: boolean): Row => ({
    id, hay: `${label} ${sub}`, node: (first) => <SetRow first={first} icon={icon} tone={tone} label={label} sub={sub} control={<Switch value={on} onChange={onChange} label={label} disabled={disabled} />} />,
  });
  const link = (id: string, icon: Parameters<typeof SetRow>[0]["icon"], tone: Parameters<typeof SetRow>[0]["tone"], label: string, sub: string, value: string, onPress: () => void, mono?: boolean): Row => ({
    id, hay: `${label} ${sub} ${value}`, node: (first) => <SetRow first={first} icon={icon} tone={tone} label={label} sub={sub} onPress={onPress} control={<SetValue value={value} mono={mono} chevron />} />,
  });
  const stepper = (id: string, icon: Parameters<typeof SetRow>[0]["icon"], tone: Parameters<typeof SetRow>[0]["tone"], label: string, sub: string, value: string, dec: () => void, inc: () => void, decLabel: string, incLabel: string, canDec: boolean, canInc: boolean): Row => ({
    id, hay: `${label} ${sub}`, node: (first) => <SetRow first={first} icon={icon} tone={tone} label={label} sub={sub} control={<SetStepper value={value} onDec={dec} onInc={inc} decLabel={decLabel} incLabel={incLabel} canDec={canDec} canInc={canInc} disabled={!canEdit} />} />,
  });
  const seg = (id: string, icon: Parameters<typeof SetRow>[0]["icon"], tone: Parameters<typeof SetRow>[0]["tone"], label: string, sub: string, options: string[], value: number, onChange: (i: number) => void, disabled?: boolean, labels?: string[]): Row => ({
    id, hay: `${label} ${sub}`, node: (first) => <SetRow first={first} icon={icon} tone={tone} label={label} sub={sub} below={<SetSegment options={options} value={value} onChange={onChange} label={label} labels={labels} disabled={disabled} />} />,
  });

  const units = profile?.units ?? "both";
  const unitIdx = units === "imperial" ? 0 : units === "metric" ? 1 : 2;
  const groups: Group[] = [
    {
      key: "assistant", title: t("g.assistant"), voice: (
        <VoicePicker icon="wave" tone="violet" label={t("voice.label")} sub={t(`voice.${prefs.voice ?? "ember"}`)} group={t("voice.group")} voices={(["ember", "tide", "stone"] as const).map((id) => ({ id, name: t(`voice.${id}`) }))}
          value={prefs.voice ?? "ember"} onChange={(v) => void savePrefs({ voice: v })} />
      ),
      rows: [
        seg("lang", "globe", "azure", t("lang.label"), t("lang.sub"), [t("lang.en"), t("lang.fr")], i18n.language === "fr" ? 1 : 0, (i) => { void i18n.changeLanguage(i === 1 ? "fr" : "en"); void savePrefs({ language: i === 1 ? "fr" : "en" }); }),
        sw("speak", "speaker", "lilac", t("speak.label"), t("speak.sub"), prefs.speak ?? true, (v) => void savePrefs({ speak: v })),
        sw("confirm", "shield", "indigo", t("confirm.label"), t("confirm.sub"), prefs.confirmSend ?? true, (v) => void savePrefs({ confirmSend: v })),
      ],
    },
    {
      key: "company", title: t("g.company"), rows: [
        link("company", "building", "violet", t("company.label"), t("company.sub", { tax: taxWord }), "", go("SetCompany", t("company.label"))),
        link("taxes", "percent", "azure", t("taxes.label"), "", taxValue, go("SetTaxes", t("taxes.label"))),
        link("invoices", "receipt", "amber", t("invoices.label"), t("invoices.sub"), String(netWord), go("SetInvoices", t("invoices.label"))),
        link("quotes", "doc", "indigo", t("quotes.label"), t("quotes.sub"), "", go("SetQuotes", t("quotes.label"))),
        link("templates", "chat", "sky", t("templates.label"), t("templates.sub"), "", go("MessageTemplates", t("templates.label"))),
        link("messaging", "mail", "teal", t("messaging.label"), "", t(smsOn ? "messaging.on" : "messaging.off"), go("SetMessaging", t("messaging.label"))),
        link("widget", "code", "clay", t("widget.label"), t("widget.sub"), "", go("SetWidget", t("widget.label"))),
      ],
    },
    {
      key: "team", title: t("g.team"), rows: [
        link("roles", "users", "sage", t("roles.label"), t("roles.sub"), "", go("SetRoles", t("roles.label"))),
        link("apps", "sync", "clay", t("apps.label"), t("apps.sub"), "", go("Integrations", t("apps.label"))),
        link("assistantRow", "orb", "violet", t("assistantRow.label"), t("assistantRow.sub"), "", go("AssistantPermissions", t("assistantRow.label"))),
        link("home", "tier3", "indigo", t("home.label"), t("home.sub"), "", go("CustomizeHome", t("home.label"))),
      ],
    },
    {
      key: "quote", title: t("g.quote"), rows: [
        link("province", "pin", "clay", t("province.label"), t("province.sub"), code ? tr(`onboarding.provinces.${code}.name`) : "", () => canEdit && setProvinceOpen(true)),
        stepper("dep", "percent", "amber", t("deposit.label"), t("deposit.sub"), percent(deposit / 100, locale), () => dep(Math.max(0, deposit - 5)), () => dep(Math.min(50, deposit + 5)), t("deposit.dec"), t("deposit.inc"), deposit > 0, deposit < 50),
        stepper("valid", "clock", "teal", t("valid.label"), t("valid.sub"), t("valid.unit", { count: profile?.quoteValidDays ?? 30 }), () => void saveProfile({ quoteValidDays: Math.max(5, (profile?.quoteValidDays ?? 30) - 5) }), () => void saveProfile({ quoteValidDays: Math.min(90, (profile?.quoteValidDays ?? 30) + 5) }), t("valid.dec"), t("valid.inc"), (profile?.quoteValidDays ?? 30) > 5, (profile?.quoteValidDays ?? 30) < 90),
        stepper("markup", "tag", "lilac", t("markup.label"), t("markup.sub"), percent((profile?.materialsMarkupPercent ?? 0) / 100, locale), () => void saveProfile({ materialsMarkupPercent: Math.max(0, (profile?.materialsMarkupPercent ?? 0) - 1) }), () => void saveProfile({ materialsMarkupPercent: Math.min(40, (profile?.materialsMarkupPercent ?? 0) + 1) }), t("markup.dec"), t("markup.inc"), (profile?.materialsMarkupPercent ?? 0) > 0, (profile?.materialsMarkupPercent ?? 0) < 40),
        sw("copy", "mail", "sky", t("copy.label"), t("copy.sub"), profile?.quoteCopyToMe ?? false, (v) => void saveProfile({ quoteCopyToMe: v }), !canEdit),
      ],
    },
    {
      key: "notifications", title: t("g.notifications"), rows: [
        sw("brief", "sun", "amber", t("n.brief.label"), t("n.brief.sub"), !muted.has("brief"), (v) => void flipPush("brief", v)),
        sw("views", "eye", "indigo", t("n.views.label"), t("n.views.sub"), !muted.has("views"), (v) => void flipPush("views", v)),
        sw("payments", "card", "sage", t("n.payments.label"), t("n.payments.sub"), !muted.has("payments"), (v) => void flipPush("payments", v)),
        sw("checkins", "users", "teal", t("n.checkins.label"), t("n.checkins.sub"), !muted.has("checkins"), (v) => void flipPush("checkins", v)),
      ],
    },
    {
      key: "display", title: t("g.display"), rows: [
        seg("appearance", "moon", "slate", t("display.appearance.label"), t("display.appearance.sub"), [t("display.appearance.light"), t("display.appearance.dark"), t("display.appearance.auto")], appearance === "light" ? 0 : appearance === "dark" ? 1 : 2, (i) => setAppearance(i === 0 ? "light" : i === 1 ? "dark" : "auto")),
        seg("units", "ruler", "stone", t("display.units.label"), "", [t("display.units.imperial"), t("display.units.metric"), t("display.units.both")], unitIdx, (i) => void saveProfile({ units: i === 0 ? "imperial" : i === 1 ? "metric" : "both" }), !canEdit),
        seg("size", "text", "azure", t("display.size.label"), t("display.size.sub"), ["A", "A", "A"], textSize, (i) => setTextSize(i as 0 | 1 | 2), false, [t("display.size.small"), t("display.size.normal"), t("display.size.large")]),
      ],
    },
    {
      key: "security", title: t("g.security"), rows: [
        link("security", "lock", "slate", t("security.label"), t("security.sub"), "", go("SetSecurity", t("security.label"))),
        sw("faceid", "face", "slate", t("faceId.label"), t("faceId.sub"), false, () => toast({ message: t("faceId.soon") })),
        {
          id: "export", hay: `${t("export.label")} ${t("export.sub")}`,
          node: (first) => <SetRow first={first} icon="export" tone="stone" label={t("export.label")} sub={t("export.sub")} control={<SetValue value="" chevron />} onPress={async () => {
            try { await api("/api/account/export", { method: "POST", body: { language: i18n.language === "fr" ? "fr" : "en" } }); toast({ message: t("export.sent") }); }
            catch (e) { toast({ message: e instanceof ApiFailure ? (e.status === 429 ? t("export.limited") : e.status === 403 ? t("export.ownerOnly") : e.status === 0 ? t("toast.offline") : t("export.failed")) : t("export.failed") }); }
          }} />,
        },
      ],
    },
    {
      key: "account", title: t("g.account"), rows: [
        link("plan", "tier3", "violet", t("plan.label"), planSub, "", go("SetPlan", t("plan.label"))),
        link("help", "help", "stone", t("help.label"), t("help.sub"), "", go("HelpCentre", t("help.label"))),
      ],
    },
  ];

  const shown = useMemo(() => {
    const w = term.trim();
    if (!w) return groups.map((g) => ({ ...g, voiceShown: !!g.voice }));
    return groups
      .map((g) => ({ ...g, rows: g.rows.filter((r) => fold(`${g.title} ${r.hay}`).includes(fold(w))), voiceShown: !!g.voice && fold(`${g.title} ${t("voice.label")} ${t("voice.group")}`).includes(fold(w)) }))
      .filter((g) => g.rows.length > 0 || g.voiceShown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, groups.length, profile, prefs.voice, prefs.speak, prefs.confirmSend, pushQ.data, appearance, textSize, i18n.language, planSub]);

  const version = Constants.expoConfig?.version ?? "1.0";
  const build = String(Constants.expoConfig?.android?.versionCode ?? Constants.expoConfig?.ios?.buildNumber ?? "1");

  return (
    <Screen>
      <Header title="" backLabel={t("back")} onBack={back} />
      <ScrollPage bottom={40}>
        <Section px={20} pt={2}><PageTitle>{t("title")}</PageTitle></Section>
        <Section delay={40} px={16} pt={14}><Search label={t("searchLabel")} placeholder={t("searchPlaceholder")} value={term} onChangeText={setTerm} autoCorrect={false} autoCapitalize="none" /></Section>

        {failed ? (
          <Section pt={26} px={16}><Empty icon="warn" iconTone="clay" title={t("loadFailed.title")} body={t("loadFailed.body")} action={t("retry")} onAction={() => void q.refetch()} /></Section>
        ) : loading ? (
          <Section pt={26} px={16} gap={14}><Skeleton height={260} radius={22} /><Skeleton height={300} radius={22} /></Section>
        ) : (
          <>
            {!canEdit ? <Section pt={14} px={16}><Banner tone="info" icon="eye" iconTone="sky" lead={t("viewOnly.lead")}>{t("viewOnly.body")}</Banner></Section> : null}
            {shown.map((g, gi) => (
              <Section key={g.key} delay={80 + gi * 60}>
                <SetGroup title={g.title}>
                  {g.voiceShown ? g.voice : null}
                  {g.voiceShown && g.rows.length ? <Hairline inset={58} /> : null}
                  {g.rows.map((r, i) => <View key={r.id}>{r.node(i === 0)}</View>)}
                </SetGroup>
              </Section>
            ))}
            {shown.length === 0 ? <Section pt={40} px={20}><Empty icon="search" iconTone="slate" title={t("noMatch", { q: term.trim() })} body="" /></Section> : null}
            <Section delay={420} pt={44} px={16}>
              <VersionFoot version={t("version", { version, build })} links={[
                { label: t("terms"), onPress: () => void Linking.openURL("https://quoteai.ca/terms") },
                { label: t("privacy"), onPress: () => void Linking.openURL("https://quoteai.ca/privacy") },
                { label: t("licences"), onPress: go("Licences", t("licences")) },
              ]} />
            </Section>
          </>
        )}
      </ScrollPage>

      <Sheet open={provinceOpen} onClose={() => setProvinceOpen(false)} label={t("province.sheet")} closeLabel={t("close")}>
        <Stack px={16} pb={30} gap={4}>
          <SheetTitle>{t("province.sheet")}</SheetTitle>
          <SheetNote>{t("province.sheetSub")}</SheetNote>
          <ChoiceList chosen={code} items={PROVINCES.map((c) => ({ id: c, name: tr(`onboarding.provinces.${c}.name`), sub: tr(`onboarding.provinces.${c}.tax`) }))} onPick={(c) => { setProvinceOpen(false); void saveProfile({ province: c }); }} />
        </Stack>
      </Sheet>
    </Screen>
  );
}
