// Help: the pure parts. The articles (both languages, copied from the web help centre), the search over their titles, summaries and words, how many there are in each topic, and what to
// read next.
import { HELP_ARTICLES, HELP_CATEGORIES, type HelpArticle, type HelpBlock, type HelpCategory } from "../content/helpArticles.ts";

export type Lang = "en" | "fr";
export type { HelpArticle, HelpBlock, HelpCategory };
export const ARTICLES: HelpArticle[] = HELP_ARTICLES;
export const CATEGORIES = Object.keys(HELP_CATEGORIES) as HelpCategory[];
export const categoryName = (c: HelpCategory, l: Lang): string => HELP_CATEGORIES[c][l];

const fold = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** What an article says, as one string to search: title, summary and every block's words. */
export function textOf(a: HelpArticle, l: Lang): string {
  const parts: string[] = [a.title[l], a.summary[l], HELP_CATEGORIES[a.category][l]];
  for (const b of a.blocks) {
    if (b.type === "steps" || b.type === "bullets") for (const i of b.items) parts.push(i[l]);
    else parts.push(b.text[l]);
  }
  return fold(parts.join(" "));
}

/** The articles that mention every word of the search, those that name it in the title first. */
export function search(list: HelpArticle[], term: string, l: Lang): HelpArticle[] {
  const words = fold(term).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return list
    .filter((a) => { const t = textOf(a, l); return words.every((w) => t.includes(w)); })
    .map((a) => ({ a, inTitle: words.every((w) => fold(a.title[l]).includes(w)) }))
    .sort((x, y) => Number(y.inTitle) - Number(x.inTitle))
    .map((x) => x.a);
}

export const countsByTopic = (list: HelpArticle[]): { topic: HelpCategory; n: number }[] => CATEGORIES.map((topic) => ({ topic, n: list.filter((a) => a.category === topic).length })).filter((c) => c.n > 0);

/** Two more to read: the same topic first, then the next ones in order. */
export function related(a: HelpArticle, list: HelpArticle[], n = 2): HelpArticle[] {
  const others = list.filter((x) => x.slug !== a.slug);
  return [...others.filter((x) => x.category === a.category), ...others.filter((x) => x.category !== a.category)].slice(0, n);
}

export const popular = (list: HelpArticle[], n = 5): HelpArticle[] => list.slice(0, n);
export const findBySlug = (slug: string | undefined): HelpArticle | undefined => (slug ? ARTICLES.find((a) => a.slug === slug) : undefined);
