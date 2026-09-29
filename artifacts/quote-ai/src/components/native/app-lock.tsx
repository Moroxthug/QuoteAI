import { useCallback, useEffect, useRef, useState } from "react";
import { Fingerprint, ScanFace, LockKeyhole } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { BottomSheet } from "@/components/mobile/bottom-sheet";
import { Logo } from "@/components/logo";
import { biometricKind, confirmIdentity, type BiometricKind } from "@/lib/native/biometric";
import { biometricOfferDone, biometricOfferDue, biometricOn, setBiometricOn } from "@/lib/native/biometric-offer";
import { locksOnReturn } from "@/lib/first-run";

// Phase 121: fingerprint / face unlock in the phone app (its own lazy chunk,
// loaded by the signed-in layout only in the app). Locked when the app opens
// and when it comes back after 5 minutes away; the first sign-in on a phone
// that can do it offers it once. Nothing behind the lock is readable: the
// cover is opaque and drawn in the same frame as the app.

export function useBiometricTexts(kind: BiometricKind | null) {
  const { t } = useLanguage();
  const k = kind === "face" ? "face" : kind === "fingerprint" ? "fingerprint" : "other";
  return {
    name: t(`firstRun.bio.${k}`),
    title: t("firstRun.bio.promptTitle"),
    reason: t("firstRun.bio.promptReason"),
    cancel: t("firstRun.bio.cancel"),
  };
}

export default function AppLock({ onSignOut }: { onSignOut: () => void }) {
  const { t } = useLanguage();
  const [locked, setLocked] = useState(() => biometricOn());
  const [kind, setKind] = useState<BiometricKind | null>(null);
  const [offer, setOffer] = useState(false);
  const [trying, setTrying] = useState(false);
  const hiddenAt = useRef<number | null>(null);
  const texts = useBiometricTexts(kind);

  useEffect(() => {
    void biometricKind().then((k) => {
      setKind(k);
      // Switched on, but the phone no longer has a fingerprint or face set up: the lock can't be opened, so it's off.
      if (!k && biometricOn()) {
        setBiometricOn(false);
        setLocked(false);
      }
      if (k && biometricOfferDue() && !biometricOn()) setOffer(true);
      else if (biometricOfferDue()) biometricOfferDone();
    });
  }, []);

  const unlock = useCallback(async () => {
    if (trying) return;
    setTrying(true);
    const ok = await confirmIdentity(texts);
    setTrying(false);
    if (ok) setLocked(false);
  }, [texts, trying]);

  // Ask as soon as the cover is up (and the phone said what it can do).
  useEffect(() => {
    if (locked && kind) void unlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per lock
  }, [locked, kind]);

  useEffect(() => {
    const on = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
        return;
      }
      const away = hiddenAt.current === null ? 0 : Date.now() - hiddenAt.current;
      hiddenAt.current = null;
      if (locksOnReturn(biometricOn(), away)) setLocked(true);
    };
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);

  const Icon = kind === "face" ? ScanFace : kind === "fingerprint" ? Fingerprint : LockKeyhole;

  const answerOffer = async (yes: boolean) => {
    biometricOfferDone();
    setOffer(false);
    if (!yes) return;
    // Asked once now, so the person knows what it will be like, and to be sure it works.
    if (await confirmIdentity(texts)) setBiometricOn(true);
  };

  return (
    <>
      {locked && (
        <div className="bio-lock" role="dialog" aria-modal="true" aria-labelledby="app-lock-title" data-app-lock="">
          <Logo />
          <Icon className="bio-lock-icon" aria-hidden="true" />
          <h1 id="app-lock-title">{t("firstRun.bio.lockedTitle")}</h1>
          <button type="button" className="btn btn-navy" onClick={() => void unlock()} disabled={trying || !kind} data-primary-action>
            {t("firstRun.bio.unlockWith").replace("{method}", texts.name)}
          </button>
          <button type="button" className="auth-link" onClick={onSignOut}>{t("firstRun.bio.usePassword")}</button>
        </div>
      )}
      <BottomSheet
        open={offer}
        onOpenChange={(v) => { if (!v) void answerOffer(false); }}
        title={t("firstRun.bio.offerTitle").replace("{method}", texts.name)}
        footer={
          <div className="grid grid-cols-2 gap-2 w-full">
            <button type="button" className="btn btn-outline-navy" onClick={() => void answerOffer(false)}>{t("firstRun.notNow")}</button>
            <button type="button" className="btn btn-navy" onClick={() => void answerOffer(true)} data-primary-action>{t("firstRun.bio.offerYes")}</button>
          </div>
        }
      >
        <div className="flex items-start gap-3">
          <span className="shrink-0 rounded-xl p-2" style={{ background: "var(--soft)", color: "var(--navy)" }}><Icon className="h-5 w-5" aria-hidden="true" /></span>
          <p className="text-sm" style={{ color: "var(--muted-mk)" }}>{t("firstRun.bio.offerBody")}</p>
        </div>
      </BottomSheet>
    </>
  );
}

/** More → This app: the switch, shown only on a phone that can do it (the group is components/native/this-app.tsx). */
export function BiometricRow() {
  const { t } = useLanguage();
  const [kind, setKind] = useState<BiometricKind | null>(null);
  const [on, setOn] = useState(() => biometricOn());
  const texts = useBiometricTexts(kind);
  useEffect(() => { void biometricKind().then(setKind); }, []);
  if (!kind) return null;
  const Icon = kind === "face" ? ScanFace : Fingerprint;
  const toggle = async () => {
    if (on) {
      setBiometricOn(false);
      setOn(false);
      return;
    }
    if (await confirmIdentity(texts)) {
      setBiometricOn(true);
      setOn(true);
    }
  };
  return (
    <button type="button" className="more-row" role="switch" aria-checked={on} onClick={() => void toggle()} data-biometric-row="">
      <Icon aria-hidden="true" />
      <span className="more-row-label">{t("firstRun.bio.rowLabel").replace("{method}", texts.name)}</span>
      <span className={on ? "more-switch on" : "more-switch"} aria-hidden="true" />
    </button>
  );
}
