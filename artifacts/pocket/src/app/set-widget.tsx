// SetWidget.dc.html. The lead form for the contractor's own website: a preview of it in the chosen colour, whether leads have come in from it, its look (colour, background), what it
// asks, the code to paste (Copy code, "Email to web person") with the key, and where the leads go. States: default, no lead yet, view only, loading and can't load.
// Read by the widget: its key, the colour, the background (Light, Dark, Match site) and the language. Saved but not read yet: "Shows as" (the script only draws the form on the page),
// the fields it asks, "Instant estimate" (the widget always shows its range), "Notify me" and "Auto-reply". Not built: "Assign to" and the "Test page" (the server has neither), and
// "Live / Last seen" (the server doesn't see the page: a lead from the form is the proof it works, so the word is Live once one has come in).
import { useState } from "react";
import { Redirect, router } from "expo-router";
import { Linking } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ApiFailure, api } from "@/lib/api";
import { initialsOf } from "@/lib/invites";
import { dateWithYear, number as num, type Locale } from "@/lib/format";
import { leadsApi } from "@/lib/leadsApi";
import { screenHref } from "@/lib/nav";
import { BRAND_KEYS, brandKeyOf, extraPage, type BrandKey } from "@/lib/profile";
import { API_ORIGIN } from "@/lib/session";
import { useProfile } from "@/lib/useProfile";
import { useRole } from "@/lib/useRole";
import { useSession } from "@/lib/useSession";
import { THEMES, embedCode, mailtoCode, previewFields, widgetLeads } from "@/lib/widget";
import { board } from "@/theme/board";
import { Button } from "@/ui/Button";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { Header } from "@/ui/Header";
import { ScrollPage, Section, Stack } from "@/ui/Layout";
import { Screen } from "@/ui/Screen";
import { Sheet, SheetTitle } from "@/ui/Sheet";
import { SetButton, SetGroup, SetRow, SetSegment, SetValue, SheetNote } from "@/ui/Settings";
import { InlineBanner, RowStatus, SetTitle, Swatches } from "@/ui/SettingsPages";
import { Switch } from "@/ui/Switch";
import { CodeBlock, WidgetPreview } from "@/ui/Widget";

