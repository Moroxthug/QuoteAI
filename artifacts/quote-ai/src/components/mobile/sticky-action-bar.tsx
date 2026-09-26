import type { ReactNode } from "react";

/**
 * Phase 100 — a screen's one primary action within thumb reach
 * (docs/MOBILE-RULES.md rule 2). On desktop it is an ordinary right-aligned
 * row wherever it is placed; under 640 px it docks to the bottom of the
 * screen, above the tab bar and the home indicator, and leaves a spacer so
 * the end of the page is never hidden under it.
 *
 * Children: at most one `.btn.secondary` and the primary `.btn`, then an
 * optional <ActionSheet/> for the rest. The primary carries
 * `data-primary-action` so the qa:visual phone check can find it.
 *
 *   <StickyActionBar>
 *     <ActionSheet actions={…} />
 *     <button className="btn btn-navy" data-primary-action>Send</button>
 *   </StickyActionBar>
 */
export function StickyActionBar({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <>
      <div className="action-bar-spacer" aria-hidden="true" />
      <div className="action-bar" role="group" aria-label={label}>
        {children}
      </div>
    </>
  );
}
