/**
 * Phase 149 — Settings, the canvas's Settings artboard (docs/pocket-design/Settings.dc.html):
 * a 28 px title; Assistant (voice orbs, language, speak replies aloud, ask before sending);
 * Quote defaults (province, deposit, valid for, materials markup, send me a copy);
 * Notifications (morning brief, quote viewed, payment received, crew check-ins, then the other
 * kinds); Display (units, text size, and on the phone photos on Wi-Fi only); Security (lock
 * with the face or fingerprint, export my data). The app's other settings pages follow as rows.
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getGetBusinessProfileQueryKey } from "@workspace/api-client-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCan } from "@/hooks/use-role";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/jobs-api";
import { pushApi } from "@/lib/push-api";
import { isNativeApp } from "@/lib/native/env";
import { biometricKind, confirmIdentity, type BiometricKind } from "@/lib/native/biometric";
import { biometricOn, setBiometricOn } from "@/lib/native/biometric-offer";
import { setPhotosOnWifiOnly, useDataSaver } from "@/lib/offline/data-saver";
import { defaultPaymentSchedule, type PaymentSchedule } from "@/lib/payment-schedule";
import { useBusinessProfile, PROVINCE_TAX } from "@/pages/dashboard/settings/data";
import { CANADIAN_PROVINCES } from "@/lib/payment-schedule";
import { applyTextScale, readTextScale, type TextScale } from "@/lib/text-scale";
import { BackHeader, Segmented, SettingRow, Stepper, Switch } from "./kit";
import { ChevronIcon } from "./icons";

type Prefs = { voice: "ember" | "tide" | "stone"; speak: boolean; confirmSend: boolean; language?: "en" | "fr" };
const prefsApi = {
  get: () => apiRequest<{ preferences: Prefs }>("/api/me/preferences"),
  put: (p: Partial<Prefs>) => apiRequest<{ preferences: Prefs }>("/api/me/preferences", { method: "PUT", body: JSON.stringify(p) }),
};

/** The canvas's three voices: base colour and the three glows of each orb. */
const VOICES = [
  { id: "ember" as const, name: "Ember", base: "#2a120c", c: ["#ff6a3d", "#7ab8ff", "#ffb347"] },
  { id: "tide" as const, name: "Tide", base: "#08172a", c: ["#3d8bff", "#6ef0d2", "#b7a6ff"] },
  { id: "stone" as const, name: "Stone", base: "#1a1a1c", c: ["#c9c4ba", "#8e8a84", "#f4efe6"] },
];

type ProfileX = { province?: string | null; quoteValidDays?: number; materialsMarkupPercent?: number; quoteCopyToMe?: boolean; units?: "imperial" | "metric" | "both"; defaultPaymentSchedule?: PaymentSchedule | null };

