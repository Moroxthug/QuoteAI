import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, HardHat, PlayCircle } from "lucide-react";
import { Logo } from "@/components/logo";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useAuth } from "@/hooks/use-auth";
import { markWelcomeSeen, parseJoinInput } from "@/lib/first-run";
import { OVERVIEW_VIDEO, markOverviewOffered, overviewOffered } from "@/lib/videos";

/**
 * Phase 121 — the phone app's first screen when nobody is signed in
 * (docs/APP-DESIGN.md §2 "Welcome"): three calm screens, each a line drawing
 * and one sentence, that can be swiped or skipped — the two ways in are on
 * every one of them. No marketing wall. A crew member has a third way in
 * (/welcome/crew): the link the office texted, or an access code.
 */

const SLIDES = ["quote", "jobs", "paid"] as const;

/** 160×120 line drawings in the title colour with one teal detail (as components/states.tsx). */
function WelcomeArt({ slide }: { slide: (typeof SLIDES)[number] }) {
  const teal = { stroke: "var(--teal)" };
  return (
    <svg className="welcome-art" viewBox="0 0 160 120" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {slide === "quote" && (<>
        <rect x="58" y="10" width="52" height="100" rx="9" /><path d="M78 18h12" />
        <path d="M68 34h32M68 44h32M68 54h22M68 72h14M92 72h8M68 82h14M92 82h8" />
        <path d="M68 96h32" />
        <path d="M24 52v16M32 44v32M40 54v12M48 48v24" style={teal} />
      </>)}
      {slide === "jobs" && (<>
        <path d="M20 104h120" /><path d="M34 104V62l34-26 34 26v42" /><path d="M58 104V78h20v26" />
        <rect x="108" y="20" width="36" height="34" rx="4" /><path d="M108 30h36M118 16v8M134 16v8" />
        <path d="M117 42l5 5 10-10" style={teal} />
      </>)}
      {slide === "paid" && (<>
        <path d="M42 10h52l16 16v84H42z" /><path d="M94 10v16h16" />
        <path d="M54 38h40M54 48h40M54 58h26" /><path d="M54 90c6-8 10 4 16-4s8 4 14 0" />
        <circle cx="112" cy="88" r="16" style={teal} /><path d="M105 88l5 5 9-10" style={teal} />
      </>)}
    </svg>
  );
}

function LangSwitch() {
  const { lang, setLang } = useLanguage();
  return (
    <div className="welcome-lang" role="group" aria-label="Language / Langue">
      <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")} lang="en">EN</button>
      <button type="button" aria-pressed={lang === "fr"} onClick={() => setLang("fr")} lang="fr">FR</button>
    </div>
  );
}

function useSignedInGoesHome() {
  const { isLoaded, isSignedIn } = useAuth();
  const [, navigate] = useLocation();
  useEffect(() => {
    if (isLoaded && isSignedIn) navigate("/dashboard", { replace: true });
  }, [isLoaded, isSignedIn, navigate]);
}

