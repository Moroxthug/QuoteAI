// Turns out/assets/quote-<lang>.pdf into sharp page images: out/assets/quote-<lang>-1.png and so on.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = 8093;
const server = createServer((req, res) => {
  const path = new URL(req.url, "http://x").pathname;
  if (path === "/") { res.writeHead(200, { "content-type": "text/html" }); return res.end("<!doctype html><title>pdf</title>"); }
  if (!existsSync(join(HERE, normalize(path)))) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": path.endsWith("mjs") ? "text/javascript" : "application/pdf" });
  res.end(readFileSync(join(HERE, normalize(path))));
}).listen(PORT);
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const p = await b.newPage();
await p.goto(`http://localhost:${PORT}/`);
for (const lang of ["en", "fr"]) {
  const pages = await p.evaluate(async (url) => {
    const lib = await import("/node_modules/pdfjs-dist/build/pdf.min.mjs");
    lib.GlobalWorkerOptions.workerSrc = "/node_modules/pdfjs-dist/build/pdf.worker.min.mjs";
    const doc = await lib.getDocument(url).promise;
    const out = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const vp = page.getViewport({ scale: 2200 / page.getViewport({ scale: 1 }).width });
      const c = document.createElement("canvas");
      c.width = vp.width; c.height = vp.height;
      await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
      out.push(c.toDataURL("image/png"));
    }
    return out;
  }, `/out/assets/quote-${lang}.pdf`);
  pages.forEach((d, i) => writeFileSync(join(HERE, "out", "assets", `quote-${lang}-${i + 1}.png`), Buffer.from(d.split(",")[1], "base64")));
  console.log(lang, pages.length, "pages");
}
await b.close();
server.close();
server.closeAllConnections();