export function PocketSettings({ sections }: { sections: { id: string; label: string; href: string; status?: string | null }[] }) {
  const { t, lang, setLang } = useLanguage();
  const can = useCan();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const owner = can("settings", "edit");
  const { data: profileRaw } = useBusinessProfile();
  const profile = profileRaw as unknown as ProfileX | undefined;
  const { data: prefsData } = useQuery({ queryKey: ["member-prefs"], queryFn: prefsApi.get, staleTime: 60_000 });
  const prefs = prefsData?.preferences;
  const { data: push } = useQuery({ queryKey: ["push-preferences"], queryFn: pushApi.preferences, retry: false });
  const [bio, setBio] = useState<BiometricKind | null>(null);
  const [bioOn, setBioOn] = useState(() => biometricOn());
  const { wifiOnly } = useDataSaver();
  const [scale, setScale] = useState<TextScale>(() => readTextScale());
  useEffect(() => { if (isNativeApp) void biometricKind().then(setBio); }, []);

  const setPrefs = useMutation({
    mutationFn: prefsApi.put,
    onMutate: (p) => { queryClient.setQueryData(["member-prefs"], { preferences: { ...prefs, ...p } }); },
    onSuccess: (r) => queryClient.setQueryData(["member-prefs"], r),
  });
  const saveProfile = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiRequest<unknown>("/api/business-profile", { method: "PUT", body: JSON.stringify(body) }),
    onMutate: (body) => {
      const key = getGetBusinessProfileQueryKey();
      const prev = queryClient.getQueryData(key);
      queryClient.setQueryData(key, { ...(prev as object), ...body });
      return { prev };
    },
    onError: (_e, _b, ctx) => { queryClient.setQueryData(getGetBusinessProfileQueryKey(), ctx?.prev); toast({ title: t("pocket.settings.notSaved"), variant: "destructive" }); },
    onSuccess: (r) => queryClient.setQueryData(getGetBusinessProfileQueryKey(), r),
  });
  const setMuted = useMutation({
    mutationFn: pushApi.setPreferences,
    onMutate: (muted) => { queryClient.setQueryData(["push-preferences"], { categories: push?.categories ?? [], muted }); },
    onSuccess: (r) => queryClient.setQueryData(["push-preferences"], r),
  });

  const muted = new Set(push?.muted ?? []);
  const kindOn = (c: string) => !muted.has(c as never);
  const flip = (c: string) => setMuted.mutate((kindOn(c) ? [...muted, c] : [...muted].filter((x) => x !== c)) as never);

  // Deposit: the default schedule's deposit term; the difference goes to (or comes from) its last term.
  const sched = profile?.defaultPaymentSchedule ?? defaultPaymentSchedule(lang);
  const depTerm = sched.terms.find((x) => x.type === "deposit" && x.amountType === "percent");
  const deposit = depTerm?.value ?? 0;
  const setDeposit = (v: number) => {
    const terms = sched.terms.map((x) => ({ ...x }));
    const d = terms.find((x) => x.type === "deposit" && x.amountType === "percent");
    const tail = terms.filter((x) => x.type !== "deposit" && x.type !== "holdback_release" && x.amountType === "percent").at(-1);
    if (!tail) return;
    const cur = d?.value ?? 0;
    const delta = v - cur;
    if (tail.value - delta < 0) return;
    tail.value = Math.round((tail.value - delta) * 100) / 100;
    if (d) d.value = v;
    else terms.unshift({ id: `t${Date.now()}`, type: "deposit", label: t("pocket.quote.depositLabel"), trigger: "on_signing", amountType: "percent", value: v, dueDays: 0 });
    saveProfile.mutate({ defaultPaymentSchedule: { ...sched, terms: terms.filter((x) => x.type !== "deposit" || x.value > 0), derived: false } });
  };
  const valid = profile?.quoteValidDays ?? 30;
  const markup = profile?.materialsMarkupPercent ?? 0;
  const prov = profile?.province ?? null;
  const provName = CANADIAN_PROVINCES.find((p) => p.code === prov)?.[lang === "fr" ? "fr" : "en"];

  const toggleBio = async () => {
    if (bioOn) { setBiometricOn(false); setBioOn(false); return; }
    const texts = { title: t("firstRun.bio.promptTitle"), reason: t("firstRun.bio.promptReason"), cancel: t("firstRun.bio.cancel") };
    if (await confirmIdentity(texts)) { setBiometricOn(true); setBioOn(true); }
  };

  const notifRows: { c: string; label: string; hint: string }[] = [
    { c: "brief", label: t("pocket.settings.brief"), hint: t("pocket.settings.briefHint") },
    { c: "views", label: t("pocket.settings.viewed"), hint: t("pocket.settings.viewedHint") },
    { c: "payments", label: t("pocket.settings.paid"), hint: t("pocket.settings.paidHint") },
    { c: "checkins", label: t("pocket.settings.checkins"), hint: t("pocket.settings.checkinsHint") },
    ...["signatures", "messages", "crew", "budget", "compliance"].filter((c) => push?.categories.includes(c as never)).map((c) => ({ c, label: t(`pocket.settings.kind.${c}`), hint: t(`native.push.cat.${c}`) })),
  ].filter((r) => !push || push.categories.includes(r.c as never));

  const orb = (v: (typeof VOICES)[number], on: boolean) => (
    <button key={v.id} type="button" role="radio" aria-checked={on} className="pk-press" onClick={() => setPrefs.mutate({ voice: v.id })}
      style={{ border: 0, background: "transparent", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "4px 0", cursor: "pointer", fontFamily: "inherit" }}>
      <span className="pk-vring" style={{ borderRadius: "50%", padding: 3, boxShadow: on ? "0 0 0 2px #141416" : "0 0 0 1px #e7e6e2", transform: on ? "scale(1.04)" : undefined }}>
        <span className="pk-vo" style={{ display: "block", background: v.base }}><i style={{ background: v.c[0] }} /><i style={{ background: v.c[1] }} /><i style={{ background: v.c[2] }} /></span>
      </span>
      <span className="pk-dayt" style={{ fontSize: 12.5, fontWeight: 500, color: on ? "#141416" : "#6e6e76" }}>{v.name}</span>
    </button>
  );

  return (
    <div className="pk-page">
      <BackHeader backHref="/dashboard/menu" backLabel={t("pocket.settings.back")} />
      <h1 className="pk-h1 pk-rise">{t("dashboard.settings.title")}</h1>

      <section className="pk-section pk-rise" style={{ animationDelay: "60ms" }} aria-labelledby="st-assistant">
        <h2 className="pk-group-label" id="st-assistant">{t("pocket.settings.assistant")}</h2>
        <div className="pk-card-20">
          <div style={{ padding: "16px 16px 14px" }}>
            <span id="st-voice" style={{ fontSize: 14, fontWeight: 500 }}>{t("pocket.settings.voice")}</span>
            <div role="radiogroup" aria-labelledby="st-voice" style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
              {VOICES.map((v) => orb(v, (prefs?.voice ?? "ember") === v.id))}
            </div>
          </div>
          <div className="pk-srow" style={{ borderTop: "1px solid #efeeea" }}>
            <span className="pk-lbl"><b>{t("pocket.settings.language")}</b></span>
            <Segmented label={t("pocket.settings.language")} width={150} value={lang} onChange={(v) => { setLang(v); setPrefs.mutate({ language: v }); }} options={[{ value: "en", label: "English" }, { value: "fr", label: "Français" }]} />
          </div>
          <SettingRow label={t("pocket.settings.speak")} hint={t("pocket.settings.speakHint")}><Switch on={prefs?.speak ?? true} onChange={(v) => setPrefs.mutate({ speak: v })} label={t("pocket.settings.speak")} /></SettingRow>
          <SettingRow label={t("pocket.settings.confirm")} hint={t("pocket.settings.confirmHint")}><Switch on={prefs?.confirmSend ?? true} onChange={(v) => setPrefs.mutate({ confirmSend: v })} label={t("pocket.settings.confirm")} /></SettingRow>
        </div>
      </section>

      {owner && (
        <section className="pk-section pk-rise" style={{ animationDelay: "120ms" }} aria-labelledby="st-quotes">
          <h2 className="pk-group-label" id="st-quotes">{t("pocket.settings.quoteDefaults")}</h2>
          <div className="pk-card-20">
            <Link href="/dashboard/settings/taxes" className="pk-srow">
              <span className="pk-lbl"><b>{t("pocket.settings.province")}</b></span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6e6e76" }}>{prov ? [provName, PROVINCE_TAX[prov]].filter(Boolean).join(" · ") : t("pocket.settings.notSet")}<ChevronIcon className="" /></span>
            </Link>
            <SettingRow label={t("pocket.settings.deposit")} hint={t("pocket.settings.depositHint")}>
              <Stepper value={`${deposit}%`} decLabel={t("pocket.settings.decrease").replace("{what}", t("pocket.settings.deposit"))} incLabel={t("pocket.settings.increase").replace("{what}", t("pocket.settings.deposit"))} canDec={deposit > 0} canInc={deposit < 50} onDec={() => setDeposit(Math.max(0, deposit - 5))} onInc={() => setDeposit(Math.min(50, deposit + 5))} />
            </SettingRow>
            <SettingRow label={t("pocket.settings.valid")} hint={t("pocket.settings.validHint")}>
              <Stepper value={t("pocket.settings.days").replace("{n}", String(valid))} decLabel={t("pocket.settings.decrease").replace("{what}", t("pocket.settings.valid"))} incLabel={t("pocket.settings.increase").replace("{what}", t("pocket.settings.valid"))} canDec={valid > 5} canInc={valid < 90} onDec={() => saveProfile.mutate({ quoteValidDays: Math.max(5, valid - 5) })} onInc={() => saveProfile.mutate({ quoteValidDays: Math.min(90, valid + 5) })} />
            </SettingRow>
            <SettingRow label={t("pocket.settings.markup")} hint={t("pocket.settings.markupHint")}>
              <Stepper value={`${markup}%`} decLabel={t("pocket.settings.decrease").replace("{what}", t("pocket.settings.markup"))} incLabel={t("pocket.settings.increase").replace("{what}", t("pocket.settings.markup"))} canDec={markup > 0} canInc={markup < 40} onDec={() => saveProfile.mutate({ materialsMarkupPercent: Math.max(0, markup - 1) })} onInc={() => saveProfile.mutate({ materialsMarkupPercent: Math.min(40, markup + 1) })} />
            </SettingRow>
            <SettingRow label={t("pocket.settings.copy")} hint={t("pocket.settings.copyHint")}><Switch on={!!profile?.quoteCopyToMe} onChange={(v) => saveProfile.mutate({ quoteCopyToMe: v })} label={t("pocket.settings.copy")} /></SettingRow>
          </div>
        </section>
      )}

      {push && (
        <section className="pk-section pk-rise" style={{ animationDelay: "180ms" }} aria-labelledby="st-notif">
          <h2 className="pk-group-label" id="st-notif">{t("pocket.settings.notifications")}</h2>
          <div className="pk-card-20">
            {notifRows.map((r) => <SettingRow key={r.c} label={r.label} hint={r.hint}><Switch on={kindOn(r.c)} onChange={() => flip(r.c)} label={r.label} /></SettingRow>)}
          </div>
          <p style={{ margin: "8px 4px 0", fontSize: 12, color: "#6e6e76", lineHeight: 1.45 }}><Link href="/dashboard/notifications" style={{ color: "#6e6e76" }}>{t("pocket.settings.thisPhone")}</Link></p>
        </section>
      )}

      <section className="pk-section pk-rise" style={{ animationDelay: "240ms" }} aria-labelledby="st-display">
        <h2 className="pk-group-label" id="st-display">{t("pocket.settings.display")}</h2>
        <div className="pk-card-20">
          {owner && (
            <div className="pk-srow">
              <span className="pk-lbl"><b>{t("pocket.settings.units")}</b></span>
              <Segmented label={t("pocket.settings.units")} width={186} value={profile?.units ?? "both"} onChange={(v) => saveProfile.mutate({ units: v })}
                options={[{ value: "imperial", label: lang === "fr" ? "pi, po" : "ft, in" }, { value: "metric", label: "m, cm" }, { value: "both", label: t("pocket.settings.both") }]} />
            </div>
          )}
          <div className="pk-srow">
            <span className="pk-lbl"><b>{t("pocket.settings.textSize")}</b></span>
            <Segmented label={t("pocket.settings.textSize")} width={186} value={scale} onChange={(v) => { setScale(v); applyTextScale(v); }}
              options={[{ value: "small", label: "A", style: { fontSize: 11 } }, { value: "default", label: "A", style: { fontSize: 13.5 } }, { value: "large", label: "A", style: { fontSize: 16 } }]} />
          </div>
          {isNativeApp && <SettingRow label={t("thisApp.wifiPhotos")} hint={t("thisApp.wifiPhotosSub")}><Switch on={wifiOnly} onChange={(v) => setPhotosOnWifiOnly(v)} label={t("thisApp.wifiPhotos")} /></SettingRow>}
        </div>
        <p style={{ margin: "8px 4px 0", fontSize: 12, color: "#6e6e76", lineHeight: 1.45 }}>{t("pocket.settings.textHint")}</p>
      </section>

      <section className="pk-section pk-rise" style={{ animationDelay: "300ms" }} aria-labelledby="st-security">
        <h2 className="pk-group-label" id="st-security">{t("pocket.settings.security")}</h2>
        <div className="pk-card-20">
          {bio && <SettingRow label={t(bio === "face" ? "pocket.settings.lockFace" : "pocket.settings.lockFinger")} hint={t("pocket.settings.lockHint")}><Switch on={bioOn} onChange={() => void toggleBio()} label={t(bio === "face" ? "pocket.settings.lockFace" : "pocket.settings.lockFinger")} /></SettingRow>}
          <SettingRow label={t("pocket.settings.export")} href="/dashboard/settings/security"><ChevronIcon className="" /></SettingRow>
        </div>
      </section>

      {sections.length > 0 && (
        <section className="pk-section pk-rise" style={{ animationDelay: "360ms" }} aria-labelledby="st-more">
          <h2 className="pk-group-label" id="st-more">{t("pocket.settings.more")}</h2>
          <div className="pk-card-20">
            {sections.map((s) => (
              <SettingRow key={s.id} label={s.label} href={s.href}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6e6e76", minWidth: 0 }}><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150 }}>{s.status}</span><ChevronIcon className="" /></span>
              </SettingRow>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
