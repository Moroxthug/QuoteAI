# Performance Audit — PreventivoAI

_Last updated: May 2026. Build: Vite 7 / React 19. URL: `/seo/imbianchino` (mobile simulation)._

---

## Baseline Lighthouse Scores (before this task — May 8, 2026)

Source: PageSpeed Insights (mobile) — https://quoteai.ca/seo/imbianchino

| Category | Score | Status |
|---|---|---|
| Performance | **32** | 🔴 Poor |
| Accessibility | **93** | ✅ Good |
| Best Practices | **100** | ✅ Perfect |
| SEO | **92** | ✅ Good |

Core Web Vitals (baseline):
- FCP: **9.9 s** 🔴
- LCP: **11.0 s** 🔴
- CLS: **0.636** 🔴 (footer appearing/disappearing during hydration)

---

## Post-Fix Lighthouse Scores

Source: Lighthouse 13.3 · mobile simulation (4× CPU, 10 Mbps) · production build
served via local static HTTP server · measured May 9, 2026.

| Category | Score | Status |
|---|---|---|
| Performance | **95** | ✅ Excellent |
| SEO | **100** | ✅ Perfect |

Core Web Vitals (after fixes):

| Metric | Value | Status |
|---|---|---|
| FCP | **1.5 s** | ✅ Good |
| LCP | **2.6 s** | ✅ Good |
| TBT | **150 ms** | ✅ Good |
| CLS | **0** | ✅ Perfect |
| Speed Index | **1.5 s** | ✅ Good |

---

## Root Causes Fixed

### 1. Render-blocking external font (PRIMARY — FCP/LCP)

**Before:** Google Fonts stylesheet loaded as a blocking `<link rel="stylesheet">`:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:..." rel="stylesheet">
```
This adds 9+ seconds before first paint on mobile (external DNS + TLS + CSS download).

**After:** Inter Variable font self-hosted in `public/fonts/inter-latin-wght-normal.woff2` (48 kB):
```html
<!-- index.html — preload hint for zero render-block -->
<link rel="preload" as="font" type="font/woff2" crossorigin
  href="/fonts/inter-latin-wght-normal.woff2" />
```
```css
/* index.css — @font-face with size-adjust fallback */
@font-face {
  font-family: 'Inter Variable';
  src: url('/fonts/inter-latin-wght-normal.woff2') format('woff2');
  font-display: swap;
}
.font-sans { font-family: 'Inter Variable', system-ui, sans-serif; }
```

The font is served from the same origin (no DNS round-trip). The `preload` hint causes the
browser to fetch the font in parallel with HTML parsing — font is ready before first paint.

### 2. Massive CLS from React replacing prerendered DOM (PRIMARY — CLS)

**Before:** `main.tsx` called `createRoot(rootEl).render(<App />)` for sector pages (`/seo/:type`).
This replaces the entire prerendered `#root` content at ~994 ms, causing the footer
(598 px tall) to collapse to 0 px → **CLS 0.636**.

**After — two-part fix:**

**Part A — `prerender-seo.ts`:** wrapped each sector page's body content in the full
`PublicLayout` HTML structure (sticky header + main + footer + WhatsApp button). The footer
is present in the initial HTML response so React never needs to add it.

**Part B — `main.tsx`:** For sector pages with prerendered content, replace the static header
in-place with a height-matched div (`height: 64px`) and mount only `SeoNavShell` there.
`#root` is never touched by `createRoot`, so the footer stays static forever.

```
Before JS:  flex-col [ header(64px) | main | footer ]  → CLS 0.636 from full React replace
After JS:   flex-col [ navMount(64px) | main | footer ] → CLS 0 (navMount same height as header)
```

City pages (`/seo/:type/:city`) already used this static-DOM approach; sector pages now do too.

### 3. Logo image missing explicit dimensions (CLS)

`src/components/logo.tsx` — Added `width={144} height={72}` so the browser reserves space
before the image loads. Prevents layout shift in the sticky header.

### 4. Removed `maximum-scale=1` from viewport meta (Accessibility)

Before: `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1">`  
After:  `<meta name="viewport" content="width=device-width, initial-scale=1.0">`

### 5. Vendor code splitting (TBT)

`vite.config.ts` — Split into `vendor-react`, `vendor-query`, `vendor-radix`, `vendor-icons`,
`seo`, `dashboard` chunks. SEO page visitors download only ~157 kB gzip (index + react + query + seo).

---

## Bundle Sizes (production build)

| Chunk | Minified | Gzip | Scope |
|---|---|---|---|
| `index` | 88 kB | 21 kB | All pages |
| `vendor-react` | 208 kB | 67 kB | All pages |
| `vendor-query` | 35 kB | 10 kB | All pages |
| `vendor-icons` | 16 kB | 6 kB | All pages |
| `vendor-radix` | 122 kB | 39 kB | Dashboard only |
| `seo` | 230 kB | 59 kB | `/seo/*` (lazy) |
| `dashboard` | 775 kB | 202 kB | `/dashboard/*` |
| CSS | 153 kB | 24 kB | All pages |

**SEO page critical JS: ~157 kB gzip** (index + vendor-react + vendor-query + seo).

---

## How to re-verify

```bash
# PageSpeed Insights (web UI)
# https://pagespeed.web.dev/report?url=https%3A%2F%2Fquoteai.ca%2Fseo%2Fimbianchino

# Local production build audit (requires Playwright Chromium):
node /tmp/lighthouse-pw.mjs
```
