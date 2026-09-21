import { useEffect } from "react";

/**
 * Sets `document.title` for the life of the component and restores the
 * previous one on unmount — the SPA shell otherwise leaves the marketing
 * homepage title on every public page (Phase 67). Pass `null` while the
 * page is still loading to leave the title alone.
 */
export function useDocumentTitle(title: string | null | undefined): void {
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
