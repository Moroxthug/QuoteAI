// Phase 77 (docs/PILOT-LAUNCH-PLAN.md): maskable icons for the web manifest.
//
//   pnpm --filter @workspace/quote-ai exec tsx scripts/generate-pwa-icons.ts
//
// Android crops maskable icons to a circle/squircle, keeping only the inner
// 80 % "safe zone". The plain icon-512.png (transparent, full-bleed ring)
// would lose its edge, so this writes icon-maskable-{192,512}.png: the same
// artwork at 62 % on a solid white square. Run once and commit the PNGs — it
// is not part of the build.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Resvg } from "@resvg/resvg-js";

const publicDir = resolve(import.meta.dirname, "..", "public");
const source = readFileSync(resolve(publicDir, "icon-512.png")).toString("base64");

for (const size of [192, 512]) {
  const art = Math.round(size * 0.62);
  const offset = Math.round((size - art) / 2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#ffffff"/>
  <image x="${offset}" y="${offset}" width="${art}" height="${art}" href="data:image/png;base64,${source}"/>
</svg>`;
  const png = new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
  const out = resolve(publicDir, `icon-maskable-${size}.png`);
  writeFileSync(out, png);
  console.log(`wrote ${out} (${png.length} bytes)`);
}
