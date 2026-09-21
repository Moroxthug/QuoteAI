// orval ≥ 8.5 emits zod v4 top-level helpers (`zod.int()`, `zod.email()`);
// the workspace pins zod 3.x. Rewrite them to the v3 spelling after codegen.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const file = resolve(dirname(fileURLToPath(import.meta.url)), "../api-zod/src/generated/api/api.ts");
const before = readFileSync(file, "utf8");
const after = before
  .replace(/\bzod\.int\(\)/g, "zod.number().int()")
  .replace(/\bzod\.email\(\)/g, "zod.string().email()")
  .replace(/\bzod\.url\(\)/g, "zod.string().url()")
  .replace(/\bzod\.uuid\(\)/g, "zod.string().uuid()");
if (after !== before) writeFileSync(file, after);
