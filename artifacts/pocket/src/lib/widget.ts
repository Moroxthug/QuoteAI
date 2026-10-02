// Website widget: the pure parts. The code to paste on the contractor's site (the widget's own script, with its key and look), and what the leads it brought say about it.
export type Theme = "light" | "dark" | "auto";
export const THEMES: Theme[] = ["light", "dark", "auto"];

/** The snippet Settings → Widget on the web gives, with the look the phone chose. The script takes the key, a colour, a theme and a language. */
export function embedCode(o: { origin: string; apiKey: string; colour: string; theme: Theme; lang: "en" | "fr" }): string {
  return [
    "<!-- QuoteAI widget -->",
    '<div id="quoteai-widget"></div>',
    "<script",
    `  src="${o.origin}/widget.js"`,
    `  data-api-key="${o.apiKey}"`,
    `  data-color="${o.colour}"`,
    `  data-theme="${o.theme}"`,
    `  data-lang="${o.lang}"`,
    "  async",
    "></script>",
  ].join("\n");
}

/** The widget's leads: how many came this month and when the last one did. A lead is the proof the form is live. */
export function widgetLeads(leads: { source: string; createdAt: string }[], now: Date): { thisMonth: number; last: Date | null } {
  const mine = leads.filter((l) => l.source === "widget");
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const last = mine.reduce<Date | null>((m, l) => { const d = new Date(l.createdAt); return !m || d > m ? d : m; }, null);
  return { thisMonth: mine.filter((l) => new Date(l.createdAt).getTime() >= start).length, last };
}

/** The words of the fields the preview shows: the name always, then what is switched on (three at most, as the board draws). */
export function previewFields(on: { phone: boolean; email: boolean; postal: boolean }, words: { name: string; phone: string; email: string; postal: string }): string[] {
  return [words.name, ...(on.phone ? [words.phone] : []), ...(on.email ? [words.email] : []), ...(on.postal ? [words.postal] : [])].slice(0, 3);
}

/** A mail to whoever builds the site: the code and one line. */
export function mailtoCode(subject: string, intro: string, code: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${intro}\n\n${code}`)}`;
}
