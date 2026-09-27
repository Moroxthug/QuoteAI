import { ChevronDown } from "lucide-react";

/**
 * Phase 112 — questions as a folded list (homepage and /pricing). Seven
 * answer cards were three phone screens on /pricing; a question you can open
 * is one line until you want it.
 */
export function FaqList({ items }: { items: ReadonlyArray<{ q: string; a: string }> }) {
  return (
    <div className="faq-list">
      {items.map((item) => (
        <details key={item.q} className="faq-item">
          <summary>
            <h3>{item.q}</h3>
            <ChevronDown className="faq-chev h-4 w-4" aria-hidden="true" />
          </summary>
          <p>{item.a}</p>
        </details>
      ))}
    </div>
  );
}
