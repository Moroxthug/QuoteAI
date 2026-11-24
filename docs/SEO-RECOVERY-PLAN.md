# SEO recovery plan: quoteai.ca (2026-11-22)

Audit date 2026-11-22. Sources: Search Console (read in the owner's Chrome), a live crawl of all 290 sitemap URLs as Googlebot smartphone, a code review of artifacts/quote-ai, a content review of every article and page family, and Lighthouse on 8 URLs. Raw data from the audit is in the session scratchpad and is not kept in the repo.

## 1. What the numbers say

| Period | Impressions/day | Clicks | Avg position |
|---|---|---|---|
| 14 Sept – 6 Oct | 30–126 (peak ~100) | 5 | 20–60 |
| 7 Oct – 6 Nov | 3–46 | 6 | 7–50 |
| 7 Nov – 20 Nov | 78–343 | 4 | 44–74 |

- Impressions have **not** fallen again: they are at their highest since launch. 18–20 Nov were 261, 175 and 343. Over the last 3 months the site got 4.61k impressions, 17 clicks, a 0.4 % CTR and an average position of 46.
- **The problem is position and intent, not visibility.** Most impressions are on pages 5–9 of Google for homeowner cost questions that never turn into a contractor sign-up:
  - /blog/cost-to-install-windows-and-doors-canada/: 408 impressions, position 54
  - heat pump: 375 impressions, position 77
  - furnace: 290 impressions, position 52
  - concrete driveway: 155 impressions, position 75
  - The blog as a whole: 2,378 impressions, 2 clicks.
- What does earn clicks is contractor-intent French:
  - /fr/soumissions/travailleur-autonome/: position 7.9, 10 % CTR
  - /fr/soumissions/modele-soumission-word/: position 8.1
  - "modèle de soumission word": position 8–9
  - /fr/outils/calculateur-taux-horaire/: position 14.6
  - The brand query "quoteai": position 6.7
- Indexing: 422 indexed, 333 not.
  - 184 are "alternative page with canonical", mostly www and old URLs. That is harmless.
  - 117 are "Discovered – not indexed" and 16 "Crawled – not indexed". These are the quality signal.
  - The "Request indexing" quota has been blocked since 11 Nov.
- Authority: Ahrefs DR is 12, against Joist 67 and Jobber 79.

**Diagnosis.** The technical layer is sound. What holds the site back is a page mix that tells Google "scaled site". About 59 % of the indexable URLs are templates, several pages still carry PrevAI (Italian) leftovers, and the 60 short blog posts have backdated dates, no named author and no sources. Most of the blog also targets homeowners rather than contractors. Google crawls the site rarely and ranks it low across the board. Speed is not a factor: Google has no field data for the site, and lab mobile scores are 89–96.

## 2. Audit findings

### Technical (crawl plus code)
**Clean:**
- All 290 sitemap URLs are 200, prerendered, and have a self canonical with the trailing slash.
- Hreflang is reciprocal.
- Each page has one title, one meta description and one H1. No duplicate titles.
- JSON-LD parses on every page and no image is missing alt text.
- www, http and vercel.app all 308 to the apex.

**Defects:**

| # | Severity | Defect | Evidence |
|---|---|---|---|
| T1 | P0 | Every unknown URL returns 200 with the home page and `noindex` (a soft 404), including `/quotes/` and `/fr/soumissions/` | vercel.json:46 catch-all to spa.html; prerender-seo.ts:253 |
| T2 | P0 | 18 FR trade pages link to 90 FR city pages that don't exist (`/fr/soumissions/peintre/toronto/` etc., 180 links) | seo-render-engine nearby-cities block |
| T3 | P1 | Every FR page links to `/fr`, which 308s (165 links), so `/fr/` has almost no direct internal links. 179 internal links go through a redirect in total | public-layout header/footer |
| T4 | P1 | FR header and footer link to EN pages (`/`, `/blog/`, `/about/`…). The language switch is a `<button>`, not a link | public-layout |
| T5 | P1 | `/blog/category/innovation/` has 0 articles but is in the sitemap; `/index.html` returns 200 | sitemap-routes |
| T6 | P2 | The dev canonical script still ships in production (it would override any future cross-canonical) | index.html:26-65; prerender-seo.ts:63 |
| T7 | P2 | 111 titles are over 60 characters, 56 descriptions over 160, and 171 lastmods share one date | crawl |
| T8 | P2 | Two-hop redirects (`http://www.`, `/quotes/x/halifax` without a slash) | vercel.json:24,27 |

### Spam-policy exposure (the likely cause of the October drop)
| # | Severity | Finding |
|---|---|---|
| Q1 | P0 | **Scaled template pages.** 108 EN trade×city pages and 18 FR Montréal pages. Only about 6 % of each EN city page's text appears nowhere else in its family (FR Montréal 17 %). Intros are 4 spun variants picked by a hash. The pages contain unverifiable claims ("[city] sees thousands of … jobs"), and painter pages list "Roofing" as a top service. |
| Q2 | P0 | **FR trade pages are one template with the trade name swapped in** (84 % shared text) and contain broken French ("le type de plombier à effectuer"). |
| Q3 | P0 | **Italian PrevAI mock quote on all 44 trade pages** ("Generato con AI", "P.IVA 01234567890", "IVA 22%", "Spett.le Cliente"), in the indexed HTML (quote-preview-mockup.tsx, used in pages/seo/[type].tsx:362). |
| Q4 | P0 | **Doorway pages left over from PrevAI.** `/quotes/excel-template/`, `/quotes/word-template/`, `/quotes/free-quote/`, `/quotes/how-to-quote/` and `/quotes/freelance/` are trade-template pages that offer no template. `decorative-painter` and `building-consultant` are Italian trade categories. |
| Q5 | P1 | **Self-serving review markup.** The home page shows "5.0/5 average verified rating" with `AggregateRating` reviewCount 2 from two testimonials whose websites don't respond (json-ld.ts:127; testimonials-section.tsx). |
| Q6 | P1 | **170 pages each claim to be a free SoftwareApplication** (`price: "0"`), which contradicts the paid plans. FAQPage markup is on every template page. |
| Q7 | P1 | **Backdated articles.** 16 posts dated March–Sept 2026 first appear on 2026-09-10; 43 posts were committed in 4 days. Stated reading times are inflated (a 214-word article says "6 min"). |

### Content
- **Blog:**
  - 59 EN articles, median 322 words. 58 are under 600 words and 26 under 300.
  - 0 external links, no named author, no `updatedAt`, no FR blog.
  - 296 unsourced dollar figures.
  - The 11 "how to quote X" posts (198–283 words) share one skeleton.
  - The Greener Homes article ignores that the grant closed to new applicants in 2024. It also credits Rénoclimat to Hydro-Québec; check this attribution before rewriting.
- **Cannibalisation:**
  - Quote-writing: 5 posts + 2 template pages.
  - Templates: 4 pages, none with a download.
  - Pricing/markup: 2 posts + 1 tool.
  - Software choice: 2 posts + /compare.
  - Each trade has 3 competing posts (cost / how-to-quote / get more jobs).
- **E-E-A-T:** no person anywhere on the site. The About page has no names, founding date or Canadian address, and there are no real screenshots, case studies or editorial policy. **The exception is the 3 FR guides** (dated, citing RBQ / Revenu Québec / LégisQuébec / OQLF), which are the model for everything else.
- **Strong pages to protect:** tools (84 % unique), FR guides, compare pages, help, `/fr/soumissions/travailleur-autonome/`, `/fr/soumissions/modele-soumission-word/`.
- **Missing pages for real buyer queries:**
  - estimate/estimating software
  - invoicing software for contractors (EN/FR)
  - contractor CRM
  - a contract template
  - job costing
  - a downloadable quote template (.xlsx/.docx)
  - a FR blog built from Québec topics

### Speed and stack
- **Verdict on the stack: keep it.** The Vite + React prerender with `react-dom/static` gives Googlebot complete HTML; no framework migration is needed.
- **Speed is not a ranking factor here.** CrUX has no data for the site. Lab mobile 89–96, desktop 93–100, TTFB under 50 ms from the edge cache, SEO and accessibility 100.
- **Real-user fixes:**
  - **P1, hydration error #418** on `/`, `/fr/`, `/blog/` and posts. React discards the server HTML, doubling main-thread work and causing CLS 0.149 on desktop home. Likely cause: `toLocaleDateString` without `timeZone` (home.tsx:427, blog/index.tsx:29, blog/[slug].tsx:13).
  - **P2, blog posts load `blog-data.ts` whole.** The 155 KB chunk isn't preloaded, so post LCP render is delayed by 1.2 s.
  - **P2, marketing pages call `/api/me/allowance`** and get a 401 console error.
  - **P2, dashboard routes in the App chunk:** 35 KB of unused JS on every page.
  - **P2, no long cache** on `/fonts/`.

## 3. The plan

Principle: **act now on everything Google can see, measure against clicks and sign-ups, not impressions.** Removing the templated pages and the homeowner cost posts will lower impressions for 2–4 weeks; those impressions are at positions 50–90 and have produced 2 clicks in 3 months. Rankings react after Google recrawls (typically 2–8 weeks for a site this size), so the sooner S1 ships the sooner the clock starts.

### S1: Remove the spam signals (P0; 1–2 days; ship immediately)
1. Replace the Italian mock quote with a Canadian sample (CAD, GST/HST/QST, a Canadian address, "Prepared with quoteai") built from i18n strings (Q3).
2. **City grid:**
   - `noindex,follow` all 108 EN and 18 FR trade×city pages and drop them from the sitemap.
   - Keep the URLs live, so there are no 404s and no redirect storm. In 4–6 weeks, 301 each one to its trade page.
   - Move the real local facts (provincial regulator, permit office, tax line, consumer-contract rule) into the province pages; add Alberta (Q1).
3. **Doorway and Italian pages:**
   - 301 `/quotes/excel-template/`, `/quotes/word-template/` and `/quotes/free-quote/` (EN and FR) to one new template page (built in S3; until then, to `/tools/`).
   - 301 `/quotes/how-to-quote/` to the quote-writing pillar post.
   - 301 `decorative-painter` → `painter`, `building-consultant` → `general-contractor`, `air-conditioning-installer` → `hvac-technician`, `renovation-contractor` → `general-contractor`.
   - **Exception:** keep `/fr/soumissions/modele-soumission-word/` and `/fr/soumissions/travailleur-autonome/` indexed. They are the site's best French pages (position 8, the only pages with real CTR) and get rewritten by hand in S3, not redirected (Q4).
4. **Structured data:**
   - Remove `AggregateRating` and the Review items, and the "5.0/5 verified rating" line, until there are verifiable third-party reviews (Q5).
   - Keep one SoftwareApplication (with the real starting price) on `/` and `/pricing/`; everywhere else, BreadcrumbList only.
   - FAQPage only where a real FAQ section exists (Q6).
5. **FR trade pages:** `noindex,follow` the label-swap pages, except the two above, until each is hand-written in S3 (Q2).
6. **Blog dates:**
   - Set `publishedAt` to the real first-commit date.
   - Add `updatedAt`, shown and also used in JSON-LD.
   - Compute reading time from the actual word count (Q7).

Done when: a crawl shows no Italian strings and no AggregateRating; 126 city pages and the noindexed FR trade pages are out of the sitemap with `noindex`; the redirects return a single 301; `validate-sitemap` and `validate-prerender` pass.

**S1 status (2026-11-22): built.** Sitemap 290 → 139 URLs; 265 pages prerendered (139 indexable, 126 `noindex, follow`); no Italian text, rating markup or links to retired pages in the build.
- Index rules live in one place: `src/data/seo-data.ts` (`RETIRED_SECTOR_REDIRECTS`, `frSectorIndexed`, `CITY_PAGES_INDEXED`), with the light list `RETIRED_SECTOR_SLUGS` in `seo-slugs.ts`. `generate-sitemap.ts` fails the build if `vercel.json` lacks a retired page's 301.
- **Changes from the plan above:**
  - `renovation-contractor` and `air-conditioning-installer` were **not** merged. They are real trades with their own searches, and the French renovation page ranks around position 5. Only the Italian categories (`decorative-painter`, `building-consultant`) were merged.
  - French trade pages kept indexed: `travailleur-autonome`, `modele-soumission-word`, `entrepreneur-renovation`, the three that earn clicks.
  - `/quotes/free-quote/` → `/pricing/`; `/fr/soumissions/comment-faire-une-soumission/` → `/fr/guides/`.
  - The home page's verified-rating tile became "13 provinces and territories with their sales taxes built in" (true: `src/lib/tax-profiles.ts`). The testimonials themselves stay until the owner confirms them (§4).
  - SoftwareApplication shows the Starter price from `src/data/pricing.ts` ($29). Change it there if the launch price ships.
  - Blog `publishedAt` is now the day each post first appeared in git; reading time is computed from its word count (1–3 min today).
- The template's default `index, follow` robots tag is dropped when a page sets its own (`prerender-seo.ts` `injectHead`).

### S2: Technical cleanup (1 day; ship with S1)
1. **Real 404s (T1):**
   - Rewrite to spa.html only the private SPA prefixes (`/sign-in`, `/sign-up`, `/dashboard`, `/p/`, `/i/`, `/portal/`, `/welcome`, `/join`, …).
   - Every other unknown path serves a prerendered `404.html` with status 404.
   - Add hub pages for `/quotes/` and `/fr/soumissions/`, which today are soft 404s.
2. **Fix the 90 dead FR city links (T2):** FR trade pages link only to FR pages that exist.
3. **Internal links (T3, T4):**
   - Point every internal link at the final URL with a trailing slash (`/fr/`, `/sign-up/` or the app URL, no `/dashboard/*` from marketing pages).
   - FR header and footer link to FR pages.
   - The language switch becomes an `<a href>` to the counterpart page.
4. **Hygiene (T5, T6):** remove the empty category from the sitemap; 301 `/index.html` → `/`; strip the dev canonical script in `injectHead`.
5. **Hydration #418:** format dates with `timeZone: "UTC"` (or at build time), then confirm no hydration error in the console on `/`, `/fr/`, `/blog/` and one post.
6. **Speed and redirect cleanup:**
   - Skip `/api/me/allowance` when there is no session.
   - Long cache on `/fonts/`.
   - Fold the two-hop redirects into one (T8).
   - Trim titles over 60 characters and descriptions over 160 on the pages that stay indexed (T7).
7. Add a crawl check to the build (built as `scripts/seo-check.ts`) that fails on:
   - a soft 404
   - an internal link through a redirect
   - a sitemap URL that isn't 200 or isn't self-canonical
   - Italian strings
   - AggregateRating
   - a title over 65 or a description over 165 characters

**S2 status (2026-11-23): built.** Sitemap 140 URLs; 266 pages built, plus `404.html`.
- **404s:** `vercel.json` sends only the app routes (sign-in/up, onboarding, welcome, admin, crm, sign, portal, i, t, team-invite, join, p) to `spa.html` and `/dashboard` to `app.html`. Every other unknown URL gets the prerendered `404.html` with status 404.
- **Hubs:** new `/quotes/` and `/fr/soumissions/` pages (`src/pages/seo/hub.tsx`).
- **French trade pages:** link only to the Montréal city page; the all-cities block is gone.
- **Internal links:** go to final URLs (`/fr/`, `/sign-up/`); French header, footer and anchors stay French.
- **Language switch:** a real link when the page has a counterpart.
- **Housekeeping:**
  - empty blog categories are hidden
  - `/index.html` 301s to `/`
  - the dev canonical script is stripped from built pages
  - blog dates are formatted in UTC (the hydration mismatch)
  - `/api/me/allowance` is only called when the free-quotes dialog opens
  - `/fonts/` cached for 30 days
- **Titles and descriptions:** 48 pages shortened to 65 / 165 characters. On blog and help pages the description is also the lead paragraph, so that text is shorter too.
- **Build gate:** `scripts/seo-check.ts` (`npm run qa:seo`) runs in `build` and fails the deploy on any of the checks listed in item 7.
- **Not done:** the two-hop redirects (`http://www.`, a city URL without its trailing slash), which are rare and harmless.

### S3: Consolidate and rewrite the content (2–3 weeks; ship in weekly batches)
Every page that stays indexed must meet this bar: at least 900 words of main content, a named author with a bio, a sourced price or rule for every number, at least one real product screenshot or worked example, a real `updatedAt`, and one clear contractor intent.

1. **Noindex and drop from the sitemap** 11 homeowner-only posts: painting an apartment, bathroom Toronto, kitchen, basement finishing, basement waterproofing, deck, fence, flooring, siding, winterizing, and reduce-material-costs. 410 them after 6 weeks if they still have no clicks.
2. **Merge with 301s**, each cost piece becoming a sourced "what clients will expect to pay" section in the contractor article:
   - rewire → how to quote an electrical job
   - reroof and snow load → how to quote a roofing job
   - heat pump and furnace → how to quote an HVAC job
   - windows → how to quote a window and door job
   - driveway → how to quote a masonry job
   - attic insulation → the rewritten rebates guide
   - common-mistakes, win-more-bids, send-in-5-minutes and mobile-quoting → the quote-writing pillar
   - markup guide → the markup tool page
   - best-software and vs-spreadsheet → /compare/
   - more-electrical-jobs → "How to get more jobs as a contractor"
   - slow-season → scale-your-business
3. **Rewrite to the bar:**
   - The 11 how-to-quote articles and the pillar.
   - Pricing a job; contractor contract (provincial consumer rules).
   - Insurance (WSIB / WorkSafeBC / CNESST).
   - Subcontractors and first employee (CRA RC4110).
   - Collecting payment, cash flow, job costing, change orders, raising prices, Google Business Profile, reviews.
   - The rebates guide: current programs, Rénoclimat attribution checked.
4. **One template page per language** with real downloadable .xlsx and .docx quote templates (GST/HST/QST ready), plus a contractor contract template. This replaces the 4 doorway template pages.
5. **18 FR trade pages written by hand** in the FR-guide style: RBQ subclass, CMEQ/CMMTQ where they apply, commerçant itinérant, TPS/TVQ on a soumission. Re-index each one as it is finished.
6. **Kept English trade pages (`/quotes/<trade>/`):**
   - Cut the doubled benefits block.
   - Cut the spun intro and the "common jobs our users quote every day" claim.
   - Add one real trade-specific sample quote each.
   - Raise the unique share above 60 %, or noindex the page.

**S3 batch 1 status (2026-11-24): built.** Sitemap 140 → 111 URLs; 248 pages built.
- **Homeowner posts (item 1):** the 11 posts carry `noindex: true` in `blog-index.ts`. They stay live as `noindex, follow` and are left out of the sitemap, llms.txt, the blog lists and related links (`BLOG_LISTED`). Re-check their clicks around 2027-01-05 and 410 any without clicks.
- **Merged posts (item 2):** 16 posts are in `BLOG_REDIRECTS` and their bodies are deleted. Each 301s in `vercel.json`; `generate-sitemap.ts` fails the build if a redirect is missing or a merged slug is still an article. Links to them inside other articles now point at the target. The now-empty Trades and Pricing categories 301 to `/blog/`.
  - **Batch 2:** `more-electrical-jobs` and `more-plumbing-jobs` 301 to the new `/blog/how-to-get-more-jobs-as-a-contractor-canada/`.
- **Rewritten to the bar (item 3, partial):** the pillar, plus the electrical, roofing, HVAC, window/door and masonry quoting guides, and the rebates guide (now "Home Energy Rebates in Canada", programs checked November 2026, Rénoclimat credited to the Québec government).
  - Each is 1,400–1,600 words with an itemized sample quote and 7–18 official sources, all opened and checked.
  - Price ranges with no official source were dropped, not guessed; each guide explains the price drivers instead.
  - `updatedAt` is shown on the page and used in the JSON-LD.
- **English trade pages (item 6, partial):** the repeated benefits block and the unsourced claims are cut from the shared long-form section ("jobs our users quote every day", "already use quoteai every week"). Trade-specific sample quotes are still to do.
**S3 batch 2 status (2026-11-24): built.** Sitemap 110 URLs; 247 pages built.
- **Rewritten to the bar:**
  - the six remaining quoting guides: painting, plumbing, landscaping, tiling, carpentry, welding
  - the pricing guide: labour burden from the 2026 CPP/EI rates, overhead, markup vs margin
  - the quote follow-up guide, including the CASL quote exemption in s. 6(6)(a)
  - the new "get more jobs as a contractor" article
- **Each article:** 1,400–1,500 words, 2–9 checked official sources, and a labelled worked example.

**S3 batch 3 status (2026-11-24): built.**
- **Rewritten to the bar:** the 14 business articles:
  - contract (ON/BC/QC/AB rules, BC's August 2026 door-to-door changes)
  - change orders
  - quote vs estimate vs invoice (current ITC invoice bands: $100 / $500)
  - insurance and workers' compensation clearances
  - subcontractors (T5018, Construction Act payment periods)
  - first employee (2026 CPP/EI)
  - getting paid (prompt payment by province, liens, small claims)
  - cash flow (GST/HST filing periods)
  - job costing
  - raising prices (StatCan CPI and building price index)
  - scaling (with the slow-season material)
  - project management (O. Reg. 213/91 notice of project)
  - Google Business Profile
  - reviews (Google policy, Competition Bureau, CASL)
- **Every indexed article now meets the S3 bar**, except `free-quote-template-for-contractors-canada`, which is rebuilt with the template downloads (item 4).

**S3 item 4 status (2026-11-24): built.**
- **Five templates in `public/templates/`**, generated by `scripts/generate-templates.ts` (`npm run templates`; rates come from `src/lib/tax-profiles.ts`, so re-run after a rate change):
  - Excel quote templates, EN and FR, with formulas and a province tax lookup
  - Word quote templates, EN and FR
  - an English renovation contract template
- **Tested:** each file opened in Excel and Word, with the totals checked for ON, QC, BC (PST on and off) and NS.
- **English template page:** `/blog/free-quote-template-for-contractors-canada/`. **French:** a download block on `/fr/soumissions/modele-soumission-word/`.
- **Redirects:** the retired Excel/Word template pages now 301 to these pages, not `/tools/`.
- **No French contract template:** Québec itinerant-merchant contracts need the OPC's own cancellation form, so this needs a lawyer.

**S3 item 5 status (2026-11-24): built.** Sitemap 110 → 124 URLs.
- **All 17 live French trade pages are hand-written** in `src/data/fr-trade-pages.ts`. On a page that has one, the hand-written copy replaces the generic benefits, "built for the market" and long-form blocks; the page is indexed through `FR_HANDWRITTEN_SECTOR_SLUGS`, and the sitemap build fails if that list and the data drift.
- **Each page:**
  - 1,000–1,300 words
  - the RBQ subcategory named exactly
  - CMEQ or CMMTQ where they apply
  - the OPC itinerant-merchant rules where they apply (roofing, windows and doors, insulation; the 7 November 2024 heating-appliance ban)
  - TPS/TVQ worked example
  - 5–6 FAQ (FAQPage JSON-LD)
  - 8–15 official sources, all opened
- **Loading:** the French text loads only on French routes (`src/pages/seo/fr-type.tsx`); the English trade chunk stays at 24 kB.
- **Excel templates:** now have a "Registered for GST/HST?" switch that zeroes the tax lines.
- **Recheck:** the Rénoclimat amounts (new rules since 1 October 2026) once its online portal launches.

**Remaining S3 work:**
  - trade-page sample quotes (item 6)
  - bylines once the owner names an author (S5)

### S4: New pages for real buyer queries (2 weeks, overlapping S3)
1. Feature landing pages, EN and FR, built from real product screenshots:
   - estimates (/estimating-software/)
   - invoicing (/invoicing-software/, /fr/logiciel-facturation/)
   - contractor CRM
   - job costing
   - contracts and e-signature
2. A FR blog, Québec topics written in French (not translated): permis d'arrondissement, garantie GCR, CNESST, retenue contractuelle, TPS/TVQ on deposits. Start with 4 pieces at the FR-guide standard.
3. Articles on HST on renovation quotes (Ontario) and holdback rules by province, each linking to the calculators.
4. Internal links: every article links to one tool and one feature page; hubs link to every child page; the home page links to the hubs.

### S5: Trust and E-E-A-T (owner input needed; this week)
1. About page with the founder's real name and photo, founding date, Canadian business address and a short honest story.
2. One author page per writer, with a bio and credentials; every article carries a byline.
3. An editorial policy page (how prices and rules are sourced and updated).
4. Testimonials:
   - Keep only those the owner can confirm, with written permission.
   - Otherwise remove the section until there are real ones.
   - Collect reviews on Google Business Profile and Capterra/G2, not as self-hosted stars.
5. Remove unsourced claims ("1.2 million tradespeople", "4–6 hrs saved/week", "median 30 sec", "used across the country") or source them.

### S6: Authority (owner-led, starts now, runs continuously)
DR 12 is the ceiling on everything above. Target: 15 relevant referring domains in 8 weeks.
1. **Directories and listings:** Capterra, G2, GetApp, Software Advice, SaaSworthy, Product Hunt (EN), BetaList; Google Business Profile, Bing Places, Apple Business Connect.
2. **Trade associations and regional bodies** (member listings or supplier pages): APCHQ, ACQ, CHBA provincial chapters, Ontario Home Builders' Association, BC's HAVAN, local chambers of commerce.
3. **The calculators as link assets:** pitch them to trade blogs, renovation forums and college construction programs (Holland College, Conestoga, Cégep trades programs). Offer an embeddable GST/HST and holdback calculator with a credit link.
4. **Original data:** if the volume of anonymised quotes allows, publish a quarterly "Canadian trade labour-rate index" from real quotes. This is the one asset competitors can't copy.
5. **Reddit and YouTube:** r/Construction, r/Carpentry, r/HVAC, r/electricians, r/Quebec. Answer questions (no link spam); make short screen-capture videos showing a quote built in 30 seconds.

### S7: Measure and decide (weekly, from the day S1 ships)
- **Weekly Search Console export** (clicks, impressions, position by page family) into docs/seo-metrics.md, compared with this baseline:
  - 17 clicks
  - 4.61k impressions
  - position 46 over 3 months
- **Success at 6 weeks:**
  - average position under 30 on indexed pages
  - at least 5 clicks a week
  - "Discovered – not indexed" under 40
  - first sign-ups attributed to organic search (GA4, `quoteai.ca` property)
- **At 8 weeks, if positions haven't moved:** the cause is authority, not on-page quality, so put S6 ahead of new content.
- **Request indexing**, once the quota returns: S1 hubs first, then the rewritten articles, 10 a day at most. Run `npm run indexnow` after every deploy.

## 4. Owner decisions needed before S1 ships
1. **Testimonials:** are RBA Construction and Abdul Contracting real customers who agreed to be quoted? If not, they are removed.
2. **Byline:** whose name and photo go on the About page and the articles? A real business address?
3. **Pruning:** confirm that noindexing the city grid and the 11 homeowner posts is acceptable. Impressions will fall for a few weeks; clicks are expected to stay about the same, since those pages produced 2 clicks in 3 months.
4. **Pricing in schema:** which starting price goes in the one SoftwareApplication block ($19 launch or $29)?
