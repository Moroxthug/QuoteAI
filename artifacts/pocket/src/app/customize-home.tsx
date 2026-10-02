// CustomizeHome.dc.html. Your home: reorder the sections (tap the handle to lift a row, then the arrows), show or hide each, pick up to three tabs after Home (a miniature tab bar shows the result),
// choose Comfortable or Compact, Reset to the role's defaults, Save. States: default, one lifted, tabs full, saved, the owner turned it off for your role, loading.
// Kept: member preferences `home` (the same on this phone and the web). The role's Money and margins row is drawn locked when its switch is off.
import { useEffect, useState } from "react";
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { homeOf, lockedTabs, move, ROLES, SECTIONS, TAB_CHOICES, TABS, toggleTab, MAX_TABS, type HomePrefs } from "@/lib/jobRoles";
import { firstName } from "@/lib/jobRoles";
import { screenHref } from "@/lib/nav";
import { useJobRole } from "@/lib/useJobRole";
import { useSession } from "@/lib/useSession";
import { Button } from "@/ui/Button";
import { Banner, Skeleton, useToast } from "@/ui/Feedback";
import { Header } from "@/ui/Header";
import { type IconName, type Tone } from "@/ui/Icon";
import { ScrollPage, Section } from "@/ui/Layout";
import { DensityPreview, GroupHeading, NavPreview, SectionRow, TabTile, TileGrid } from "@/ui/Roles";
import { Screen } from "@/ui/Screen";
import { SetGroup, SetRow, SetSegment } from "@/ui/Settings";
import { InlineBanner, SetTitle } from "@/ui/SettingsPages";
import { Switch } from "@/ui/Switch";

