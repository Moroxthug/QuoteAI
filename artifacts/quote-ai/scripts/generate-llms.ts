/**
 * llms.txt and llms-full.txt — the plain-text map of quoteai.ca that AI
 * search and answer engines (ChatGPT, Claude, Perplexity, Gemini, Copilot)
 * read to learn what the product is. Generated at prebuild from the same data
 * the pages render, so a price, a province or a guide can never drift from
 * what the site itself says. See https://llmstxt.org.
 *
 *   public/llms.txt       short: what quoteai is, the facts, links to every hub
 *   public/llms-full.txt  long: the same, plus every help article in full and
 *                         every guide's summary
 */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { SECTORS } from "../src/data/seo-data.js";
import { BLOG_ARTICLES, BLOG_CATEGORIES } from "../src/data/blog-data.js";
import { HELP_ARTICLES, HELP_CATEGORIES, type HelpBlock } from "../src/data/help-articles.js";
import { PILOT_PROVINCES, provinceName, provinceTaxComponents, provincePath } from "../src/data/province-data.js";
import { MARKETING_PLANS } from "../src/data/pricing.js";
import { toolPath, comparePath } from "../src/data/seo-slugs.js";
import { COMPETITORS, COMPARE_ORDER, CHECKED_AT } from "../src/data/compare-pages.js";
import { FR_GUIDES } from "../src/data/fr-guides.js";
import { TOOL_PAGES, TOOL_ORDER } from "../src/data/tool-pages.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = "https://quoteai.ca";

const taxLine = (p: (typeof PILOT_PROVINCES)[number]) =>
  provinceTaxComponents(p).map((c) => `${c.code} ${c.rate} %`).join(" + ");

const plans = MARKETING_PLANS.map((p) => {
  const price = p.monthly === null ? "custom price" : `CA$${p.monthly}/month`;
  const quota = p.quotaPerMonth === null ? (p.monthly === null ? "" : ", unlimited quotes") : `, ${p.quotaPerMonth} AI quotes a month`;
  return `- ${p.name}: ${price}${quota}`;
}).join("\n");

const sectorLinks = Object.entries(SECTORS)
  .map(([slug, s]) => `- [${s.labelPlural.replace(/^./, (c) => c.toUpperCase())}](${BASE}/quotes/${slug}/): ${s.metaDescription}`)
  .join("\n");

const sectorLinksFr = Object.values(SECTORS)
  .map((s) => `- [${s.fr.labelPlural.replace(/^./, (c) => c.toUpperCase())}](${BASE}/fr/soumissions/${s.frSlug}/)`)
  .join("\n");

const provinceLinks = PILOT_PROVINCES.map(
  (p) => `- [${provinceName(p, "en")}](${BASE}${provincePath(p, "en")}): sales tax on quotes and invoices shown as ${taxLine(p)}.`,
).join("\n");

const provinceLinksFr = PILOT_PROVINCES.map(
  (p) => `- [${provinceName(p, "fr")}](${BASE}${provincePath(p, "fr")})`,
).join("\n");

const toolLinks = (lang: "en" | "fr") =>
  TOOL_ORDER.map((id) => `- [${TOOL_PAGES[id].h1[lang].replace(/[.?]$/, "")}](${BASE}${toolPath(lang, id)}): ${TOOL_PAGES[id].short[lang]}`).join("\n");

const compareLinks = (lang: "en" | "fr") =>
  COMPARE_ORDER.map((id) => `- [quoteai ${lang === "fr" ? "ou" : "vs"} ${COMPETITORS[id].name}](${BASE}${comparePath(lang, id)})`).join("\n");

const helpLinks = HELP_ARTICLES.map((a) => `- [${a.title.en}](${BASE}/help/${a.slug}/): ${a.summary.en}`).join("\n");

const newest = [...BLOG_ARTICLES].sort((a, b) => (b.updatedAt ?? b.publishedAt).localeCompare(a.updatedAt ?? a.publishedAt));
const blogLinks = (list: typeof BLOG_ARTICLES) =>
  list.map((a) => `- [${a.title}](${BASE}/blog/${a.slug}/): ${a.metaDescription}`).join("\n");

