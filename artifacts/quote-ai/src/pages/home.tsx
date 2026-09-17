import { lazy, Suspense, useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, CheckCircle2, FileText, Zap, Lock, Star, Sparkles, Check, X, Loader2, ChevronDown, Shield, Cpu, DollarSign, Users } from "lucide-react";
import { SeoHead } from "@/components/seo-head";
import { TestimonialsSection } from "@/components/testimonials-section";
import { RevealHeading } from "@/components/reveal-heading";
import { StatsBar } from "@/components/stats-bar";
import { useGetPlans, useCreateCheckoutSession } from "@workspace/api-client-react";
import { useScrollFade } from "@/hooks/use-scroll-fade";
import { useAuth } from "@/hooks/use-auth";
import { WhatsAppChatDemo } from "@/components/whatsapp-chat-demo";
import { TRADE_LABELS } from "@/i18n/translations";
import { useLanguage } from "@/i18n/LanguageContext";
import { SECTORS } from "@/data/seo-data";
import { cityBasePath } from "@/data/seo-render-engine";
import { BLOG_ARTICLES } from "@/data/blog-data";
const DemoPlayer = lazy(() => import("@/components/demo/DemoPlayer"));

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

export default function Home() {
  const { data: plans } = useGetPlans();
  const { isSignedIn } = useAuth();
  const { lang } = useLanguage();
  const base = cityBasePath(lang === "fr" ? "fr-CA" : "en-CA");
  const [, navigate] = useLocation();
  const [homepageInput, setHomepageInput] = useState("");
  const homepageInputRef = useRef<HTMLInputElement>(null);
  const [sectorsOpen, setSectorsOpen] = useState(false);
  const heroDocRef = useRef<HTMLDivElement>(null);

  const handleHeroMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = heroDocRef.current;
    if (!el) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.animationPlayState = "paused";
    el.style.transform = `rotateY(${-14 + x * 18}deg) rotateX(${8 - y * 14}deg) translateY(-8px)`;
  };
  const handleHeroLeave = () => {
    const el = heroDocRef.current;
    if (!el) return;
    el.style.transform = "";
    el.style.animationPlayState = "running";
  };

  const plansArray = Array.isArray(plans) ? plans : [];
  const subscriptionPlans = plansArray.filter((p) => p.interval);
  const oneshotPlans = plansArray.filter((p) => !p.interval);
  const createCheckout = useCreateCheckoutSession();
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);

  const handlePlanClick = (planId: string) => {
    if (!isSignedIn) {
      navigate(`/sign-up?plan=${planId}`);
      return;
    }
    setLoadingPlanId(planId);
    createCheckout.mutate(
      { data: { planType: planId as "monthly_starter" | "monthly_pro" | "monthly_elite" | "oneshot_watermark" | "oneshot_clean" } },
      {
        onSuccess: (r) => {
          window.location.href = r.url;
        },
        onError: () => {
          setLoadingPlanId(null);
        },
      }
    );
  };

  const handleHomepageSubmit = () => {
    const trimmed = homepageInput.trim();
    if (!trimmed) return;
    sessionStorage.setItem("quoteai:homepage_prompt", trimmed);
    navigate(isSignedIn ? "/dashboard/new" : "/sign-up?next=/dashboard/new");
  };

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
      <section className="hero on-dark" id="hero" onMouseMove={handleHeroMove} onMouseLeave={handleHeroLeave}>
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

          {/* Product screenshot in the hero-media slot (no stock photography) */}
          <div className="hero-3d-stage hidden lg:flex justify-center items-center relative h-[420px]">
            <div ref={heroDocRef} className="hero-doc relative w-[320px]">
              <div className="absolute -bottom-12 left-8 right-8 h-8 rounded-[50%] bg-black/25 blur-xl" style={{ transform: "translateZ(-60px)" }} />
              <div className="hero-doc-layer rounded-2xl overflow-hidden border border-gray-100 shadow-2xl bg-white">
                <div className="bg-gray-900 px-3 py-2 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  </div>
                  <div className="text-[10px] font-medium text-gray-400 ml-2">Quote_John_Smith.pdf</div>
                </div>
                <div className="bg-white text-black text-[9px] p-4 select-none">
                  <div className="flex justify-between items-start border-b-2 border-slate-800 pb-2.5 mb-2.5">
                    <div>
                      <div className="font-bold text-slate-800 text-[11px]">Smith Painting Co.</div>
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
                        <th className="py-0.5 px-1.5 text-left text-[8px] font-semibold">Section</th>
                        <th className="py-0.5 px-1.5 text-right text-[8px] font-semibold">Net amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td className="py-0.5 px-1.5 text-slate-700">A. Wall painting</td><td className="py-0.5 px-1.5 text-right font-medium text-slate-800">$1,200.00</td></tr>
                      <tr className="bg-slate-50"><td className="py-0.5 px-1.5 text-slate-700">B. Skim coating & prep</td><td className="py-0.5 px-1.5 text-right font-medium text-slate-800">$250.00</td></tr>
                    </tbody>
                  </table>
                  <div className="flex justify-end">
                    <div className="w-44 border border-slate-200 rounded overflow-hidden">
                      <div className="flex justify-between px-2 py-0.5 text-slate-600 border-b border-slate-100 text-[9px]"><span>Subtotal:</span><span className="font-medium">$1,450.00</span></div>
                      <div className="flex justify-between px-2 py-0.5 text-slate-600 border-b border-slate-100 text-[9px]"><span>HST (13%):</span><span className="font-medium">$319.00</span></div>
                      <div className="flex justify-between px-2 py-1 bg-slate-800 text-white font-bold text-[10px]"><span>TOTAL</span><span>$1,769.00</span></div>
                    </div>
                  </div>
                </div>
              </div>
              {/* floating chips */}
              <div className="hero-float-chip absolute -left-16 top-10 bg-white rounded-xl border border-gray-100 shadow-lg px-3 py-2 flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-emerald-50 flex items-center justify-center"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /></div>
                <div className="text-[11px] font-semibold text-gray-700">Tax calculated</div>
              </div>
              <div className="hero-float-chip absolute -right-14 top-40 bg-white rounded-xl border border-gray-100 shadow-lg px-3 py-2 flex items-center gap-2" style={{ animationDelay: "-2s" }}>
                <div className="h-6 w-6 rounded-lg bg-navy-50 flex items-center justify-center"><Sparkles className="h-3.5 w-3.5 text-navy-500" /></div>
                <div className="text-[11px] font-semibold text-gray-700">Generated in 30 sec</div>
              </div>
              <div className="hero-float-chip absolute -left-10 bottom-2 bg-white rounded-xl border border-gray-100 shadow-lg px-3 py-2 flex items-center gap-2" style={{ animationDelay: "-3.2s" }}>
                <div className="h-6 w-6 rounded-lg bg-teal-50 flex items-center justify-center"><DollarSign className="h-3.5 w-3.5 text-teal-500" /></div>
                <div className="text-[11px] font-semibold text-gray-700">$1,769.00 total</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 1BIS: Product tiles ───────────────────────── */}
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
              <span className="cta-link">{lang === "fr" ? "En savoir plus" : "Learn more"} <ArrowRight className="h-4 w-4" /></span>
            </Link>
            <Link href="#story-crm" className="tile tile-purple">
              <Users className="h-6 w-6" />
              <h3>{lang === "fr" ? "CRM intelligent" : "Smart CRM"}</h3>
              <p>{lang === "fr" ? "Chaque soumission acceptée devient un chantier avec tâches, équipe et fournisseurs suivis dans un seul pipeline." : "Every accepted quote becomes a job site — tasks, team members, and suppliers tracked in a single pipeline."}</p>
              <span className="cta-link">{lang === "fr" ? "En savoir plus" : "Learn more"} <ArrowRight className="h-4 w-4" /></span>
            </Link>
            <Link href="#story-invoicing" className="tile tile-teal">
              <DollarSign className="h-6 w-6" />
              <h3>{lang === "fr" ? "Facturation & paiements" : "Invoicing & Payments"}</h3>
              <p>{lang === "fr" ? "Les soumissions acceptées deviennent des factures instantanément, avec contrats et suivi de budget en continu." : "Accepted quotes become invoices instantly, with contracts and budget tracking that stay in sync."}</p>
              <span className="cta-link">{lang === "fr" ? "En savoir plus" : "Learn more"} <ArrowRight className="h-4 w-4" /></span>
            </Link>
            <Link href="/whatsapp/" className="tile tile-yellow">
              <Zap className="h-6 w-6" />
              <h3>{lang === "fr" ? "Intégrations" : "Integrations"}</h3>
              <p>{lang === "fr" ? "WhatsApp, imports de tableurs, et les outils que vous utilisez déjà pour gérer votre entreprise." : "WhatsApp, spreadsheet imports, and the tools you already run your business on."}</p>
              <span className="cta-link">{lang === "fr" ? "En savoir plus" : "Learn more"} <ArrowRight className="h-4 w-4" /></span>
            </Link>
          </div>
        </div>
      </ScrollSection>

      {/* ── SECTION 3/4/5: Story splits (AI Quotes / Smart CRM / Invoicing — locked, literal 3) ── */}
      <ScrollSection className="stories" id="platform">
        <div className="wrap">

          <div className="split" id="story-quotes">
            <div className="split-media">
              <div className="bg-white rounded-xl border border-gray-100 shadow-md overflow-hidden flex flex-col w-full max-w-[420px]">
                <div className="border-b bg-gray-50 px-4 py-2.5 flex items-center gap-2 shrink-0">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  </div>
                  <div className="text-xs font-medium text-gray-400 ml-4">Quote_John_Smith.pdf</div>
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
            </div>
            <div className="split-body">
              <span className="eyebrow">{lang === "fr" ? "Soumissions IA" : "AI Quotes"}</span>
              <h2>{lang === "fr" ? <>D'un simple texte à un <span className="gradient-text">document professionnel</span>.</> : <>From a simple text to a <span className="gradient-text">professional document</span>.</>}</h2>
              <div className="bg-gray-50 p-4 rounded-xl mb-4 font-mono text-xs border border-gray-100 text-gray-700">
                {lang === "fr"
                  ? "« Je dois peindre un appartement de 800 pi² avec deux couches de peinture lavable blanche. Il faut aussi refaire l'enduit d'un mur endommagé au salon. »"
                  : "\"I need to paint an 800 sq ft apartment with two coats of white washable paint. Also include skim-coating a damaged wall in the living room.\""}
              </div>
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
              <span className="eyebrow">{lang === "fr" ? "CRM intelligent · Inclus dans tous les forfaits" : "Smart CRM · Included in every plan"}</span>
              <h2>{lang === "fr" ? <>Une soumission acceptée <span className="text-navy-600">devient un chantier</span>.</> : <>An accepted quote <span className="text-navy-600">becomes a job site</span>.</>}</h2>
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
              <h2>{lang === "fr" ? <>Des factures qui se <span className="text-navy-600">suivent toutes seules</span>.</> : <>Invoices that <span className="text-navy-600">chase themselves</span>.</>}</h2>
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

      {/* ── Impact: real, live-counted stats (docs/mockups .impact band) ── */}
      <StatsBar />

      {/* ── Newsroom: latest real blog posts ──────────────────── */}
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

      {/* ── Trial CTA band (docs/mockups .trial — locked position: right after newsroom) ── */}
      <ScrollSection className="trial on-dark" id="trial">
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #0f0f1a 0%, #1a0a2e 55%, #0a1628 100%)" }}>
          <div className="mesh-blob mesh-blob-1" style={{ opacity: 0.6 }} />
          <div className="mesh-blob mesh-blob-2" style={{ opacity: 0.6 }} />
        </div>
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
            <Link href="#pricing" className="btn btn-outline-light">
              {lang === "fr" ? "Voir les forfaits" : "See plans"}
            </Link>
          </div>
          <p className="trial-note">{lang === "fr" ? "Sans carte de crédit · Annulez à tout moment" : "No credit card required · Cancel anytime"}</p>
        </div>
      </ScrollSection>

      {/* ── Appended below the locked structure (per user decision): everything the
          mockup doesn't have a slot for, reskinned into the same vocabulary rather
          than dropped — try-it bar + demo video, WhatsApp integrations, pricing,
          comparison table, testimonials, guides, sectors accordion, SEO deep-dive. ── */}

      {/* Try it yourself + demo video */}
      <ScrollSection className="py-16 bg-white">
        <div className="wrap">
          <div className="text-center max-w-xl mx-auto mb-8">
            <p className="eyebrow">{lang === "fr" ? "Essayez-le" : "Try it yourself"}</p>
            <h2 className="sec-title !text-[1.9rem]">{lang === "fr" ? "Décrivez le travail, obtenez une soumission" : "Describe the job, get a quote"}</h2>
          </div>
          <div className="ai-bar-glow flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm focus-within:border-navy-400 focus-within:ring-2 focus-within:ring-navy-100 transition-all max-w-lg mx-auto mb-3">
            <Sparkles className="h-4 w-4 text-navy-400 shrink-0" />
            <input
              ref={homepageInputRef}
              value={homepageInput}
              onChange={(e) => setHomepageInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && homepageInput.trim()) handleHomepageSubmit(); }}
              placeholder={lang === "fr" ? "Décrivez le travail et obtenez une soumission en 30 secondes..." : "Describe the job and get a quote in 30 seconds..."}
              className="flex-1 text-sm outline-none placeholder:text-gray-400 text-gray-800 bg-transparent min-w-0"
            />
            <button
              onClick={handleHomepageSubmit}
              disabled={!homepageInput.trim()}
              className="shrink-0 btn-gradient inline-flex h-8 w-8 items-center justify-center rounded-xl disabled:opacity-40 transition-all"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-gray-400 text-center mb-10">{lang === "fr" ? "Essai gratuit de 7 jours · Sans carte de crédit" : "7-day free trial · No credit card required"}</p>

          <div className="max-w-3xl mx-auto">
            <div className="rounded-xl overflow-hidden border border-gray-100 shadow-md flex flex-col">
              <div className="bg-gray-900 px-3 py-2 flex items-center gap-2 shrink-0">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                </div>
                <div className="text-[11px] font-medium text-gray-400 ml-2">quoteai.ca — demo</div>
              </div>
              <div style={{ aspectRatio: "16/9", position: "relative", overflow: "hidden" }}>
                <Suspense fallback={<div className="w-full h-full bg-gray-950 flex items-center justify-center"><div className="w-8 h-8 border-2 border-navy-500 border-t-transparent rounded-full animate-spin" /></div>}>
                  <div className="absolute inset-0" style={{ transform: "scale(1)", transformOrigin: "top left", width: "100%", height: "100%" }}>
                    <DemoPlayer loop={true} />
                  </div>
                </Suspense>
              </div>
            </div>
            <p className="text-xs text-gray-400 text-center mt-3">{lang === "fr" ? "Démo en direct — aucun effet, aucun montage" : "Live demo — no effects, no editing"}</p>
          </div>
        </div>
      </ScrollSection>

      {/* WhatsApp / Integrations (reuses the locked .stories/.split vocabulary, outside the primary 3-split structure) */}
      <ScrollSection className="stories">
        <div className="wrap">
          <div className="split rev" id="story-whatsapp">
            <div className="split-media">
              <WhatsAppChatDemo />
            </div>
            <div className="split-body">
              <span className="eyebrow">{lang === "fr" ? "Intégrations" : "Integrations"}</span>
              <h2>{lang === "fr" ? <>D'une note vocale au PDF <span className="text-navy-600">sans toucher un ordinateur</span>.</> : <>From voice note to PDF <span className="text-navy-600">without touching a computer</span>.</>}</h2>
              <div className="space-y-4 mb-6">
                {(lang === "fr" ? [
                  { num: "1", title: "Envoyez une note vocale, un texte ou une photo", desc: "Directement sur WhatsApp." },
                  { num: "2", title: "L'IA génère un aperçu", desc: "Sections, prix et taxes en 60 secondes." },
                  { num: "3", title: "Recevez le PDF dans le clavardage", desc: "Envoyez-le d'un geste, sauvegardé sur quoteai.ca." },
                ] : [
                  { num: "1", title: "Send a voice note, text, or photo", desc: "Right on WhatsApp." },
                  { num: "2", title: "The AI generates a preview", desc: "Sections, prices, and tax in 60 seconds." },
                  { num: "3", title: "Get the PDF in chat", desc: "Send it with a tap, saved on quoteai.ca." },
                ]).map((s) => (
                  <div key={s.num} className="flex gap-3">
                    <div className="w-7 h-7 rounded-lg text-xs font-bold shrink-0 flex items-center justify-center text-white bg-navy-700">{s.num}</div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{s.title}</p>
                      <p className="text-sm text-gray-500">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/whatsapp/" className="cta-link">
                {lang === "fr" ? "Voir la fonctionnalité complète" : "See the full feature"} <ArrowRight className="chev h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </ScrollSection>

      {/* ── SECTION 6: Pricing ─────────────────────────────────── */}
      <ScrollSection className="py-16 bg-white" id="pricing">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-xl font-semibold text-gray-900">
              {lang === "fr" ? "Des forfaits simples et transparents" : "Simple, Transparent Plans"}
            </h2>
            <p className="mt-2 text-sm text-gray-500 max-w-xl mx-auto leading-relaxed">
              {lang === "fr" ? "Essai gratuit de 7 jours inclus — sans carte de crédit." : "7-day free trial included — no credit card required."}
            </p>
          </div>

          {/* Subscription plans */}
          <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto mb-8">
            {subscriptionPlans.map((plan) => {
              const isPro = plan.id === "monthly_pro";
              const isElite = plan.id === "monthly_elite";
              const isStarter = plan.id === "monthly_starter";
              return (
                <div
                  key={plan.id}
                  className={`plan-card-enter card-soft bg-white rounded-xl p-6 flex flex-col relative transition-all duration-300 ${
                    isPro
                      ? "border-2 border-navy-300 shadow-lg shadow-navy-200/40"
                      : isElite
                        ? "border-2 border-amber-300"
                        : "border border-gray-200"
                  }`}
                >
                  {isPro && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="text-[10px] font-semibold text-navy-600 bg-navy-50 px-2 py-0.5 rounded-full whitespace-nowrap border border-navy-100">
                        ⭐ {lang === "fr" ? "Le plus populaire" : "Most Popular"}
                      </span>
                    </div>
                  )}
                  {isElite && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full whitespace-nowrap border border-amber-100">
                        👑 {lang === "fr" ? "Illimité" : "Unlimited"}
                      </span>
                    </div>
                  )}

                  <div className="mb-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mb-1.5 inline-block ${
                      isPro ? "bg-navy-100 text-navy-700" : isElite ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {plan.name}
                    </span>
                    <div className="flex items-end gap-1">
                      <span className="text-2xl font-bold text-gray-900">${plan.price}</span>
                      <span className="text-gray-400 text-xs mb-0.5">/mo</span>
                    </div>
                  </div>

                  <ul className="space-y-1.5 mb-5 flex-1">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <CheckCircle2 className={`h-3 w-3 shrink-0 mt-0.5 ${
                          isPro ? "text-navy-500" : isElite ? "text-amber-500" : "text-gray-400"
                        }`} />
                        <span className="text-xs text-gray-600 leading-snug">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handlePlanClick(plan.id)}
                    disabled={loadingPlanId === plan.id}
                    className={`inline-flex h-9 items-center justify-center w-full text-xs font-semibold rounded-lg transition-all gap-1.5 ${
                      isPro
                        ? "btn-gradient"
                        : isElite
                          ? "bg-amber-500 hover:bg-amber-600 text-white"
                          : "btn-gradient-outline"
                    }`}
                  >
                    {loadingPlanId === plan.id ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" />{lang === "fr" ? "Veuillez patienter..." : "Please wait..."}</>
                    ) : lang === "fr" ? (
                      isStarter ? "Commencer avec Starter" : isPro ? "Commencer avec Pro" : "Commencer avec Elite"
                    ) : (
                      isStarter ? "Start with Starter" : isPro ? "Start with Pro" : "Start with Elite"
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 max-w-xl mx-auto mb-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">{lang === "fr" ? "ou un achat unique" : "or a one-time purchase"}</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* One-shot plans */}
          <div className="grid md:grid-cols-2 gap-3 max-w-md mx-auto">
            {oneshotPlans.map((plan) => {
              const isClean = plan.id === "oneshot_clean";
              return (
                <div
                  key={plan.id}
                  className={`bg-white rounded-xl p-4 flex flex-col border ${
                    isClean ? "border-navy-100" : "border-gray-200"
                  }`}
                >
                  <h3 className="text-xs font-semibold text-gray-900 mb-0.5">{plan.name}</h3>
                  <div className="mb-2">
                    <span className="text-lg font-bold text-gray-900">${plan.price}</span>
                    <span className="text-gray-400 text-[10px]"> {lang === "fr" ? "paiement unique" : "one-time"}</span>
                  </div>
                  <ul className="space-y-1 mb-4 flex-1">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <CheckCircle2 className="h-3 w-3 text-navy-400 shrink-0 mt-0.5" />
                        <span className="text-[11px] text-gray-500">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handlePlanClick(plan.id)}
                    disabled={loadingPlanId === plan.id}
                    className={`inline-flex h-8 items-center justify-center w-full text-xs font-semibold rounded-lg transition-all gap-1.5 ${
                      isClean ? "btn-gradient" : "btn-gradient-outline"
                    }`}
                  >
                    {lang === "fr" ? "Acheter" : "Buy"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </ScrollSection>

      {/* ── SECTION 7: quoteai vs Word/Excel comparison ─────────── */}
      <ScrollSection className="py-14 bg-gray-50/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-xl font-semibold tracking-tight text-gray-900">
                <span className="quoteai-word">quoteai</span> {lang === "fr" ? "vs" : "vs"}{" "}
                <span className="gradient-text">Word {lang === "fr" ? "et" : "and"} Excel</span>
              </h2>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="grid grid-cols-4 border-b border-gray-100">
                <div className="px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">{lang === "fr" ? "Fonctionnalité" : "Feature"}</div>
                {[
                  { label: "quoteai", gradient: true },
                  { label: "Word", gradient: false },
                  { label: "Excel", gradient: false },
                ].map(({ label, gradient }) => (
                  <div key={label} className={`px-4 py-3.5 text-center text-sm font-bold ${gradient ? "bg-gradient-to-b from-navy-50 to-teal-50/40" : ""}`}>
                    {gradient ? <span className="quoteai-word">{label}</span> : <span className="text-gray-400">{label}</span>}
                  </div>
                ))}
              </div>

              {[
                {
                  feature: "Quote in 30 seconds",
                  quoteai: { ok: true, label: "~30 sec" },
                  word:   { ok: false, label: "30–60 min" },
                  excel:  { ok: false, label: "20–40 min" },
                },
                {
                  feature: "Job site photo upload",
                  quoteai: { ok: true,  label: "Built in" },
                  word:   { ok: false, label: "Not supported" },
                  excel:  { ok: false, label: "Not supported" },
                },
                {
                  feature: "Voice description",
                  quoteai: { ok: true,  label: "Coming soon" },
                  word:   { ok: false, label: "Not available" },
                  excel:  { ok: false, label: "Not available" },
                },
                {
                  feature: "Automatic tax calculation",
                  quoteai: { ok: true,  label: "Always correct" },
                  word:   { ok: false, label: "Manual" },
                  excel:  { ok: true,  label: "With formulas" },
                },
                {
                  feature: "Professional PDF",
                  quoteai: { ok: true,  label: "With logo and branding" },
                  word:   { ok: true,  label: "Text only" },
                  excel:  { ok: false, label: "Difficult layout" },
                },
                {
                  feature: "No skills required",
                  quoteai: { ok: true,  label: "Just describe the job" },
                  word:   { ok: false, label: "Manual formatting" },
                  excel:  { ok: false, label: "Complex formulas" },
                },
              ].map(({ feature, quoteai, word, excel }, rowIdx) => (
                <div key={feature} className={`grid grid-cols-4 border-b border-gray-100 last:border-0 ${rowIdx % 2 === 1 ? "bg-gray-50/50" : ""}`}>
                  <div className="px-5 py-3.5 text-sm text-gray-700 font-medium flex items-center">{feature}</div>
                  {[
                    { cell: quoteai, highlight: true },
                    { cell: word,   highlight: false },
                    { cell: excel,  highlight: false },
                  ].map(({ cell, highlight }, i) => (
                    <div key={i} className={`px-4 py-3.5 flex flex-col items-center justify-center gap-0.5 ${highlight ? "bg-gradient-to-b from-navy-50/60 to-teal-50/30" : ""}`}>
                      {cell.ok
                        ? <Check className={`h-4 w-4 ${highlight ? "text-navy-600" : "text-emerald-500"}`} />
                        : <X className="h-4 w-4 text-gray-300" />
                      }
                      <span className={`text-[11px] font-medium text-center leading-tight ${cell.ok ? (highlight ? "text-navy-700" : "text-gray-600") : "text-gray-300"}`}>
                        {cell.label}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="mt-5 text-center">
              <button
                onClick={() => navigate(isSignedIn ? "/dashboard/new" : "/sign-up")}
                className="btn-gradient inline-flex h-10 items-center justify-center px-6 text-sm font-semibold"
              >
                {lang === "fr" ? "Essayez quoteai gratuitement" : "Try quoteai for free"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </ScrollSection>

      {/* ── SECTION 8: Testimonials ───────────────────────────── */}
      <TestimonialsSection />

      {/* ── SECTION 9 (positional): Excel/Word alternative ───────── */}
      <ScrollSection className="py-14 bg-gray-50/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-6">
              <span className="inline-block bg-navy-100 text-navy-700 text-xs font-bold px-3 py-0.5 rounded-full uppercase tracking-wider mb-3">{lang === "fr" ? "Fini les tableurs" : "No more spreadsheets"}</span>
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl mb-3">
                {lang === "fr" ? <>Oubliez <span className="gradient-text">Excel et Word</span></> : <>Forget <span className="gradient-text">Excel and Word</span></>}
              </h2>
              <p className="text-sm text-gray-500 max-w-xl mx-auto leading-relaxed">
                {lang === "fr"
                  ? <>Les modèles Excel se brisent. Les documents Word ne calculent rien. Avec <span className="quoteai-word font-semibold">quoteai</span> vous décrivez le travail dans vos propres mots et en 30 secondes vous avez un document professionnel prêt à envoyer.</>
                  : <>Excel templates break. Word documents don't calculate. With <span className="quoteai-word font-semibold">quoteai</span> you describe the job in your own words and in 30 seconds you have a professional document ready to send.</>}
              </p>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {(lang === "fr" ? [
                { slug: "excel-template", label: "Alternative à une soumission Excel", desc: "Pas de formules. Pas d'erreurs. Juste des résultats.", badge: "vs Excel" },
                { slug: "word-template", label: "Alternative à un modèle Word", desc: "PDF professionnel en un clic, sans mise en page manuelle.", badge: "vs Word" },
                { slug: "how-to-quote", label: "Comment rédiger une soumission", desc: "Un guide pratique pour les entrepreneurs et petites entreprises canadiennes.", badge: "Guide" },
              ] : [
                { slug: "excel-template", label: "Alternative to an Excel quote", desc: "No formulas. No errors. Just results.", badge: "vs Excel" },
                { slug: "word-template", label: "Alternative to a Word template", desc: "Professional PDF in one click, no manual formatting.", badge: "vs Word" },
                { slug: "how-to-quote", label: "How to write a quote", desc: "A practical guide for Canadian contractors and small businesses.", badge: "Guide" },
              ]).map(({ slug: guideSlug, label, desc, badge }) => (
                <Link
                  key={guideSlug}
                  href={`${base}/${lang === "fr" ? (SECTORS[guideSlug]?.frSlug ?? guideSlug) : guideSlug}/`}
                  className="bg-white rounded-xl border border-gray-100 p-4 hover:border-navy-200 hover:shadow-md transition-all group card-soft"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-navy-500 bg-navy-50 px-2 py-0.5 rounded-full">{badge}</span>
                  <h3 className="font-semibold text-gray-900 mt-2.5 mb-1 text-sm leading-snug group-hover:text-navy-700 transition-colors">{label}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
                  <span className="inline-flex items-center gap-1 text-xs text-navy-500 font-semibold mt-2">{lang === "fr" ? "En savoir plus" : "Learn more"} <ArrowRight className="h-3 w-3" /></span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </ScrollSection>

      {/* ── SECTION 10 (positional): Collapsible sectors ────────── */}
      <section className="py-12 bg-white border-t border-gray-100">
        <div className="container mx-auto px-4 max-w-3xl">
          <button
            onClick={() => setSectorsOpen(v => !v)}
            className="w-full flex items-center justify-between py-3 text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors"
          >
            <span>{lang === "fr" ? "Soumissions pour chaque métier et ville" : "Quotes for every trade and city"}</span>
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${sectorsOpen ? "rotate-180" : ""}`} />
          </button>
          {sectorsOpen && (
            <div className="pt-2 pb-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 mb-4">
                {Object.entries(TRADE_LABELS[lang]).map(([slug, label]) => (
                  <Link
                    key={slug}
                    href={`${base}/${lang === "fr" ? (SECTORS[slug]?.frSlug ?? slug) : slug}/`}
                    className="text-xs text-gray-500 hover:text-navy-600 py-1 px-2 rounded hover:bg-navy-50 transition-colors"
                  >
                    {label}
                  </Link>
                ))}
              </div>
              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-2">{lang === "fr" ? "Principales villes" : "Major cities"}</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { name: "Toronto", slug: "toronto" },
                    { name: "Vancouver", slug: "vancouver" },
                    { name: "Montreal", slug: "montreal" },
                    { name: "Calgary", slug: "calgary" },
                    { name: "Ottawa", slug: "ottawa" },
                    { name: "Edmonton", slug: "edmonton" },
                    { name: "Winnipeg", slug: "winnipeg" },
                    { name: "Mississauga", slug: "mississauga" },
                    { name: "Hamilton", slug: "hamilton" },
                    { name: "Halifax", slug: "halifax" },
                  ].map(city => (
                    <Link
                      key={city.slug}
                      href={`${base}/${lang === "fr" ? SECTORS["renovation-contractor"].frSlug : "renovation-contractor"}/${city.slug}/`}
                      className="text-xs text-gray-400 hover:text-navy-600 hover:bg-navy-50 px-2 py-0.5 rounded transition-colors"
                    >
                      {city.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── SECTION 10b: What is quoteai (SEO deep dive) ──── */}
      <ScrollSection className="py-16 bg-white border-t border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <span className="inline-flex items-center gap-1.5 bg-navy-50 border border-navy-100 text-navy-700 text-xs font-semibold px-3 py-1 rounded-full mb-4">
                <Sparkles className="h-3 w-3" /> {lang === "fr" ? "Analyse approfondie" : "Deep dive"}
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                {lang === "fr"
                  ? <>Qu'est-ce que <span className="quoteai-word text-2xl sm:text-3xl">quoteai</span> et à qui ça s'adresse</>
                  : <>What is <span className="quoteai-word text-2xl sm:text-3xl">quoteai</span> and who it's for</>}
              </h2>
            </div>

            <div className="space-y-5 text-sm sm:text-[15px] text-gray-600 leading-relaxed">
              {lang === "fr" ? (
                <p>
                  <strong className="text-gray-900">quoteai</strong> est un logiciel canadien qui utilise l'intelligence
                  artificielle pour transformer une description en langage courant en une soumission complète et
                  professionnelle. Il est conçu pour les entrepreneurs, artisans qualifiés et petites entreprises qui
                  envoient des soumissions à leurs clients chaque semaine — peintres, électriciens, plombiers, maçons,
                  métalliers, menuisiers, entreprises de rénovation, et tous les métiers de la construction et du
                  mécanique/électrique. L'objectif est simple : réduire le temps nécessaire pour préparer une soumission
                  de 30-60 minutes à 30 secondes, sans sacrifier la qualité du document final.
                </p>
              ) : (
                <p>
                  <strong className="text-gray-900">quoteai</strong> is a Canadian software that uses artificial
                  intelligence to turn a plain-language description into a complete, professional quote. It's built for
                  contractors, skilled tradespeople, and small businesses that send client quotes every week — painters,
                  electricians, plumbers, masons, metalworkers, carpenters, renovation companies, and every trade in
                  construction and mechanical/electrical work. The goal is simple: cut the time it takes to put together
                  a quote from 30-60 minutes down to 30 seconds, without giving up the quality of the final document.
                </p>
              )}

              <div className="grid sm:grid-cols-3 gap-3 my-8">
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
                  <DollarSign className="h-5 w-5 text-navy-600 mb-2" />
                  <div className="font-semibold text-gray-900 text-sm mb-1">{lang === "fr" ? "Taxes canadiennes intégrées" : "Built-in Canadian tax"}</div>
                  <p className="text-xs text-gray-500 leading-relaxed">{lang === "fr" ? "Calcul automatique de la TPS/TVH selon la province." : "Automatic GST/HST calculation by province."}</p>
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
                  <Shield className="h-5 w-5 text-navy-600 mb-2" />
                  <div className="font-semibold text-gray-900 text-sm mb-1">{lang === "fr" ? "Données stockées en sécurité" : "Securely stored data"}</div>
                  <p className="text-xs text-gray-500 leading-relaxed">{lang === "fr" ? "Stripe gère les paiements, les sessions sont protégées par des cookies chiffrés." : "Stripe handles payments, sessions are protected with encrypted cookies."}</p>
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
                  <Cpu className="h-5 w-5 text-navy-600 mb-2" />
                  <div className="font-semibold text-gray-900 text-sm mb-1">{lang === "fr" ? "IA formée pour les métiers" : "AI trained for the trades"}</div>
                  <p className="text-xs text-gray-500 leading-relaxed">{lang === "fr" ? "Vocabulaire technique pour la construction et les métiers mécaniques." : "Technical vocabulary for construction and mechanical trades."}</p>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 pt-3">{lang === "fr" ? "Comment ça fonctionne concrètement" : "How it actually works"}</h3>
              {lang === "fr" ? (
                <p>
                  Ouvrez quoteai sur votre téléphone directement sur le chantier, ou de la maison le soir. Décrivez le
                  travail comme vous l'expliqueriez à un collègue : <em>« Peindre un appartement de 800 pi², deux
                  couches de peinture lavable blanche, enduire le mur de la salle de bain. »</em> En trente secondes, le
                  moteur d'IA construit une soumission organisée en sections, avec les postes de coûts, unités de mesure
                  (pieds carrés, heures, à l'unité), prix unitaires au taux du marché, et calcul automatique des taxes.
                  Vous pouvez modifier chaque ligne, utiliser votre propre liste de prix, et ajouter ou retirer des
                  sections. Une fois prêt, téléchargez le PDF, envoyez-le par WhatsApp ou courriel, et le document est
                  sauvegardé dans votre compte pour modification future.
                </p>
              ) : (
                <p>
                  Open quoteai on your phone right on the job site, or from home in the evening. Describe the job the way
                  you'd explain it to a coworker: <em>"Paint an 800 sq ft apartment, two coats of white washable paint,
                  skim-coat the bathroom wall."</em> In thirty seconds the AI engine builds a quote organized into
                  sections, with cost items, units of measure (square feet, hours, per unit), market-rate unit prices,
                  and automatic tax calculation. You can edit every line item, swap in your own price list, and add or
                  remove sections. When you're ready, download the PDF, send it over WhatsApp or email, and the document
                  is saved to your account for future edits.
                </p>
              )}

              <h3 className="text-lg font-semibold text-gray-900 pt-3">{lang === "fr" ? "Pourquoi c'est mieux qu'Excel ou les logiciels traditionnels" : "Why it works better than Excel or traditional software"}</h3>
              {lang === "fr" ? (
                <p>
                  Les logiciels de soumission traditionnels sont conçus pour le bureau : ils demandent une installation,
                  une configuration initiale des listes de prix et codes, et des heures de formation. Excel est gratuit
                  mais vous force à repartir d'une feuille vide ou d'un modèle créé il y a des années, chaque fois.
                  quoteai élimine ces deux problèmes : rien à installer (juste un navigateur), rien à configurer au
                  départ (l'IA connaît déjà les prix moyens du marché), et chaque soumission est structurée dès le
                  départ. En moyenne, nos utilisateurs rapportent économiser 4 à 6 heures par semaine — du temps qui
                  retourne au chantier ou à la famille.
                </p>
              ) : (
                <p>
                  Traditional quoting software is built for the office: it requires installation, an upfront setup of
                  price lists and codes, and hours of training. Excel is free but forces you to start from a blank
                  sheet or a template built years ago every single time. quoteai removes both problems: there's nothing
                  to install (just a browser), nothing to configure up front (the AI already knows average market
                  prices), and every quote is structured from the start. On average, our users report saving 4-6 hours
                  a week — time that goes back into the job site or their family.
                </p>
              )}

              <h3 className="text-lg font-semibold text-gray-900 pt-3">{lang === "fr" ? "Sécurité et conformité fiscale canadienne" : "Security and Canadian tax compliance"}</h3>
              {lang === "fr" ? (
                <p>
                  Toutes les données sont stockées sur une infrastructure sécurisée et chiffrée, les sessions sont
                  protégées par des cookies chiffrés, et les paiements sont traités via Stripe. La gestion fiscale suit
                  les règles canadiennes : la TPS/TVH est calculée automatiquement selon votre province, au taux
                  applicable à votre travail. Vos informations d'entreprise (numéro d'entreprise, numéro de TPS/TVH)
                  sont enregistrées une seule fois et appliquées automatiquement à chaque soumission.
                </p>
              ) : (
                <p>
                  All data is stored on secure, encrypted infrastructure, sessions are protected with encrypted cookies,
                  and payments are processed through Stripe. Tax handling follows Canadian rules: GST/HST is calculated
                  automatically based on your province, at the rate that applies to your work. Your business details
                  (business number, GST/HST number) are saved once and applied to every quote automatically.
                </p>
              )}

              <h3 className="text-lg font-semibold text-gray-900 pt-3">{lang === "fr" ? "Combien ça coûte pour commencer" : "What it costs to get started"}</h3>
              {lang === "fr" ? (
                <p>
                  L'inscription est gratuite, et votre première soumission est générée sans entrer de carte de crédit.
                  Ensuite, vous pouvez choisir : payer pour une seule soumission (5 $ à 13 $) selon vos besoins, ou
                  démarrer un abonnement mensuel (Starter 19 $ avec 10 soumissions, Pro 49 $ avec 60 soumissions, Elite
                  59 $ illimité). Vous pouvez modifier ou annuler votre forfait à tout moment depuis votre compte. Des
                  milliers d'entrepreneurs canadiens utilisent déjà quoteai chaque semaine.
                </p>
              ) : (
                <p>
                  Signing up is free, and your first quote is generated without entering a credit card. From there you
                  can choose: pay for a single quote ($5 to $13) when you need one, or start a monthly subscription
                  (Starter $19 with 10 quotes, Pro $49 with 60 quotes, Elite $59 unlimited). You can change or cancel
                  your plan at any time from your account. Thousands of Canadian contractors already use quoteai every
                  week.
                </p>
              )}
            </div>
          </div>
        </div>
      </ScrollSection>

    </div>
  );
}
