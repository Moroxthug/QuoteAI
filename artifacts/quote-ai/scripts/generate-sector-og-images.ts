import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { SECTORS } from "../src/data/seo-data.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../public/og/sectors");

if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

// Deve restare in sincronia con SECTOR_OG_IMAGES in src/data/seo-render-engine.ts
const SECTOR_SLUGS = [
  "edilizia",
  "ristrutturazione",
  "elettricista",
  "idraulico",
  "imbianchino",
  "carpentiere",
  "falegname",
  "termoidraulico",
  "freelance",
  "geometra",
];

function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&apos;");
}

function buildOgSvg(label: string, labelPlural: string): string {
  const W = 1200;
  const H = 630;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7c3aed" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#06b6d4" stop-opacity="0.10"/>
    </linearGradient>
    <linearGradient id="accentBar" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#7c3aed"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="white"/>
  <rect width="${W}" height="${H}" fill="url(#bgGrad)"/>
  <rect x="0" y="${H - 6}" width="${W}" height="6" fill="url(#accentBar)"/>
  <rect x="0" y="0" width="6" height="${H}" fill="url(#accentBar)"/>

  <circle cx="${W - 80}" cy="80" r="180" fill="#7c3aed" fill-opacity="0.05"/>
  <circle cx="${W - 40}" cy="${H - 40}" r="140" fill="#06b6d4" fill-opacity="0.06"/>

  <rect x="80" y="180" width="220" height="40" rx="20" fill="#f5f3ff"/>
  <text x="190" y="206" text-anchor="middle" font-size="20" font-weight="700" fill="#6d28d9" font-family="'Segoe UI', Arial, Helvetica, sans-serif">AI Quotes</text>

  <text x="80" y="300" font-size="58" font-weight="800" fill="#111827" font-family="'Segoe UI', Arial, Helvetica, sans-serif" letter-spacing="-1">${escXml(label)}</text>
  <text x="80" y="368" font-size="58" font-weight="800" fill="#111827" font-family="'Segoe UI', Arial, Helvetica, sans-serif" letter-spacing="-1">Quotes Online</text>

  <text x="80" y="420" font-size="24" fill="#6b7280" font-family="'Segoe UI', Arial, Helvetica, sans-serif">For Canadian ${escXml(labelPlural)} — in 30 seconds with AI</text>

  <text x="${W - 80}" y="${H - 40}" text-anchor="end" font-size="30" font-weight="800" fill="#7c3aed" font-family="'Segoe UI', Arial, Helvetica, sans-serif" letter-spacing="-0.5">quoteai</text>
  <line x1="80" y1="${H - 80}" x2="${W - 80}" y2="${H - 80}" stroke="#e5e7eb" stroke-width="1"/>
  <text x="80" y="${H - 40}" font-size="22" fill="#9ca3af" font-family="'Segoe UI', Arial, Helvetica, sans-serif">quoteai.ca</text>
</svg>`;
}

let generated = 0;

for (const slug of SECTOR_SLUGS) {
  const sector = SECTORS[slug];
  if (!sector) {
    console.warn(`  ! Sector "${slug}" non trovato in SECTORS, skip`);
    continue;
  }
  const outPath = join(outDir, `${slug}.png`);
  const svg = buildOgSvg(sector.label, sector.labelPlural);
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } });
  const pngBuffer = resvg.render().asPng();
  writeFileSync(outPath, pngBuffer);
  generated++;
}

console.log(`  ✓ Generated ${generated} sector OG images → public/og/sectors/`);
