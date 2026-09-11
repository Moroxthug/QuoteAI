import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Logo } from "@/components/logo";
import { useScrolled } from "@/hooks/use-scrolled";
import { cn } from "@/lib/utils";
import { X, Send, CheckCircle2, Menu, Globe } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import SupportBot from "@/components/support-bot";
import { useLanguage } from "@/i18n/LanguageContext";
import { TRADE_LABELS } from "@/i18n/translations";
import { getLanguageCounterpartPath } from "@/data/seo-render-engine";

function LanguageToggle({ className }: { className?: string }) {
  const { lang, toggleLang, t } = useLanguage();
  const [pathname, navigate] = useLocation();

  const handleClick = () => {
    // Pages with a real French URL (home, sector/city SEO pages) navigate
    // to the counterpart URL so hreflang/canonical/prerendered content stay
    // correct. Everything else (dashboard, auth, blog, ...) just flips the
    // client-side chrome language in place.
    const counterpart = getLanguageCounterpartPath(pathname);
    if (counterpart) {
      navigate(counterpart);
    } else {
      toggleLang();
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full",
        className
      )}
      aria-label={t("lang.switchTo")}
    >
      <Globe className="h-4 w-4" />
      {lang === "en" ? "FR" : "EN"}
    </button>
  );
}

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useAuth();
  const { t, lang } = useLanguage();
  const scrolled = useScrolled(20);
  const [supportOpen, setSupportOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [, navigate] = useLocation();

  function handleMobileNav(href: string) {
    setMobileMenuOpen(false);
    navigate(href);
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <header
        className={cn(
          "sticky top-0 z-50 w-full transition-all duration-300",
          scrolled
            ? "navbar-glass"
            : "bg-transparent border-b border-transparent"
        )}
      >
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center">
            <Logo />
          </Link>
          <nav className="flex items-center gap-3">
            <Link
              href="/whatsapp/"
              className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full"
            >
              {t("nav.whatsapp")}
              <span className="inline-flex items-center rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 leading-none">
                {t("nav.new")}
              </span>
            </Link>
            <LanguageToggle className="hidden sm:inline-flex" />
            {!isSignedIn ? (
              <>
                <Link
                  href="/sign-in/"
                  className="hidden sm:inline-flex text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full"
                >
                  {t("nav.signIn")}
                </Link>
                <Link
                  href="/sign-up/"
                  className="hidden sm:inline-flex btn-gradient h-9 items-center justify-center px-5 text-sm font-semibold"
                >
                  {t("nav.signUp")}
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/dashboard"
                  className="hidden sm:inline-flex text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full"
                >
                  {t("nav.dashboard")}
                </Link>
                <Link
                  href="/dashboard"
                  className="hidden sm:inline-flex btn-gradient h-9 items-center justify-center px-5 text-sm font-semibold"
                >
                  {t("nav.goToDashboard")}
                </Link>
              </>
            )}
            <button
              className="sm:hidden inline-flex items-center justify-center h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              onClick={() => setMobileMenuOpen(true)}
              aria-label={t("nav.openMenu")}
            >
              <Menu className="h-5 w-5" />
            </button>
          </nav>
        </div>
      </header>

      {/* ── Mobile drawer ─────────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60]" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="absolute top-0 right-0 h-full w-72 bg-white shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <Logo />
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label={t("nav.closeMenu")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex flex-col gap-1 px-3 py-4 flex-1">
              <button
                onClick={() => handleMobileNav("/whatsapp")}
                className="flex items-center gap-2 w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {t("nav.whatsapp")}
                <span className="inline-flex items-center rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 leading-none">
                  {t("nav.new")}
                </span>
              </button>
              <LanguageToggle className="justify-start" />
              {!isSignedIn ? (
                <>
                  <button
                    onClick={() => handleMobileNav("/sign-in")}
                    className="flex items-center w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    {t("nav.signIn")}
                  </button>
                  <button
                    onClick={() => handleMobileNav("/sign-up")}
                    className="mt-2 btn-gradient inline-flex h-11 w-full items-center justify-center px-5 text-sm font-semibold"
                  >
                    {t("nav.signUp")}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleMobileNav("/dashboard")}
                    className="flex items-center w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    {t("nav.dashboard")}
                  </button>
                  <button
                    onClick={() => handleMobileNav("/dashboard")}
                    className="mt-2 btn-gradient inline-flex h-11 w-full items-center justify-center px-5 text-sm font-semibold"
                  >
                    {t("nav.goToDashboard")}
                  </button>
                </>
              )}
            </nav>
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col">{children}</main>

      <footer className="border-t py-12 md:py-16 bg-white">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
            <div className="md:col-span-2">
              <Link href="/" className="flex items-center mb-4">
                <Logo />
              </Link>
              <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                {t("footer.tagline")}
              </p>
            </div>
            <div className="md:col-span-2">
              <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-foreground">{t("footer.trades")}</h4>
              <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-muted-foreground">
                {Object.entries(TRADE_LABELS[lang]).map(([slug, label]) => (
                  <li key={slug}><Link href={`/quotes/${slug}/`} className="hover:text-foreground transition-colors">{label}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-foreground">{t("footer.features")}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/whatsapp/" className="hover:text-foreground transition-colors inline-flex items-center gap-1.5">
                    {t("nav.whatsapp")}
                    <span className="inline-flex items-center rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 leading-none">
                      {t("footer.new")}
                    </span>
                  </Link>
                </li>
              </ul>
              <h4 className="font-semibold mt-8 mb-4 text-sm uppercase tracking-wider text-foreground">{t("footer.guides")}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/blog/" className="hover:text-foreground transition-colors font-medium text-foreground/80">{t("footer.blog")}</Link></li>
                <li><Link href="/quotes/excel-template/" className="hover:text-foreground transition-colors">{t("footer.excelTemplate")}</Link></li>
                <li><Link href="/quotes/word-template/" className="hover:text-foreground transition-colors">{t("footer.wordTemplate")}</Link></li>
                <li><Link href="/quotes/how-to-quote/" className="hover:text-foreground transition-colors">{t("footer.howToQuote")}</Link></li>
                <li><Link href="/quotes/free-quote/" className="hover:text-foreground transition-colors">{t("footer.freeQuotes")}</Link></li>
              </ul>
              <h4 className="font-semibold mt-8 mb-4 text-sm uppercase tracking-wider text-foreground">{t("footer.company")}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/chi-siamo/" className="hover:text-foreground transition-colors">{t("footer.aboutUs")}</Link></li>
                <li><Link href="/contatti/" className="hover:text-foreground transition-colors">{t("footer.contact")}</Link></li>
                <li>
                  <button
                    onClick={() => setSupportOpen(true)}
                    className="hover:text-foreground transition-colors text-left"
                  >
                    {t("footer.support")}
                  </button>
                </li>
                <li><Link href="/privacy-policy/" className="hover:text-foreground transition-colors">{t("footer.privacyPolicy")}</Link></li>
                <li><Link href="/terms/" className="hover:text-foreground transition-colors">{t("footer.terms")}</Link></li>
                <li><Link href="/mappa-sito/" className="hover:text-foreground transition-colors">{t("footer.sitemap")}</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t text-center text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} quoteai. {t("footer.rights")}
          </div>
        </div>
      </footer>

      {/* ── WhatsApp live chat ───────────────────────────────── */}
      <a
        href="https://wa.me/393791059492"
        target="_blank"
        rel="noopener noreferrer nofollow"
        aria-label={t("whatsappCta.aria")}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-full shadow-lg shadow-green-200/60 transition-all duration-200 hover:scale-105 active:scale-95"
        style={{ background: "#25D366" }}
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "#25D366" }}>
          <WhatsAppIcon />
        </span>
        <span className="pr-5 text-white text-sm font-semibold whitespace-nowrap hidden sm:inline-block">
          {t("whatsappCta.helpText")}
        </span>
      </a>

      {/* ── Support modal ────────────────────────────────────── */}
      {supportOpen && (
        <SupportModal onClose={() => setSupportOpen(false)} />
      )}

      {/* AI Support Bot Widget */}
      <SupportBot />
    </div>
  );
}

