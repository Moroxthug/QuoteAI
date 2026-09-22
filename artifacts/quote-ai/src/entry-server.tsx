// Build-time rendering of every public page (Phase 68 for the homepage and
// the static pages, Phase 80 for the sector, city and blog pages that used
// to be hand-built HTML in scripts/prerender-seo.ts).
//
// Built with `vite build --ssr src/entry-server.tsx --outDir dist/server` and
// called by scripts/prerender-seo.ts for each route in listPrerenderRoutes().
// The markup goes into <div id="root"> of the page's index.html and main.tsx
// hydrates it, so the hero (the LCP element) paints from the HTML and the
// crawler sees the same DOM the user gets. The <head> comes from the same
// render: what each page's <SeoHead> declares — title, description,
// canonical, hreflang, Open Graph, JSON-LD — is authored once, in the page,
// and cannot drift from what hydration shows.
//
// Under React 19 react-helmet-async steps aside and the <title>/<meta>/<link>
// a page renders are React "hoistables": the prerender emits them at the very
// front of the stream (before the first element), and the browser hoists the
// same elements into document.head on hydration. That prefix is the head this
// module returns. <script type="application/ld+json"> is not hoisted and
// stays where <SeoHead> sits, inside #root — where crawlers read it too.
//
// `prerender` (react-dom/static) waits for every lazy route chunk before
// resolving, so the lazy pages render in full; hydrateRoot then attaches to
// the Suspense boundaries as their chunks arrive in the browser.
import { StrictMode } from "react";
import ReactDOMStatic from "react-dom/static";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import type { Lang } from "./i18n/translations";

export { listPrerenderRoutes } from "./data/prerender-routes";

export interface RenderedPage {
  /** Inner HTML of <div id="root">. */
  body: string;
  /** <title>, <meta> and <link> lines for <head>, one per line. */
  head: string;
  /** `lang` for the <html> element. */
  htmlLang: string;
}

const HOISTED_PREFIX_RE = /^(?:\s*(?:<(?:link|meta)\b[^>]*\/?>|<title>[^<]*<\/title>))+/;
const HEAD_TAG_RE = /<title>[^<]*<\/title>|<(?:link|meta)\b[^>]*\/?>/g;

export async function renderPage(path: string, lang: Lang): Promise<RenderedPage> {
  // CommonJS package, Node build: `prerenderToNodeStream` (the web-stream
  // `prerender` only exists in the browser/edge builds) and no named exports.
  const { prelude } = await ReactDOMStatic.prerenderToNodeStream(
    <StrictMode>
      <HelmetProvider>
        <App ssr={{ path, lang }} />
      </HelmetProvider>
    </StrictMode>,
  );
  const chunks: Buffer[] = [];
  for await (const chunk of prelude) chunks.push(Buffer.from(chunk));
  const html = Buffer.concat(chunks).toString("utf8");
  const hoisted = HOISTED_PREFIX_RE.exec(html)?.[0] ?? "";
  if (!/<title>/.test(hoisted)) throw new Error(`No <title> rendered for ${path} — does the page render <SeoHead>?`);
  const head = (hoisted.match(HEAD_TAG_RE) ?? []).join("\n");
  return { body: html.slice(hoisted.length), head, htmlLang: lang === "fr" ? "fr-CA" : "en-CA" };
}
