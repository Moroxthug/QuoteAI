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

const ChevRight = () => (
  <svg className="chev" viewBox="0 0 16 16" fill="none"><path d="M5.5 3l5 5-5 5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

function ProductsMegaMenu() {
  const { t } = useLanguage();
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

  const tiles = [
    { href: "/#story-quotes", cls: "mc-green", title: t("nav.products.quotes.title"), desc: t("nav.products.quotes.desc") },
    { href: "/#story-crm", cls: "mc-purple", title: t("nav.products.crm.title"), desc: t("nav.products.crm.desc") },
    { href: "/#story-invoicing", cls: "mc-teal", title: t("nav.products.invoicing.title"), desc: t("nav.products.invoicing.desc") },
    { href: "/whatsapp/", cls: "mc-yellow", title: t("nav.products.integrations.title"), desc: t("nav.products.integrations.desc") },
  ];

  return (
    <div ref={containerRef} className="hidden lg:block">
      <button onClick={() => setOpen((v) => !v)} className="nav-link" aria-expanded={open}>
        {t("nav.products")}
        <ChevronDown className="chev-down h-2.5 w-2.5" />
      </button>
      {open && (
        <div className="mega">
          <div className="mega-in">
            {tiles.map((tile) => (
              <Link key={tile.title} href={tile.href} onClick={() => setOpen(false)} className={cn("mega-card", tile.cls)}>
                <b>{tile.title}</b>
                <p>{tile.desc}</p>
                <span className="cta-link">{t("nav.megamenu.learnMore")} <ChevRight /></span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

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
      <button onClick={() => setOpen((v) => !v)} className="nav-link" aria-expanded={open}>
        {t("nav.trades")}
        <ChevronDown className="chev-down h-2.5 w-2.5" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-[560px] bg-white rounded-2xl border border-gray-100 shadow-2xl shadow-navy-200/30 overflow-hidden">
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

function AnnouncementBar() {
  const { t } = useLanguage();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem("quoteai:annc_dismissed") === "1";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  return (
    <div className="annc">
      {t("annc.text")}
      <Link href="/whatsapp/">{t("annc.cta")}</Link>
      <button
        className="annc-x"
        aria-label={t("annc.dismiss")}
        onClick={() => {
          setDismissed(true);
          try {
            sessionStorage.setItem("quoteai:annc_dismissed", "1");
          } catch {
            /* sessionStorage unavailable — dismissal just won't persist */
          }
        }}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function LanguageToggle({ className, variant = "light" }: { className?: string; variant?: "light" | "dark" }) {
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

  if (variant === "dark") {
    return (
      <button onClick={handleClick} className={cn("locale", className)} aria-label={t("lang.switchTo")}>
        <Globe className="h-3.5 w-3.5" />
        {lang === "en" ? "FR" : "EN"}
      </button>
    );
  }

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
      <button onClick={() => setOpen((v) => !v)} className="m-link" aria-expanded={open}>
        {t("nav.trades")}
        <ChevronDown className={cn("h-4 w-4 text-gray-400 ml-auto transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-1 pb-2">
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
      <AnnouncementBar />
      <header className={cn("site-head", scrolled && "scrolled")}>
        <div className="wrap hd-in">
          <Link href="/" className="flex items-center">
            <Logo />
          </Link>
          <nav aria-label="Primary" className="main-nav">
            <ProductsMegaMenu />
            <TradesMegaMenu />
            <Link href="/whatsapp/" className="nav-link">
              {t("nav.whatsapp")}
              <span className="inline-flex items-center rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 leading-none">
                {t("nav.new")}
              </span>
            </Link>
          </nav>
          <div className="hd-right">
            <LanguageToggle className="hidden sm:inline-flex" />
            {!isSignedIn ? (
              <>
                <Link href="/sign-in/" className="hd-signin">
                  {t("nav.signIn")}
                </Link>
                <Link href="/sign-up/" className="btn btn-navy hd-cta">
                  {t("nav.signUp")}
                </Link>
              </>
            ) : (
              <Link href="/dashboard" className="btn btn-navy hd-cta">
                {t("nav.goToDashboard")}
              </Link>
            )}
            <button className="menu-btn" onClick={() => setMobileMenuOpen(true)} aria-label={t("nav.openMenu")}>
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile drawer ─────────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60]" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="absolute top-0 right-0 h-full w-72 bg-white shadow-2xl flex flex-col m-menu open"
            style={{ padding: 0 }}
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
            <nav className="flex flex-col px-4 py-2 flex-1 overflow-y-auto">
              <p className="m-label">{t("nav.products")}</p>
              <button className="m-link" onClick={() => handleMobileNav("/#story-quotes")}><span className="m-dot" style={{ background: "var(--green)" }} />{t("nav.products.quotes.title")}</button>
              <button className="m-link" onClick={() => handleMobileNav("/#story-crm")}><span className="m-dot" style={{ background: "var(--purple)" }} />{t("nav.products.crm.title")}</button>
              <button className="m-link" onClick={() => handleMobileNav("/#story-invoicing")}><span className="m-dot" style={{ background: "var(--teal)" }} />{t("nav.products.invoicing.title")}</button>
              <p className="m-label">{t("nav.trades")}</p>
              <MobileTradesAccordion onNavigate={handleMobileNav} />
              <button onClick={() => handleMobileNav("/whatsapp")} className="m-link">
                {t("nav.whatsapp")}
                <span className="inline-flex items-center rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 leading-none ml-auto">
                  {t("nav.new")}
                </span>
              </button>
              <LanguageToggle className="justify-start !py-3" />
              {!isSignedIn ? (
                <>
                  <button onClick={() => handleMobileNav("/sign-in")} className="m-link">{t("nav.signIn")}</button>
                  <button onClick={() => handleMobileNav("/sign-up")} className="btn btn-navy">{t("nav.signUp")}</button>
                </>
              ) : (
                <button onClick={() => handleMobileNav("/dashboard")} className="btn btn-navy">{t("nav.goToDashboard")}</button>
              )}
            </nav>
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col">{children}</main>

      <footer className="footer on-dark">
        <div className="wrap">
          <div className="ft-grid">
            <div className="ft-brand">
              <Link href="/" className="flex items-center mb-1">
                <Logo className="logo-invert" />
              </Link>
              <p>{t("footer.tagline")}</p>
            </div>
            <div className="ft-col">
              <h4>{t("footer.products")}</h4>
              <Link href="/#story-quotes">{t("nav.products.quotes.title")}</Link>
              <Link href="/#story-crm">{t("nav.products.crm.title")}</Link>
              <Link href="/#story-invoicing">{t("nav.products.invoicing.title")}</Link>
              <Link href="/whatsapp/">{t("nav.whatsapp")}</Link>
            </div>
            <div className="ft-col">
              <h4>{t("footer.trades")}</h4>
              {Object.entries(TRADE_LABELS[lang]).slice(0, 5).map(([slug, label]) => (
                <Link key={slug} href={`/quotes/${slug}/`}>{label}</Link>
              ))}
            </div>
            <div className="ft-col">
              <h4>{t("footer.guides")}</h4>
              <Link href="/blog/">{t("footer.blog")}</Link>
              <Link href="/quotes/excel-template/">{t("footer.excelTemplate")}</Link>
              <Link href="/quotes/word-template/">{t("footer.wordTemplate")}</Link>
              <Link href="/quotes/how-to-quote/">{t("footer.howToQuote")}</Link>
              <Link href="/quotes/free-quote/">{t("footer.freeQuotes")}</Link>
            </div>
            <div className="ft-col">
              <h4>{t("footer.company")}</h4>
              <Link href="/chi-siamo/">{t("footer.aboutUs")}</Link>
              <Link href="/contatti/">{t("footer.contact")}</Link>
              <button onClick={() => setSupportOpen(true)}>{t("footer.support")}</button>
              <Link href="/privacy-policy/">{t("footer.privacyPolicy")}</Link>
              <Link href="/terms/">{t("footer.terms")}</Link>
              <Link href="/mappa-sito/">{t("footer.sitemap")}</Link>
            </div>
          </div>
          <p className="ft-fine">{t("footer.fine")}</p>
          <div className="ft-bottom">
            <span>&copy; {new Date().getFullYear()} quoteai. {t("footer.rights")}</span>
            <div className="ft-legal">
              <Link href="/terms/">{t("footer.terms")}</Link>
              <Link href="/privacy-policy/">{t("footer.privacyPolicy")}</Link>
              <Link href="/mappa-sito/">{t("footer.sitemap")}</Link>
            </div>
            <LanguageToggle variant="dark" />
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
              <div className="h-14 w-14 rounded-full flex items-center justify-center bg-navy-50">
                <CheckCircle2 className="h-7 w-7 text-navy-600" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t("support.sentTitle")}</h3>
            <p className="text-sm text-gray-500 mb-6">{t("support.sentBody")}</p>
            <button onClick={onClose} className="btn btn-navy">
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
            <button type="submit" className="btn btn-navy w-full mt-1">
              <Send className="h-4 w-4" />
              {t("support.submit")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
