import { Link, useLocation } from "wouter";
import { MarketingImage } from "@/components/marketing-image";
import { ArrowRight, Receipt, Shield, Zap } from "lucide-react";
import { SeoHead } from "@/components/seo-head";
import { RevealHeading } from "@/components/reveal-heading";
import { StatsBar } from "@/components/stats-bar";
import { TestimonialsSection } from "@/components/testimonials-section";
import { useScrollFade } from "@/hooks/use-scroll-fade";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/i18n/LanguageContext";
import { BLOG_INDEX } from "@/data/blog-index";
import { sectorLabel, localizedPath, PROVINCE_SLUG_PAIRS } from "@/data/seo-slugs";
import { PROVINCE_NAMES } from "@/lib/tax-profiles";
import { homepageJsonLd } from "@/data/json-ld";

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

/** The 18 real trade verticals, in the order they appear on their SEO pages. */
const TRADE_SLUGS = [
  "painter", "electrician", "plumber", "general-contractor", "renovation-contractor",
  "welder-fabricator", "carpenter-cabinetmaker", "hvac-technician", "freelance",
  "building-consultant", "mason", "landscaper", "tile-installer", "window-door-installer",
  "roofer", "air-conditioning-installer", "decorative-painter", "flooring-installer",
];

export default function Home() {
  const { isSignedIn } = useAuth();
  const { lang } = useLanguage();
  const [, navigate] = useLocation();

  const tradeLabel = (slug: string) => sectorLabel(slug, lang);

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Phase 80: this head IS the prerendered head — entry-server.tsx
          serialises it at build time, so crawler and hydrated page agree. */}
      <SeoHead
        title={
          lang === "fr"
            ? "quoteai – Soumissions instantanées pour entrepreneurs canadiens | IA en 30s"
            : "quoteai – Instant Quotes for Canadian Contractors | AI in 30s"
        }
        description={
          lang === "fr"
            ? "quoteai transforme une description en langage courant en une soumission chiffrée, personnalisée et taxée en 30 secondes — puis gère prospects, chantiers, contrats et factures jusqu'au paiement. Conçu pour les métiers canadiens."
            : "quoteai turns a plain-language job description into a priced, branded, tax-calculated quote in 30 seconds — then runs leads, job sites, contracts and invoices until you're paid. Built for Canadian trades."
        }
        canonical={lang === "fr" ? "https://quoteai.ca/fr/" : "https://quoteai.ca/"}
        lang={lang === "fr" ? "fr-CA" : "en-CA"}
        altCanonical={lang === "fr" ? "https://quoteai.ca/" : "https://quoteai.ca/fr/"}
        jsonLd={homepageJsonLd(lang)}
      />

      {/* ── HERO ───────────────────────────────────────────── */}
      <section className="hero on-dark" id="hero">
        <div className="wrap hero-grid">
          <div>
            <p className="eyebrow on-dark" style={{ marginBottom: 22 }}>
              {lang === "fr" ? "La plateforme IA pour les métiers canadiens" : "The AI-driven expert platform for Canadian trades"}
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
            <p className="lead">
              {lang === "fr"
                ? "Décrivez le travail dans vos propres mots — quoteai génère une soumission chiffrée avec taxes selon votre province. Puis ça continue : prospects, chantiers, contrats, factures, payé."
                : "Describe the job in your own words — quoteai generates a priced, branded quote with line items, quantities and GST/HST by province. Then it runs the rest of the path: leads, job sites, contracts, invoices, paid."}
            </p>
            <div className="hero-cta">
              <button onClick={() => navigate(isSignedIn ? "/dashboard/new" : "/sign-up")} className="btn btn-white">
                {lang === "fr" ? "Commencer gratuitement" : "Start for free"}
              </button>
              <Link href={lang === "fr" ? "/fr/tarifs/" : "/pricing/"} className="btn btn-outline-light">
                {lang === "fr" ? "Voir les forfaits" : "See plans"}
              </Link>
            </div>
            <p className="hero-note">
              {lang === "fr" ? "Essai gratuit de 7 jours · Sans carte de crédit · Bilingue FR / EN" : "7-day free trial · No credit card required · Bilingual FR / EN"}
            </p>
          </div>
          <div>
            <div className="doc-mock">
              <div className="dm-bar"><b>Quote_John_Smith.pdf</b><span className="chip chip-grey">PDF</span></div>
              <div className="dm-body">
                <div className="dm-co">
                  <span><b>Smith Painting Co.</b>GST/HST: 123456789 RT0001</span>
                  <span style={{ textAlign: "right" }}><b>{lang === "fr" ? "Soumission N. 2024-042" : "Quote N. 2024-042"}</b>Toronto, ON</span>
                </div>
                <div className="dm-row"><span>{lang === "fr" ? "A. Peinture des murs" : "A. Wall painting"}</span><span className="v">$1,200.00</span></div>
                <div className="dm-row"><span>{lang === "fr" ? "B. Enduit et préparation" : "B. Skim coating & prep"}</span><span className="v">$250.00</span></div>
                <div className="dm-tot">
                  <div className="dm-row"><span>{lang === "fr" ? "Sous-total" : "Subtotal"}</span><span className="v">$1,450.00</span></div>
                  <div className="dm-row"><span>HST (13%)</span><span className="v">$319.00</span></div>
                  <div className="dm-grand"><span>{lang === "fr" ? "Total" : "Total"}</span><b>$1,769.00</b></div>
                </div>
              </div>
              <div className="dm-chips">
                <span className="chip chip-green">{lang === "fr" ? "Taxes calculées" : "Tax calculated"}</span>
                <span className="chip chip-teal">{lang === "fr" ? "Générée en 30 sec" : "Generated in 30 sec"}</span>
                <span className="chip chip-grey">{lang === "fr" ? "Signature électronique incluse" : "E-signature built in"}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRODUCTS ───────────────────────────────────────── */}
      <ScrollSection className="sec" id="products">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <span className="eyebrow">{lang === "fr" ? "Nos produits" : "Our products"}</span>
              <h2 className="h2">{lang === "fr" ? "Une plateforme, du prospect au paiement." : "One platform, from lead to paid."}</h2>
            </div>
            <p className="lead">
              {lang === "fr"
                ? "Pas seulement un générateur de soumissions. Chaque étape d'un vrai chantier — prospect, soumission, chantier, contrat, facture, paiement — vit au même endroit, conçu pour les métiers canadiens."
                : "Not a one-trick quote generator. Every step a job actually flows through — lead, quote, job site, contract, invoice, payment — lives in one place, built for Canadian trades."}
            </p>
          </div>
          <div className="tiles">
            <Link href="#story-quotes" className="tile t-green">
              <h3>{lang === "fr" ? "Soumissions IA" : "AI Quotes"}</h3>
              <p>
                {lang === "fr"
                  ? "Décrivez le travail en langage courant — ou envoyez une note vocale WhatsApp ou une photo — et obtenez une soumission chiffrée avec postes, quantités et TPS/TVH par province en environ 30 secondes. Appuyée sur votre catalogue de prix, signée par signature électronique."
                  : "Describe the job in plain language — or send a WhatsApp voice note or photo — and get a priced, branded quote with line items, quantities and GST/HST by province in about 30 seconds. Backed by your price catalog, signed with e-signature."}
              </p>
              <span className="cta-link">{lang === "fr" ? "En savoir plus" : "Learn more"} <ArrowRight className="chev h-4 w-4" /></span>
            </Link>
            <Link href="#story-jobs" className="tile t-purple">
              <h3>{lang === "fr" ? "CRM et prospects" : "CRM & Leads"}</h3>
              <p>
                {lang === "fr"
                  ? "Les prospects entrants atterrissent dans un pipeline kanban avant de devenir des soumissions. Notez-les, relancez-les, et faites-les avancer jusqu'à signature sans un seul tableur."
                  : "Incoming leads land in a kanban pipeline before they become quotes. Score them, follow up, and move them to signed without a spreadsheet in sight."}
              </p>
              <span className="cta-link">{lang === "fr" ? "En savoir plus" : "Learn more"} <ArrowRight className="chev h-4 w-4" /></span>
            </Link>
            <Link href="#story-jobs" className="tile t-teal">
              <h3>{lang === "fr" ? "Chantiers" : "Job Sites"}</h3>
              <p>
                {lang === "fr"
                  ? "Une soumission acceptée devient un chantier : tâches avec échéances, équipe assignée, fournisseurs suivis et budget réel vs prévu — le tout lié à la soumission d'origine."
                  : "An accepted quote becomes a job: tasks with deadlines, team assignment, supplier tracking and budget vs actual — linked to the original quote."}
              </p>
              <span className="cta-link">{lang === "fr" ? "En savoir plus" : "Learn more"} <ArrowRight className="chev h-4 w-4" /></span>
            </Link>
            <Link href="#story-invoicing" className="tile t-yellow">
              <h3>{lang === "fr" ? "Facturation et paiements" : "Invoicing & Payments"}</h3>
              <p>
                {lang === "fr"
                  ? "Les factures sont générées depuis les soumissions ou chantiers acceptés, avec une vue client publique. Des rappels partent selon l'échéancier jusqu'au paiement."
                  : "Invoices generate from accepted quotes or jobs, with a public invoice view for clients. Reminders go out on schedule until it's paid."}
              </p>
              <span className="cta-link">{lang === "fr" ? "En savoir plus" : "Learn more"} <ArrowRight className="chev h-4 w-4" /></span>
            </Link>
            <Link href="#story-invoicing" className="tile t-green">
              <h3>{lang === "fr" ? "Contrats et documents" : "Contracts & Documents"}</h3>
              <p>
                {lang === "fr"
                  ? "Les contrats sont générés depuis les soumissions et chantiers acceptés. Chaque fichier, soumission, client et facture reste consultable dans une archive — suppression réversible incluse."
                  : "Contracts generate from accepted quotes and jobs. Every file, quote, client and invoice stays searchable in one archive — soft-delete included."}
              </p>
              <span className="cta-link">{lang === "fr" ? "En savoir plus" : "Learn more"} <ArrowRight className="chev h-4 w-4" /></span>
            </Link>
            <Link href="#products" className="tile t-purple">
              <h3>{lang === "fr" ? "Équipe, analytique et assistant" : "Team, Analytics & Assistant"}</h3>
              <p>
                {lang === "fr"
                  ? "Comptes multi-utilisateurs avec rôles et invitations, tableaux de bord de revenus, taux de conversion et délais, un assistant IA dans votre tableau de bord, et des imports pour vos listes de prix et clients existants."
                  : "Multi-user accounts with roles and invites, dashboards for revenue, win rate and turnaround, an AI assistant inside your dashboard, and imports for your existing price lists and client data."}
              </p>
              <span className="cta-link">{lang === "fr" ? "En savoir plus" : "Learn more"} <ArrowRight className="chev h-4 w-4" /></span>
            </Link>
          </div>
          <div className="also">
            <span className="lbl">{lang === "fr" ? "Aussi inclus" : "Also included"}</span>
            {(lang === "fr"
              ? ["Soumissions WhatsApp", "Signature électronique", "Catalogue de prix", "TPS/TVH par province", "Bilingue FR / EN", "Suivi du temps des employés", "Invitations d'équipe", "Imports de tableurs et PDF", "Documents et archive", "Assistant IA"]
              : ["WhatsApp quoting", "E-signature", "Price catalog", "GST/HST by province", "Bilingual FR / EN", "Worker time tracking", "Team invites", "Spreadsheet & PDF imports", "Documents & archive", "AI Assistant"]
            ).map((item) => (
              <span key={item} className="chip chip-grey">{item}</span>
            ))}
          </div>
        </div>
      </ScrollSection>

      {/* ── STORIES ────────────────────────────────────────── */}
      <ScrollSection className="sec soft">
        <div className="wrap">
          <div className="split" id="story-quotes">
            <div className="split-media">
              <MarketingImage slot="home-quotes" />
            </div>
            <div className="split-body">
              <span className="eyebrow">{lang === "fr" ? "Soumissions IA" : "AI Quotes"}</span>
              <h2>{lang === "fr" ? "D'une simple phrase à une soumission signée." : "From a plain sentence to a signed quote."}</h2>
              <p>
                {lang === "fr"
                  ? "Le moteur lit votre description, choisit les postes de coûts, estime les quantités et applique la taxe de votre province. Vous validez, le client signe électroniquement, et la demande d'acompte part le jour même."
                  : "The engine reads your description, picks the cost items, estimates quantities and applies your province's tax. You review, the client e-signs, and the deposit request goes out the same day."}
              </p>
              <button onClick={() => navigate(isSignedIn ? "/dashboard/new" : "/sign-up")} className="cta-link">
                {lang === "fr" ? "Explorer les soumissions IA" : "Explore AI Quotes"} <ArrowRight className="chev h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="split rev" id="story-jobs">
            <div className="split-media">
              <MarketingImage slot="home-jobs" />
            </div>
            <div className="split-body">
              <span className="eyebrow">{lang === "fr" ? "Chantiers" : "Job Sites"}</span>
              <h2>{lang === "fr" ? "Une soumission acceptée devient un chantier." : "An accepted quote becomes a job site."}</h2>
              <p>
                {lang === "fr"
                  ? "Ouvrez le chantier directement depuis la soumission signée — client, montant et postes déjà liés. Suivez les tâches, assignez votre équipe, notez les fournisseurs et surveillez le budget réel vs prévu."
                  : "Open the job straight from the signed quote — client, amount and line items already linked. Track tasks, assign your team, log suppliers and watch budget vs actual as costs land."}
              </p>
              <Link href="/dashboard/jobs" className="cta-link">
                {lang === "fr" ? "Explorer les chantiers" : "Explore job sites"} <ArrowRight className="chev h-4 w-4" />
              </Link>
            </div>
          </div>
          <div className="split" id="story-invoicing">
            <div className="split-media">
              <MarketingImage slot="home-invoicing" />
            </div>
            <div className="split-body">
              <span className="eyebrow">{lang === "fr" ? "Facturation et paiements" : "Invoicing & Payments"}</span>
              <h2>{lang === "fr" ? "Des factures qui se suivent toutes seules." : "Invoices that chase themselves."}</h2>
              <p>
                {lang === "fr"
                  ? "Générées depuis la soumission ou le chantier accepté, envoyées avec une vue client publique, rappelées poliment selon l'échéancier, et réconciliées une fois payées. Les contrats viennent de la même source de vérité."
                  : "Generated from the accepted quote or job, sent with a public client view, reminded politely on schedule, and reconciled when paid. Contracts come from the same source of truth."}
              </p>
              <Link href="/dashboard/invoices" className="cta-link">
                {lang === "fr" ? "Explorer la facturation" : "Explore invoicing"} <ArrowRight className="chev h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </ScrollSection>

      {/* ── WHATSAPP ───────────────────────────────────────── */}
      <ScrollSection className="sec" id="whatsapp">
        <div className="wrap">
          <div className="split">
            <div>
              <span className="chip chip-new">{lang === "fr" ? "Nouveau" : "New"}</span>
              <span className="eyebrow grey" style={{ marginLeft: 10 }}>{lang === "fr" ? "Directement depuis votre téléphone" : "Straight from your phone"}</span>
              <h2 className="h2" style={{ margin: "16px 0 14px" }}>{lang === "fr" ? "Tout le flux de soumission, sur WhatsApp." : "The whole quote flow, on WhatsApp."}</h2>
              <p className="lead">
                {lang === "fr"
                  ? "Note vocale, texte ou photo — l'assistant rédige la soumission, vous la corrigez ou l'approuvez dans le clavardage, et le PDF revient dans la conversation. Sauvegardé automatiquement dans votre compte. Aucune application à ouvrir."
                  : "Voice note, text or photo — the assistant drafts the quote, you correct or approve it in chat, and the PDF lands back in the conversation. Saved to your account automatically. No app to open."}
              </p>
              <Link href="/whatsapp/" className="cta-link" style={{ marginTop: 22 }}>
                {lang === "fr" ? "Voir la fonctionnalité complète" : "See the full feature"} <ArrowRight className="chev h-4 w-4" />
              </Link>
            </div>
            <div className="split-media">
              <MarketingImage slot="home-whatsapp" />
            </div>
          </div>
          <div className="steps3">
            <div className="step">
              <span className="n">1</span>
              <b>{lang === "fr" ? "Envoyez une note vocale, un texte ou une photo" : "Send a voice note, text, or photo"}</b>
              <p>{lang === "fr" ? "Directement sur WhatsApp. Décrivez le travail comme vous le feriez avec un client." : "Right on WhatsApp. Describe the job just like you'd talk to a client."}</p>
            </div>
            <div className="step">
              <span className="n">2</span>
              <b>{lang === "fr" ? "L'IA génère un aperçu" : "The AI generates a preview"}</b>
              <p>{lang === "fr" ? "Sections, prix et taxes en 60 secondes. Corrigez ou approuvez immédiatement." : "Sections, prices, and tax in 60 seconds. Correct or approve it right away."}</p>
            </div>
            <div className="step">
              <span className="n">3</span>
              <b>{lang === "fr" ? "Recevez le PDF dans le clavardage" : "Get the PDF in chat"}</b>
              <p>{lang === "fr" ? "Envoyez-le à votre client d'un geste. La soumission est aussi sauvegardée sur quoteai.ca." : "Send it to your client with a tap. The quote is also saved on quoteai.ca."}</p>
            </div>
          </div>
        </div>
      </ScrollSection>

      {/* ── COMPARISON ─────────────────────────────────────── */}
      <ScrollSection className="sec soft" id="comparison">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <span className="eyebrow grey">{lang === "fr" ? "Comparaison" : "Comparison"}</span>
              <h2 className="h2">{lang === "fr" ? "Comparaison honnête" : "Honest side-by-side"}</h2>
            </div>
            <p className="lead">
              {lang === "fr"
                ? "Les métiers achètent en fonction d'une question : est-ce que ça m'épargne les 30 minutes de paperasse? Voici comment quoteai se compare aux alternatives que vous connaissez déjà."
                : "Trades buy on one question: does it save me the 30 minutes of paperwork? Here is how quoteai compares to the alternatives you already know."}
            </p>
          </div>
          <div className="card cmp-wrap" tabIndex={0}>
            <table className="cmp">
              <thead>
                <tr>
                  <th>{lang === "fr" ? "Fonctionnalité" : "Feature"}</th>
                  <th className="q">quoteai</th>
                  <th>Jobber / Housecall Pro</th>
                  <th>Excel & Word</th>
                </tr>
              </thead>
              <tbody>
                {(lang === "fr" ? [
                  { f: "Soumission depuis une description en langage courant", q: "~30 secondes", j: "Non offert", e: "Manuel, 30–60 min" },
                  { f: "TPS/TVH canadienne par province", q: "Automatique", j: "Configuration manuelle", e: "Formules manuelles" },
                  { f: "Soumission par WhatsApp", q: "Inclus", j: "Non offert", e: "Impossible" },
                  { f: "Bilingue FR / EN", q: "Oui", j: "Limité", e: "Manuel" },
                  { f: "Prospect → soumission → chantier → facture → payé", q: "Une seule plateforme", j: "Modules et paliers payants", e: "Fichiers séparés" },
                  { f: "Temps jusqu'à la première soumission", q: "30 secondes", j: "Heures d'intégration", e: "Heures par document" },
                ] : [
                  { f: "Quote from a plain-language description", q: "~30 seconds", j: "Not offered", e: "Manual, 30–60 min" },
                  { f: "Canadian GST/HST by province", q: "Automatic", j: "Manual tax setup", e: "Manual formulas" },
                  { f: "Quoting over WhatsApp", q: "Built in", j: "Not offered", e: "Not possible" },
                  { f: "Bilingual FR / EN", q: "Yes", j: "Limited", e: "Manual" },
                  { f: "Lead → quote → job → invoice → paid", q: "One platform", j: "Modules & plan gates", e: "Separate files" },
                  { f: "Time to first quote", q: "30 seconds", j: "Hours of onboarding", e: "Hours per document" },
                ]).map((row) => (
                  <tr key={row.f}>
                    <td>{row.f}</td>
                    <td className="q">{row.q}</td>
                    <td>{row.j}</td>
                    <td>{row.e}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="cmp-cta">
            <button onClick={() => navigate(isSignedIn ? "/dashboard/new" : "/sign-up")} className="btn btn-navy">
              {lang === "fr" ? "Essayer quoteai gratuitement" : "Try quoteai for free"}
            </button>
          </div>
        </div>
      </ScrollSection>

      {/* ── IMPACT (real, live-counted numbers) ───────────────── */}
      <StatsBar />

      {/* ── NEWSROOM (real blog posts) ─────────────────────── */}
      <ScrollSection className="sec" id="newsroom">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <span className="eyebrow">{lang === "fr" ? "Salle de presse" : "Newsroom"}</span>
              <h2 className="h2">{lang === "fr" ? "Les dernières nouvelles de quoteai" : "The latest from quoteai"}</h2>
            </div>
            <Link href="/blog/" className="cta-link">{lang === "fr" ? "Voir tous les articles" : "View all news"} <ArrowRight className="chev h-4 w-4" /></Link>
          </div>
          <div className="news-grid">
            {[...BLOG_INDEX].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 3).map((article) => (
              <Link key={article.slug} href={`/blog/${article.slug}/`} className="card news-card">
                <div className="news-media">
                  <MarketingImage slot="news-card" seed={article.slug} />
                </div>
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

      {/* ── REVIEWS (real, verified testimonials) ─────────────── */}
      <TestimonialsSection />

      {/* ── GUIDES ─────────────────────────────────────────── */}
      <ScrollSection className="sec" id="guides">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <span className="eyebrow grey">{lang === "fr" ? "Guides" : "Guides"}</span>
              <h2 className="h2">{lang === "fr" ? "Fini les tableurs. Oubliez Excel et Word." : "No more spreadsheets. Forget Excel and Word."}</h2>
            </div>
            <p className="lead">
              {lang === "fr"
                ? "Les modèles Excel se brisent. Les documents Word ne calculent rien. Avec quoteai, vous décrivez le travail dans vos propres mots et en 30 secondes vous avez un document professionnel prêt à envoyer."
                : "Excel templates break. Word documents don't calculate. With quoteai you describe the job in your own words and in 30 seconds you have a professional document ready to send."}
            </p>
          </div>
          <div className="news-grid">
            {(lang === "fr" ? [
              { slug: "excel-template", chip: "chip-green", badge: "vs Excel", title: "Alternative à une soumission Excel", desc: "Pas de formules. Pas d'erreurs. Juste des résultats.", seed: "quoteai-guide-excel" },
              { slug: "word-template", chip: "chip-teal", badge: "vs Word", title: "Alternative à un modèle Word", desc: "PDF professionnel en un clic, sans mise en page manuelle.", seed: "quoteai-guide-word" },
              { slug: "how-to-quote", chip: "chip-purple", badge: "Guide", title: "Comment rédiger une soumission", desc: "Un guide pratique pour les entrepreneurs et petites entreprises canadiennes.", seed: "quoteai-guide-howto" },
            ] : [
              { slug: "excel-template", chip: "chip-green", badge: "vs Excel", title: "Alternative to an Excel quote", desc: "No formulas. No errors. Just results.", seed: "quoteai-guide-excel" },
              { slug: "word-template", chip: "chip-teal", badge: "vs Word", title: "Alternative to a Word template", desc: "Professional PDF in one click, no manual formatting.", seed: "quoteai-guide-word" },
              { slug: "how-to-quote", chip: "chip-purple", badge: "Guide", title: "How to write a quote", desc: "A practical guide for Canadian contractors and small businesses.", seed: "quoteai-guide-howto" },
            ]).map((g) => (
              <Link key={g.slug} href={localizedPath(`/quotes/${g.slug}/`, lang)} className="card news-card">
                <div className="news-media">
                  <MarketingImage slot="guide-card" seed={g.seed} />
                </div>
                <div className="news-body">
                  <p><span className={`chip ${g.chip}`}>{g.badge}</span></p>
                  <h3>{g.title}</h3>
                  <p>{g.desc}</p>
                  <span className="cta-link">{lang === "fr" ? "En savoir plus" : "Learn more"} <ArrowRight className="chev h-4 w-4" /></span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </ScrollSection>

      {/* ── TRADES & CITIES ────────────────────────────────── */}
      <ScrollSection className="sec soft" id="trades">
        <div className="wrap">
          <div className="sec-head" style={{ justifyContent: "center", textAlign: "center", flexDirection: "column", alignItems: "center" }}>
            <span className="eyebrow grey">{lang === "fr" ? "Couverture" : "Coverage"}</span>
            <h2 className="h2">{lang === "fr" ? "Des soumissions pour chaque métier et ville" : "Quotes for every trade and city"}</h2>
            <p className="lead" style={{ marginInline: "auto" }}>
              {lang === "fr"
                ? "Dix-huit métiers avec leur propre vocabulaire, croisés avec 15+ villes canadiennes pour des pages locales — chacune appliquant automatiquement les règles de taxe de votre province."
                : "Eighteen trade verticals with their own vocabulary, crossed with 15+ Canadian cities for local pages — each applying your province's tax rules automatically."}
            </p>
          </div>
        </div>
        <div className="marquee">
          <div className="mq-track">
            {[...TRADE_SLUGS, ...TRADE_SLUGS].map((slug, i) => (
              <Link key={`${slug}-${i}`} href={localizedPath(`/quotes/${slug}/`, lang)} className="wm">{tradeLabel(slug)}</Link>
            ))}
          </div>
        </div>
        <div className="wrap">
          <div className="cov-note">
            <span className="chip chip-green">{lang === "fr" ? "18 métiers" : "18 trade verticals"}</span>
            <span className="chip chip-teal">{lang === "fr" ? "15+ villes canadiennes" : "15+ Canadian cities"}</span>
            <span className="chip chip-grey">{lang === "fr" ? "Bilingue FR / EN" : "Bilingual FR / EN"}</span>
            <span className="chip chip-grey">{lang === "fr" ? "TPS/TVH par province" : "GST/HST by province"}</span>
          </div>
          {/* Phase 81 — the three pilot provinces, each with its own page. */}
          <div className="cov-note" style={{ marginTop: 14 }}>
            {PROVINCE_SLUG_PAIRS.map((p) => (
              <Link key={p.code} href={lang === "fr" ? `/fr/provinces/${p.fr}/` : `/provinces/${p.en}/`} className="wm">
                {PROVINCE_NAMES[p.code][lang]}
              </Link>
            ))}
          </div>
        </div>
      </ScrollSection>

      {/* ── DEEP DIVE ──────────────────────────────────────── */}
      <ScrollSection className="sec" id="deep-dive">
        <div className="wrap">
          <div className="split" style={{ paddingTop: 0 }}>
            <div>
              <span className="eyebrow grey">{lang === "fr" ? "Analyse approfondie" : "Deep dive"}</span>
              <h2 className="h2" style={{ margin: "14px 0 16px" }}>{lang === "fr" ? "Qu'est-ce que quoteai et à qui ça s'adresse" : "What is quoteai and who it's for"}</h2>
              <p className="lead">
                {lang === "fr"
                  ? "quoteai est un logiciel canadien qui utilise l'intelligence artificielle pour transformer une description en langage courant en une soumission complète et professionnelle. Conçu pour les entrepreneurs, artisans qualifiés et petites entreprises qui envoient des soumissions chaque semaine — peintres, électriciens, plombiers, maçons, métalliers, menuisiers, entreprises de rénovation, et tous les métiers de la construction et du mécanique/électrique. L'objectif : réduire le temps de préparation d'une soumission de 30-60 minutes à 30 secondes, sans sacrifier la qualité du document final."
                  : "quoteai is a Canadian software that uses artificial intelligence to turn a plain-language description into a complete, professional quote. It's built for contractors, skilled tradespeople, and small businesses that send client quotes every week — painters, electricians, plumbers, masons, metalworkers, carpenters, renovation companies, and every trade in construction and mechanical/electrical work. The goal is simple: cut the time it takes to put together a quote from 30-60 minutes down to 30 seconds, without giving up the quality of the final document."}
              </p>
            </div>
            <div className="dd-feats">
              <div className="dd-feat">
                <span className="fi g"><Receipt className="h-5 w-5" /></span>
                <div>
                  <b>{lang === "fr" ? "Taxes canadiennes intégrées" : "Built-in Canadian tax"}</b>
                  <p>{lang === "fr" ? "Calcul automatique de la TPS/TVH selon la province." : "Automatic GST/HST calculation by province."}</p>
                </div>
              </div>
              <div className="dd-feat">
                <span className="fi t"><Shield className="h-5 w-5" /></span>
                <div>
                  <b>{lang === "fr" ? "Données stockées en sécurité" : "Securely stored data"}</b>
                  <p>{lang === "fr" ? "Stripe gère les paiements, les sessions sont protégées par des cookies chiffrés." : "Stripe handles payments, sessions are protected with encrypted cookies."}</p>
                </div>
              </div>
              <div className="dd-feat">
                <span className="fi p"><Zap className="h-5 w-5" /></span>
                <div>
                  <b>{lang === "fr" ? "IA formée pour les métiers" : "AI trained for the trades"}</b>
                  <p>{lang === "fr" ? "Vocabulaire technique pour la construction et les métiers mécaniques." : "Technical vocabulary for construction and mechanical trades."}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="dd-grid">
            <div className="card dd-card">
              <h3>{lang === "fr" ? "Comment ça fonctionne concrètement" : "How it actually works"}</h3>
              <p>
                {lang === "fr"
                  ? "Ouvrez quoteai sur votre téléphone directement sur le chantier, ou de la maison le soir. Décrivez le travail comme vous l'expliqueriez à un collègue : « Peindre un appartement de 800 pi², deux couches de peinture lavable blanche, enduire le mur de la salle de bain. » En trente secondes, le moteur d'IA construit une soumission organisée en sections, avec postes de coûts, unités de mesure, prix unitaires au taux du marché, et calcul automatique des taxes. Vous pouvez modifier chaque ligne, utiliser votre propre liste de prix, et ajouter ou retirer des sections."
                  : "Open quoteai on your phone right on the job site, or from home in the evening. Describe the job the way you'd explain it to a coworker: \"Paint an 800 sq ft apartment, two coats of white washable paint, skim-coat the bathroom wall.\" In thirty seconds the AI engine builds a quote organized into sections, with cost items, units of measure, market-rate unit prices, and automatic tax calculation. You can edit every line item, swap in your own price list, and add or remove sections."}
              </p>
            </div>
            <div className="card dd-card">
              <h3>{lang === "fr" ? "Pourquoi c'est mieux qu'Excel ou les logiciels traditionnels" : "Why it works better than Excel or traditional software"}</h3>
              <p>
                {lang === "fr"
                  ? "Les logiciels de soumission traditionnels sont conçus pour le bureau : installation, configuration initiale des listes de prix, heures de formation. Excel est gratuit mais vous force à repartir d'une feuille vide chaque fois. quoteai élimine ces deux problèmes : rien à installer, rien à configurer au départ, et chaque soumission est structurée dès le départ. En moyenne, nos utilisateurs rapportent économiser 4 à 6 heures par semaine."
                  : "Traditional quoting software is built for the office: it requires installation, an upfront setup of price lists and codes, and hours of training. Excel is free but forces you to start from a blank sheet every single time. quoteai removes both problems: there's nothing to install, nothing to configure up front, and every quote is structured from the start. On average, our users report saving 4-6 hours a week."}
              </p>
            </div>
            <div className="card dd-card">
              <h3>{lang === "fr" ? "Sécurité et conformité fiscale canadienne" : "Security and Canadian tax compliance"}</h3>
              <p>
                {lang === "fr"
                  ? "Toutes les données sont stockées sur une infrastructure sécurisée et chiffrée, les sessions sont protégées par des cookies chiffrés, et les paiements sont traités via Stripe. La TPS/TVH est calculée automatiquement selon votre province. Vos informations d'entreprise sont enregistrées une seule fois et appliquées automatiquement à chaque soumission."
                  : "All data is stored on secure, encrypted infrastructure, sessions are protected with encrypted cookies, and payments are processed through Stripe. Tax handling follows Canadian rules: GST/HST is calculated automatically based on your province. Your business details are saved once and applied to every quote automatically."}
              </p>
            </div>
            <div className="card dd-card" id="plans">
              <h3>{lang === "fr" ? "Combien ça coûte pour commencer" : "What it costs to get started"}</h3>
              <p>
                {lang === "fr"
                  ? "L'inscription est gratuite, et votre première soumission est générée sans carte de crédit. Ensuite : payez à l'unité (5 $ à 13 $), ou démarrez un abonnement mensuel (Starter 19 $ avec 10 soumissions, Pro 49 $ avec 60 soumissions, Elite 59 $ illimité) — ou payez à l'année et obtenez deux mois gratuits. Modifiez ou annulez votre forfait à tout moment."
                  : "Signing up is free, and your first quote is generated without entering a credit card. From there you can choose: pay for a single quote ($5 to $13) when you need one, or start a monthly subscription (Starter $19 with 10 quotes, Pro $49 with 60 quotes, Elite $59 unlimited) — or pay yearly and get two months free. You can change or cancel your plan at any time from your account."}
              </p>
              <Link href={lang === "fr" ? "/fr/tarifs/" : "/pricing/"} className="cta-link" style={{ marginTop: 14 }}>
                {lang === "fr" ? "Voir la page des tarifs" : "See the full pricing page"} <ArrowRight className="chev h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </ScrollSection>

      {/* ── CTA ────────────────────────────────────────────── */}
      <ScrollSection className="cta on-dark" id="trial">
        <div className="cta-bg">
          <MarketingImage slot="cta-home" />
        </div>
        <div className="wrap cta-in">
          <span className="eyebrow on-dark">{lang === "fr" ? "Commencer" : "Get started"}</span>
          <h2>{lang === "fr" ? "Prêt à transformer votre entreprise?" : "Ready to transform your business?"}</h2>
          <p>
            {lang === "fr"
              ? "Rejoignez des centaines d'entrepreneurs et d'artisans canadiens qui économisent des heures chaque semaine."
              : "Join hundreds of Canadian contractors and tradespeople who save hours every week."}
          </p>
          <div className="cta-actions">
            <button onClick={() => navigate(isSignedIn ? "/dashboard/new" : "/sign-up")} className="btn btn-white">
              {lang === "fr" ? "Créez votre compte gratuit" : "Create your free account"}
            </button>
            <Link href={lang === "fr" ? "/fr/tarifs/" : "/pricing/"} className="btn btn-outline-light">
              {lang === "fr" ? "Voir les forfaits" : "See plans"}
            </Link>
          </div>
          <p className="cta-fine">
            {lang === "fr" ? "Essai gratuit de 7 jours · Sans carte de crédit · Soumissions à l'unité dès 5 $" : "7-day free trial · No credit card required · Single quotes from $5"}
          </p>
        </div>
      </ScrollSection>
    </div>
  );
}
