import { useState, useEffect } from "react";
import { Link, useSearch } from "wouter";
import { Logo } from "@/components/logo";
import { authClient } from "@/lib/auth-client";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

function safeLocalPath(raw: string | null, fallback: string): string {
  if (!raw) return fallback;
  try {
    // Only allow paths starting with "/" that are not protocol-relative (//) or external
    if (/^\/[^/]/.test(raw) || raw === "/") return raw;
  } catch {}
  return fallback;
}

export default function SignUpPage() {
  const { t } = useLanguage();
  const search = useSearch();
  const nextPath = safeLocalPath(new URLSearchParams(search).get("next"), "/onboarding");
  const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);

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
      <div className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="h-8 w-8 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!registrationOpen) {
    return (
      <div className="flex-1 flex items-center justify-center py-12 px-4 bg-muted/30">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-lg p-10 max-w-sm w-full text-center">
          <div className="flex justify-center mb-6">
            <Logo />
          </div>
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">{t("signUp.betaClosedTitle")}</h1>
          <p className="text-sm text-gray-500 mb-6">
            {t("signUp.betaClosedBody")}
          </p>
          <p className="text-sm text-gray-500 mb-6">
            {t("signUp.alreadyInvited")}{" "}
            <Link href="/sign-in/" className="text-violet-600 font-semibold hover:underline">
              {t("signUp.loginHere")}
            </Link>
          </p>
          <a
            href="https://wa.me/393791059492"
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-2 w-full justify-center h-10 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90"
            style={{ background: "#25D366" }}
          >
            {t("signUp.requestAccessWhatsapp")}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center py-12 px-4 bg-muted/30">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-lg overflow-hidden">
          <div className="px-8 pt-8 pb-6">
            <div className="flex justify-center mb-6">
              <Logo />
            </div>

            {verificationSent ? (
              <div className="text-center py-4">
                <div className="text-4xl mb-3">📧</div>
                <h2 className="text-lg font-bold text-gray-900 mb-2">{t("signUp.checkEmailTitle")}</h2>
                <p className="text-sm text-gray-500 mb-6">
                  {t("signUp.checkEmailBodyPrefix")} <strong>{email}</strong>. {t("signUp.checkEmailBodySuffix")}
                </p>
                <Link href="/sign-in" className="text-sm text-violet-600 hover:underline font-medium">
                  {t("signUp.backToLogin")}
                </Link>
              </div>
            ) : (
              <>
                <h1 className="text-xl font-bold text-gray-900 text-center mb-1">{t("signUp.title")}</h1>
                <p className="text-sm text-gray-400 text-center mb-6">{t("signUp.subtitle")}</p>

                {error && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 mb-4">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleSignUp} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("signUp.fullName")}</label>
                    <input
                      type="text"
                      required
                      autoComplete="name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Jane Smith"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("signUp.email")}</label>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="jane@example.com"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("signUp.password")}</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={8}
                        autoComplete="new-password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder={t("signUp.passwordPlaceholder")}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 pr-10 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all"
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

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="btn-gradient w-full h-11 flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-60"
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {isLoading ? t("signUp.signingUp") : t("signUp.createFreeAccount")}
                  </button>

                  <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                    {t("signUp.agreeToPrefix")}{" "}
                    <Link href="/termini/" className="underline hover:text-gray-600">{t("signUp.termsOfService")}</Link>{" "}
                    {t("signUp.andThe")}{" "}
                    <Link href="/privacy/" className="underline hover:text-gray-600">{t("signUp.privacyPolicy")}</Link>.
                  </p>
                </form>
              </>
            )}
          </div>

          {!verificationSent && (
            <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 text-center">
              <span className="text-sm text-gray-500">{t("signUp.alreadyHaveAccount")} </span>
              <Link href={nextPath !== "/onboarding" ? `/sign-in?next=${encodeURIComponent(nextPath)}` : "/sign-in"} className="text-sm text-violet-600 font-semibold hover:underline">
                {t("signUp.signInLink")}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
