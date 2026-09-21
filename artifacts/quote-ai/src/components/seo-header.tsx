import { StrictMode, useLayoutEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { Logo } from "@/components/logo";
import { useScrolled } from "@/hooks/use-scrolled";
import { cn } from "@/lib/utils";

// The interactive header for the statically prerendered SEO/blog pages. It
// renders the same markup as STATIC_HEADER / STATIC_HEADER_FR in
// scripts/prerender-seo.ts (same height, same links) and main.tsx mounts it
// INTO that static <header>, replacing its children — so the only visible
// change after JavaScript runs is the session-aware "Dashboard →" button.
// Phase 68: it used to be inserted as a second header above the static one,
// with Italian labels ("Accedi / Registrati") — every sector, city and blog
// page shipped two headers and a 64 px layout shift.
const LABELS = {
  en: { signIn: "Sign in", signUp: "Sign up", home: "/" },
  fr: { signIn: "Se connecter", signUp: "S'inscrire", home: "/fr" },
} as const;

function SeoHeaderInner({ lang }: { lang: "en" | "fr" }) {
  const { data: session } = authClient.useSession();
  const isSignedIn = !!session?.user;
  const scrolled = useScrolled(20);
  const t = LABELS[lang];

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300",
        scrolled ? "navbar-glass" : "bg-transparent border-b border-transparent"
      )}
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href={t.home} className="flex items-center">
          <Logo />
        </a>
        <nav className="flex items-center gap-3">
          {!isSignedIn ? (
            <>
              <a
                href="/sign-in/"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full"
              >
                {t.signIn}
              </a>
              <a
                href="/sign-up/"
                className="btn-gradient inline-flex h-9 items-center justify-center px-5 text-sm font-semibold"
              >
                {t.signUp}
              </a>
            </>
          ) : (
            <a
              href="/dashboard"
              className="btn-gradient inline-flex h-9 items-center justify-center px-5 text-sm font-semibold"
            >
              Dashboard →
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}

/**
 * Mounted next to the static header; `replaces` is that header, removed in a
 * layout effect — i.e. in the same frame the React header is committed, so
 * the page never has zero or two headers for a paint (a plain
 * `replaceWith(mount)` before render() left a 64 px gap for one frame:
 * CLS 0.16–0.49 on the sector and blog pages).
 */
export function SeoNavShell({ lang, replaces }: { lang: "en" | "fr"; replaces: HTMLElement }) {
  useLayoutEffect(() => {
    replaces.remove();
  }, [replaces]);
  return (
    <StrictMode>
      <SeoHeaderInner lang={lang} />
    </StrictMode>
  );
}
