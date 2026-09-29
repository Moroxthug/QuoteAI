// Money and time the way the canvas writes them: "$48,230" on the cards, "$4,131.05" on a draft,
// "11:00" in the agenda, "3 pm" in the weather line (French: "48 230 $", "15 h").
export const money = (cents: number, lang: "en" | "fr", decimals = false) =>
  (cents / 100).toLocaleString(lang === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: decimals ? 2 : 0, maximumFractionDigits: decimals ? 2 : 0 });

export const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

export function hourWord(iso: string, lang: "en" | "fr"): string {
  const d = new Date(iso);
  if (lang === "fr") return `${d.getHours()} h`;
  const h = d.getHours() % 12 || 12;
  return `${h} ${d.getHours() < 12 ? "am" : "pm"}`;
}

export const dateLine = (d: Date, lang: "en" | "fr") =>
  lang === "fr" ? d.toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "short" }) : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

/** The local calendar day (YYYY-MM-DD) of a Date. */
export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
