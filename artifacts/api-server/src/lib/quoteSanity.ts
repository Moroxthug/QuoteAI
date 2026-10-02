// Pocket 128.11: a check on a generated quote before the person sees it. The model sometimes gets the scale of a big job wrong (a whole-house renovation priced like one floor, painting taking a third of
// the total, cleanup at $500). This reads the floor area and the number of floors from what the person wrote, looks at each chapter's share of the total, and says in words what is off, so the model can
// be asked once to correct it. Pure, so it can be tested without a model.

export type SanityChapter = { titolo: string; subtotale: number };

const SQFT_PER_SQM = 10.7639;
const NUM_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

/** The floor area the person described, in square metres, and how many floors it covers. Null when no area is written. */
export function floorAreaOf(text: string): { areaSqm: number; floors: number; perFloor: boolean; totalSqm: number } | null {
  const t = text.toLowerCase();
  const re = /(\d[\d,]*(?:\.\d+)?)\s*(sq\.?\s?m\b|sqm\b|m2\b|m²|square met(?:re|er)s?|sq\.?\s?ft\b|sqft\b|square feet|square foot)/g;
  let best = 0;
  let bestEach = false;
  for (let m = re.exec(t); m; m = re.exec(t)) {
    const n = Number(m[1]!.replace(/,/g, ""));
    if (!Number.isFinite(n)) continue;
    const sqm = /ft|feet|foot/.test(m[2]!) ? n / SQFT_PER_SQM : n;
    const around = t.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40);
    const each = /\beach\b|per floor|every floor|per level/.test(around);
    if (sqm > best) { best = sqm; bestEach = each; } else if (sqm === best && each) bestEach = true;
  }
  if (!best) return null;
  let floors = 1;
  const f = /(\d+|one|two|three|four|five|six)\s*(?:\w+\s){0,2}?(?:floors?|stor(?:e)?ys?|levels?)/.exec(t);
  if (f) floors = Number(f[1]) || NUM_WORDS[f[1]!] || 1;
  if (/(plus|with|and)\s+(a\s+)?basement/.test(t)) floors += 1;
  if (/\b4 floors\b|four floors/.test(t)) floors = Math.max(floors, 4);
  const perFloor = bestEach && floors > 1;
  return { areaSqm: best, floors, perFloor, totalSqm: perFloor ? best * floors : best };
}

const TRADES = ["electrical", "plumbing", "demolition", "flooring", "roofing", "painting", "framing", "drywall", "kitchen", "bathroom"];

/** Whether the description is a whole-building renovation (several trades from scratch), where a price per square metre is a fair check. */
export function isWholeBuilding(text: string): boolean {
  const t = text.toLowerCase();
  return /renovat|remodel|gut\b|rebuild|from scratch|turnkey/.test(t) && TRADES.filter((k) => t.includes(k)).length >= 3;
}

/** Share limits for a chapter by what it is about: painting cannot be a third of a house, cleanup cannot be everything. */
const SHARE_LIMITS: { match: RegExp; label: string; max: number }[] = [
  { match: /paint|decorat/, label: "painting", max: 0.12 },
  { match: /clean/, label: "cleanup", max: 0.04 },
  { match: /site setup|mobili[sz]ation|protection/, label: "site setup", max: 0.06 },
  { match: /floor/, label: "flooring", max: 0.18 },
  { match: /demoli/, label: "demolition", max: 0.12 },
];

/** Plain-words problems with a quote, or an empty list when it looks plausible. */
export function quoteProblems(rawInput: string, chapters: SanityChapter[], subtotal: number): string[] {
  const out: string[] = [];
  if (!(subtotal > 0)) return out;
  for (const c of chapters.length >= 4 ? chapters : []) {
    const title = c.titolo.toLowerCase();
    const rule = SHARE_LIMITS.find((r) => r.match.test(title));
    if (rule && c.subtotale / subtotal > rule.max) out.push(`"${c.titolo}" is ${Math.round((c.subtotale / subtotal) * 100)}% of the total; ${rule.label} is normally under ${Math.round(rule.max * 100)}%.`);
  }
  if (isWholeBuilding(rawInput)) {
    const a = floorAreaOf(rawInput);
    if (a) {
      const per = subtotal / a.totalSqm;
      if (per < 1500) out.push(`The subtotal is about $${Math.round(per)} per square metre of floor area (${Math.round(a.totalSqm)} m² in total${a.floors > 1 ? `, ${a.floors} floors` : ""}); a whole-building renovation from scratch in Canada is normally $1,600 to $4,500 per square metre. The quantities or unit prices are too low.`);
      if (per > 6500) out.push(`The subtotal is about $${Math.round(per)} per square metre of floor area (${Math.round(a.totalSqm)} m² in total); that is far above a normal $1,600 to $4,500. Check the quantities.`);
    }
  }
  return out;
}

/** The message sent back to the model when something is off. */
export function correctionMessage(problems: string[], rawInput: string): string {
  const a = floorAreaOf(rawInput);
  const area = a ? ` Total floor area to price: ${Math.round(a.totalSqm)} m² (${Math.round(a.areaSqm)} m²${a.perFloor ? ` on each of ${a.floors} floors` : ""}).` : "";
  return `Your quote has problems:\n- ${problems.join("\n- ")}\n${area}\nRebuild the whole quote. Compute every quantity from the stated floor area, use realistic Canadian unit prices, keep each trade within its typical share of the total, and return the full JSON again.`;
}