export default function SetWidget() {
  const { t: tr, i18n } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`wd.${k}`, o) as string;
  const lang: "en" | "fr" = i18n.language === "fr" ? "fr" : "en";
  const locale: Locale = lang === "fr" ? "fr-CA" : "en-CA";
  const { status } = useSession();
  const signedIn = status === "in" || status === "offline";
  const toast = useToast();
  const { isOwner, role } = useRole();
  const canEdit = isOwner || role === "admin";
  const { profile, q, save } = useProfile();
  const leadsQ = useQuery({ queryKey: ["leads"], queryFn: leadsApi.list, enabled: signedIn, retry: 0, staleTime: 30_000 });
  const [copied, setCopied] = useState(false);
  const [mailed, setMailed] = useState(false);
  const [renew, setRenew] = useState(false);
  const [busy, setBusy] = useState(false);

  if (status === "out") return <Redirect href="/" />;

  const page = extraPage(profile, "widget");
  const flag = (k: string, d: boolean) => (typeof page[k] === "boolean" ? (page[k] as boolean) : d);
  const num_ = (k: string, d: number) => (typeof page[k] === "number" ? (page[k] as number) : d);
  const brand: BrandKey = (typeof page.colour === "string" && (BRAND_KEYS as string[]).includes(page.colour) ? page.colour : brandKeyOf(profile?.brandColor, board.brandColours)) as BrandKey;
  const colour = board.brandColours[brand];
  const theme = num_("theme", 0);
  const shows = num_("shows", 0);
  const apiKey = profile?.apiKey ?? "";
  const site = (profile?.website ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "") || t("siteFallback");
  const company = profile?.companyName ?? "";
  const stats = widgetLeads((leadsQ.data?.items ?? []).map((l) => ({ source: l.source, createdAt: l.createdAt })), new Date());
  const live = stats.last !== null;
  const code = apiKey ? embedCode({ origin: API_ORIGIN, apiKey, colour, theme: THEMES[theme] ?? "light", lang }) : "";
  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("Settings", t("title"))));
  const loading = q.isPending && !profile;

  const savePage = async (p: Record<string, unknown>) => {
    const r = await save({ pocketSettings: { widget: p } });
    if (!r.ok) toast({ message: r.status === 403 ? t("toast.noAccess") : r.status === 0 ? t("toast.offline") : t("toast.failed") });
  };
  const makeKey = async () => {
    setBusy(true);
    try { await api("/api/business-profile/apikey", { method: "POST" }); await q.refetch(); setRenew(false); toast({ message: t("toast.keyMade") }); }
    catch (e) { toast({ message: e instanceof ApiFailure ? (e.status === 0 ? t("toast.offline") : e.status === 403 ? t("toast.noAccess") : t("toast.failed")) : t("toast.failed") }); }
    setBusy(false);
  };
  const onCopy = async () => { await Clipboard.setStringAsync(code); setCopied(true); toast({ message: t("toast.copied") }); setTimeout(() => setCopied(false), 1800); };
  const onMail = () => { setMailed(true); void Linking.openURL(mailtoCode(t("add.mailSubject"), t("add.mailIntro"), code)); };

  const fieldRow = (key: string, def: boolean, icon: "phone", tone: "sage", first = false) => (
    <SetRow key={key} first={first} icon={icon} tone={tone} label={t(`fields.${key}.label`)} sub={t(`fields.${key}.sub`) || undefined}
      control={<Switch value={flag(key, def)} onChange={(v) => void savePage({ [key]: v })} label={t(`fields.${key}.label`)} disabled={!canEdit} />} />
  );

  return (
    <Screen>
      <Header title="" backLabel={t("back")} onBack={back} />
      <ScrollPage bottom={56}>
        <SetTitle title={t("title")} lede={t("lede", { site })} />
        {!canEdit && profile ? <InlineBanner><Banner tone="info" icon="lock" iconTone="slate" lead={t("readOnly.lead")}>{t("readOnly.body")}</Banner></InlineBanner> : null}
        {profile && !live && !leadsQ.isPending ? <InlineBanner><Banner tone="warn" icon="warn" iconTone="amber" lead={t("waiting.lead")}>{t("waiting.body", { site })}</Banner></InlineBanner> : null}

        {loading ? (
          <Section pt={18} px={16} gap={14}><Skeleton height={300} radius={22} /><Skeleton height={160} radius={22} /></Section>
        ) : !profile ? (
          <Empty icon="warn" iconTone="clay" title={t("loadFailed.title")} body={t("loadFailed.body")} action={t("loadFailed.retry")} onAction={() => void q.refetch()} />
        ) : (
          <>
            <Section delay={40} pt={18} px={16}>
              <WidgetPreview address={site} initials={initialsOf(company) || "QA"} colour={colour} dark={theme === 1} title={t("preview.title")} lede={t("preview.lede")} kinds={tr("wd.preview.kinds", { returnObjects: true }) as unknown as string[]}
                fields={previewFields({ phone: flag("phone", true), email: flag("email", true), postal: flag("postal", true) }, { name: t("preview.name"), phone: t("preview.phone"), email: t("preview.email"), postal: t("preview.postal") })}
                button={flag("instant", true) ? t("preview.estimate") : t("preview.send")} />
            </Section>

            <Section delay={80}>
              <SetGroup first>
                <SetRow first icon="globe" tone="azure" label={site} sub={stats.last ? t("status.lastLead", { date: dateWithYear(stats.last, new Date(), locale) }) : t("status.noLead")} control={<RowStatus tone={live ? "ok" : "mute"} shape={live ? "live" : "off"}>{live ? t("status.live") : t("status.waiting")}</RowStatus>} />
                <SetRow icon="funnel" tone="teal" label={t("status.leads")} sub={t("status.leadsSub")} control={<SetValue value={num(stats.thisMonth, locale)} mono chevron />} onPress={() => router.push(screenHref("Leads", t("status.leads")))} />
              </SetGroup>
            </Section>

            <Section delay={130}>
              <SetGroup title={t("look.title")}>
                <SetRow first icon="brush" tone="lilac" label={brand === brandKeyOf(profile.brandColor, board.brandColours) ? t("look.brand") : t(`look.names.${brand}`)}
                  below={<Swatches colours={BRAND_KEYS.map((k) => ({ key: k, hex: board.brandColours[k] }))} value={brand} onChange={(k) => void savePage({ colour: k })} label={t("look.brand")} names={Object.fromEntries(BRAND_KEYS.map((k) => [k, t(`look.names.${k}`)]))} disabled={!canEdit} />} />
                <SetRow icon="moon" tone="slate" label={t("look.background")} below={<SetSegment options={tr("wd.look.backgrounds", { returnObjects: true }) as unknown as string[]} value={theme} onChange={(i) => void savePage({ theme: i })} label={t("look.background")} disabled={!canEdit} />} />
                <SetRow icon="grid" tone="lilac" label={t("look.shows")} below={<SetSegment options={tr("wd.look.shownAs", { returnObjects: true }) as unknown as string[]} value={shows} onChange={(i) => void savePage({ shows: i })} label={t("look.shows")} disabled={!canEdit} />} />
              </SetGroup>
            </Section>

            <Section delay={180}>
              <SetGroup title={t("fields.title")}>
                <SetRow first icon="user" tone="violet" label={t("fields.name.label")} sub={t("fields.name.sub")} control={<SetValue value={t("fields.name.value")} />} />
                {fieldRow("phone", true, "phone", "sage")}
                <SetRow icon="mail" tone="sky" label={t("fields.email.label")} control={<Switch value={flag("email", true)} onChange={(v) => void savePage({ email: v })} label={t("fields.email.label")} disabled={!canEdit} />} />
                <SetRow icon="pin" tone="clay" label={t("fields.postal.label")} sub={t("fields.postal.sub")} control={<Switch value={flag("postal", true)} onChange={(v) => void savePage({ postal: v })} label={t("fields.postal.label")} disabled={!canEdit} />} />
                <SetRow icon="camera" tone="amber" label={t("fields.photos.label")} sub={t("fields.photos.sub")} control={<Switch value={flag("photos", false)} onChange={(v) => void savePage({ photos: v })} label={t("fields.photos.label")} disabled={!canEdit} />} />
                <SetRow icon="bars" tone="teal" label={t("fields.budget.label")} control={<Switch value={flag("budget", false)} onChange={(v) => void savePage({ budget: v })} label={t("fields.budget.label")} disabled={!canEdit} />} />
                <SetRow icon="spark" tone="violet" label={t("fields.instant.label")} sub={t("fields.instant.sub")} control={<Switch value={flag("instant", true)} onChange={(v) => void savePage({ instant: v })} label={t("fields.instant.label")} disabled={!canEdit} />} />
              </SetGroup>
            </Section>

            <Section delay={220}>
              <SetGroup title={t("add.title")}>
                {apiKey ? <CodeBlock code={code} copy={copied ? t("add.copied") : t("add.copy")} mail={mailed ? t("add.mailed") : t("add.mail")} onCopy={() => void onCopy()} onMail={onMail} /> : null}
                <SetRow first={!apiKey} icon="key" tone="violet" label={t("key.label")} sub={apiKey ? t("key.sub") : t("key.none")}
                  control={apiKey ? <SetButton label={t("key.renew")} onPress={() => setRenew(true)} disabled={!canEdit} /> : <SetButton kind="primary" label={t("key.create")} onPress={() => void makeKey()} disabled={!canEdit || busy} />} />
              </SetGroup>
            </Section>

            <Section delay={260}>
              <SetGroup title={t("leads.title")}>
                <SetRow first icon="funnel" tone="teal" label={t("leads.open.label")} sub={t("leads.open.sub")} control={<SetValue value={t("leads.open.value")} chevron />} onPress={() => router.push(screenHref("Leads", t("leads.open.label")))} />
                <SetRow icon="bell" tone="amber" label={t("leads.notify.label")} sub={t("leads.notify.sub")} control={<Switch value={flag("notify", true)} onChange={(v) => void savePage({ notify: v })} label={t("leads.notify.label")} disabled={!canEdit} />} />
                <SetRow icon="chat" tone="sky" label={t("leads.reply.label")} sub={t("leads.reply.sub")} control={<Switch value={flag("autoReply", true)} onChange={(v) => void savePage({ autoReply: v })} label={t("leads.reply.label")} disabled={!canEdit} />} />
              </SetGroup>
            </Section>
          </>
        )}
      </ScrollPage>

      <Sheet open={renew} onClose={() => setRenew(false)} label={t("key.sheetTitle")} closeLabel={t("close")}>
        <Stack px={16} pb={30} gap={12}>
          <SheetTitle>{t("key.sheetTitle")}</SheetTitle>
          <SheetNote>{t("key.sheetBody")}</SheetNote>
          <Button kind="destructive" size="lg" block label={t("key.go")} disabled={busy} onPress={() => void makeKey()} />
          <Button kind="secondary" size="lg" block label={t("key.keep")} onPress={() => setRenew(false)} />
        </Stack>
      </Sheet>
    </Screen>
  );
}
