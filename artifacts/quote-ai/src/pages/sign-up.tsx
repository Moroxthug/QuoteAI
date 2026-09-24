import { useState, useEffect } from "react";
import { Link, useSearch } from "wouter";
import { Logo } from "@/components/logo";
import { authClient } from "@/lib/auth-client";
import { Eye, EyeOff, AlertCircle, Lock, Mail } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDocumentTitle } from "@/hooks/use-document-title";

function safeLocalPath(raw: string | null, fallback: string): string {
  if (!raw) return fallback;
  try {
    // Only allow paths starting with "/" that are not protocol-relative (//) or external
    if (/^\/[^/]/.test(raw) || raw === "/") return raw;
  } catch {}
  return fallback;
}

export default function SignUpPage() {
  const { t, lang } = useLanguage();
  useDocumentTitle(`${t("signUp.title")} · QuoteAI`);
  const search = useSearch();
  // Phase 91: a plan picked on the pricing page rides through sign-up to the end of onboarding (checkout with the seats chosen there).
  const params = new URLSearchParams(search);
  const plan = params.get("plan");
  const nextPath = safeLocalPath(params.get("next"), plan && /^monthly_(starter|pro|elite)$/.test(plan) ? `/onboarding?plan=${plan}` : "/onboarding");
  const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);
  // Phase 93: a way out when the email does not arrive (spam folder, a typo caught late).
  const [resend, setResend] = useState<"idle" | "sending" | "sent" | "error">("idle");
  async function resendVerification() {
    setResend("sending");
    try {
      const r = await authClient.sendVerificationEmail({ email: email.trim(), callbackURL: nextPath });
      setResend(r.error ? "error" : "sent");
    } catch {
      setResend("error");
    }
  }

  useEffect(() => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    fetch(`${base}/api/settings/registration`, { credentials: "include" })
      .then(r => r.json())
      .then((data: { open: boolean }) => setRegistrationOpen(data.open))
      .catch(() => setRegistrationOpen(true));
  }, []);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError(t("signUp.errorPasswordLength"));
      return;
    }
    setIsLoading(true);
    try {
      const result = await authClient.signUp.email({
        name: name.trim(),
        email: email.trim(),
        password,
        callbackURL: nextPath,
      });
      if (result.error) {
        const msg = result.error.message ?? "";
        if (msg.toLowerCase().includes("already")) {
          setError(t("signUp.errorAlreadyRegistered"));
        } else {
          setError(msg || t("signUp.errorSignUpFailed"));
        }
      } else {
        setVerificationSent(true);
      }
    } catch {
      setError(t("signUp.errorConnection"));
    } finally {
      setIsLoading(false);
    }
  }

  if (registrationOpen === null) {
    return (
      <div className="auth-shell">
        <span className="auth-spin" style={{ width: 28, height: 28, borderColor: "var(--line)", borderTopColor: "var(--navy)" }} />
      </div>
    );
  }

  if (!registrationOpen) {
    return (
      <div className="auth-shell">
        <div className="auth-card" style={{ maxWidth: 420 }}>
          <div className="auth-card-body" style={{ textAlign: "center" }}>
            <div className="flex justify-center mb-6">
              <Logo />
            </div>
            <div className="flex justify-center mb-4"><Lock className="h-9 w-9" style={{ color: "var(--faint)" }} /></div>
            <h1 className="auth-title">{t("signUp.betaClosedTitle")}</h1>
            <p className="auth-sub" style={{ marginBottom: 20 }}>
              {t("signUp.betaClosedBody")}
            </p>
            <p className="auth-sub" style={{ marginBottom: 20 }}>
              {t("signUp.alreadyInvited")}{" "}
              <Link href="/sign-in/" className="auth-link">
                {t("signUp.loginHere")}
              </Link>
            </p>
            <a
              href="mailto:support@quoteai.ca?subject=Beta%20access%20request"
              className="btn w-full"
              style={{ background: "#25D366", color: "#fff" }}
            >
              {t("signUp.requestAccessWhatsapp")}
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-card-body">
          <div className="flex justify-center mb-6">
            <Logo />
          </div>

          {verificationSent ? (
            <div className="auth-center">
              <div className="flex justify-center mb-3"><Mail className="h-9 w-9" style={{ color: "var(--navy)" }} /></div>
              <h2 className="auth-title" style={{ marginBottom: 8 }}>{t("signUp.checkEmailTitle")}</h2>
              <p className="auth-sub" style={{ marginBottom: 24 }}>
                {t("signUp.checkEmailBodyPrefix")} <strong style={{ color: "var(--ink)" }}>{email}</strong>. {t("signUp.checkEmailBodySuffix")}
              </p>
              <p className="auth-sub" style={{ marginBottom: 16 }}>
                {t("signUp.noEmail")}{" "}
                <button type="button" className="auth-link" onClick={resendVerification} disabled={resend === "sending" || resend === "sent"}>
                  {resend === "sending" ? t("signUp.resending") : t("signUp.resend")}
                </button>
              </p>
              <p role="status" aria-live="polite" className="auth-sub" style={{ marginBottom: 16, minHeight: 1 }}>
                {resend === "sent" ? t("signUp.resent") : resend === "error" ? t("signUp.resendError") : ""}
              </p>
              <Link href="/sign-in" className="auth-link">
                {t("signUp.backToLogin")}
              </Link>
            </div>
          ) : (
            <>
              <h1 className="auth-title">{t("signUp.title")}</h1>
              <p className="auth-sub">{t("signUp.subtitle")}</p>

              {error && (
                <div className="auth-error">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSignUp}>
                <div className="auth-field">
                  <label htmlFor="name">{t("signUp.fullName")}</label>
                  <input
                    id="name"
                    type="text"
                    required
                    autoComplete="name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={t("signUp.fullNamePlaceholder")}
                  />
                </div>
                <div className="auth-field">
                  <label htmlFor="email">{t("signUp.email")}</label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="jane@example.com"
                  />
                </div>
                <div className="auth-field">
                  <label htmlFor="password">{t("signUp.password")}</label>
                  <div className="input-wrap">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder={t("signUp.passwordPlaceholder")}
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)} className="auth-pw-toggle" aria-label={showPassword ? t("a11y.hidePassword") : t("a11y.showPassword")} aria-pressed={showPassword}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={isLoading} className="btn btn-navy w-full gap-2">
                  {isLoading ? <span className="auth-spin" /> : null}
                  {isLoading ? t("signUp.signingUp") : t("signUp.createFreeAccount")}
                </button>

                <p className="auth-fine">
                  {t("signUp.agreeToPrefix")}{" "}
                  <Link href={lang === "fr" ? "/fr/conditions/" : "/terms/"}>{t("signUp.termsOfService")}</Link>{" "}
                  {t("signUp.andThe")}{" "}
                  <Link href={lang === "fr" ? "/fr/confidentialite/" : "/privacy-policy/"}>{t("signUp.privacyPolicy")}</Link>.
                </p>
              </form>
            </>
          )}
        </div>

        {!verificationSent && (
          <div className="auth-card-foot">
            <span>{t("signUp.alreadyHaveAccount")} </span>
            <Link href={nextPath !== "/onboarding" ? `/sign-in?next=${encodeURIComponent(nextPath)}` : "/sign-in"}>
              {t("signUp.signInLink")}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
