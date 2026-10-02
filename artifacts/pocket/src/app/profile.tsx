// Profile.dc.html. The signed-in person (not the company): the head, "My numbers" (quotes made, sent, won, invoiced, jobs, for the month, quarter or year, with the
// arrows against the period before and the last three months), their details (full name, job title, mobile, language), the signature drawn for quotes and contracts,
// links to Notifications and Sign-in and security, and Sign out (a sheet that says how many changes are still waiting to be sent). Edits are a draft with "Save changes".
// States: default, unsaved, offline, loading and can't load.
// Not true to the board: Hours (nothing links a crew member's hours to a login: it reads "Not tracked for you"), "Change photo" (no place keeps a photo yet: it says so),
// and Email (the sign-in address: it is shown, not edited here). The signature is kept and drawn on the phone; the quote and contract makers don't use it yet.
import { useEffect, useMemo, useState } from "react";
import { Redirect, router } from "expo-router";
import { View } from "react-native";
import Constants from "expo-constants";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { auth } from "@/lib/auth";
import { outbox as assistantOutbox } from "@/lib/assistantSync";
import { useOutboxCount } from "@/lib/crewOutbox";
import { initialsOf } from "@/lib/invites";
import { money, number as num, percent, type Locale } from "@/lib/format";
import { screenHref } from "@/lib/nav";
import { profileApi, type MemberPrefs, type MyNumbers } from "@/lib/profileApi";
import { useProfile } from "@/lib/useProfile";
import { useRole } from "@/lib/useRole";
import { useSession } from "@/lib/useSession";
import { ActionBar } from "@/ui/ActionBar";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { FormCard, FormRow } from "@/ui/FormCard";
import { Header } from "@/ui/Header";
import { ScrollPage, Section, Stack } from "@/ui/Layout";
import { MonthsTable, NumbersGrid, ProfileHead, SignatureCard, type Kpi } from "@/ui/Profile";
import { Screen } from "@/ui/Screen";
import { Segmented } from "@/ui/Segmented";
import { SignaturePad } from "@/ui/SignaturePad";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { SetGroup, SetRow, SetSegment, SetValue, SheetNote } from "@/ui/Settings";
import { SectionHeader } from "@/ui/Row";

type Draft = { name: string; title: string; phone: string; lang: 0 | 1 };
type Period = "month" | "quarter" | "year";
const PERIODS: Period[] = ["month", "quarter", "year"];

