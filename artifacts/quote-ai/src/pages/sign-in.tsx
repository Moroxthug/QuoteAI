import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Logo } from "@/components/logo";
import { authClient } from "@/lib/auth-client";
import { Eye, EyeOff, AlertCircle, Mail } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

function safeLocalPath(raw: string | null, fallback: string): string {
  if (!raw) return fallback;
  if (/^\/[^/]/.test(raw) || raw === "/") return raw;
  return fallback;
}

export default function SignInPage() {
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const search = useSearch();
  const nextPath = safeLocalPath(new URLSearchParams(search).get("next"), "/dashboard");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const [twoFactorMode, setTwoFactorMode] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const result = await authClient.signIn.email({
        email: email.trim(),
        password,
        callbackURL: nextPath,
      });
      if (result.error) {
        const msg = result.error.message ?? "";
        if (msg.toLowerCase().includes("not verified")) {
          setError(t("signIn.errorNotVerified"));
        } else {
          setError(msg || t("signIn.errorInvalidCredentials"));
        }
      } else if (result.data && "twoFactorRedirect" in result.data && result.data.twoFactorRedirect) {
        setTwoFactorMode(true);
      } else {
        navigate(nextPath);
      }
    } catch {
      setError(t("signIn.errorConnection"));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifyTwoFactor(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setTwoFactorLoading(true);
    try {
      const result = useBackupCode
        ? await authClient.twoFactor.verifyBackupCode({ code: twoFactorCode.trim() })
        : await authClient.twoFactor.verifyTotp({ code: twoFactorCode.trim() });
      if (result.error) {
        setError(result.error.message ?? t("signIn.errorInvalidCredentials"));
      } else {
        navigate(nextPath);
      }
    } catch {
      setError(t("signIn.errorConnection"));
    } finally {
      setTwoFactorLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setResetError(null);
    setResetLoading(true);
    try {
      const result = await authClient.requestPasswordReset({
        email: resetEmail.trim(),
        redirectTo: "/reset-password",
      });
      if (result.error) {
        setResetError(result.error.message ?? t("signIn.errorSending"));
      } else {
        setResetSent(true);
      }
    } catch {
      setResetError(t("signIn.errorConnectionRetry"));
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-card-body">
          <div className="flex justify-center mb-6">
            <Logo />
          </div>

          {twoFactorMode ? (
            <>
              <h1 className="auth-title">{t("signIn.twoFactorTitle")}</h1>
              <p className="auth-sub">
                {useBackupCode ? t("signIn.twoFactorBackupSubtitle") : t("signIn.twoFactorSubtitle")}
              </p>

              {error && (
                <div className="auth-error">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleVerifyTwoFactor}>
                <div className="auth-field">
                  <input
                    type="text"
                    inputMode={useBackupCode ? "text" : "numeric"}
                    autoFocus
                    required
                    value={twoFactorCode}
                    onChange={e => setTwoFactorCode(e.target.value)}
                    placeholder={useBackupCode ? t("signIn.twoFactorBackupPlaceholder") : "123456"}
                    style={{ textAlign: "center", letterSpacing: "0.2em" }}
                  />
                </div>
                <button type="submit" disabled={twoFactorLoading} className="btn btn-navy w-full gap-2" style={{ marginBottom: 14 }}>
                  {twoFactorLoading ? <span className="auth-spin" /> : null}
                  {t("signIn.twoFactorVerify")}
                </button>
                <button
                  type="button"
                  onClick={() => { setUseBackupCode(v => !v); setTwoFactorCode(""); setError(null); }}
                  className="auth-link w-full text-center block"
                >
                  {useBackupCode ? t("signIn.twoFactorUseTotp") : t("signIn.twoFactorUseBackup")}
                </button>
              </form>
            </>
          ) : !resetMode ? (
            <>
              <h1 className="auth-title">{t("signIn.title")}</h1>
              <p className="auth-sub">{t("signIn.subtitle")}</p>

              {error && (
                <div className="auth-error">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSignIn}>
                <div className="auth-field">
                  <label htmlFor="email">{t("signIn.email")}</label>
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
                  <label htmlFor="password">{t("signIn.password")}</label>
                  <div className="input-wrap">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)} className="auth-pw-toggle">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="auth-row-end">
                  <button
                    type="button"
                    onClick={() => { setResetMode(true); setResetEmail(email); setError(null); }}
                    className="auth-link"
                  >
                    {t("signIn.forgotPassword")}
                  </button>
                </div>

                <button type="submit" disabled={isLoading} className="btn btn-navy w-full gap-2">
                  {isLoading ? <span className="auth-spin" /> : null}
                  {isLoading ? t("signIn.signingIn") : t("signIn.signIn")}
                </button>
              </form>
            </>
          ) : resetSent ? (
            <div className="auth-center">
              <div className="flex justify-center mb-3"><Mail className="h-9 w-9" style={{ color: "var(--navy)" }} /></div>
              <h2 className="auth-title" style={{ marginBottom: 8 }}>{t("signIn.emailSentTitle")}</h2>
              <p className="auth-sub" style={{ marginBottom: 24 }}>
                {t("signIn.emailSentBodyPrefix")} <strong style={{ color: "var(--ink)" }}>{resetEmail}</strong> {t("signIn.emailSentBodySuffix")}
              </p>
              <button onClick={() => { setResetMode(false); setResetSent(false); }} className="auth-link">
                {t("signIn.backToLogin")}
              </button>
            </div>
          ) : (
            <>
              <h1 className="auth-title">{t("signIn.resetTitle")}</h1>
              <p className="auth-sub">{t("signIn.resetSubtitle")}</p>

              {resetError && (
                <div className="auth-error">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{resetError}</span>
                </div>
              )}

              <form onSubmit={handleResetPassword}>
                <div className="auth-field">
                  <label htmlFor="resetEmail">{t("signIn.email")}</label>
                  <input
                    id="resetEmail"
                    type="email"
                    required
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    placeholder="jane@example.com"
                  />
                </div>
                <button type="submit" disabled={resetLoading} className="btn btn-navy w-full gap-2" style={{ marginBottom: 14 }}>
                  {resetLoading ? <span className="auth-spin" /> : null}
                  {resetLoading ? t("signIn.sending") : t("signIn.sendResetLink")}
                </button>
                <button type="button" onClick={() => setResetMode(false)} className="auth-link-muted w-full text-center block">
                  {t("signIn.backToLogin")}
                </button>
              </form>
            </>
          )}
        </div>

        {!resetMode && !twoFactorMode && (
          <div className="auth-card-foot">
            <span>{t("signIn.noAccount")} </span>
            <Link href={nextPath !== "/dashboard" ? `/sign-up?next=${encodeURIComponent(nextPath)}` : "/sign-up"}>
              {t("signIn.signUpLink")}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