function SupportModal({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  const [problema, setProblema] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const subject = encodeURIComponent(`[QuoteAI Support] ${problema}`);
    const body = encodeURIComponent(
      `Issue type: ${problema}\n\nDescription:\n${descrizione}\n\nCustomer email: ${email}`
    );
    window.location.href = `mailto:support@quoteai.ca?subject=${subject}&body=${body}`;
    setSent(true);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full sm:max-w-md mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{t("support.contactSupport")}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{t("support.replyTime")}</p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {sent ? (
          <div className="px-6 py-12 text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="h-14 w-14 rounded-full flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.12), rgba(6,182,212,0.12))" }}>
                <CheckCircle2 className="h-7 w-7 text-violet-500" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t("support.sentTitle")}</h3>
            <p className="text-sm text-gray-500 mb-6">{t("support.sentBody")}</p>
            <button
              onClick={onClose}
              className="btn-gradient inline-flex h-10 items-center justify-center px-6 text-sm font-semibold"
            >
              {t("support.close")}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {t("support.issueType")} <span className="text-red-400">*</span>
              </label>
              <select
                required
                value={problema}
                onChange={e => setProblema(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all"
              >
                <option value="">{t("support.selectType")}</option>
                <option value={t("support.technical")}>{t("support.technical")}</option>
                <option value={t("support.billing")}>{t("support.billing")}</option>
                <option value={t("support.quoteGeneration")}>{t("support.quoteGeneration")}</option>
                <option value={t("support.accountAccess")}>{t("support.accountAccess")}</option>
                <option value={t("support.other")}>{t("support.other")}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {t("support.description")} <span className="text-red-400">*</span>
              </label>
              <textarea
                required
                rows={4}
                value={descrizione}
                onChange={e => setDescrizione(e.target.value)}
                placeholder={t("support.descriptionPlaceholder")}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {t("support.yourEmail")} <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="jane@example.com"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all"
              />
            </div>
            <button
              type="submit"
              className="btn-gradient inline-flex h-11 w-full items-center justify-center gap-2 text-sm font-semibold mt-1"
            >
              <Send className="h-4 w-4" />
              {t("support.submit")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="28" height="28" fill="white">
      <path d="M16 2C8.268 2 2 8.268 2 16c0 2.478.675 4.797 1.849 6.785L2 30l7.438-1.82A13.94 13.94 0 0 0 16 30c7.732 0 14-6.268 14-14S23.732 2 16 2zm0 25.5a11.44 11.44 0 0 1-5.842-1.6l-.418-.248-4.41 1.08 1.112-4.3-.272-.44A11.46 11.46 0 0 1 4.5 16C4.5 9.649 9.649 4.5 16 4.5S27.5 9.649 27.5 16 22.351 27.5 16 27.5zm6.29-8.61c-.344-.172-2.036-1.004-2.352-1.118-.317-.115-.547-.172-.778.172-.23.344-.893 1.118-1.094 1.348-.2.23-.403.258-.747.086-.344-.172-1.452-.535-2.766-1.707-1.022-.912-1.713-2.038-1.913-2.382-.2-.344-.021-.53.15-.7.155-.155.344-.403.517-.604.172-.2.23-.344.344-.574.115-.23.057-.43-.029-.603-.086-.172-.778-1.876-1.066-2.568-.28-.673-.566-.582-.778-.593l-.663-.011c-.23 0-.603.086-.919.43s-1.207 1.18-1.207 2.876 1.236 3.337 1.408 3.567c.172.23 2.432 3.712 5.892 5.206.824.355 1.467.568 1.969.727.827.263 1.58.226 2.175.137.663-.099 2.036-.832 2.323-1.635.287-.804.287-1.493.2-1.636-.086-.143-.317-.23-.66-.402z" />
    </svg>
  );
}
