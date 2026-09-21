import express from "express";
import compression from "compression";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import http from "node:http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, "..", "dist", "public");
const INDEX_HTML = path.join(PUBLIC_DIR, "index.html");

const rawPort = process.env.PORT;
if (!rawPort) {
  throw new Error("PORT environment variable is required");
}
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

if (!fs.existsSync(INDEX_HTML)) {
  throw new Error(`index.html not found at ${INDEX_HTML} — did the build run?`);
}

const app = express();

app.disable("x-powered-by");
app.set("etag", "strong");

// Local QA only (Phase 68 Lighthouse runs against the production build with
// the e2e API behind it): forward /api/* to API_PROXY_TARGET. Vercel never
// sets it — there the rewrite in vercel.json routes /api to the function.
const apiTarget = process.env.API_PROXY_TARGET;
if (apiTarget) {
  const target = new URL(apiTarget);
  app.use("/api", (req, res) => {
    const upstream = http.request(
      { host: target.hostname, port: target.port, method: req.method, path: `/api${req.url}`, headers: { ...req.headers, host: target.host } },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      },
    );
    upstream.on("error", (err) => res.status(502).type("text/plain").send(`proxy error: ${err.message}`));
    req.pipe(upstream);
  });
}

app.use((_req, res, next) => {
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );
  next();
});

app.use(
  compression({
    threshold: 1024,
    filter: (req, res) => {
      const type = res.getHeader("Content-Type");
      if (typeof type === "string" && /^image\/(?!svg\+xml)/i.test(type)) {
        return false;
      }
      return compression.filter(req, res);
    },
  }),
);

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

app.use(
  express.static(PUBLIC_DIR, {
    index: "index.html",
    etag: true,
    lastModified: true,
    redirect: false,
    setHeaders: (res, filePath) => {
      const rel = path.relative(PUBLIC_DIR, filePath).replace(/\\/g, "/");
      const ext = path.extname(filePath).toLowerCase();

      if (rel.startsWith("assets/")) {
        res.setHeader(
          "Cache-Control",
          `public, max-age=${ONE_YEAR_SECONDS}, immutable`,
        );
        return;
      }

      if (ext === ".html") {
        res.setHeader(
          "Cache-Control",
          "public, max-age=0, must-revalidate",
        );
        return;
      }

      if (
        ext === ".js" ||
        ext === ".css" ||
        ext === ".woff" ||
        ext === ".woff2" ||
        ext === ".ttf" ||
        ext === ".otf"
      ) {
        res.setHeader(
          "Cache-Control",
          `public, max-age=${ONE_YEAR_SECONDS}, immutable`,
        );
        return;
      }

      if (
        ext === ".png" ||
        ext === ".jpg" ||
        ext === ".jpeg" ||
        ext === ".gif" ||
        ext === ".webp" ||
        ext === ".avif" ||
        ext === ".svg" ||
        ext === ".ico"
      ) {
        res.setHeader("Cache-Control", "public, max-age=86400");
        return;
      }

      if (rel === "robots.txt" || rel === "sitemap.xml") {
        res.setHeader("Cache-Control", "public, max-age=3600");
        return;
      }

      res.setHeader("Cache-Control", "public, max-age=300");
    },
  }),
);

function sendIndex(res) {
  res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
  res.sendFile(INDEX_HTML);
}

app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return next();
  }
  const accept = req.headers.accept ?? "";
  if (!accept.includes("text/html")) {
    return next();
  }
  sendIndex(res);
});

app.use((_req, res) => {
  res.status(404).type("text/plain").send("Not found");
});

app.listen(port, () => {
  console.log(`[serve] quote-ai listening on :${port}`);
});