export default function Profile() {
  const { t: tr, i18n } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`pf.${k}`, o) as string;
  const locale: Locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { status, user, refresh, signOut } = useSession();
  const signedIn = status === "in" || status === "offline";
  const toast = useToast();
  const client = useQueryClient();
  const { profile } = useProfile();
  const { role } = useRole();
  const prefsQ = useQuery({ queryKey: ["member-prefs"], queryFn: profileApi.prefs, enabled: signedIn, retry: 1, staleTime: 60_000 });
  const pushQ = useQuery({ queryKey: ["push-preferences"], queryFn: profileApi.push, enabled: signedIn, retry: 0, staleTime: 60_000 });
  const [period, setPeriod] = useState<0 | 1 | 2>(0);
  const numbersQ = useQuery({ queryKey: ["my-numbers", PERIODS[period]], queryFn: () => profileApi.numbers(PERIODS[period]!), enabled: signedIn, retry: 1, staleTime: 60_000 });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [sigOpen, setSigOpen] = useState(false);
  const [sig, setSig] = useState("");
  const [outOpen, setOutOpen] = useState(false);
  const [waiting, setWaiting] = useState(0);
  const [busy, setBusy] = useState(false);
  const crewWaiting = useOutboxCount();

  const prefs: MemberPrefs = prefsQ.data?.preferences ?? {};
  const base = useMemo<Draft | null>(() => (user ? { name: user.name, title: prefs.jobTitle ?? "", phone: prefs.mobile ?? "", lang: (prefs.language ?? (i18n.language === "fr" ? "fr" : "en")) === "fr" ? 1 : 0 } : null), [user, prefs.jobTitle, prefs.mobile, prefs.language, i18n.language]);
  useEffect(() => { if (base && !draft && !prefsQ.isPending) setDraft(base); }, [base, draft, prefsQ.isPending]);
  useEffect(() => { void assistantOutbox.read().then((o) => setWaiting(o.length)); }, [outOpen]);
  const dirty = !!draft && !!base && JSON.stringify(draft) !== JSON.stringify(base);

  if (status === "out") return <Redirect href="/" />;

  const offline = status === "offline" || numbersQ.isError;
  const loading = !user || (prefsQ.isPending && !prefsQ.data);
  const company = profile?.companyName ?? "";
  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("Menu", t("title"))));

  const onSave = async () => {
    if (!draft || !base) return;
    setBusy(true);
    let ok = true;
    if (draft.name.trim() && draft.name.trim() !== base.name) ok = (await auth.updateUser({ name: draft.name.trim() })).ok && ok;
    try { client.setQueryData(["member-prefs"], await profileApi.savePrefs({ jobTitle: draft.title.trim(), mobile: draft.phone.trim(), language: draft.lang === 1 ? "fr" : "en" })); } catch { ok = false; }
    if (draft.lang !== base.lang) void i18n.changeLanguage(draft.lang === 1 ? "fr" : "en");
    await refresh();
    setBusy(false);
    if (ok) { setDraft(null); toast({ message: t("saved") }); } else toast({ message: offline ? t("toast.offline") : t("toast.failed") });
  };

  const saveSig = async () => {
    setSigOpen(false);
    try { client.setQueryData(["member-prefs"], await profileApi.savePrefs({ signature: sig })); toast({ message: t("sig.saved") }); } catch { toast({ message: t("toast.failed") }); }
  };

  const nowN = numbersQ.data?.now;
  const before = numbersQ.data?.before;
  const prevLabel = (): string => {
    const d = new Date();
    if (period === 0) return new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(d.getFullYear(), d.getMonth() - 1, 1)).replace(".", "");
    if (period === 1) { const qn = Math.floor(d.getMonth() / 3); return qn === 0 ? `Q4` : `Q${qn}`; }
    return String(d.getFullYear() - 1);
  };
  const arrow = (n: number) => (n > 0 ? "↑" : "↓");
  const delta = (a: number, b: number, tone: "count" | "pts" | "pct"): { text: string; tone: Kpi["subTone"] } => {
    const diff = a - b;
    if (tone === "pct") {
      if (b === 0) return { text: "", tone: "muted" };
      const p = Math.round((diff / b) * 100);
      return p === 0 ? { text: t("sub.sameAs", { label: prevLabel() }), tone: "muted" } : { text: t("sub.pct", { arrow: arrow(p), n: num(Math.abs(p), locale) }), tone: p > 0 ? "ok" : "bad" };
    }
    if (diff === 0) return { text: t("sub.sameAs", { label: prevLabel() }), tone: "muted" };
    return tone === "pts" ? { text: t("sub.pts", { arrow: arrow(diff), n: num(Math.abs(diff), locale) }), tone: diff > 0 ? "ok" : "bad" }
      : { text: t("sub.onMonth", { arrow: arrow(diff), n: num(Math.abs(diff), locale), label: prevLabel() }), tone: diff > 0 ? "ok" : "bad" };
  };
  const kpis: Kpi[] | null = nowN && before ? [
    { label: t("k.made"), value: num(nowN.made, locale), ...(() => { const d = delta(nowN.made, before.made, "count"); return { sub: d.text, subTone: d.tone }; })() },
    { label: t("k.sent"), value: num(nowN.sent, locale), sub: nowN.made ? t("sub.ofMade", { pct: num(Math.round((nowN.sent / nowN.made) * 100), locale) }) : t("sub.none"), subTone: "muted" },
    { label: t("k.won"), value: nowN.wonPercent == null ? "—" : percent(nowN.wonPercent / 100, locale), ...(() => { const d = delta(nowN.wonPercent ?? 0, before.wonPercent ?? 0, "pts"); return { sub: d.text, subTone: d.tone }; })() },
    { label: t("k.invoiced"), value: money(nowN.invoicedCents / 100, locale, { cents: false }), ...(() => { const d = delta(nowN.invoicedCents, before.invoicedCents, "pct"); return { sub: d.text, subTone: d.tone }; })() },
    { label: t("k.hours"), value: "—", sub: t("sub.hours"), subTone: "muted" },
    { label: t("k.jobs"), value: num(nowN.jobs, locale), sub: t("sub.active", { count: nowN.activeJobs }), subTone: "muted" },
  ] : null;
  const months = (numbersQ.data as MyNumbers | undefined)?.months ?? [];
  const monthName = (ym: string) => { const [y, m] = ym.split("-").map(Number) as [number, number]; const s = new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(y, m - 1, 1)); return s.charAt(0).toUpperCase() + s.slice(1); };

  const set = (k: keyof Draft, v: string | number) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const version = Constants.expoConfig?.version ?? "1.0";
  const onKinds = (pushQ.data?.categories.length ?? 0) - (pushQ.data?.muted.length ?? 0);
  const unsent = waiting + crewWaiting;

  return (
    <Screen floating={dirty ? <ActionBar label={offline ? t("saveOff") : t("save")} onPress={() => void onSave()} moreLabel={t("discard")} secondary={t("discard")} onSecondary={() => setDraft(null)} busy={busy} /> : undefined}>
      <Header title="" backLabel={t("back")} onBack={back} />
      <ScrollPage bottom={dirty ? 120 : 56}>
        {offline ? <Section pt={6} px={16}><Banner tone="warn" icon="cloud" iconTone="amber" lead={t("offline.lead")}>{t("offline.body")}</Banner></Section> : null}
        {loading || !draft ? (
          <Section pt={14} px={16} gap={14}><Skeleton height={150} radius={22} /><Skeleton height={200} radius={22} /></Section>
        ) : (
          <>
            <Section><ProfileHead initials={initialsOf(draft.name || user?.name || "")} photo={user?.image} name={draft.name || user?.name || ""} line={[draft.title, company].filter(Boolean).join(" · ")} tag={t(`role.${role ?? "owner"}`)} photoLabel={t("photo")} onPhoto={() => toast({ message: t("photoSoon") })} /></Section>

            <Section delay={40} pt={26} px={16}>
              <Stack row align="center" justify="space-between" gap={12} pb={10}>
                <SectionHeader title={t("numbers.title")} />
                <View style={{ minWidth: 210 }}><Segmented options={t("numbers.periods", { returnObjects: true }) as unknown as string[]} value={period} onChange={(i) => setPeriod(i as 0 | 1 | 2)} label={t("numbers.period")} /></View>
              </Stack>
              {kpis ? <NumbersGrid items={kpis} /> : numbersQ.isError ? <Empty icon="warn" iconTone="clay" title={t("loadFailed.title")} body={t("loadFailed.body")} action={t("retry")} onAction={() => void numbersQ.refetch()} /> : <Skeleton height={150} radius={22} />}
              {months.length ? <MonthsTable head={[t("numbers.month"), t("numbers.sent"), t("numbers.won"), t("numbers.invoiced")]} rows={months.map((m) => ({ month: monthName(m.month), sent: num(m.sent, locale), won: num(m.won, locale), invoiced: money(m.invoicedCents / 100, locale, { cents: false }) }))} /> : null}
            </Section>

            <Section delay={80} pt={24} px={16}>
              <SectionHeader title={t("details")} />
              <FormCard>
                <FormRow first icon="user" tone="violet" label={t("f.name")} value={draft.name} onChangeText={(v) => set("name", v)} autoCapitalize="words" />
                <FormRow icon="star" tone="amber" label={t("f.title")} value={draft.title} onChangeText={(v) => set("title", v)} autoCapitalize="words" />
                <FormRow icon="phone" tone="sage" label={t("f.phone")} value={draft.phone} onChangeText={(v) => set("phone", v)} keyboardType="phone-pad" numeric />
                <FormRow icon="mail" tone="sky" label={t("f.email")} value={user?.email ?? ""} disabled />
              </FormCard>
            </Section>

            <Section delay={110} pt={24} px={16}>
              <SectionHeader title={t("lang.label")} />
              <SetSegment options={[t("lang.en"), t("lang.fr")]} value={draft.lang} onChange={(i) => set("lang", i)} label={t("lang.label")} />
              <SheetNote>{t("lang.sub")}</SheetNote>
            </Section>

            <Section delay={140} pt={24} px={16}>
              <Stack row align="center" justify="space-between" gap={12} pb={10}>
                <SectionHeader title={t("sig.title")} />
                <Button size="sm" kind="secondary" label={t("sig.redraw")} onPress={() => { setSig(""); setSigOpen(true); }} />
              </Stack>
              <SignatureCard d={prefs.signature ?? ""} alt={t("sig.alt")} caption={t("sig.on")} empty={t("sig.none")} />
            </Section>

            <Section delay={170} pt={24}>
              <SetGroup>
                <SetRow first icon="bell" tone="amber" label={t("notif.label")} sub={pushQ.data ? t("notif.sub", { on: onKinds, total: pushQ.data.categories.length }) : undefined} control={<SetValue value="" chevron />} onPress={() => router.push(screenHref("Notifications", t("notif.label")))} />
                <SetRow icon="shield" tone="teal" label={t("sec.label")} sub={t("sec.sub")} control={<SetValue value="" chevron />} onPress={() => router.push(screenHref("SetSecurity", t("sec.label")))} />
              </SetGroup>
            </Section>

            <Section delay={200} pt={24} px={16}>
              <Button kind="destructive" label={t("signOut")} block onPress={() => setOutOpen(true)} />
              <Stack pt={12} align="center"><SheetNote>{t("foot", { email: user?.email ?? "", version })}</SheetNote></Stack>
            </Section>
          </>
        )}
      </ScrollPage>

      <Sheet open={sigOpen} onClose={() => setSigOpen(false)} label={t("sig.sheet")} closeLabel={t("close")}>
        <Stack px={16} pb={30} gap={12}>
          <SheetTitle>{t("sig.sheet")}</SheetTitle>
          <SheetNote>{t("sig.sheetSub")}</SheetNote>
          <Card padded><SignaturePad value={sig} onChange={setSig} label={t("sig.alt")} /></Card>
          <Stack row gap={8}>
            <Stack grow><Button kind="secondary" label={t("sig.clear")} block onPress={() => setSig("")} /></Stack>
            <Stack grow><Button label={t("sig.save")} block disabled={!sig} onPress={() => void saveSig()} /></Stack>
          </Stack>
        </Stack>
      </Sheet>

      <Sheet open={outOpen} onClose={() => setOutOpen(false)} label={t("signOut")} closeLabel={t("close")}>
        <Stack px={16} pb={30} gap={12}>
          <SheetTitle>{t("out.q")}</SheetTitle>
          <SheetNote>{t("out.sub", { company })}</SheetNote>
          {unsent > 0 ? <Banner tone="warn" icon="warn" iconTone="amber" lead={t("out.unsent", { count: unsent })}>{t("out.unsentBody")}</Banner> : null}
          <Button kind="destructive" size="lg" label={t("signOut")} block onPress={() => void signOut().then(() => router.replace("/"))} />
          <Button kind="secondary" size="lg" label={t("out.cancel")} block onPress={() => setOutOpen(false)} />
        </Stack>
      </Sheet>
    </Screen>
  );
}
