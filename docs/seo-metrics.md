# SEO metrics (S7, weekly)

The weekly measure for docs/SEO-RECOVERY-PLAN.md S7. Source: Google Search Console, property `sc-domain:quoteai.ca`, web search, read in the owner's account. Add one section per week, newest first. Don't rewrite past weeks.

**Baseline (3 months to 2026-11-22, before S1 shipped):** 17 clicks, 4.61k impressions, average position 46.

**Targets at 6 weeks (from S1, about 2026-12-31):**
- Average position under 30 on indexed pages.
- At least 5 clicks a week.
- "Discovered – currently not indexed" under 40.
- First sign-ups attributed to organic search (GA4).

**At 8 weeks:** if positions haven't moved, the cause is authority. Put S6 ahead of new content.

Families are grouped by URL. "Blog" includes retired posts (merged or noindexed) that still collect impressions until Google drops them.

---

## Week ending 2026-11-23 (first report, 2026-11-25)

Search Console data runs to 23 November (it lags 2 days), so S3–S6 (shipped 24–25 November) aren't in it yet. Treat this as the post-S1/S2 starting point.

**Totals**

| Window | Clicks | Impressions | CTR | Avg position |
|---|---|---|---|---|
| Last 7 days | 3 | 1.42k | 0.2 % | 48.5 |
| Last 28 days | 8 | 2.95k | 0.3 % | 51.7 |
| Last 3 months | 18 | 5.09k | 0.4 % | 46.6 |
| Baseline (3 months) | 17 | 4.61k | 0.4 % | 46 |

**By page family, last 7 days**

| Family | Pages with impressions | Clicks | Impressions | Avg position |
|---|---|---|---|---|
| Blog (all, incl. retired) | 28 | 0 | 1,050 | 52.0 |
| Tools (EN + FR) | 8 | 1 | 151 | 31.4 |
| City pages | 20 | 0 | 88 | 52.8 |
| Trade pages (EN + FR) | 13 | 1 | 63 | 39.3 |
| French guides | 2 | 0 | 26 | 13.9 |
| Compare | 3 | 1 | 25 | 69.4 |
| Home (EN + FR) | 2 | 0 | 12 | 24.2 |
| Provinces | 1 | 0 | 4 | 37.0 |
| Other | 4 | 0 | 8 | 11.1 |

**What it says**
- **Clicks:** the 3 clicks came from the French hourly-rate calculator (position 12.5), /compare/ and the renovation trade page.
- **Blog impressions:** 77 % of the blog's 1,050 impressions go to four retired homeowner cost posts: windows and doors 351, furnace 306, driveway 105, attic insulation 55. They are now 301s or noindexed, so blog impressions will fall as Google processes that. This is the expected effect of S3.1/S3.2, not a loss.
- **Early signs on the pages kept:**
  - The tools average position 31, and the French holdback (5.9) and hourly-rate (12.5) calculators rank on page 1–2.
  - The French guides average 13.9.
  - Kept guides near the top: masonry quoting 5.0 and getting paid 7.7, both on a handful of impressions.
- **Still weak:**
  - The pillar quote guide sits at 86.3 (55 impressions).
  - City pages sit at 52.8. Only the 6 kept metros remain, and they aren't indexed while `CITY_PAGES_INDEXED` is false.

**Indexing (Pages report, last updated by Google before the S3–S6 deploys)**

| Status | Pages |
|---|---|
| Indexed | 422 |
| Not indexed | 333 |
| Alternative page with proper canonical (www and other duplicates, harmless) | 184 |
| Discovered – currently not indexed | 117 (target under 40) |
| Crawled – currently not indexed | 16 |
| Page with redirect | 12 |
| Excluded by noindex | 2 |
| Soft 404 | 1 |
| Duplicate, Google chose a different canonical | 1 |

The sitemap now lists 140 URLs. Google still counts many retired and redirected URLs; the "discovered" count should fall as it recrawls the 301s and the smaller sitemap.

**Actions this week**
- IndexNow pinged for every URL changed since 24 November (Bing, Copilot, ChatGPT search).
- **Owner:**
  - Resubmit sitemap.xml in Search Console.
  - Request indexing for the new pages, at most 10 a day, in this order: the five English feature pages; the two new English articles; the four new French guides; the five French feature pages.
- **GA4 organic sign-ups:** not checked this week (needs the GA4 property). Next report.
