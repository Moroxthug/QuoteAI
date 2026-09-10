import { lazy, Suspense, useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, CheckCircle2, FileText, Zap, Lock, Star, Sparkles, Mic, ImagePlus, Check, X, Loader2, ChevronDown, Shield, Cpu, DollarSign, Hammer, Users, ListChecks, Building2 } from "lucide-react";
import { SeoHead } from "@/components/seo-head";
import { TestimonialsSection } from "@/components/testimonials-section";
import { useGetPlans, useCreateCheckoutSession } from "@workspace/api-client-react";
import { useScrollFade } from "@/hooks/use-scroll-fade";
import { useAuth } from "@/hooks/use-auth";
import { WhatsAppChatDemo } from "@/components/whatsapp-chat-demo";
import { TRADE_LABELS } from "@/i18n/translations";
import { useLanguage } from "@/i18n/LanguageContext";
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
        title="quoteai – Instant Quotes for Canadian Contractors | AI in 30s"
        description="Forget Excel and handwritten paperwork. Describe the job in your own words and quoteai generates a professional quote with tax, line items, and totals in 30 seconds."
        canonical="https://quoteai.ca/"
      />

      {/* ── SEZIONE 1: Hero con scena 3D ──────────────────────── */}
      <section
        className="relative overflow-hidden pt-20 pb-16 bg-white"
        onMouseMove={handleHeroMove}
        onMouseLeave={handleHeroLeave}
      >
        <div className="hero-grid-bg" />
        <div className="mesh-blob mesh-blob-1" />
        <div className="mesh-blob mesh-blob-2" />
        <div className="mesh-blob mesh-blob-3" />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Copy */}
            <div className="text-center lg:text-left max-w-2xl mx-auto lg:mx-0">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 leading-tight mb-4">
                Create professional quotes<br />
                in <span className="gradient-text">30 seconds</span> with AI
              </h1>
              <p className="text-sm text-gray-500 leading-relaxed mb-8 max-w-lg mx-auto lg:mx-0">
                Describe the job in your own words — <span className="quoteai-word font-semibold">quoteai</span> generates a professional quote with line items, quantities, and tax. Ready to send to your client.
              </p>

              {/* AI bar */}
              <div className="ai-bar-glow flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100 transition-all mb-3 max-w-lg mx-auto lg:mx-0">
                <div className="group relative shrink-0">
                  <button
                    disabled
                    className="h-8 w-8 flex items-center justify-center rounded-xl text-gray-400 cursor-not-allowed hover:bg-gray-100 transition-colors"
                  >
                    <ImagePlus className="h-4 w-4" />
                  </button>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-gray-900 text-white text-[11px] font-medium rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                    Coming soon
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                  </div>
                </div>
                <Sparkles className="h-4 w-4 text-violet-400 shrink-0" />
                <input
                  ref={homepageInputRef}
                  value={homepageInput}
                  onChange={(e) => setHomepageInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && homepageInput.trim()) handleHomepageSubmit(); }}
                  placeholder="Describe the job and get a quote in 30 seconds..."
                  className="flex-1 text-sm outline-none placeholder:text-gray-400 text-gray-800 bg-transparent min-w-0"
                />
                <div className="group relative shrink-0">
                  <button
                    disabled
                    className="h-8 w-8 flex items-center justify-center rounded-xl text-gray-400 cursor-not-allowed hover:bg-gray-100 transition-colors"
                  >
                    <Mic className="h-4 w-4" />
                  </button>
                  <div className="absolute bottom-full right-0 mb-2 px-2.5 py-1 bg-gray-900 text-white text-[11px] font-medium rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                    Coming soon
                    <div className="absolute top-full right-3 border-4 border-transparent border-t-gray-900" />
                  </div>
                </div>
                <button
                  onClick={handleHomepageSubmit}
                  disabled={!homepageInput.trim()}
                  className="shrink-0 btn-gradient inline-flex h-8 w-8 items-center justify-center rounded-xl disabled:opacity-40 transition-all"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-gray-400 mb-6">7-day free trial · No credit card required</p>

              <div className="flex justify-center lg:justify-start gap-3">
                <button
                  onClick={() => navigate(isSignedIn ? "/dashboard/new" : "/sign-up")}
                  className="btn-gradient inline-flex h-9 items-center px-5 text-sm font-semibold rounded-lg"
                >
                  Start for free
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </button>
                <Link
                  href="#prezzi"
                  className="btn-gradient-outline inline-flex h-9 items-center px-5 text-sm font-semibold rounded-lg"
                >
                  See plans
                </Link>
              </div>
            </div>

            {/* 3D scene: floating quote document */}
            <div className="hero-3d-stage hidden lg:flex justify-center items-center relative h-[420px]">
              <div ref={heroDocRef} className="hero-doc relative w-[320px]">
                <div className="absolute -bottom-12 left-8 right-8 h-8 rounded-[50%] bg-violet-900/15 blur-xl" style={{ transform: "translateZ(-60px)" }} />
                <div className="hero-doc-layer rounded-2xl overflow-hidden border border-gray-100 shadow-2xl shadow-violet-200/60 bg-white">
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
                  <div className="h-6 w-6 rounded-lg bg-violet-50 flex items-center justify-center"><Sparkles className="h-3.5 w-3.5 text-violet-500" /></div>
                  <div className="text-[11px] font-semibold text-gray-700">Generated in 30 sec</div>
                </div>
                <div className="hero-float-chip absolute -left-10 bottom-2 bg-white rounded-xl border border-gray-100 shadow-lg px-3 py-2 flex items-center gap-2" style={{ animationDelay: "-3.2s" }}>
                  <div className="h-6 w-6 rounded-lg bg-cyan-50 flex items-center justify-center"><DollarSign className="h-3.5 w-3.5 text-cyan-500" /></div>
                  <div className="text-[11px] font-semibold text-gray-700">$1,769.00 total</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 2: Demo Video ─────────────────────────────── */}
      <section className="py-8 bg-white">
        <div className="container mx-auto px-4 max-w-3xl">
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
              <Suspense fallback={<div className="w-full h-full bg-gray-950 flex items-center justify-center"><div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>}>
                <div className="absolute inset-0" style={{ transform: "scale(1)", transformOrigin: "top left", width: "100%", height: "100%" }}>
                  <DemoPlayer loop={true} />
                </div>
              </Suspense>
            </div>
          </div>
          <p className="text-xs text-gray-400 text-center mt-3">Live demo — no effects, no editing</p>
        </div>
      </section>

      {/* ── SECTION 3: WhatsApp teaser ────────────────────────── */}
      <ScrollSection className="py-0">
        <Link href="/whatsapp/">
          <div className="relative overflow-hidden cursor-pointer group" style={{ background: "linear-gradient(135deg, #0f0f1a 0%, #1a0a2e 50%, #0a1628 100%)" }}>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-80 h-80 rounded-full blur-3xl opacity-20 pointer-events-none" style={{ background: "radial-gradient(ellipse, #7c3aed, transparent)" }} />

            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
              <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-5">

                <div className="flex items-center gap-4 flex-1">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg" style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.558 4.118 1.532 5.845L0 24l6.348-1.51A11.933 11.933 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.65-.5-5.18-1.373L2 22l1.415-4.664A9.958 9.958 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-green-400 uppercase tracking-wider">New</span>
                      <span className="text-xs text-gray-600">·</span>
                      <span className="text-xs text-gray-500">Straight from your phone</span>
                    </div>
                    <p className="text-white font-bold text-base sm:text-lg leading-snug">
                      Create quotes directly from{" "}
                      <span className="text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(135deg, #25D366, #a78bfa)" }}>
                        WhatsApp
                      </span>
                    </p>
                    <p className="text-gray-400 text-xs sm:text-sm mt-0.5">
                      Voice note, text, or photo → professional PDF in 60 seconds. No app to open.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 group-hover:gap-3 transition-all">
                  <span className="text-sm font-semibold text-violet-300 group-hover:text-white transition-colors">See how it works</span>
                  <ArrowRight className="h-4 w-4 text-violet-400 group-hover:text-white transition-colors" />
                </div>
              </div>
            </div>
          </div>
        </Link>
      </ScrollSection>

      {/* ── SECTION 4: How it works ──────────────────────────── */}
      <ScrollSection className="py-14 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-14 items-center">

              <div className="flex justify-center">
                <WhatsAppChatDemo />
              </div>

              <div>
                <h2 className="text-xl font-semibold tracking-tight text-gray-900 mb-6 leading-snug">
                  From voice note to PDF<br />
                  <span className="text-violet-600">without touching a computer</span>
                </h2>

                <div className="space-y-5 mb-8">
                  {[
                    { num: "1", title: "Send a voice note, text, or photo", desc: "Right on WhatsApp. Describe the job just like you'd talk to a client." },
                    { num: "2", title: "The AI generates a preview", desc: "Sections, prices, and tax in 60 seconds. Correct or approve it right away." },
                    { num: "3", title: "Get the PDF in chat", desc: "Send it to your client with a tap. The quote is also saved on quoteai.ca." },
                  ].map((s) => (
                    <div key={s.num} className="flex gap-4">
                      <div
                        className="w-8 h-8 rounded-xl text-sm font-bold shrink-0 flex items-center justify-center text-white"
                        style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}
                      >
                        {s.num}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm mb-0.5">{s.title}</p>
                        <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <Link
                  href="/whatsapp/"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-violet-600 hover:text-violet-700 transition-colors group"
                >
                  See the full feature
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>

            </div>
          </div>
        </div>
      </ScrollSection>

      {/* ── SECTION 5: Quote demo ────────────────────────── */}
      <ScrollSection id="demo" className="py-14 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-10 items-center max-w-5xl mx-auto">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-gray-900 mb-4 leading-snug">
                From a simple text to a{" "}
                <span className="gradient-text">professional document</span>.
              </h2>
              <div className="bg-gray-50 p-5 rounded-xl mb-4 font-mono text-sm border border-gray-100 text-gray-700">
                "I need to paint an 800 sq ft apartment with two coats of
                white washable paint. Also include skim-coating a damaged
                wall in the living room."
              </div>
              <ArrowRight className="h-6 w-6 text-violet-500 mx-auto lg:mx-0 mb-4 rotate-90 lg:rotate-0" />
              <p className="text-sm text-gray-500 leading-relaxed">
                Our AI engine understands natural language, identifies each
                individual cost item, estimates quantities, and lays it all
                out in a standard format.
              </p>
            </div>

            <div className="relative">
              <div className="bg-white rounded-xl border border-gray-100 shadow-md overflow-hidden flex flex-col h-[420px]">
                <div className="border-b bg-gray-50 px-4 py-2.5 flex items-center gap-2 shrink-0">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  </div>
                  <div className="text-xs font-medium text-gray-400 ml-4">Quote_John_Smith.pdf</div>
                </div>

                <div className="flex-1 overflow-hidden bg-white text-black text-[11px] p-5 select-none">
                  <div className="flex justify-between items-start border-b-2 border-slate-800 pb-3 mb-3">
                    <div>
                      <div className="text-sm font-bold text-slate-800">Smith Painting Co.</div>
                      <div className="text-slate-500 text-[10px] mt-0.5">GST/HST: 123456789 RT0001</div>
                      <div className="text-slate-500 text-[10px]">12 Roma St, Toronto, ON</div>
                      <div className="text-slate-500 text-[10px]">Tel: +1 416 555 0123</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">Quote</div>
                      <div className="text-xs font-bold text-slate-700 mt-1">N. 2024-042</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Date: 05/06/2024</div>
                    </div>
                  </div>

                  <div className="text-center mb-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-800">
                      QUOTE FOR PAINTING WORK
                    </div>
                    <div className="text-[9px] text-slate-500 italic mt-0.5">Apartment, 8 Verdi St — Toronto</div>
                  </div>

                  <div className="mb-2.5">
                    <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Bill To</div>
                    <div className="bg-slate-50 border border-slate-200 rounded px-3 py-1.5">
                      <div className="font-semibold text-slate-800">Mario Rossi</div>
                      <div className="text-slate-500 text-[10px]">8 Verdi St, Toronto, ON</div>
                    </div>
                  </div>

                  <div className="mb-2.5">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">1. Summary</div>
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-800 text-white">
                          <th className="py-1 px-2 text-left text-[9px] font-semibold">Section</th>
                          <th className="py-1 px-2 text-right text-[9px] font-semibold">Net amount</th>
                          <th className="py-1 px-2 text-left text-[9px] font-semibold hidden sm:table-cell">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-white">
                          <td className="py-1 px-2 text-slate-700">A. Wall painting</td>
                          <td className="py-1 px-2 text-right font-medium text-slate-800">$1,200.00</td>
                          <td className="py-1 px-2 text-slate-400 italic hidden sm:table-cell">Standard item</td>
                        </tr>
                        <tr className="bg-slate-50">
                          <td className="py-1 px-2 text-slate-700">B. Skim coating & prep</td>
                          <td className="py-1 px-2 text-right font-medium text-slate-800">$250.00</td>
                          <td className="py-1 px-2 text-slate-400 italic hidden sm:table-cell">Extra item</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="mb-2.5">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">2. Detailed Breakdown</div>
                    <div className="border border-slate-200 rounded overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100">
                        <span className="font-bold text-slate-800 text-[10px]">A. Wall painting</span>
                        <span className="text-[10px] font-semibold text-slate-700">$1,200.00</span>
                      </div>
                      <table className="w-full">
                        <thead>
                          <tr className="bg-slate-700 text-white">
                            <th className="py-1 px-2 text-left text-[9px]">Description</th>
                            <th className="py-1 px-1 text-center text-[9px] w-8">Unit</th>
                            <th className="py-1 px-1 text-center text-[9px] w-8">Qty</th>
                            <th className="py-1 px-2 text-right text-[9px] w-16">Unit price</th>
                            <th className="py-1 px-2 text-right text-[9px] w-16">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="bg-white">
                            <td className="py-1 px-2 text-slate-700">White washable paint (2 coats)</td>
                            <td className="py-1 px-1 text-center text-slate-500">sq ft</td>
                            <td className="py-1 px-1 text-center text-slate-500">800</td>
                            <td className="py-1 px-2 text-right text-slate-600">$1.50</td>
                            <td className="py-1 px-2 text-right font-medium text-slate-800">$1,200.00</td>
                          </tr>
                          <tr className="bg-slate-200">
                            <td colSpan={4} className="py-1 px-2 font-bold text-slate-700 text-right text-[9px]">Subtotal, section A</td>
                            <td className="py-1 px-2 text-right font-bold text-slate-800">$1,200.00</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <div className="w-52 border border-slate-200 rounded overflow-hidden">
                      <div className="flex justify-between px-3 py-1 text-slate-600 border-b border-slate-100">
                        <span>Subtotal:</span>
                        <span className="font-medium">$1,450.00</span>
                      </div>
                      <div className="flex justify-between px-3 py-1 text-slate-600 border-b border-slate-100">
                        <span>HST (13%):</span>
                        <span className="font-medium">$319.00</span>
                      </div>
                      <div className="flex justify-between px-3 py-1.5 bg-slate-800 text-white font-bold text-xs">
                        <span>TOTAL</span>
                        <span>$1,769.00</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollSection>

      {/* ── SECTION 5BIS: Accepted quote → Job Site CRM ────── */}
      <ScrollSection className="py-14 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-14 items-center">

              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-600 uppercase tracking-wider mb-3">
                  <Hammer className="h-3.5 w-3.5" />
                  Included in every plan
                </div>
                <h2 className="text-xl font-semibold tracking-tight text-gray-900 mb-6 leading-snug">
                  An accepted quote<br />
                  <span className="text-violet-600">becomes a job site</span>
                </h2>

                <div className="space-y-5 mb-8">
                  {[
                    { icon: Hammer, title: "One click, zero re-typing", desc: "Open the job site straight from the accepted quote: client, amount, and line items are already linked." },
                    { icon: ListChecks, title: "Tasks and progress tracking", desc: "Organize the work into tasks with deadlines, without leaving quoteai." },
                    { icon: Users, title: "Team members and suppliers", desc: "Assign the job site to your team and keep track of the suppliers involved." },
                    { icon: Building2, title: "Budget and extra costs under control", desc: "Every expense outside the original quote stays linked to the job site and its starting budget." },
                  ].map((s) => (
                    <div key={s.title} className="flex gap-4">
                      <div
                        className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-white"
                        style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}
                      >
                        <s.icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm mb-0.5">{s.title}</p>
                        <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <Link
                  href="/crm"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-violet-600 hover:text-violet-700 transition-colors group"
                >
                  See the job site CRM
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>

              <div className="relative">
                <div className="bg-white rounded-xl border border-gray-100 shadow-md overflow-hidden">
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
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
                        In progress
                      </span>
                    </div>

                    <div className="space-y-2 mb-4">
                      {[
                        { done: true, label: "Site visit and measurements" },
                        { done: true, label: "Materials ordered (Rossi Hardware)" },
                        { done: false, label: "Wall painting" },
                        { done: false, label: "Living room skim coating" },
                      ].map((t) => (
                        <div key={t.label} className="flex items-center gap-2.5 text-sm">
                          <div className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 ${t.done ? "bg-violet-600" : "border border-gray-300"}`}>
                            {t.done && <Check className="h-3 w-3 text-white" />}
                          </div>
                          <span className={t.done ? "text-gray-400 line-through" : "text-gray-700"}>{t.label}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Users className="h-3.5 w-3.5" />
                        2 team members assigned
                      </div>
                      <span className="text-xs font-semibold text-violet-600">Linked to the quote</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </ScrollSection>

      {/* ── SECTION 6: Pricing ─────────────────────────────────── */}
      <ScrollSection className="py-16 bg-white" id="prezzi">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-xl font-semibold text-gray-900">
              Simple, Transparent Plans
            </h2>
            <p className="mt-2 text-sm text-gray-500 max-w-xl mx-auto leading-relaxed">
              7-day free trial included — no credit card required.
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
                      ? "border-2 border-violet-300 shadow-lg shadow-violet-200/40"
                      : isElite
                        ? "border-2 border-amber-300"
                        : "border border-gray-200"
                  }`}
                >
                  {isPro && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full whitespace-nowrap border border-violet-100">
                        ⭐ Most Popular
                      </span>
                    </div>
                  )}
                  {isElite && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full whitespace-nowrap border border-amber-100">
                        👑 Unlimited
                      </span>
                    </div>
                  )}

                  <div className="mb-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mb-1.5 inline-block ${
                      isPro ? "bg-violet-100 text-violet-700" : isElite ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
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
                          isPro ? "text-violet-500" : isElite ? "text-amber-500" : "text-gray-400"
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
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" />Please wait...</>
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
            <span className="text-xs text-gray-400 font-medium">or a one-time purchase</span>
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
                    isClean ? "border-violet-100" : "border-gray-200"
                  }`}
                >
                  <h3 className="text-xs font-semibold text-gray-900 mb-0.5">{plan.name}</h3>
                  <div className="mb-2">
                    <span className="text-lg font-bold text-gray-900">${plan.price}</span>
                    <span className="text-gray-400 text-[10px]"> one-time</span>
                  </div>
                  <ul className="space-y-1 mb-4 flex-1">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <CheckCircle2 className="h-3 w-3 text-violet-400 shrink-0 mt-0.5" />
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
                    Buy
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
                <span className="quoteai-word">quoteai</span> vs{" "}
                <span className="gradient-text">Word and Excel</span>
              </h2>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="grid grid-cols-4 border-b border-gray-100">
                <div className="px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Feature</div>
                {[
                  { label: "quoteai", gradient: true },
                  { label: "Word", gradient: false },
                  { label: "Excel", gradient: false },
                ].map(({ label, gradient }) => (
                  <div key={label} className={`px-4 py-3.5 text-center text-sm font-bold ${gradient ? "bg-gradient-to-b from-violet-50 to-cyan-50/40" : ""}`}>
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
                    <div key={i} className={`px-4 py-3.5 flex flex-col items-center justify-center gap-0.5 ${highlight ? "bg-gradient-to-b from-violet-50/60 to-cyan-50/30" : ""}`}>
                      {cell.ok
                        ? <Check className={`h-4 w-4 ${highlight ? "text-violet-600" : "text-emerald-500"}`} />
                        : <X className="h-4 w-4 text-gray-300" />
                      }
                      <span className={`text-[11px] font-medium text-center leading-tight ${cell.ok ? (highlight ? "text-violet-700" : "text-gray-600") : "text-gray-300"}`}>
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
                Try quoteai for free
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
              <span className="inline-block bg-violet-100 text-violet-700 text-xs font-bold px-3 py-0.5 rounded-full uppercase tracking-wider mb-3">No more spreadsheets</span>
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl mb-3">
                Forget <span className="gradient-text">Excel and Word</span>
              </h2>
              <p className="text-sm text-gray-500 max-w-xl mx-auto leading-relaxed">
                Excel templates break. Word documents don't calculate. With <span className="quoteai-word font-semibold">quoteai</span> you describe the job in your own words and in 30 seconds you have a professional document ready to send.
              </p>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {[
                { href: "/preventivi/modello-excel", label: "Alternative to an Excel quote", desc: "No formulas. No errors. Just results.", badge: "vs Excel" },
                { href: "/preventivi/modello-word", label: "Alternative to a Word template", desc: "Professional PDF in one click, no manual formatting.", badge: "vs Word" },
                { href: "/preventivi/come-fare-preventivo", label: "How to write a quote", desc: "A practical guide for Canadian contractors and small businesses.", badge: "Guide" },
              ].map(({ href, label, desc, badge }) => (
                <Link
                  key={href}
                  href={href}
                  className="bg-white rounded-xl border border-gray-100 p-4 hover:border-violet-200 hover:shadow-md transition-all group card-soft"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-violet-500 bg-violet-50 px-2 py-0.5 rounded-full">{badge}</span>
                  <h3 className="font-semibold text-gray-900 mt-2.5 mb-1 text-sm leading-snug group-hover:text-violet-700 transition-colors">{label}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
                  <span className="inline-flex items-center gap-1 text-xs text-violet-500 font-semibold mt-2">Learn more <ArrowRight className="h-3 w-3" /></span>
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
            <span>Quotes for every trade and city</span>
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${sectorsOpen ? "rotate-180" : ""}`} />
          </button>
          {sectorsOpen && (
            <div className="pt-2 pb-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 mb-4">
                {Object.entries(TRADE_LABELS[lang]).map(([slug, label]) => (
                  <Link
                    key={slug}
                    href={`/preventivi/${slug}/`}
                    className="text-xs text-gray-500 hover:text-violet-600 py-1 px-2 rounded hover:bg-violet-50 transition-colors"
                  >
                    {label}
                  </Link>
                ))}
              </div>
              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-2">Major cities</p>
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
                      href={`/preventivi/ristrutturazione/${city.slug}/`}
                      className="text-xs text-gray-400 hover:text-violet-600 hover:bg-violet-50 px-2 py-0.5 rounded transition-colors"
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
              <span className="inline-flex items-center gap-1.5 bg-violet-50 border border-violet-100 text-violet-700 text-xs font-semibold px-3 py-1 rounded-full mb-4">
                <Sparkles className="h-3 w-3" /> Deep dive
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                What is <span className="quoteai-word text-2xl sm:text-3xl">quoteai</span> and who it's for
              </h2>
            </div>

            <div className="space-y-5 text-sm sm:text-[15px] text-gray-600 leading-relaxed">
              <p>
                <strong className="text-gray-900">quoteai</strong> is a Canadian software that uses artificial
                intelligence to turn a plain-language description into a complete, professional quote. It's built for
                contractors, skilled tradespeople, and small businesses that send client quotes every week — painters,
                electricians, plumbers, masons, metalworkers, carpenters, renovation companies, and every trade in
                construction and mechanical/electrical work. The goal is simple: cut the time it takes to put together
                a quote from 30-60 minutes down to 30 seconds, without giving up the quality of the final document.
              </p>

              <div className="grid sm:grid-cols-3 gap-3 my-8">
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
                  <DollarSign className="h-5 w-5 text-violet-600 mb-2" />
                  <div className="font-semibold text-gray-900 text-sm mb-1">Built-in Canadian tax</div>
                  <p className="text-xs text-gray-500 leading-relaxed">Automatic GST/HST calculation by province.</p>
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
                  <Shield className="h-5 w-5 text-violet-600 mb-2" />
                  <div className="font-semibold text-gray-900 text-sm mb-1">Securely stored data</div>
                  <p className="text-xs text-gray-500 leading-relaxed">Stripe handles payments, sessions are protected with encrypted cookies.</p>
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
                  <Cpu className="h-5 w-5 text-violet-600 mb-2" />
                  <div className="font-semibold text-gray-900 text-sm mb-1">AI trained for the trades</div>
                  <p className="text-xs text-gray-500 leading-relaxed">Technical vocabulary for construction and mechanical trades.</p>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 pt-3">How it actually works</h3>
              <p>
                Open quoteai on your phone right on the job site, or from home in the evening. Describe the job the way
                you'd explain it to a coworker: <em>"Paint an 800 sq ft apartment, two coats of white washable paint,
                skim-coat the bathroom wall."</em> In thirty seconds the AI engine builds a quote organized into
                sections, with cost items, units of measure (square feet, hours, per unit), market-rate unit prices,
                and automatic tax calculation. You can edit every line item, swap in your own price list, and add or
                remove sections. When you're ready, download the PDF, send it over WhatsApp or email, and the document
                is saved to your account for future edits.
              </p>

              <h3 className="text-lg font-semibold text-gray-900 pt-3">Why it works better than Excel or traditional software</h3>
              <p>
                Traditional quoting software is built for the office: it requires installation, an upfront setup of
                price lists and codes, and hours of training. Excel is free but forces you to start from a blank
                sheet or a template built years ago every single time. quoteai removes both problems: there's nothing
                to install (just a browser), nothing to configure up front (the AI already knows average market
                prices), and every quote is structured from the start. On average, our users report saving 4-6 hours
                a week — time that goes back into the job site or their family.
              </p>

              <h3 className="text-lg font-semibold text-gray-900 pt-3">Security and Canadian tax compliance</h3>
              <p>
                All data is stored on secure, encrypted infrastructure, sessions are protected with encrypted cookies,
                and payments are processed through Stripe. Tax handling follows Canadian rules: GST/HST is calculated
                automatically based on your province, at the rate that applies to your work. Your business details
                (business number, GST/HST number) are saved once and applied to every quote automatically.
              </p>

              <h3 className="text-lg font-semibold text-gray-900 pt-3">What it costs to get started</h3>
              <p>
                Signing up is free, and your first quote is generated without entering a credit card. From there you
                can choose: pay for a single quote ($29) when you need one, or start a monthly subscription
                (Starter $19 with 10 quotes, Pro $49 with 60 quotes, Elite $59 unlimited). You can change or cancel
                your plan at any time from your account. Thousands of Canadian contractors already use quoteai every
                week.
              </p>
            </div>
          </div>
        </div>
      </ScrollSection>

      {/* ── SECTION 11 (positional): Closing CTA ──────────────────── */}
      <ScrollSection className="relative overflow-hidden">
        <div className="relative overflow-hidden py-16" style={{ background: "linear-gradient(135deg, #0f0f1a 0%, #1a0a2e 55%, #0a1628 100%)" }}>
          <div className="mesh-blob mesh-blob-1" style={{ opacity: 0.6 }} />
          <div className="mesh-blob mesh-blob-2" style={{ opacity: 0.6 }} />
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-white mb-3">
              Ready to transform your business?
            </h2>
            <p className="text-sm text-gray-400 mb-7 max-w-md mx-auto leading-relaxed">
              Join hundreds of Canadian contractors and tradespeople who
              save hours every week.
            </p>
            <button
              onClick={() => navigate(isSignedIn ? "/dashboard/new" : "/sign-up")}
              className="btn-gradient inline-flex h-11 items-center justify-center px-8 text-sm font-semibold"
            >
              Create Your Free Account
              <ArrowRight className="ml-2 h-4 w-4" />
            </button>
          </div>
        </div>
      </ScrollSection>
    </div>
  );
}