export default function WelcomePage() {
  const { t } = useLanguage();
  useDocumentTitle(`${t("firstRun.welcome.title")} · QuoteAI`);
  useSignedInGoesHome();
  const [index, setIndex] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const [offerVideo] = useState(() => !!OVERVIEW_VIDEO && !overviewOffered());

  useEffect(() => {
    markWelcomeSeen();
    if (offerVideo) markOverviewOffered();
  }, [offerVideo]);

  const onScroll = () => {
    const el = track.current;
    if (!el || el.clientWidth === 0) return;
    setIndex(Math.max(0, Math.min(SLIDES.length - 1, Math.round(el.scrollLeft / el.clientWidth))));
  };
  const goTo = (i: number) => {
    const el = track.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
    setIndex(i);
  };

  return (
    <main id="main" className="welcome" data-welcome="">
      <header className="welcome-top">
        <Logo />
        <LangSwitch />
      </header>
      <h1 className="sr-only">{t("firstRun.welcome.title")}</h1>

      {/* Focusable, so a keyboard can scroll it: ← → move between the screens. */}
      <div
        className="welcome-track"
        ref={track}
        onScroll={onScroll}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" && index < SLIDES.length - 1) { e.preventDefault(); goTo(index + 1); }
          if (e.key === "ArrowLeft" && index > 0) { e.preventDefault(); goTo(index - 1); }
        }}
        role="region"
        aria-roledescription="carousel"
        aria-label={t("firstRun.welcome.title")}
      >
        {SLIDES.map((s, i) => (
          <section key={s} className="welcome-slide" aria-roledescription="slide" aria-label={t("firstRun.welcome.slideOf").replace("{n}", String(i + 1)).replace("{total}", String(SLIDES.length))} aria-hidden={i !== index}>
            <WelcomeArt slide={s} />
            <h2>{t(`firstRun.welcome.${s}Title`)}</h2>
            <p>{t(`firstRun.welcome.${s}Body`)}</p>
          </section>
        ))}
      </div>

      <div className="welcome-dots">
        {SLIDES.map((s, i) => (
          <button key={s} type="button" aria-label={t("firstRun.welcome.slideOf").replace("{n}", String(i + 1)).replace("{total}", String(SLIDES.length))} aria-current={i === index ? "step" : undefined} className={i === index ? "on" : undefined} onClick={() => goTo(i)} />
        ))}
      </div>

      {offerVideo && OVERVIEW_VIDEO && (
        <a className="welcome-video" href={OVERVIEW_VIDEO.href} target="_blank" rel="noopener noreferrer">
          <PlayCircle aria-hidden="true" /> {t("firstRun.welcome.watch")}
        </a>
      )}

      <div className="welcome-actions">
        <Link href="/sign-up" className="btn btn-navy" data-primary-action>{t("firstRun.welcome.create")}</Link>
        <Link href="/sign-in?from=welcome" className="btn btn-outline-navy">{t("firstRun.welcome.haveAccount")}</Link>
        <Link href="/welcome/crew" className="welcome-crew-link"><HardHat aria-hidden="true" /> {t("firstRun.welcome.crew")}</Link>
      </div>
    </main>
  );
}

/** /welcome/crew — a crew member's way in: the texted link or an access code, no company to set up. */
export function WelcomeCrewPage() {
  const { t } = useLanguage();
  useDocumentTitle(`${t("firstRun.crew.title")} · QuoteAI`);
  const [, navigate] = useLocation();
  const [value, setValue] = useState("");
  const [bad, setBad] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseJoinInput(value);
    if (!target) {
      setBad(true);
      return;
    }
    navigate(target.kind === "code" ? `/join?code=${encodeURIComponent(target.code)}` : target.path);
  };

  return (
    <main id="main" className="welcome welcome-crew" data-welcome-crew="">
      <header className="welcome-top">
        <Link href="/welcome" className="welcome-back" aria-label={t("firstRun.back")}><ArrowLeft aria-hidden="true" /></Link>
        <Logo />
        <span className="welcome-top-spacer" aria-hidden="true" />
      </header>
      <div className="welcome-crew-body">
        <HardHat className="welcome-crew-icon" aria-hidden="true" />
        <h1>{t("firstRun.crew.title")}</h1>
        <p>{t("firstRun.crew.body")}</p>
        <form onSubmit={submit} noValidate>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="join-input">{t("firstRun.crew.label")}</label>
            <input
              id="join-input"
              value={value}
              onChange={(e) => { setValue(e.target.value); setBad(false); }}
              placeholder={t("firstRun.crew.placeholder")}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="go"
              aria-invalid={bad || undefined}
              aria-describedby="join-input-help"
              autoFocus
            />
          </div>
          <p id="join-input-help" className={bad ? "welcome-crew-error" : "welcome-crew-hint"} role={bad ? "alert" : undefined}>
            {bad ? t("firstRun.crew.notRecognised") : t("firstRun.crew.hint")}
          </p>
          <button type="submit" className="btn btn-navy w-full" disabled={!value.trim()} data-primary-action>{t("firstRun.crew.continue")}</button>
        </form>
      </div>
    </main>
  );
}
