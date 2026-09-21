import type { KeyboardEvent } from "react";

/**
 * Props for a table row that acts as a link to a detail page. A bare
 * `onClick` on a <tr> is invisible to the keyboard and to screen readers
 * (Phase 66); this adds focus, a role and Enter/Space activation.
 */
export function rowLink(go: () => void) {
  return {
    onClick: go,
    role: "link" as const,
    tabIndex: 0,
    className: "cursor-pointer",
    onKeyDown: (e: KeyboardEvent<HTMLTableRowElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        go();
      }
    },
  };
}
