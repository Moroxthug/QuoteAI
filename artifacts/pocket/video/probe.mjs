// Opens app routes against the fixtures and says which /api calls have no answer yet, and what the page reads. `node probe.mjs en /jobs "/job?id=j1"`
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { NOW, fixtures } from "./fixtures.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
const [lang, stateJson, ...routes] = process.argv.slice(2);
const state = JSON.parse(stateJson);
const PORT = 8092, ORIGIN = `http://localhost:${PORT}`, WEB = join(HERE, "out", "web");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".ttf": "font/ttf", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json" };
const server = createServer((req, res) => {
  const want = join(WEB, normalize(decodeURIComponent(new URL(req.url, ORIGIN).pathname)));
  const file = want.startsWith(WEB) && existsSync(want) && statSync(want).isFile() ? want : join(WEB, "index.html");
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" }); res.end(readFileSync(file));
}).listen(PORT);
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, locale: lang === "fr" ? "fr-CA" : "en-CA", timezoneId: "America/Toronto", colorScheme: "light" });
await ctx.addInitScript(() => { localStorage.setItem("quoteai_session-token", "video-fixture"); localStorage.setItem("quoteai_crew_token", "video-crew"); });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("  PAGE ERROR:", String(e).slice(0, 200)));
await page.clock.install({ time: new Date(NOW) });
let missing = new Set();
await page.route("**/api/**", (route) => {
  const req = route.request(), u = new URL(req.url()), hit = fixtures(req.method(), u.pathname, lang, state);
  if (hit === undefined) missing.add(`${req.method()} ${u.pathname}${u.search}`);
  return route.fulfill({ status: hit === undefined ? 404 : 200, contentType: "application/json", body: JSON.stringify(hit ?? { error: "no fixture" }) });
});
for (const [i, r] of routes.entries()) {
  missing = new Set();
  await page.goto(ORIGIN + r, { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(2500);
  const text = (await page.locator("body").innerText()).replace(/\n+/g, " | ").slice(0, 700);
  console.log(`\n== ${r}\nmissing: ${[...missing].join("  ") || "none"}\ntext: ${text}`);
  await page.screenshot({ path: join(HERE, "out", `probe-${i}.png`) });
}
await browser.close(); server.close(); server.closeAllConnections();