const intro = `# quoteai

> quoteai (quoteai.ca) is quoting and job-management software for Canadian trade contractors and small service businesses. A contractor describes a job in plain words, by text or voice, and quoteai drafts a professional quote in about 30 seconds: line items, quantities, unit prices and the correct Canadian sales tax for the customer's province. The same numbers then flow into the contract, e-signature, deposit, job, invoice and payment. It works in English and French (Canada), on the web and as an Android app.

Key facts:
- Who it is for: independent tradespeople and small contracting firms in Canada (painters, electricians, plumbers, roofers, HVAC technicians, general contractors, landscapers, cleaners and more).
- Market: Canada only. Launching first in British Columbia, Ontario and Québec (the pilot provinces).
- Languages: English (en-CA) and French (fr-CA); quotes can be written in either language for the customer.
- Taxes: GST, HST, PST and QST are shown as separate lines, as the CRA and provincial ministries expect, never one blended rate.
- Payments: customers pay by Interac e-Transfer, cheque or card; card payments go to the contractor's own Stripe account.
- Trial: 7 days free, no credit card. A single quote can also be bought without a plan.
- Prices are in Canadian dollars, before tax.
- Company: quoteai, Canada. Contact: info@quoteai.ca.

## Plans

${plans}

Annual billing charges ten months for a year. Details: [Pricing](${BASE}/pricing/).

## Product

- [Home](${BASE}/): what quoteai does, a sample AI quote, plans.
- [Pricing](${BASE}/pricing/): plans, free trial, single-quote purchase, FAQ.
- [Pilot](${BASE}/pilot/): the BC, Ontario and Québec launch.
- [WhatsApp quotes](${BASE}/whatsapp/): create and send quotes from WhatsApp.
- [About](${BASE}/about/): who builds quoteai and why.
- [Contact](${BASE}/contact/)
- [Help centre](${BASE}/help/): how-to articles for every part of the product.
- [Blog](${BASE}/blog/): Canadian cost guides and how-to-quote guides for trades.

## Free calculators

Free, no sign-up, in English and French: [all calculators](${BASE}/tools/).

${toolLinks("en")}

## Comparisons

quoteai next to Jobber, Joist and Housecall Pro for Canadian contractors, with each company's published prices (checked ${CHECKED_AT}) and when each is the better pick: [all comparisons](${BASE}/compare/).

${compareLinks("en")}

## Provinces

${provinceLinks}

## Quoting software by trade

${sectorLinks}

## Help centre

${helpLinks}
`;

const frSection = `
## En français

quoteai est un logiciel de soumissions et de gestion de chantiers pour les entrepreneurs et gens de métier au Canada. Décrivez le travail en quelques mots et obtenez en 30 secondes une soumission professionnelle avec les bonnes taxes (TPS, TVH, TVP, TVQ) pour la province du client, puis le contrat, la signature, l'acompte, la facture et le paiement. Essai gratuit de 7 jours, sans carte de crédit.

- [Accueil](${BASE}/fr/)
- [Tarifs](${BASE}/fr/tarifs/)
- [Projet pilote](${BASE}/fr/pilote/)

Calculateurs gratuits ([tous](${BASE}/fr/outils/)) :
${toolLinks("fr")}

Guides pour les entrepreneurs du Québec ([tous](${BASE}/fr/guides/)) :
${FR_GUIDES.map((g) => `- [${g.h1.replace(/\.$/, "")}](${BASE}/fr/guides/${g.slug}/) : ${g.short}`).join("\n")}

Comparaisons ([toutes](${BASE}/fr/comparer/)) :
${compareLinks("fr")}

Provinces :
${provinceLinksFr}

Soumissions par métier :
${sectorLinksFr}
`;

const short = `${intro}
## Guides (newest first)

${blogLinks(newest.slice(0, 25))}

All ${BLOG_ARTICLES.length} guides: [Blog](${BASE}/blog/). Full text of the help centre: [llms-full.txt](${BASE}/llms-full.txt).
${frSection}`;

const blockText = (b: HelpBlock): string => {
  switch (b.type) {
    case "p": return b.text.en;
    case "h": return `### ${b.text.en}`;
    case "note": return `Note: ${b.text.en}`;
    case "steps": return b.items.map((i, n) => `${n + 1}. ${i.en}`).join("\n");
    case "bullets": return b.items.map((i) => `- ${i.en}`).join("\n");
  }
};

const helpFull = HELP_ARTICLES.map(
  (a) => `## ${a.title.en}

Source: ${BASE}/help/${a.slug}/ (${HELP_CATEGORIES[a.category].en}, updated ${a.updatedAt})

${a.summary.en}

${a.blocks.map(blockText).join("\n\n")}
`,
).join("\n");

const guidesByCategory = BLOG_CATEGORIES.map((c) => {
  const list = BLOG_ARTICLES.filter((a) => a.category === c.name || a.category === c.slug);
  return list.length ? `### ${c.name}\n\n${blogLinks(list)}\n` : "";
}).filter(Boolean).join("\n");

const full = `${intro}
# Help centre, in full
${helpFull}
# All guides

${guidesByCategory}
${frSection}`;

writeFileSync(join(__dirname, "../public/llms.txt"), short, "utf-8");
writeFileSync(join(__dirname, "../public/llms-full.txt"), full, "utf-8");
console.log(`llms.txt written (${short.length} chars), llms-full.txt (${full.length} chars)`);
