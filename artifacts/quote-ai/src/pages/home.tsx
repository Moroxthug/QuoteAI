import { Link, useLocation } from "wouter";
import { ArrowRight, FileText, Zap, Users, DollarSign, Check } from "lucide-react";
import { SeoHead } from "@/components/seo-head";
import { RevealHeading } from "@/components/reveal-heading";
import { StatsBar } from "@/components/stats-bar";
import { useScrollFade } from "@/hooks/use-scroll-fade";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/i18n/LanguageContext";
import { BLOG_ARTICLES } from "@/data/blog-data";

function ScrollSection({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const ref = useScrollFade();
  return (
    <section
      id={id}
      ref={ref as React.RefObject<HTMLElement>}
      className={`fade-in-section ${className}`}
    >
      {children}
    </section>
  );
}

/** Quote PDF preview used as the hero-media / story-media product screenshot in place of stock photography. */
function QuoteDocPreview({ title }: { title: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-md overflow-hidden w-full max-w-[420px]">
      <div className="border-b bg-gray-50 px-4 py-2.5 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
        </div>
        <div className="text-xs font-medium text-gray-400 ml-4">{title}</div>
      </div>
      <div className="bg-white text-black text-[10px] p-4 select-none">
        <div className="flex justify-between items-start border-b-2 border-slate-800 pb-2.5 mb-2.5">
          <div>
            <div className="text-xs font-bold text-slate-800">Smith Painting Co.</div>
            <div className="text-slate-500 text-[9px] mt-0.5">GST/HST: 123456789 RT0001</div>
          </div>
          <div className="text-right">
            <div className="text-[8px] font-semibold text-slate-400 uppercase tracking-widest">Quote</div>
            <div className="text-[10px] font-bold text-slate-700 mt-0.5">N. 2024-042</div>
          </div>
        </div>
        <table className="w-full mb-2">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="py-1 px-2 text-left text-[8px] font-semibold">Section</th>
              <th className="py-1 px-2 text-right text-[8px] font-semibold">Net amount</th>
            </tr>
          </thead>
          <tbody>
            <tr><td className="py-1 px-2 text-slate-700">A. Wall painting</td><td className="py-1 px-2 text-right font-medium text-slate-800">$1,200.00</td></tr>
            <tr className="bg-slate-50"><td className="py-1 px-2 text-slate-700">B. Skim coating & prep</td><td className="py-1 px-2 text-right font-medium text-slate-800">$250.00</td></tr>
          </tbody>
        </table>
        <div className="flex justify-end">
          <div className="w-44 border border-slate-200 rounded overflow-hidden">
            <div className="flex justify-between px-2 py-1 text-slate-600 border-b border-slate-100"><span>Subtotal:</span><span className="font-medium">$1,450.00</span></div>
            <div className="flex justify-between px-2 py-1 text-slate-600 border-b border-slate-100"><span>HST (13%):</span><span className="font-medium">$319.00</span></div>
            <div className="flex justify-between px-2 py-1.5 bg-slate-800 text-white font-bold text-[10px]"><span>TOTAL</span><span>$1,769.00</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { isSignedIn } = useAuth();
  const { lang } = useLanguage();
  const [, navigate] = useLocation();

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* WebSite + SoftwareApplication JSON-LD for "/" is already baked into
          the prerendered shell by scripts/prerender-seo.ts — don't duplicate
          it here via Helmet, or crawlers see two WebSite schemas. */}
      <SeoHead
        title={
          lang === "fr"
            ? "quoteai – Soumissions instantanées pour entrepreneurs canadiens | IA en 30s"
            : "quoteai – Instant Quotes for Canadian Contractors | AI in 30s"
        }
        description={
          lang === "fr"
            ? "Oubliez Excel et la paperasse écrite à la main. Décrivez le travail dans vos propres mots et quoteai génère une soumission professionnelle avec taxes, postes et totaux en 30 secondes."
            : "Forget Excel and handwritten paperwork. Describe the job in your own words and quoteai generates a professional quote with tax, line items, and totals in 30 seconds."
        }
        canonical={lang === "fr" ? "https://quoteai.ca/fr/" : "https://quoteai.ca/"}
        lang={lang === "fr" ? "fr-CA" : "en-CA"}
        frCanonical="https://quoteai.ca/fr/"
      />

      {/* ── HERO (docs/mockups .hero — locked, literal) ───────── */}
      <section className="hero on-dark" id="hero">
        <div className="wrap hero-grid">
          <div>
            <p className="hero-kicker">
              {lang === "fr" ? "La plateforme IA pour les petites entreprises" : "The AI-driven platform for small business"}
            </p>
            <h1>
              {lang === "fr" ? (
                <RevealHeading
                  lines={[
                    [{ text: "Créez" }, { text: "des" }, { text: "soumissions" }],
                    [{ text: "professionnelles" }, { text: "en" }, { text: "30" }, { text: "secondes" }],
                    [{ text: "avec" }, { text: "l'IA." }],
                  ]}
                />
              ) : (
                <RevealHeading
                  lines={[
                    [{ text: "Create" }, { text: "professional" }],
                    [{ text: "quotes" }, { text: "in" }, { text: "30" }, { text: "seconds" }],
                    [{ text: "with" }, { text: "AI." }],
                  ]}
                />
              )}
            </h1>
            <p className="hero-sub">
              {lang === "fr"
                ? "quoteai génère vos soumissions chiffrées, suit vos chantiers et garde vos factures organisées — une seule plateforme intelligente pour chaque étape de votre entreprise."
                : "quoteai drafts priced quotes, tracks your job sites, and keeps your invoices organized — one intelligent platform for every moment of your business."}
            </p>
            <div className="hero-actions">
              <button onClick={() => navigate(isSignedIn ? "/dashboard/new" : "/sign-up")} className="btn btn-white">
                {lang === "fr" ? "Essayez gratuitement" : "Start your free trial"}
              </button>
              <Link href="#products" className="btn btn-outline-light">
                {lang === "fr" ? "Voir les produits" : "See the products"}
              </Link>
            </div>
            <p className="hero-note">{lang === "fr" ? "Essai gratuit de 7 jours. Sans carte de crédit." : "7-day free trial. No credit card required."}</p>
          </div>

          {/* hero-media: real product screenshot, no stock photography */}
          <div className="hero-media hidden lg:block">
            <QuoteDocPreview title="Quote_John_Smith.pdf" />
          </div>
        </div>
      </section>

      {/* ── PRODUCTS (docs/mockups .products/.tiles — locked, literal) ── */}
      <ScrollSection className="products" id="products">
        <div className="wrap">
          <div>
            <p className="eyebrow">{lang === "fr" ? "Nos produits" : "Our products"}</p>
            <h2 className="sec-title">{lang === "fr" ? "Une plateforme. Chaque étape de l'argent." : "One platform. Every money moment."}</h2>
            <p className="sec-sub">
              {lang === "fr"
                ? "Quatre produits qui partagent un seul cerveau — pour qu'un prospect devienne une soumission, qu'une soumission devienne une facture, et qu'une facture devienne de l'argent, sans rien perdre en chemin."
                : "Four products that share one brain — so a lead becomes a quote, a quote becomes an invoice, and an invoice becomes money, without anything falling through the cracks."}
            </p>
          </div>
          <div className="tiles">
            <Link href="#story-quotes" className="tile tile-green">
              <FileText className="h-6 w-6" />
              <h3>{lang === "fr" ? "Soumissions IA" : "AI Quotes"}</h3>
              <p>{lang === "fr" ? "Décrivez le travail à voix haute. L'IA le chiffre à partir de votre liste de prix et vous remet une soumission prête à envoyer et à signer." : "Describe the job out loud. The AI scopes it, prices it from your price list, and hands you a branded quote ready to send and sign."}</p>
              <span className="cta-link">{lang === "fr" ? "En savoir plus" : "Learn more"} <ArrowRight className="chev h-4 w-4" /></span>
            </Link>
            <Link href="#story-crm" className="tile tile-purple">
              <Users className="h-6 w-6" />
              <h3>{lang === "fr" ? "CRM intelligent" : "Smart CRM"}</h3>
              <p>{lang === "fr" ? "Chaque soumission acceptée devient un chantier avec tâches, équipe et fournisseurs suivis dans un seul pipeline." : "Every accepted quote becomes a job site — tasks, team members, and suppliers tracked in a single pipeline."}</p>
              <span className="cta-link">{lang === "fr" ? "En savoir plus" : "Learn more"} <ArrowRight className="chev h-4 w-4" /></span>
            </Link>
            <Link href="#story-invoicing" className="tile tile-teal">
              <DollarSign className="h-6 w-6" />
              <h3>{lang === "fr" ? "Facturation & paiements" : "Invoicing & Payments"}</h3>
              <p>{lang === "fr" ? "Les soumissions acceptées deviennent des factures instantanément, avec contrats et suivi de budget en continu." : "Accepted quotes become invoices instantly, with contracts and budget tracking that stay in sync."}</p>
              <span className="cta-link">{lang === "fr" ? "En savoir plus" : "Learn more"} <ArrowRight className="chev h-4 w-4" /></span>
            </Link>
            <Link href="/whatsapp/" className="tile tile-yellow">
              <Zap className="h-6 w-6" />
              <h3>{lang === "fr" ? "Intégrations" : "Integrations"}</h3>
              <p>{lang === "fr" ? "WhatsApp, imports de tableurs, et les outils que vous utilisez déjà pour gérer votre entreprise." : "WhatsApp, spreadsheet imports, and the tools you already run your business on."}</p>
              <span className="cta-link">{lang === "fr" ? "En savoir plus" : "Learn more"} <ArrowRight className="chev h-4 w-4" /></span>
            </Link>
          </div>
        </div>
      </ScrollSection>

      {/* ── STORY BLOCKS (docs/mockups .stories/.split — locked, literal 3) ── */}
      <ScrollSection className="stories" id="platform">
        <div className="wrap">

          <div className="split" id="story-quotes">
            <div className="split-media">
              <QuoteDocPreview title="Quote_John_Smith.pdf" />
            </div>
            <div className="split-body">
              <span className="eyebrow">{lang === "fr" ? "Soumissions IA" : "AI Quotes"}</span>
              <h2>{lang === "fr" ? "D'un simple texte à un document professionnel." : "From a simple text to a professional document."}</h2>
              <p>
                {lang === "fr"
                  ? "Notre moteur d'IA comprend le langage naturel, identifie chaque poste de coût, estime les quantités et présente le tout dans un format standard, prêt à envoyer et à signer."
                  : "Our AI engine understands natural language, identifies each individual cost item, estimates quantities, and lays it all out in a standard format, ready to send and sign."}
              </p>
              <button onClick={() => navigate(isSignedIn ? "/dashboard/new" : "/sign-up")} className="cta-link">
                {lang === "fr" ? "Essayer maintenant" : "Try it now"} <ArrowRight className="chev h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="split rev" id="story-crm">
            <div className="split-media">
              <div className="bg-white rounded-xl border border-gray-100 shadow-md overflow-hidden w-full max-w-[420px]">
                <div className="border-b bg-gray-50 px-4 py-2.5 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  </div>
                  <div className="text-xs font-medium text-gray-400 ml-4">Job Site · Mario Rossi Renovation</div>
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Budget</div>
                      <div className="text-lg font-bold text-gray-900">$1,769.00</div>
                    </div>
                    <span className="chip chip-green">{lang === "fr" ? "En cours" : "In progress"}</span>
                  </div>
                  <div className="space-y-2 mb-4">
                    {[
                      { done: true, label: lang === "fr" ? "Visite et mesures" : "Site visit and measurements" },
                      { done: true, label: lang === "fr" ? "Matériaux commandés" : "Materials ordered (Rossi Hardware)" },
                      { done: false, label: lang === "fr" ? "Peinture des murs" : "Wall painting" },
                      { done: false, label: lang === "fr" ? "Enduit du salon" : "Living room skim coating" },
                    ].map((t) => (
                      <div key={t.label} className="flex items-center gap-2.5 text-sm">
                        <div className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 ${t.done ? "bg-navy-600" : "border border-gray-300"}`}>
                          {t.done && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <span className={t.done ? "text-gray-400 line-through" : "text-gray-700"}>{t.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Users className="h-3.5 w-3.5" />
                      {lang === "fr" ? "2 membres assignés" : "2 team members assigned"}
                    </div>
                    <span className="text-xs font-semibold text-navy-600">{lang === "fr" ? "Lié à la soumission" : "Linked to the quote"}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="split-body">
              <span className="eyebrow">{lang === "fr" ? "CRM intelligent" : "Smart CRM"}</span>
              <h2>{lang === "fr" ? "Une soumission acceptée devient un chantier." : "An accepted quote becomes a job site."}</h2>
              <p>
                {lang === "fr"
                  ? "Ouvrez le chantier en un clic depuis la soumission acceptée : client, montant et postes sont déjà liés. Organisez le travail en tâches, assignez votre équipe et vos fournisseurs, et gardez chaque coût extra rattaché au budget de départ."
                  : "Open the job site in one click from the accepted quote: client, amount, and line items are already linked. Organize the work into tasks, assign your team and suppliers, and keep every extra cost tied to the starting budget."}
              </p>
              <Link href="/dashboard/jobs" className="cta-link">
                {lang === "fr" ? "Voir la gestion de chantier" : "See job management"} <ArrowRight className="chev h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="split" id="story-invoicing">
            <div className="split-media">
              <div className="bg-white rounded-xl border border-gray-100 shadow-md overflow-hidden w-full max-w-[420px]">
                <div className="border-b bg-gray-50 px-4 py-2.5 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  </div>
                  <div className="text-xs font-medium text-gray-400 ml-4">Invoice_2024-042.pdf</div>
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-xs text-gray-400 uppercase tracking-wide font-semibold">{lang === "fr" ? "Facture" : "Invoice"} #2024-042</div>
                      <div className="text-lg font-bold text-gray-900">$1,769.00</div>
                    </div>
                    <span className="chip chip-teal">{lang === "fr" ? "Payée" : "Paid"}</span>
                  </div>
                  <div className="space-y-2 mb-4 text-sm text-gray-600">
                    <div className="flex justify-between"><span>{lang === "fr" ? "Soumission acceptée" : "Quote accepted"}</span><span className="text-gray-400">Jun 5</span></div>
                    <div className="flex justify-between"><span>{lang === "fr" ? "Facture envoyée" : "Invoice sent"}</span><span className="text-gray-400">Jun 5</span></div>
                    <div className="flex justify-between"><span>{lang === "fr" ? "Paiement reçu" : "Payment received"}</span><span className="text-gray-400">Jun 9</span></div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <DollarSign className="h-3.5 w-3.5" />
                      {lang === "fr" ? "Réglée par carte" : "Settled by card"}
                    </div>
                    <span className="text-xs font-semibold text-navy-600">{lang === "fr" ? "Lié à la soumission" : "Linked to the quote"}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="split-body">
              <span className="eyebrow">{lang === "fr" ? "Facturation & paiements" : "Invoicing & Payments"}</span>
              <h2>{lang === "fr" ? "Des factures qui se suivent toutes seules." : "Invoices that chase themselves."}</h2>
              <p>
                {lang === "fr"
                  ? "Dès qu'une soumission est acceptée, la facture correspondante est prête à envoyer — postes, taxes et montant déjà liés. Suivez les contrats et le budget de chaque chantier sans ressaisir une seule ligne."
                  : "The moment a quote is accepted, the matching invoice is ready to send — line items, tax, and amount already linked. Track contracts and each job's budget without retyping a single line."}
              </p>
              <Link href="/dashboard/invoices" className="cta-link">
                {lang === "fr" ? "Voir la facturation" : "See invoicing"} <ArrowRight className="chev h-4 w-4" />
              </Link>
            </div>
          </div>

        </div>
      </ScrollSection>

      {/* ── IMPACT (docs/mockups .impact — locked, literal; real live-counted numbers) ── */}
      <StatsBar />

      {/* ── NEWSROOM (docs/mockups .newsroom — locked, literal; real blog posts) ── */}
      <ScrollSection className="newsroom" id="newsroom">
        <div className="wrap">
          <div className="news-head">
            <div>
              <p className="eyebrow">{lang === "fr" ? "Blogue" : "Newsroom"}</p>
              <h2 className="sec-title">{lang === "fr" ? "Les dernières nouvelles de quoteai" : "The latest from quoteai"}</h2>
            </div>
            <Link href="/blog/" className="cta-link">{lang === "fr" ? "Voir tous les articles" : "View all articles"} <ArrowRight className="chev h-4 w-4" /></Link>
          </div>
          <div className="news-grid">
            {[...BLOG_ARTICLES].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 3).map((article) => (
              <Link key={article.slug} href={`/blog/${article.slug}/`} className="news-card">
                <div className="news-body">
                  <p className="news-meta">
                    {article.category} · {new Date(article.publishedAt).toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA", { year: "numeric", month: "long", day: "numeric" })}
                  </p>
                  <h3>{article.title}</h3>
                  <span className="cta-link">{lang === "fr" ? "Lire l'article" : "Read more"} <ArrowRight className="chev h-4 w-4" /></span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </ScrollSection>

      {/* ── TRIAL CTA (docs/mockups .trial — locked, literal) ── */}
      <ScrollSection className="trial on-dark" id="trial">
        <div className="wrap trial-in">
          <p className="eyebrow">{lang === "fr" ? "Commencer" : "Get started"}</p>
          <h2>{lang === "fr" ? "Prêt à transformer votre entreprise?" : "Ready to transform your business?"}</h2>
          <p>
            {lang === "fr"
              ? "Rejoignez des centaines d'entrepreneurs et d'artisans canadiens qui économisent des heures chaque semaine. Essai gratuit de 7 jours, sans carte de crédit."
              : "Join hundreds of Canadian contractors and tradespeople who save hours every week. 7-day free trial, no credit card required."}
          </p>
          <div className="trial-actions">
            <button onClick={() => navigate(isSignedIn ? "/dashboard/new" : "/sign-up")} className="btn btn-white">
              {lang === "fr" ? "Créez votre compte gratuit" : "Create your free account"}
            </button>
            <Link href="/whatsapp/" className="btn btn-outline-light">
              {lang === "fr" ? "Voir comment ça marche" : "See how it works"}
            </Link>
          </div>
          <p className="trial-note">{lang === "fr" ? "Sans carte de crédit · Annulez à tout moment" : "No credit card required · Cancel anytime"}</p>
        </div>
      </ScrollSection>
    </div>
  );
}
