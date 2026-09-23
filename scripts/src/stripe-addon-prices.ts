// Phase 91 (docs/OPERATIONS-PLATFORM-PLAN.md): the two subscription add-ons —
// an extra company on a group's bill (Phase 90) and an extra seat beyond the
// plan's included ones — each monthly and yearly (10 × monthly, the same
// "2 months free" as the plans). Idempotent: every price carries a lookup_key,
// so re-running finds it instead of creating a duplicate. Plain REST, no SDK.
//
//   STRIPE_SECRET_KEY=sk_test_… pnpm --filter @workspace/scripts stripe-addon-prices
//   STRIPE_SECRET_KEY=sk_live_… pnpm --filter @workspace/scripts stripe-addon-prices
//
// Test and live mode have separate price ids: run it once per mode and paste
// each block into the matching environment.
//
// The amounts below are the business decision (CAD cents). Change them before
// the first run; after that, a new amount needs a new lookup_key (a Stripe price
// amount can never be edited).

const ADDONS = [
  { env: "GROUP_COMPANY", name: "QuoteAI — extra company in a group", monthlyCents: 2900, lookup: "quoteai_addon_group_company" },
  { env: "EXTRA_SEAT", name: "QuoteAI — extra seat", monthlyCents: 1500, lookup: "quoteai_addon_extra_seat" },
] as const;
const MONTHS_CHARGED_YEARLY = 10;
const CURRENCY = "cad";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY is required (sk_test_… or sk_live_…)");
  process.exit(1);
}

type Price = { id: string; product: string; unit_amount: number | null; recurring?: { interval: string } | null };
type Product = { id: string };

async function stripe<T>(method: "GET" | "POST", path: string, form?: Record<string, string>): Promise<T> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  const json = (await res.json()) as T & { error?: { message: string } };
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${json.error?.message ?? JSON.stringify(json)}`);
  return json;
}

async function findPrice(lookupKey: string): Promise<Price | null> {
  const found = await stripe<{ data: Price[] }>("GET", `/prices?lookup_keys[]=${encodeURIComponent(lookupKey)}&limit=1`);
  return found.data[0] ?? null;
}

async function main() {
  console.log(`Stripe mode: ${key!.startsWith("sk_live_") ? "LIVE" : "test"}\n`);
  const out: string[] = [];
  for (const addon of ADDONS) {
    const monthlyKey = `${addon.lookup}_monthly`;
    const yearlyKey = `${addon.lookup}_yearly`;
    const existingMonthly = await findPrice(monthlyKey);
    const existingYearly = await findPrice(yearlyKey);
    let productId = existingMonthly?.product ?? existingYearly?.product ?? null;
    if (!productId) {
      const product = await stripe<Product>("POST", "/products", { name: addon.name, "metadata[addon]": addon.env.toLowerCase() });
      productId = product.id;
      console.log(`${addon.env}: created product ${productId}`);
    }
    const ensure = async (existing: Price | null, lookupKey: string, interval: "month" | "year", cents: number) => {
      if (existing) {
        console.log(`${addon.env} ${interval}: already exists (${existing.id}, ${(existing.unit_amount ?? 0) / 100} ${CURRENCY.toUpperCase()})`);
        return existing.id;
      }
      const price = await stripe<Price>("POST", "/prices", {
        product: productId!,
        currency: CURRENCY,
        unit_amount: String(cents),
        "recurring[interval]": interval,
        lookup_key: lookupKey,
        nickname: `${addon.name} — ${interval === "month" ? "monthly" : `annual (${MONTHS_CHARGED_YEARLY} months)`}`,
        "metadata[addon]": addon.env.toLowerCase(),
        "metadata[interval]": interval,
      });
      console.log(`${addon.env} ${interval}: created ${price.id} = ${cents / 100} ${CURRENCY.toUpperCase()}/${interval}`);
      return price.id;
    };
    out.push(`STRIPE_PRICE_${addon.env}=${await ensure(existingMonthly, monthlyKey, "month", addon.monthlyCents)}`);
    out.push(`STRIPE_PRICE_${addon.env}_YEARLY=${await ensure(existingYearly, yearlyKey, "year", addon.monthlyCents * MONTHS_CHARGED_YEARLY)}`);
  }
  console.log("\nAdd to Vercel (Production + Preview) and to artifacts/api-server/.env:\n");
  console.log(out.join("\n"));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

export {};
