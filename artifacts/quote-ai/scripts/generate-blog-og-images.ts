import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

import {
  BLOG_ARTICLES,
} from "../src/data/blog-data.js";
import type { BlogArticle } from "../src/data/blog-data.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../public/og/blog");

if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

// ─── Category colours ────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { bg: string; text: string; accent: string }> = {
  Professioni: { bg: "#f5f3ff", text: "#6d28d9", accent: "#7c3aed" },
  Prezzi:      { bg: "#ecfeff", text: "#0e7490", accent: "#06b6d4" },
  Consigli:    { bg: "#fffbeb", text: "#d97706", accent: "#f59e0b" },
  Tool:        { bg: "#f0fdf4", text: "#15803d", accent: "#22c55e" },
  Innovazione: { bg: "#eff6ff", text: "#1d4ed8", accent: "#3b82f6" },
  Business:    { bg: "#fff1f2", text: "#be123c", accent: "#f43f5e" },
};

const DEFAULT_COLOR = { bg: "#f5f3ff", text: "#6d28d9", accent: "#7c3aed" };

// ─── Text wrapping ────────────────────────────────────────────────────────────

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length <= maxCharsPerLine) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ─── SVG builder ──────────────────────────────────────────────────────────────

function buildOgSvg(article: BlogArticle): string {
  const W = 1200;
  const H = 630;

  const col = CATEGORY_COLORS[article.category] ?? DEFAULT_COLOR;

  // Title lines (max ~32 chars per line at this font size, max 3 lines)
  const titleLines = wrapText(article.title, 38).slice(0, 3);
  const titleY = titleLines.length <= 1 ? 290 : titleLines.length === 2 ? 268 : 246;
  const titleLineHeight = 62;

  const titleSvg = titleLines
    .map(
      (line, i) =>
        `<text x="80" y="${titleY + i * titleLineHeight}" font-size="52" font-weight="800" fill="#111827" font-family="'Segoe UI', Arial, Helvetica, sans-serif" letter-spacing="-1">${escXml(line)}</text>`
    )
    .join("\n    ");

  const catY = titleY - 68;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7c3aed" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="#06b6d4" stop-opacity="0.08"/>
    </linearGradient>
    <linearGradient id="accentBar" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#7c3aed"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="4" stdDeviation="12" flood-color="#0000001a"/>
    </filter>
  </defs>

  <!-- White background -->
  <rect width="${W}" height="${H}" fill="white"/>

  <!-- Subtle gradient overlay -->
  <rect width="${W}" height="${H}" fill="url(#bgGrad)"/>

  <!-- Bottom accent strip -->
  <rect x="0" y="${H - 6}" width="${W}" height="6" fill="url(#accentBar)"/>

  <!-- Left accent bar -->
  <rect x="0" y="0" width="6" height="${H}" fill="url(#accentBar)"/>

  <!-- Decorative circles -->
  <circle cx="${W - 80}" cy="80" r="160" fill="#7c3aed" fill-opacity="0.04"/>
  <circle cx="${W - 40}" cy="${H - 40}" r="120" fill="#06b6d4" fill-opacity="0.05"/>

  <!-- Category badge -->
  <rect x="80" y="${catY - 28}" width="${Math.min(article.category.length * 13 + 32, 200)}" height="40" rx="20" fill="${col.bg}"/>
  <text x="${Math.min(article.category.length * 13 + 32, 200) / 2 + 80}" y="${catY - 4}" text-anchor="middle" font-size="20" font-weight="700" fill="${col.text}" font-family="'Segoe UI', Arial, Helvetica, sans-serif">${escXml(article.category)}</text>

  <!-- Title -->
  ${titleSvg}

  <!-- Meta line -->
  <text x="80" y="${titleY + titleLines.length * titleLineHeight + 28}" font-size="22" fill="#6b7280" font-family="'Segoe UI', Arial, Helvetica, sans-serif">
    ${article.readingTimeMin} min di lettura
  </text>

  <!-- quoteai brand -->
  <text x="${W - 80}" y="${H - 40}" text-anchor="end" font-size="30" font-weight="800" fill="#7c3aed" font-family="'Segoe UI', Arial, Helvetica, sans-serif" letter-spacing="-0.5">quoteai</text>

  <!-- Divider above brand -->
  <line x1="80" y1="${H - 80}" x2="${W - 80}" y2="${H - 80}" stroke="#e5e7eb" stroke-width="1"/>

  <!-- Site URL -->
  <text x="80" y="${H - 40}" font-size="22" fill="#9ca3af" font-family="'Segoe UI', Arial, Helvetica, sans-serif">quoteai.ca/blog</text>
</svg>`;
}

function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&apos;");
}

// ─── Generate images ───────────────────────────────────────────────────────────

let generated = 0;

for (const article of BLOG_ARTICLES) {
  const outPath = join(outDir, `${article.slug}.png`);

  const svg = buildOgSvg(article);
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 1200 },
  });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();
  writeFileSync(outPath, pngBuffer);
  generated++;
}

console.log(`  ✓ Generated ${generated} blog OG images → public/og/blog/`);