export default function CustomizeHome() {
  const { t: tr } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`jr.${k}`, o) as string;
  const { status } = useSession();
  const toast = useToast();
  const { me, role, prefs, ready, saveHome } = useJobRole();
  const [order, setOrder] = useState<string[] | null>(null);
  const [on, setOn] = useState<Record<string, boolean>>({});
  const [tabs, setTabs] = useState<string[] | null>(null);
  const [density, setDensity] = useState<0 | 1>(0);
  const [lifted, setLifted] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Start from what is kept once it has loaded, once.
  useEffect(() => {
    if (!ready || order) return;
    const h = homeOf(role, prefs);
    setOrder(h.map((x) => x.key));
    setOn(Object.fromEntries(h.map((x) => [x.key, x.on])));
    setTabs(prefs?.tabs?.length ? prefs.tabs.slice(0, MAX_TABS) : ROLES[role].tabs);
    setDensity(prefs?.density ?? 0);
  }, [ready, order, role, prefs]);

  if (status === "out") return <Redirect href="/" />;
  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("Menu", t("home.title"))));
  const off = ready && !me.mayChangeHome;
  const locked = lockedTabs(role);
  const list = order ?? [];
  const sec = (k: string) => (tr(`jr.sec.${k}`, { returnObjects: true }) as unknown as string[]);
  const shown = list.filter((k) => on[k]).length;
  const touch = () => { setDirty(true); setSaved(false); };

  const lift = (k: string) => setLifted((cur) => (cur === k ? null : k));
  const shift = (k: string, d: -1 | 1) => { setOrder((cur) => (cur ? move(cur, cur.indexOf(k), d) : cur)); touch(); };
  const flip = (k: string, v: boolean) => { setOn((c) => ({ ...c, [k]: v })); touch(); };
  const pickTab = (k: string) => {
    const r = toggleTab(tabs ?? [], k, locked);
    setFull(r.full);
    if (!r.full) { setTabs(r.tabs); touch(); }
  };
  const reset = () => {
    const h = homeOf(role, null);
    setOrder(h.map((x) => x.key)); setOn(Object.fromEntries(h.map((x) => [x.key, x.on]))); setTabs(ROLES[role].tabs); setDensity(0); setLifted(null); setFull(false); touch();
  };
  const save = async () => {
    setSaving(true);
    const home: HomePrefs = { order: list, on, tabs: tabs ?? [], density };
    try { await saveHome(home); setSaved(true); setDirty(false); } catch { toast({ message: t("toast.failed") }); }
    setSaving(false);
  };

  const tabItems = [{ label: t("tab.home"), icon: "house" as IconName, tone: "slate" as Tone, on: true }, ...(tabs ?? []).map((k) => ({ label: t(`tab.${k}`), icon: TABS[k]!.icon as IconName, tone: TABS[k]!.tone as Tone }))];
  const padded = [...tabItems, ...Array.from({ length: Math.max(0, MAX_TABS + 1 - tabItems.length) }, (_, i) => ({ label: t("tab.empty") + (i ? "​".repeat(i) : ""), icon: "plus" as IconName, tone: "slate" as Tone }))];

  return (
    <Screen>
      <Header title="" backLabel={t("back")} onBack={back} />
      <ScrollPage bottom={56}>
        <SetTitle title={t("home.title")} lede={t("home.lede", { name: firstName(""), role: t(`role.${role}`) }).replace(/^ · /, "")} />
        {saved ? <InlineBanner><Banner tone="ok" icon="check" iconTone="sage" lead={t("home.saved.lead")}>{t("home.saved.body")}</Banner></InlineBanner> : null}
        {off ? <InlineBanner><Banner tone="info" icon="lock" iconTone="slate" lead={t("home.locked2")}>{t("readOnly.body")}</Banner></InlineBanner> : null}
        {!ready || !order ? (
          <Section pt={18} px={16} gap={14}><Skeleton height={360} radius={22} /><Skeleton height={200} radius={22} /></Section>
        ) : (
          <>
            <Section delay={40}>
              <SetGroup title={t("home.sections")} foot={t("home.shown", { shown, total: list.length })}>
                {list.map((k, i) => (
                  <SectionRow key={k} first={i === 0} icon={SECTIONS[k]!.icon as IconName} tone={SECTIONS[k]!.tone as Tone} name={sec(k)[0] ?? k} sub={on[k] ? sec(k)[1] ?? "" : t("home.hidden")}
                    off={!on[k]} lifted={lifted === k} locked={off} handle={t("home.reorder", { name: sec(k)[0] })} onLift={() => lift(k)} onUp={() => shift(k, -1)} onDown={() => shift(k, 1)}
                    upOff={i === 0} downOff={i === list.length - 1} up={t("home.up")} down={t("home.down")}
                    control={<Switch value={!!on[k]} onChange={(v) => flip(k, v)} label={t("home.show", { name: sec(k)[0] })} disabled={off} />} />
                ))}
                {!me.sensitive.margins ? <SetRow icon="lock" tone="slate" label={t("home.locked.label")} sub={t("home.locked.sub")} labelTone="muted" disabled /> : null}
              </SetGroup>
            </Section>

            <Section delay={80} pt={26}>
              <GroupHeading>{t("home.tabsTitle")}</GroupHeading>
              <NavPreview label={t("home.navLabel")} items={padded.slice(0, MAX_TABS + 1)} />
              <TileGrid>
                {TAB_CHOICES.map((k) => {
                  const n = (tabs ?? []).indexOf(k) + 1;
                  return <TabTile key={k} icon={TABS[k]!.icon as IconName} tone={TABS[k]!.tone as Tone} label={t(`tab.${k}`)} n={n || undefined} on={n > 0} locked={locked.includes(k) || off}
                    a11y={locked.includes(k) ? t("home.notRole", { name: t(`tab.${k}`) }) : t(`tab.${k}`)} onPress={() => pickTab(k)} />;
                })}
              </TileGrid>
              {full ? <InlineBanner><Banner tone="info" icon="warn" iconTone="amber" lead={t("home.full")} /></InlineBanner> : null}
            </Section>

            <Section delay={120} pt={26}>
              <GroupHeading>{t("home.density")}</GroupHeading>
              <SetSegment options={(tr("jr.home.densities", { returnObjects: true }) as unknown as string[])} value={density} onChange={(i) => { setDensity(i as 0 | 1); touch(); }} label={t("home.density")} disabled={off} />
              <DensityPreview compact={density === 1} note={(tr("jr.home.densityNote", { returnObjects: true }) as unknown as string[])[density] ?? ""} />
            </Section>

            <Section delay={160} pt={26}>
              <SetGroup>
                <SetRow first icon="sync" tone="slate" label={t("home.reset.label", { role: t(`role.${role}`) })} sub={t("home.reset.sub")} onPress={off ? undefined : reset} disabled={off} />
              </SetGroup>
              <Section pt={16} px={16}><Button size="lg" block label={saved && !dirty ? t("home.savedLabel") : t("home.save")} onPress={() => void save()} disabled={off || saving || !dirty} /></Section>
            </Section>
          </>
        )}
      </ScrollPage>
    </Screen>
  );
}
