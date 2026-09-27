// Phase 99 (2026-09-26): the whole Stripe catalog in one idempotent run —
// the four plans (Starter / Pro / Business published, Elite custom), yearly
// prices, the one-off quotes and the two add-ons — and the env lines to paste
// into Vercel. Replaces the price ids that used to be hard-coded in
// routes/payments.ts (they belonged to a Stripe account the business no longer
// has, so checkout failed).
//
// It drives the logged-in Stripe CLI, so no secret key passes through a shell
// variable:
//
//   stripe login                                   # pick the QuoteAI account
//   pnpm --filter @workspace/scripts stripe-catalog            # test mode
//   pnpm --filter @workspace/scripts stripe-catalog -- --live  # live mode
//
// Every price carries a lookup_key, so a re-run finds it instead of making a
// duplicate. A price amount can never be edited: to change one, bump the
// lookup key's version suffix and run again.
//
// Elite is custom-priced: the product exists, and each Elite customer gets a
// price made for them in the dashboard with metadata quoteai_plan=monthly_elite
// (the webhook reads that metadata when it doesn't know the price id).

import { execFileSync } from "node:child_process";

const LIVE = process.argv.includes("--live");
const CURRENCY = "cad";
const MONTHS_CHARGED_YEARLY = 10;
const V = "v2"; // lookup-key version: bump to re-price

type Recurring = { env: string; plan?: string; addon?: string; monthlyCents: number };
type OneOff = { env: string; plan: string; cents: number };

const CATALOG: { product: string; key: string; recurring?: Recurring; oneOff?: OneOff }[] = [
  { product: "QuoteAI Starter", key: "starter", recurring: { env: "STARTER", plan: "monthly_starter", monthlyCents: 2900 } },
  { product: "QuoteAI Pro", key: "pro", recurring: { env: "PRO", plan: "monthly_pro", monthlyCents: 7900 } },
  { product: "QuoteAI Business", key: "business", recurring: { env: "BUSINESS", plan: "monthly_business", monthlyCents: 24900 } },
  { product: "QuoteAI Elite", key: "elite" }, // custom prices per customer
  { product: "QuoteAI single quote (with footer line)", key: "oneshot_watermark", oneOff: { env: "ONESHOT_WATERMARK", plan: "oneshot_watermark", cents: 500 } },
  { product: "QuoteAI single quote (clean)", key: "oneshot_clean", oneOff: { env: "ONESHOT_CLEAN", plan: "oneshot_clean", cents: 1300 } },
  { product: "QuoteAI — extra seat", key: "addon_extra_seat", recurring: { env: "EXTRA_SEAT", addon: "extra_seat", monthlyCents: 1500 } },
  { product: "QuoteAI — extra company in a group", key: "addon_group_company", recurring: { env: "GROUP_COMPANY", addon: "group_company", monthlyCents: 2900 } },
];

type Obj = { id: string; unit_amount?: number | null; metadata?: Record<string, string> };

function cli<T>(args: string[]): T {
  const out = execFileSync("stripe", [...args, ...(LIVE ? ["--live"] : [])], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const json = JSON.parse(out) as T & { error?: { message: string } };
  if (json.error) throw new Error(`stripe ${args[0]} ${args[1]}: ${json.error.message}`);
  return json;
}
const d = (k: string, v: string) => ["-d", `${k}=${v}`];

function findPrice(lookupKey: string): Obj | null {
  return cli<{ data: Obj[] }>(["prices", "list", ...d("lookup_keys[]", lookupKey), ...d("limit", "1")]).data[0] ?? null;
}

function findProduct(key: string): Obj | null {
  const found = cli<{ data: Obj[] }>(["products", "search", "--query", `metadata['quoteai']:'${key}'`]);
  return found.data[0] ?? null;
}

function ensureProduct(name: string, key: string): string {
  const existing = findProduct(key);
  if (existing) return existing.id;
  const p = cli<Obj>(["products", "create", "--name", name, ...d("metadata[quoteai]", key)]);
  console.log(`  created product ${name} (${p.id})`);
  return p.id;
}

function ensurePrice(product: string, lookupKey: string, cents: number, meta: Record<string, string>, interval?: "month" | "year"): string {
  const existing = findPrice(lookupKey);
  if (existing) {
    console.log(`  ${lookupKey}: exists (${existing.id}, ${(existing.unit_amount ?? 0) / 100} ${CURRENCY.toUpperCase()})`);
    return existing.id;
  }
  const args = ["prices", "create", "--product", product, "--currency", CURRENCY, "--unit-amount", String(cents), "--lookup-key", lookupKey];
  if (interval) args.push(...d("recurring[interval]", interval));
  for (const [k, v] of Object.entries(meta)) args.push(...d(`metadata[${k}]`, v));
  const price = cli<Obj>(args);
  console.log(`  ${lookupKey}: created ${price.id} = ${cents / 100} ${CURRENCY.toUpperCase()}${interval ? `/${interval}` : ""}`);
  return price.id;
}

const out: string[] = [];
console.log(`Stripe mode: ${LIVE ? "LIVE" : "test"}\n`);
for (const item of CATALOG) {
  const product = ensureProduct(item.product, item.key);
  if (item.recurring) {
    const r = item.recurring;
    const meta: Record<string, string> = r.plan ? { quoteai_plan: r.plan } : { addon: r.addon! };
    out.push(`STRIPE_PRICE_${r.env}=${ensurePrice(product, `quoteai_${item.key}_monthly_${V}`, r.monthlyCents, { ...meta, interval: "month" }, "month")}`);
    out.push(`${r.plan ? `STRIPE_PRICE_YEARLY_${r.env}` : `STRIPE_PRICE_${r.env}_YEARLY`}=${ensurePrice(product, `quoteai_${item.key}_yearly_${V}`, r.monthlyCents * MONTHS_CHARGED_YEARLY, { ...meta, interval: "year" }, "year")}`);
  }
  if (item.oneOff) {
    const o = item.oneOff;
    out.push(`STRIPE_PRICE_${o.env}=${ensurePrice(product, `quoteai_${item.key}_${V}`, o.cents, { quoteai_plan: o.plan })}`);
  }
}
console.log(`\nAdd to Vercel (${LIVE ? "Production" : "Preview + Development"}):\n`);
console.log(out.join("\n"));

export {};
