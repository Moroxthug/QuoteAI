import type { ReactNode } from "react";
import { PlayCircle, RotateCw } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";

/**
 * Phase 120 — every state a screen can be in, designed once
 * (docs/APP-DESIGN.md §3 "Empty states", APP-PLAN Phase 120):
 *
 * - EmptyState: a quiet line drawing in the title colour with one teal
 *   detail, one sentence, one button — and, when there is one, a "Watch how"
 *   video (Track C). No mascots, glow or gradients.
 * - ErrorState: what happened in plain words and Try again. Never a stack
 *   trace or a status code.
 * - OfflineState: the screen was never opened with a signal, so nothing is
 *   saved for it yet (what has been opened stays readable offline, Phase 116).
 * - NoAccess: not part of this person's role.
 * - PlanLocked: not on the company's plan; the caller passes the way up
 *   (UpgradeLink, which says "not in the app" in the phone app).
 *
 * Loading is the skeletons (components/skeletons.tsx), shown only past 300 ms.
 * All of them are in the catalogue at /dashboard/__states (dev), which the
 * phone sheets (qa:visual) photograph in both languages.
 */

export type StateArt = "quotes" | "jobs" | "invoices" | "clients" | "leads" | "search" | "notifications" | "error" | "offline" | "lock";

/** 96×72 line drawings: currentColor (the title colour) with one teal stroke. */
function Art({ art }: { art: StateArt }) {
  const teal = { stroke: "var(--teal)" };
  const body = (() => {
    switch (art) {
      case "quotes":
        return (<>
          <path d="M30 8h28l10 10v46H30z" /><path d="M58 8v10h10" />
          <path d="M37 30h22M37 38h22M37 46h14" />
          <path d="M52 56h9" style={teal} />
        </>);
      case "jobs":
        return (<>
          <path d="M22 62h52" /><path d="M30 62V36l18-14 18 14v26" />
          <path d="M42 62V48h12v14" />
          <path d="M62 16v10M57 21h10" style={teal} />
        </>);
      case "invoices":
        return (<>
          <path d="M32 8h32v56l-5-4-5 4-5-4-5 4-5-4-5 4-2-2z" />
          <path d="M39 22h18M39 30h18M39 38h10" />
          <path d="M44 50h12" style={teal} />
        </>);
      case "clients":
        return (<>
          <circle cx="40" cy="28" r="9" /><path d="M24 60c2-10 8-15 16-15s14 5 16 15" />
          <circle cx="62" cy="30" r="7" style={teal} /><path d="M58 45c6 0 11 4 13 13" style={teal} />
        </>);
      case "leads":
        return (<>
          <circle cx="48" cy="36" r="24" /><circle cx="48" cy="36" r="14" />
          <circle cx="48" cy="36" r="4" style={teal} />
        </>);
      case "search":
        return (<>
          <circle cx="44" cy="32" r="16" /><path d="M56 44l14 14" />
          <path d="M38 32h12" style={teal} />
        </>);
      case "notifications":
        return (<>
          <path d="M34 50V34a14 14 0 0 1 28 0v16l5 6H29z" /><path d="M44 62a4 4 0 0 0 8 0" />
          <path d="M66 18l4-4M70 26h5" style={teal} />
        </>);
      case "error":
        return (<>
          <path d="M48 10l30 52H18z" /><path d="M48 30v14" />
          <circle cx="48" cy="52" r="1.5" style={teal} />
        </>);
      case "offline":
        return (<>
          <path d="M30 54h36a12 12 0 0 0 0-24 18 18 0 0 0-34-4 14 14 0 0 0-2 28z" />
          <path d="M26 16l44 44" style={teal} />
        </>);
      case "lock":
        return (<>
          <rect x="30" y="32" width="36" height="30" rx="4" /><path d="M36 32v-8a12 12 0 0 1 24 0v8" />
          <path d="M48 44v8" style={teal} />
        </>);
    }
  })();
  return (
    <svg className="state-art" viewBox="0 0 96 72" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {body}
    </svg>
  );
}

function StateShell({ art, title, body, children, compact, role }: { art: StateArt; title: ReactNode; body?: ReactNode; children?: ReactNode; compact?: boolean; role?: "alert" | "status" }) {
  return (
    <div className={cn("state", compact && "compact")} role={role}>
      <Art art={art} />
      <p className="state-title">{title}</p>
      {body && <p className="state-body">{body}</p>}
      {children && <div className="state-actions">{children}</div>}
    </div>
  );
}

export function EmptyState({ art, title, body, action, watch, compact }: {
  art: StateArt;
  /** The one sentence: what this is, or what is not here yet. */
  title: ReactNode;
  body?: ReactNode;
  /** The one action (a button or link). */
  action?: ReactNode;
  /** A "Watch how" video for this screen (Track C), when one exists. */
  watch?: { href: string; label?: string };
  compact?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <StateShell art={art} title={title} body={body} compact={compact}>
      {action}
      {watch && (
        <a className="state-watch" href={watch.href} target="_blank" rel="noopener noreferrer">
          <PlayCircle aria-hidden="true" /> {watch.label ?? t("states.watch")}
        </a>
      )}
    </StateShell>
  );
}

export function ErrorState({ onRetry, title, body, compact }: { onRetry?: () => void; title?: ReactNode; body?: ReactNode; compact?: boolean }) {
  const { t } = useLanguage();
  // With no signal the honest answer is "offline", not "something went wrong".
  if (typeof navigator !== "undefined" && navigator.onLine === false) return <OfflineState compact={compact} onRetry={onRetry} />;
  return (
    <StateShell art="error" title={title ?? t("states.error.title")} body={body ?? t("states.error.body")} compact={compact} role="alert">
      {onRetry && (
        <button type="button" className="btn btn-sm btn-outline-navy" onClick={onRetry}>
          <RotateCw className="h-4 w-4" aria-hidden="true" /> {t("states.error.retry")}
        </button>
      )}
    </StateShell>
  );
}

export function OfflineState({ onRetry, compact }: { onRetry?: () => void; compact?: boolean }) {
  const { t } = useLanguage();
  return (
    <StateShell art="offline" title={t("states.offline.title")} body={t("states.offline.body")} compact={compact} role="status">
      {onRetry && (
        <button type="button" className="btn btn-sm btn-outline-navy" onClick={onRetry}>
          <RotateCw className="h-4 w-4" aria-hidden="true" /> {t("states.error.retry")}
        </button>
      )}
    </StateShell>
  );
}

export function NoAccess({ body, compact }: { body?: ReactNode; compact?: boolean }) {
  const { t } = useLanguage();
  return <StateShell art="lock" title={t("states.denied.title")} body={body ?? t("states.denied.body")} compact={compact} />;
}

export function PlanLocked({ title, body, action, compact }: { title?: ReactNode; body: ReactNode; /** The way up (UpgradeLink). */ action?: ReactNode; compact?: boolean }) {
  const { t } = useLanguage();
  return (
    <StateShell art="lock" title={title ?? t("states.locked.title")} body={body} compact={compact}>
      {action}
    </StateShell>
  );
}
