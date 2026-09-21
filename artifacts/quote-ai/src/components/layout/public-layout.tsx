import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Logo } from "@/components/logo";
import { useScrolled } from "@/hooks/use-scrolled";
import { cn } from "@/lib/utils";
import { X, Send, CheckCircle2, Menu, ChevronDown } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import SupportBot from "@/components/support-bot";
import { useLanguage } from "@/i18n/LanguageContext";
import { TRADE_LABELS } from "@/i18n/translations";
import { getLanguageCounterpartPath } from "@/data/seo-slugs";
import { legalIdentityLines } from "@workspace/legal-entity";

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
    { href: "/#story-jobs", cls: "mc-purple", title: t("nav.products.crm.title"), desc: t("nav.products.crm.desc") },
    { href: "/#story-invoicing", cls: "mc-teal", title: t("nav.products.invoicing.title"), desc: t("nav.products.invoicing.desc") },
    { href: "/#products", cls: "mc-yellow", title: t("nav.products.team.title"), desc: t("nav.products.team.desc") },
  ];

  return (
    <span ref={containerRef} className={cn("has-mega", open && "open")}>
      <button onClick={() => setOpen((v) => !v)} className="nav-link" aria-expanded={open}>
        {t("nav.products")}
        <ChevronDown className="chev-d h-2.5 w-2.5" />
      </button>
      {open && (
        <div className="mega">
          {tiles.map((tile) => (
            <Link key={tile.title} href={tile.href} onClick={() => setOpen(false)} className={cn("mega-card", tile.cls)}>
              <b>{tile.title}</b>
              <p>{tile.desc}</p>
              <span className="cta-link">{t("nav.megamenu.learnMore")} <ChevRight /></span>
            </Link>
          ))}
        </div>
      )}
    </span>
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
      <Link href="/#whatsapp">{t("annc.cta")}</Link>
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

function LanguageToggle({ variant = "pill" }: { variant?: "pill" | "dark" }) {
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

  const label = lang === "en" ? "FR" : "EN";

  if (variant === "dark") {
    return (
      <button onClick={handleClick} className="locale" aria-label={t("lang.switchTo")}>
        {label}
      </button>
    );
  }

  return (
    <button onClick={handleClick} className="hd-fr" aria-label={t("lang.switchTo")}>
      {label}
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
      <AnnouncementBar />
      <header className={cn("site-head", scrolled && "scrolled")}>
        <div className="wrap hd">
          <Link href="/" className="flex items-center">
            <Logo />
          </Link>
          <nav aria-label={t("a11y.primaryNav")} className="nav">
            <ProductsMegaMenu />
            <Link href="/#trades" className="nav-link">{t("nav.trades")}</Link>
            <Link href="/#whatsapp" className="nav-link">
              {t("nav.whatsapp")}
              <span className="chip chip-new">{t("nav.new")}</span>
            </Link>
            <Link href="/#guides" className="nav-link">{t("nav.guides")}</Link>
          </nav>
          <div className="hd-r">
            <LanguageToggle />
            {!isSignedIn ? (
              <>
                <Link href="/sign-in/" className="signin">{t("nav.signIn")}</Link>
                <Link href="/sign-up/" className="btn btn-navy btn-sm">{t("nav.signUp")}</Link>
              </>
            ) : (
              <Link href="/dashboard" className="btn btn-navy btn-sm">{t("nav.goToDashboard")}</Link>
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
            className="absolute top-0 right-0 h-full w-72 bg-white shadow-2xl flex flex-col mnav open"
            style={{ padding: 0 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--line)" }}>
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
              <button className="mnav-link" onClick={() => handleMobileNav("/#products")}>{t("nav.products")}</button>
              <button className="mnav-link" onClick={() => handleMobileNav("/#trades")}>{t("nav.trades")}</button>
              <button className="mnav-link" onClick={() => handleMobileNav("/#whatsapp")}>{t("nav.whatsapp")}</button>
              <button className="mnav-link" onClick={() => handleMobileNav("/#guides")}>{t("nav.guides")}</button>
              <button className="mnav-link" onClick={() => handleMobileNav("/#comparison")}>{t("nav.compare")}</button>
              {!isSignedIn ? (
                <button className="mnav-link" onClick={() => handleMobileNav("/sign-in")}>{t("nav.signIn")}</button>
              ) : (
                <button className="mnav-link" onClick={() => handleMobileNav("/dashboard")}>{t("nav.dashboard")}</button>
              )}
              <div className="pt-3">
                <LanguageToggle />
              </div>
              {!isSignedIn ? (
                <button onClick={() => handleMobileNav("/sign-up")} className="btn btn-navy">{t("nav.signUp")}</button>
              ) : (
                <button onClick={() => handleMobileNav("/dashboard")} className="btn btn-navy">{t("nav.goToDashboard")}</button>
              )}
            </nav>
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col">{children}</main>

      <footer className="footer">
        <div className="wrap ft-grid">
          <div className="ft-brand">
            <Link href="/" className="flex items-center mb-1">
              <Logo className="logo-invert" />
            </Link>
            <p>{t("footer.tagline")}</p>
          </div>
          <div className="ft-col">
            <h4>{t("footer.trades")}</h4>
            {Object.entries(TRADE_LABELS[lang]).slice(0, 7).map(([slug, label]) => (
              <Link key={slug} href={`/quotes/${slug}/`}>{label}</Link>
            ))}
            <Link href="/#trades">{t("footer.allTrades")}</Link>
          </div>
          <div className="ft-col">
            <h4>{t("footer.features")}</h4>
            <Link href="/#whatsapp">{t("nav.whatsapp")}<span className="chip-new chip">{t("nav.new")}</span></Link>
            <Link href="/#story-jobs">{t("footer.jobSites")}</Link>
            <Link href="/#story-invoicing">{t("footer.contracts")}</Link>
            <Link href="/#products">{t("footer.analytics")}</Link>
            <Link href="/#products">{t("footer.aiAssistant")}</Link>
            <Link href="/#products">{t("footer.imports")}</Link>
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
            <Link href="/#newsroom">{t("footer.newsroom")}</Link>
            <Link href="/#reviews">{t("footer.reviews")}</Link>
          </div>
          <div className="ft-col">
            <h4>{t("footer.support")}</h4>
            <Link href="/help/">{t("footer.helpCenter")}</Link>
            <button onClick={() => setSupportOpen(true)}>{t("support.contactSupport")}</button>
            <Link href="/privacy-policy/">{t("footer.privacyPolicy")}</Link>
            <Link href="/terms/">{t("footer.terms")}</Link>
            <Link href="/mappa-sito/">{t("footer.sitemap")}</Link>
          </div>
        </div>
        <div className="wrap"><p className="ft-fine">{t("footer.fine")}</p></div>
        {/* Phase 73: registered entity (lib/legal-entity) — one line per part, blank until O5 */}
        <div className="wrap"><p className="ft-fine">{legalIdentityLines(lang).join(" · ")}</p></div>
        <div className="wrap ft-bottom">
          <span>&copy; {new Date().getFullYear()} quoteai. {t("footer.rights")}</span>
          <div className="ft-legal">
            <Link href="/privacy-policy/">{t("footer.privacyPolicy")}</Link>
            <Link href="/terms/">{t("footer.terms")}</Link>
            <Link href="/mappa-sito/">{t("footer.sitemap")}</Link>
          </div>
          <LanguageToggle variant="dark" />
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
