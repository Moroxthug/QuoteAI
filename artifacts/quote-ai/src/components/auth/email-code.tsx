import { useEffect, useRef, useState } from "react";
import { AlertCircle, Mail } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useLanguage } from "@/i18n/LanguageContext";

/**
 * Phase 121: the phone app confirms a new address with the 6-digit code
 * emailed to it, typed right here — a confirmation link would open the
 * browser, sign the person in there and leave the app signed out. The code
 * signs them in (the server's autoSignInAfterVerification; the app keeps the
 * bearer token like any sign-in), then `onVerified` takes them on.
 */
export function EmailCode({ email, onVerified, onBack }: { email: string; onVerified: () => void; onBack: () => void }) {
  const { t } = useLanguage();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resend, setResend] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [wait, setWait] = useState(30);
  const sentOnce = useRef(false);

  const send = async () => {
    setResend("sending");
    try {
      const r = await authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" });
      setResend(r.error ? "error" : "sent");
    } catch {
      setResend("error");
    }
    setWait(30);
  };

  useEffect(() => {
    if (sentOnce.current) return;
    sentOnce.current = true;
    void send().then(() => setResend("idle"));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the screen opens
  }, []);

  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(id);
  }, [wait]);

  const verify = async (otp: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await authClient.emailOtp.verifyEmail({ email, otp });
      if (r.error) {
        const tooMany = /too many|TOO_MANY/i.test(`${r.error.code ?? ""} ${r.error.message ?? ""}`);
        setError(t(tooMany ? "firstRun.code.tooMany" : "firstRun.code.wrong"));
        setCode("");
      } else {
        onVerified();
      }
    } catch {
      setError(t("signIn.errorConnection"));
    } finally {
      setBusy(false);
    }
  };

  const onChange = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    if (digits.length === 6) void verify(digits);
  };

  return (
    <div className="auth-center" data-email-code="">
      <div className="flex justify-center mb-3"><Mail className="h-9 w-9" style={{ color: "var(--navy)" }} /></div>
      <h1 className="auth-title" style={{ marginBottom: 8 }}>{t("firstRun.code.title")}</h1>
      <p className="auth-sub" style={{ marginBottom: 20 }}>
        {t("firstRun.code.body")} <strong style={{ color: "var(--ink)" }}>{email}</strong>
      </p>
      {error && (
        <div className="auth-error" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); if (code.length === 6) void verify(code); }}>
        <div className="auth-field">
          <label htmlFor="email-code" className="sr-only">{t("firstRun.code.label")}</label>
          <input
            id="email-code"
            className="code-input"
            value={code}
            onChange={(e) => onChange(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            enterKeyHint="go"
            aria-describedby="email-code-hint"
            autoFocus
            disabled={busy}
          />
        </div>
        <button type="submit" className="btn btn-navy w-full gap-2" disabled={busy || code.length !== 6}>
          {busy ? <span className="auth-spin" /> : null}
          {t("firstRun.code.confirm")}
        </button>
      </form>
      <p id="email-code-hint" className="auth-sub" style={{ marginTop: 16, marginBottom: 8 }}>
        {t("signUp.noEmail")}{" "}
        <button type="button" className="auth-link" onClick={() => void send()} disabled={resend === "sending" || wait > 0}>
          {wait > 0 ? t("firstRun.code.resendIn").replace("{s}", String(wait)) : t("signUp.resend")}
        </button>
      </p>
      <p role="status" aria-live="polite" className="auth-sub" style={{ marginBottom: 12, minHeight: 1 }}>
        {resend === "sent" ? t("signUp.resent") : resend === "error" ? t("signUp.resendError") : ""}
      </p>
      <button type="button" className="auth-link" onClick={onBack}>{t("firstRun.code.otherEmail")}</button>
    </div>
  );
}
