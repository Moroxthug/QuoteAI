// Copies the web help centre's articles into the app (src/content/helpArticles.ts) so the phone reads them offline.
import { readFileSync, writeFileSync } from "node:fs";

const src = readFileSync(new URL("../../quote-ai/src/data/help-articles.ts", import.meta.url), "utf8");
const head = "// A COPY of artifacts/quote-ai/src/data/help-articles.ts (the web help centre): the same articles in both languages, so the phone reads them offline. Do not edit here: change the web file and\n// run `npm run sync-help`.\n";
writeFileSync(new URL("../src/content/helpArticles.ts", import.meta.url), head + src);
console.log("Copied the help articles.");
