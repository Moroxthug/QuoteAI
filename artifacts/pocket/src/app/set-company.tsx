// SetCompany.dc.html. The company's details as they print on quotes, invoices and client pages: the logo (Change takes a photo from the library), the
// legal and operating names, the GST/HST and WSIB numbers, the address, phone, email and website, the brand colour with a small quote to show it, and the
// default language of documents. Typed fields are kept as a draft with "Unsaved changes" (Discard / Save); the swatch and language are part of the draft.
// States: default, unsaved, view only (not the owner), loading and can't load.
// Not true to the board: the "Verified" and "Clearance valid" marks (nothing checks a number with the CRA or the WSIB: the GST/HST field says only whether its
// format looks right, WSIB has no mark), and the brand colour and language are saved but the quote and invoice makers don't read them yet.
import { useEffect, useMemo, useState } from "react";
import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { board } from "@/theme/board";
import { API_ORIGIN } from "@/lib/session";
import { initialsOf } from "@/lib/invites";
import { choosePhotos } from "@/lib/media";
import { screenHref } from "@/lib/nav";
import { PROVINCE_RATE, provinceCode, taxKey } from "@/lib/newQuote";
import { BRAND_KEYS, brandKeyOf, looksLikeGstHst, type BrandKey, type Profile } from "@/lib/profile";
import { profileApi } from "@/lib/profileApi";
import { useProfile } from "@/lib/useProfile";
import { useRole } from "@/lib/useRole";
import { useSession } from "@/lib/useSession";
import { useQueryClient } from "@tanstack/react-query";
import { Banner, Empty, Skeleton, useToast } from "@/ui/Feedback";
import { Header } from "@/ui/Header";
import { ScrollPage, Section } from "@/ui/Layout";
import { Screen } from "@/ui/Screen";
import { Status } from "@/ui/Status";
import { SaveBar, SetField, SetGroup, SetRow, SetSegment } from "@/ui/Settings";
import { BrandHex, LogoCard, QuotePreview, SetTitle, Swatches } from "@/ui/SettingsPages";
import { percent } from "@/lib/format";

type Draft = { legal: string; op: string; gst: string; wsib: string; addr: string; phone: string; email: string; web: string; brand: BrandKey; lang: 0 | 1 };

const draftOf = (p: Profile): Draft => ({
  legal: p.legalName ?? "", op: p.companyName ?? "", gst: p.gstHstNumber ?? "", wsib: p.wsibNumber ?? "", addr: p.address ?? "", phone: p.phone ?? "", email: p.email ?? "", web: p.website ?? "",
  brand: brandKeyOf(p.brandColor, board.brandColours), lang: p.docLanguage === "fr" ? 1 : 0,
});

