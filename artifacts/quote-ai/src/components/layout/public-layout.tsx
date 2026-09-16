import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Logo } from "@/components/logo";
import { useScrolled } from "@/hooks/use-scrolled";
import { cn } from "@/lib/utils";
import { X, Send, CheckCircle2, Menu, Globe, ChevronDown, MessageCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import SupportBot from "@/components/support-bot";
import { useLanguage } from "@/i18n/LanguageContext";
import { TRADE_LABELS } from "@/i18n/translations";
import { getLanguageCounterpartPath, cityBasePath } from "@/data/seo-render-engine";
import { SECTORS } from "@/data/seo-data";

const MEGA_MENU_TRADE_SLUGS = [
  "painter",
  "electrician",
  "plumber",
  "general-contractor",
  "renovation-contractor",
  "roofer",
  "landscaper",
  "flooring-installer",
];

function TradesMegaMenu() {
  const { t, lang } = useLanguage();
  const base = cityBasePath(lang === "fr" ? "fr-CA" : "en-CA");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const tradeLabels = TRADE_LABELS[lang];

  return (
    <div ref={containerRef} className="relative hidden lg:block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full"
        aria-expanded={open}
      >
        {t("nav.trades")}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="mega-menu-panel absolute left-1/2 -translate-x-1/2 top-full mt-2 w-[560px] bg-white rounded-2xl border border-gray-100 shadow-2xl shadow-navy-200/30 overflow-hidden">
          <div className="grid grid-cols-3 p-6 gap-6">
            <div className="col-span-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                {t("nav.megamenu.popularTrades")}
              </div>
              <div className="grid grid-cols-2 gap-1">
                {MEGA_MENU_TRADE_SLUGS.map((slug) => (
                  <Link
                    key={slug}
                    href={`${base}/${lang === "fr" ? (SECTORS[slug]?.frSlug ?? slug) : slug}/`}
                    onClick={() => setOpen(false)}
                    className="text-sm text-gray-600 hover:text-navy-700 hover:bg-navy-50 rounded-lg px-2.5 py-1.5 transition-colors"
                  >
                    {tradeLabels[slug]}
                  </Link>
                ))}
              </div>
              <Link
                href="/#pricing"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-navy-600 hover:text-navy-700 mt-3 px-2.5"
              >
                {t("nav.megamenu.viewAllTrades")}
              </Link>
            </div>

            <div className="border-l border-gray-100 pl-6">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                {t("nav.megamenu.resources")}
              </div>
              <ul className="space-y-1.5 mb-4">
                <li><Link href="/blog/" onClick={() => setOpen(false)} className="text-sm text-gray-600 hover:text-navy-700 transition-colors">{t("footer.blog")}</Link></li>
                <li><Link href="/quotes/excel-template/" onClick={() => setOpen(false)} className="text-sm text-gray-600 hover:text-navy-700 transition-colors">{t("footer.excelTemplate")}</Link></li>
                <li><Link href="/quotes/word-template/" onClick={() => setOpen(false)} className="text-sm text-gray-600 hover:text-navy-700 transition-colors">{t("footer.wordTemplate")}</Link></li>
                <li><Link href="/quotes/how-to-quote/" onClick={() => setOpen(false)} className="text-sm text-gray-600 hover:text-navy-700 transition-colors">{t("footer.howToQuote")}</Link></li>
              </ul>
              <Link
                href="/whatsapp/"
                onClick={() => setOpen(false)}
                className="block rounded-xl bg-gray-50 hover:bg-navy-50 border border-gray-100 p-3 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-6 w-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}>
                    <MessageCircle className="h-3.5 w-3.5 text-white" />
                  </div>
                  <span className="text-xs font-semibold text-gray-900">{t("nav.megamenu.whatsappTitle")}</span>
                </div>
                <p className="text-xs text-gray-500 leading-snug">{t("nav.megamenu.whatsappDesc")}</p>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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

function MobileTradesAccordion({ onNavigate }: { onNavigate: (href: string) => void }) {
  const { t, lang } = useLanguage();
  const base = cityBasePath(lang === "fr" ? "fr-CA" : "en-CA");
  const [open, setOpen] = useState(false);
  const tradeLabels = TRADE_LABELS[lang];

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        aria-expanded={open}
      >
        {t("nav.trades")}
        <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-1 px-4 pb-2">
          {MEGA_MENU_TRADE_SLUGS.map((slug) => (
            <button
              key={slug}
              onClick={() => onNavigate(`${base}/${lang === "fr" ? (SECTORS[slug]?.frSlug ?? slug) : slug}/`)}
              className="text-left text-xs text-gray-500 hover:text-navy-700 py-1.5 px-2 rounded-lg hover:bg-navy-50 transition-colors"
            >
              {tradeLabels[slug]}
            </button>
          ))}
        </div>
      )}
    </div>
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
            <TradesMegaMenu />
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
              <MobileTradesAccordion onNavigate={handleMobileNav} />
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
                <CheckCircle2 className="h-7 w-7 text-navy-500" />
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
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-navy-400 focus:border-transparent transition-all"
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
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy-400 focus:border-transparent transition-all resize-none"
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
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy-400 focus:border-transparent transition-all"
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
