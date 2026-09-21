// Phase 73 (docs/PILOT-LAUNCH-PLAN.md): create the three yearly Stripe prices
// (10 × the monthly amount, "2 months free") next to the existing monthly
// ones, and print the env lines to paste into Vercel. Idempotent: each price
// carries a lookup_key, so re-running finds the existing one instead of
// creating a duplicate. Plain REST — no Stripe SDK in this package.
//
//   STRIPE_SECRET_KEY=sk_live_… pnpm --filter @workspace/scripts stripe-annual-prices
//
// Run it once against the test key and once against the live key; each Stripe
// mode has its own price ids.

// Mirror of PLANS in artifacts/api-server/src/routes/payments.ts (the monthly price ids).
const MONTHLY: Record<"STARTER" | "PRO" | "ELITE", string> = {
  STARTER: "price_1UEgdQEI5cvpdr6NMQIPKpao",
  PRO: "price_1UEgdSEI5cvpdr6Nx6dNesfl",
  ELITE: "price_1UEgdVEI5cvpdr6NHbrrdO88",
};
const MONTHS_CHARGED = 10;

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY is required (sk_test_… or sk_live_…)");
  process.exit(1);
}

type Price = { id: string; product: string; currency: string; unit_amount: number | null; nickname?: string | null; recurring?: { interval: string } | null };

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

async function main() {
  const out: string[] = [];
  for (const [tier, monthlyId] of Object.entries(MONTHLY) as [keyof typeof MONTHLY, string][]) {
    const lookupKey = `quoteai_yearly_${tier.toLowerCase()}`;
    const existing = await stripe<{ data: Price[] }>("GET", `/prices?lookup_keys[]=${encodeURIComponent(lookupKey)}&limit=1`);
    if (existing.data[0]) {
      console.log(`${tier}: yearly price already exists (${existing.data[0].id})`);
      out.push(`STRIPE_PRICE_YEARLY_${tier}=${existing.data[0].id}`);
      continue;
    }
    const monthly = await stripe<Price>("GET", `/prices/${monthlyId}`);
    if (monthly.unit_amount == null || monthly.recurring?.interval !== "month") {
      throw new Error(`${tier}: ${monthlyId} is not a monthly recurring price in this Stripe mode`);
    }
    const yearly = await stripe<Price>("POST", "/prices", {
      product: monthly.product,
      currency: monthly.currency,
      unit_amount: String(monthly.unit_amount * MONTHS_CHARGED),
      "recurring[interval]": "year",
      nickname: `${tier[0]}${tier.slice(1).toLowerCase()} — annual (${MONTHS_CHARGED} months)`,
      lookup_key: lookupKey,
      "metadata[tier]": `monthly_${tier.toLowerCase()}`,
      "metadata[interval]": "year",
    });
    console.log(`${tier}: created ${yearly.id} = ${(monthly.unit_amount * MONTHS_CHARGED) / 100} ${monthly.currency.toUpperCase()}/year`);
    out.push(`STRIPE_PRICE_YEARLY_${tier}=${yearly.id}`);
  }
  console.log("\nAdd to Vercel (Production + Preview) and to artifacts/api-server/.env:\n");
  console.log(out.join("\n"));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

export {};
