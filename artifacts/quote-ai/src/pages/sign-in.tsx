import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Logo } from "@/components/logo";
import { authClient } from "@/lib/auth-client";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
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
    <div className="flex-1 flex items-center justify-center py-12 px-4 bg-muted/30">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-lg overflow-hidden">
          <div className="px-8 pt-8 pb-6">
            <div className="flex justify-center mb-6">
              <Logo />
            </div>

            {twoFactorMode ? (
              <>
                <h1 className="text-xl font-bold text-gray-900 text-center mb-1">{t("signIn.twoFactorTitle")}</h1>
                <p className="text-sm text-gray-400 text-center mb-6">
                  {useBackupCode ? t("signIn.twoFactorBackupSubtitle") : t("signIn.twoFactorSubtitle")}
                </p>

                {error && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 mb-4">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleVerifyTwoFactor} className="space-y-4">
                  <div>
                    <input
                      type="text"
                      inputMode={useBackupCode ? "text" : "numeric"}
                      autoFocus
                      required
                      value={twoFactorCode}
                      onChange={e => setTwoFactorCode(e.target.value)}
                      placeholder={useBackupCode ? t("signIn.twoFactorBackupPlaceholder") : "123456"}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-navy-400 focus:border-transparent transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={twoFactorLoading}
                    className="btn-gradient w-full h-11 flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-60"
                  >
                    {twoFactorLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {t("signIn.twoFactorVerify")}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setUseBackupCode(v => !v); setTwoFactorCode(""); setError(null); }}
                    className="w-full text-center text-sm text-navy-600 hover:underline font-medium"
                  >
                    {useBackupCode ? t("signIn.twoFactorUseTotp") : t("signIn.twoFactorUseBackup")}
                  </button>
                </form>
              </>
            ) : !resetMode ? (
              <>
                <h1 className="text-xl font-bold text-gray-900 text-center mb-1">{t("signIn.title")}</h1>
                <p className="text-sm text-gray-400 text-center mb-6">{t("signIn.subtitle")}</p>

                {error && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 mb-4">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("signIn.email")}</label>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="jane@example.com"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy-400 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("signIn.password")}</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 pr-10 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy-400 focus:border-transparent transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => { setResetMode(true); setResetEmail(email); setError(null); }}
                      className="text-xs text-navy-600 hover:text-navy-700 font-medium transition-colors"
                    >
                      {t("signIn.forgotPassword")}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="btn-gradient w-full h-11 flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-60"
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {isLoading ? t("signIn.signingIn") : t("signIn.signIn")}
                  </button>
                </form>
              </>
            ) : resetSent ? (
              <div className="text-center py-4">
                <div className="text-4xl mb-3">📧</div>
                <h2 className="text-lg font-bold text-gray-900 mb-2">{t("signIn.emailSentTitle")}</h2>
                <p className="text-sm text-gray-500 mb-6">
                  {t("signIn.emailSentBodyPrefix")} <strong>{resetEmail}</strong> {t("signIn.emailSentBodySuffix")}
                </p>
                <button
                  onClick={() => { setResetMode(false); setResetSent(false); }}
                  className="text-sm text-navy-600 hover:underline font-medium"
                >
                  {t("signIn.backToLogin")}
                </button>
              </div>
            ) : (
              <>
                <h1 className="text-xl font-bold text-gray-900 text-center mb-1">{t("signIn.resetTitle")}</h1>
                <p className="text-sm text-gray-400 text-center mb-6">{t("signIn.resetSubtitle")}</p>

                {resetError && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 mb-4">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{resetError}</span>
                  </div>
                )}

                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("signIn.email")}</label>
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={e => setResetEmail(e.target.value)}
                      placeholder="jane@example.com"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy-400 focus:border-transparent transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="btn-gradient w-full h-11 flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-60"
                  >
                    {resetLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {resetLoading ? t("signIn.sending") : t("signIn.sendResetLink")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetMode(false)}
                    className="w-full text-center text-sm text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {t("signIn.backToLogin")}
                  </button>
                </form>
              </>
            )}
          </div>

          {!resetMode && !twoFactorMode && (
            <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 text-center">
              <span className="text-sm text-gray-500">{t("signIn.noAccount")} </span>
              <Link href={nextPath !== "/dashboard" ? `/sign-up?next=${encodeURIComponent(nextPath)}` : "/sign-up"} className="text-sm text-navy-600 font-semibold hover:underline">
                {t("signIn.signUpLink")}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
