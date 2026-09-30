// Tokens only (CLAUDE.md, handoff BUILD-PLAN phase 0 "done" line):
// - no hex or rgb()/rgba() colour anywhere in src/ except src/theme/tokens.ts;
// - no typed font size, radius, letter-spacing or spacing in screens (src/app): screens compose
//   src/ui components and tokens. src/ui itself may hold the exact sizes COMPONENTS.md gives.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const src = join(root, "src");
const TOKENS = join(src, "theme", "tokens.ts");

const COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(/;
const SCREEN_SIZE = /\b(fontSize|lineHeight|letterSpacing|borderRadius|padding\w*|margin\w*|gap|rowGap|columnGap|width|height|top|left|right|bottom)\s*:\s*-?\d/;

function* files(dir) {
  for (const name of readdirSync(dir)) {
    if (name.includes(" - Copy")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(ts|tsx)$/.test(name)) yield p;
  }
}

const problems = [];
for (const file of files(src)) {
  if (file === TOKENS) continue;
  const isScreen = relative(src, file).split(sep)[0] === "app";
  readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, "");
    if (COLOUR.test(code)) problems.push(`${relative(root, file)}:${i + 1}  colour typed outside tokens.ts: ${line.trim()}`);
    if (isScreen && SCREEN_SIZE.test(code)) problems.push(`${relative(root, file)}:${i + 1}  size typed in a screen: ${line.trim()}`);
  });
}

if (problems.length) {
  console.error(problems.join("\n"));
  console.error(`\nlint:tokens: ${problems.length} problem(s). Use tokens (src/theme) and src/ui components.`);
  process.exit(1);
}
console.log("lint:tokens: clean");