export default function SetCompany() {
  const { t: tr, i18n } = useTranslation();
  const t = (k: string, o?: Record<string, unknown>) => tr(`sc.${k}`, o) as string;
  const locale = i18n.language === "fr" ? "fr-CA" : "en-CA";
  const { status } = useSession();
  const toast = useToast();
  const client = useQueryClient();
  const { profile, q, save } = useProfile();
  const { isOwner } = useRole();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  // The draft starts from the profile and follows it until the person types.
  useEffect(() => { if (profile && !draft) setDraft(draftOf(profile)); }, [profile, draft]);
  const saved = useMemo(() => (profile ? draftOf(profile) : null), [profile]);
  const dirty = !!draft && !!saved && JSON.stringify(draft) !== JSON.stringify(saved);

  if (status === "out") return <Redirect href="/" />;

  const loading = q.isPending && !profile;
  const failed = q.isError && !profile;
  const canEdit = isOwner;
  const back = () => (router.canGoBack() ? router.back() : router.replace(screenHref("Settings", t("title"))));
  const set = (k: keyof Draft, v: string | number) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const emailBad = !!draft && draft.email.trim() !== "" && !/^\S+@\S+\.\S+$/.test(draft.email.trim());
  const gstBad = !!draft && draft.gst.trim() !== "" && !looksLikeGstHst(draft.gst);

  const onSave = async () => {
    if (!draft) return;
    if (emailBad) { setShowErrors(true); return; }
    setBusy(true);
    const r = await save({
      companyName: draft.op.trim(), legalName: draft.legal.trim() || null, gstHstNumber: draft.gst.trim() || null, wsibNumber: draft.wsib.trim() || null, address: draft.addr.trim() || null,
      phone: draft.phone.trim() || null, email: draft.email.trim() || null, website: draft.web.trim() || null, brandColor: board.brandColours[draft.brand], docLanguage: draft.lang === 1 ? "fr" : "en",
    });
    setBusy(false);
    if (r.ok) { setDraft(null); setShowErrors(false); toast({ message: t("saved") }); }
    else toast({ message: r.status === 403 ? t("noAccess") : r.status === 0 ? t("offline") : t("failed") });
  };

  const changeLogo = async () => {
    const r = await choosePhotos(1, "logo");
    if (!r.ok) { toast({ message: t(r.problem === "denied" ? "logo.denied" : "logo.unavailable") }); return; }
    const file = r.files[0];
    if (!file) return;
    const up = await profileApi.logo(file);
    if (up.ok) { void client.invalidateQueries({ queryKey: ["profile"] }); toast({ message: t("logo.uploaded") }); }
    else toast({ message: up.status === 403 ? t("noAccess") : t("logo.failed") });
  };

  const code = provinceCode(profile?.province) ?? "ON";
  const taxWord = tr(`nq.tax.${taxKey(code)}`);
  const op = draft?.op || profile?.companyName || "";
  const colour = draft ? board.brandColours[draft.brand] : board.brandColours.violet;
  const logoUri = profile?.logoUrl ? (profile.logoUrl.startsWith("http") ? profile.logoUrl : `${API_ORIGIN}${profile.logoUrl}`) : undefined;

  return (
    <Screen floating={dirty && canEdit ? <SaveBar message={t("unsaved")} discard={t("discard")} save={t("save")} onDiscard={() => { setDraft(null); setShowErrors(false); }} onSave={() => void onSave()} busy={busy} /> : undefined}>
      <Header title="" backLabel={t("back")} onBack={back} />
      <ScrollPage bottom={dirty ? 120 : 56}>
        <SetTitle title={t("title")} lede={t("lede")} />
        {failed ? (
          <Section pt={26} px={16}><Empty icon="warn" iconTone="clay" title={t("loadFailed.title")} body={t("loadFailed.body")} action={t("retry")} onAction={() => void q.refetch()} /></Section>
        ) : loading || !draft ? (
          <Section pt={18} px={16} gap={14}><Skeleton height={96} radius={22} /><Skeleton height={260} radius={22} /><Skeleton height={260} radius={22} /></Section>
        ) : (
          <>
            {!canEdit ? <Section pt={16} px={16}><Banner tone="info" icon="eye" iconTone="sky" lead={t("viewOnly.lead")}>{t("viewOnly.body")}</Banner></Section> : null}
            <Section delay={40} pt={18} px={16}>
              <LogoCard initials={initialsOf(op)} colour={colour} name={op} hint={t("logo.hint")} change={t("logo.change")} onChange={() => void changeLogo()} disabled={!canEdit} logoUri={logoUri} />
            </Section>
            <Section delay={80}>
              <SetGroup title={t("g.business")} foot={t("footBusiness")}>
                <SetField first icon="building" tone="slate" label={t("f.legal")} value={draft.legal} onChangeText={(v) => set("legal", v)} disabled={!canEdit} autoCapitalize="words" />
                <SetField icon="star" tone="amber" label={t("f.op")} value={draft.op} onChangeText={(v) => set("op", v)} disabled={!canEdit} autoCapitalize="words" />
                <SetField icon="receipt" tone="violet" label={t("f.gst")} value={draft.gst} onChangeText={(v) => set("gst", v)} disabled={!canEdit} mono autoCapitalize="characters" autoCorrect={false}
                  status={draft.gst.trim() ? <Status tone={gstBad ? "warn" : "ok"} shape={gstBad ? "alert" : "check"}>{t(gstBad ? "gstCheck" : "gstOk")}</Status> : undefined} />
                <SetField icon="shield" tone="teal" label={t("f.wsib")} value={draft.wsib} onChangeText={(v) => set("wsib", v)} disabled={!canEdit} mono keyboardType="number-pad" />
              </SetGroup>
            </Section>
            <Section delay={140}>
              <SetGroup title={t("g.contact")}>
                <SetField first icon="pin" tone="clay" label={t("f.addr")} value={draft.addr} onChangeText={(v) => set("addr", v)} disabled={!canEdit} autoComplete="street-address" />
                <SetField icon="phone" tone="sage" label={t("f.phone")} value={draft.phone} onChangeText={(v) => set("phone", v)} disabled={!canEdit} mono keyboardType="phone-pad" />
                <SetField icon="mail" tone="sky" label={t("f.email")} value={draft.email} onChangeText={(v) => set("email", v)} disabled={!canEdit} keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
                  status={showErrors && emailBad ? <Status tone="bad" shape="alert">{t("bad.email")}</Status> : undefined} />
                <SetField icon="globe" tone="azure" label={t("f.web")} value={draft.web} onChangeText={(v) => set("web", v)} disabled={!canEdit} keyboardType="url" autoCapitalize="none" autoCorrect={false} />
              </SetGroup>
            </Section>
            <Section delay={200}>
              <SetGroup title={t("g.documents")}>
                <SetRow first icon="brush" tone="lilac" label={t("brand.label")} sub={t("brand.sub")}
                  control={<BrandHex colour={colour} />}
                  below={(
                    <>
                      <Swatches colours={BRAND_KEYS.map((k) => ({ key: k, hex: board.brandColours[k] }))} value={draft.brand} onChange={(k) => set("brand", k)} label={t("brand.group")} names={Object.fromEntries(BRAND_KEYS.map((k) => [k, t(`brand.${k}`)]))} disabled={!canEdit} />
                      <QuotePreview colour={colour} initials={initialsOf(op)} name={op} site={draft.web} word={draft.lang === 1 ? t("preview.soumission") : t("preview.quote")} number="Q-2026-108"
                        taxLine={t("preview.taxIncluded", { tax: taxWord, rate: percent(PROVINCE_RATE[code] / 100, locale, PROVINCE_RATE[code] % 1 ? 3 : 0) })} accept={draft.lang === 1 ? t("preview.accepter") : t("preview.accept")} />
                    </>
                  )} />
              </SetGroup>
              <SetGroup first foot={t("lang.foot")}>
                <SetRow first icon="globe" tone="azure" label={t("lang.label")} sub={t("lang.sub")} below={<SetSegment options={[t("lang.en"), t("lang.fr")]} value={draft.lang} onChange={(i) => set("lang", i)} label={t("lang.label")} disabled={!canEdit} />} />
              </SetGroup>
            </Section>
          </>
        )}
      </ScrollPage>
    </Screen>
  );
}
