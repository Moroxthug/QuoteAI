import { useEffect, useId, type ReactNode } from "react";
import "@/client-pages.css";
import { GLYPHS, TONES } from "./glyph-data";
import { useLanguage } from "@/i18n/LanguageContext";

/**
 * Pocket 125.10: the pieces the client pages share (the design's header, language
 * switch, gradient icons, status pill, money). Styles are in client-pages.css, built
 * from docs/pocket-design/handoff/tokens/tokens.css.
 */

/** Puts the design's tokens on <html> while a client page is on screen, so portal sheets get them too. */
export function useClientTheme() {
  useEffect(() => {
    const el = document.documentElement;
    el.classList.add("cp");
    return () => el.classList.remove("cp");
  }, []);
}

/** The design's unboxed gradient icon: three layers on a 19x19 box, filled with a two-stop tone. */
export function Glyph({ name, tone, size = 28 }: { name: string; tone: string; size?: number }) {
  const id = useId().replace(/:/g, "");
  const gl = GLYPHS[name] ?? GLYPHS.dot;
  const [c0, c1] = TONES[tone] ?? TONES.slate;
  return (
    <svg width={size} height={size} viewBox="5.5 5.5 19 19" aria-hidden="true" style={{ display: "block", flexShrink: 0, overflow: "visible" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={c0} />
          <stop offset="1" stopColor={c1} />
        </linearGradient>
      </defs>
      <path d={gl[2]} fill={`url(#${id})`} fillOpacity={0.35} />
      <path d={gl[1]} fill={`url(#${id})`} fillOpacity={0.6} />
      <path d={gl[0]} fill={`url(#${id})`} />
    </svg>
  );
}

export type StatusTone = "ok" | "warn" | "bad" | "acc" | "info" | "mute";

/** Status = word + colour + shape (the shape comes from the tone's mask or an explicit icon class). */
export function StatusPill({ tone, shape, children }: { tone: StatusTone; shape?: "check" | "alert" | "x" | "clock" | "pause" | "off" | "dot" | "draft" | "q1" | "q2" | "q3"; children: ReactNode }) {
  return <span className={`cp-st cp-st-${tone}${shape ? ` si-${shape}` : ""}`}>{children}</span>;
}

/** EN | FR switch with the sliding indicator, as on the boards. */
export function LangSwitch() {
  const { lang, setLang } = useLanguage();
  const opts: Array<["en" | "fr", string]> = [["en", "EN"], ["fr", "FR"]];
  return (
    <div className="cp-seg" role="group" aria-label="Language" style={{ gridTemplateColumns: "repeat(2, 44px)", flexShrink: 0 }}>
      <span className="cp-seg-ind" style={{ width: 44, transform: `translateX(${lang === "fr" ? 100 : 0}%)` }} />
      {opts.map(([code, label]) => (
        <button key={code} type="button" aria-pressed={lang === code} lang={code} aria-label={code === "fr" ? "Français" : "English"} onClick={() => setLang(code)} style={{ color: lang === code ? "var(--ink)" : "var(--muted)" }}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function initialsOf(name: string | null | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Q";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "")).toUpperCase();
}

/** The page's top row: company mark, "From" + name, language switch. */
export function ClientHeader({ company, from, logoUrl }: { company: string; from: string; logoUrl?: string | null }) {
  return (
    <header className="cp-head cp-rise">
      <span className="cp-mark" aria-hidden="true">{logoUrl ? <img src={logoUrl} alt="" /> : initialsOf(company)}</span>
      <span className="cp-head-t">
        <span>{from}</span>
        <b>{company}</b>
      </span>
      <LangSwitch />
    </header>
  );
}

/** A standalone figure with the cents smaller, as the board's total (en-CA: $4,131.05, fr-CA: 4 131,05 $). */
export function BigMoney({ value, lang, size = 40, small = 24 }: { value: number; lang: "en" | "fr"; size?: number; small?: number }) {
  const parts = new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD" }).formatToParts(value);
  const fraction = parts.findIndex((p) => p.type === "decimal");
  const head = fraction === -1 ? parts : parts.slice(0, fraction);
  const tail = fraction === -1 ? [] : parts.slice(fraction);
  // fr-CA puts the "$" after the cents: keep it with the whole figure's size.
  const cents: typeof parts = [];
  const trailing: typeof parts = [];
  for (const p of tail) (p.type === "decimal" || p.type === "fraction" ? cents : trailing).push(p);
  return (
    <div className="cp-num" style={{ fontSize: size, fontWeight: 600, letterSpacing: "-0.045em", lineHeight: 1.05 }}>
      {head.map((p) => p.value).join("")}
      <span style={{ fontSize: small, color: "var(--faint)", letterSpacing: "-0.01em" }}>{cents.map((p) => p.value).join("")}</span>
      {trailing.map((p) => p.value).join("")}
    </div>
  );
}

export function money(value: string | number, lang: "en" | "fr" = "en") {
  return Number(value).toLocaleString(lang === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD" });
}
