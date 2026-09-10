/**
 * Seed script: crea i 4 piani quoteai su Stripe (idempotente).
 * Eseguire dopo aver connesso l'integrazione Stripe:
 *   pnpm --filter @workspace/scripts exec tsx src/seed-products.ts
 */
import { getUncachableStripeClient } from './stripeClient';

const PLANS = [
  {
    name: 'quoteai Starter',
    description: '10 preventivi al mese, logo aziendale, template Standard.',
    planId: 'monthly_starter',
    unitAmount: 1900,   // €19.00
    currency: 'eur',
    recurring: { interval: 'month' as const },
  },
  {
    name: 'quoteai Pro',
    description: '60 preventivi al mese, nessun watermark, tutti i template, AI con foto e voce.',
    planId: 'monthly_pro',
    unitAmount: 4900,   // €49.00
    currency: 'eur',
    recurring: { interval: 'month' as const },
  },
  {
    name: 'quoteai Elite',
    description: 'Preventivi illimitati, tutto incluso, supporto dedicato.',
    planId: 'monthly_elite',
    unitAmount: 5900,   // €59.00
    currency: 'eur',
    recurring: { interval: 'month' as const },
  },
  {
    name: 'quoteai Singolo Base',
    description: '1 preventivo PDF con riga quoteai.ca. Pagamento unico.',
    planId: 'oneshot_watermark',
    unitAmount: 500,    // €5.00
    currency: 'eur',
    recurring: null,
  },
  {
    name: 'quoteai Singolo Pro',
    description: '1 preventivo PDF pulito, logo aziendale, nessun watermark. Pagamento unico.',
    planId: 'oneshot_clean',
    unitAmount: 900,    // €9.00
    currency: 'eur',
    recurring: null,
  },
];

async function seedProducts() {
  const stripe = await getUncachableStripeClient();
  console.log('Connessione a Stripe OK. Creazione/aggiornamento prodotti...\n');

  for (const plan of PLANS) {
    // Check if product with this planId already exists
    const existing = await stripe.products.search({
      query: `metadata['planId']:'${plan.planId}' AND active:'true'`,
    });

    let productId: string;

    if (existing.data.length > 0) {
      const prod = existing.data[0];
      productId = prod.id;

      // Update product name/description in case they changed
      await stripe.products.update(productId, {
        name: plan.name,
        description: plan.description,
      });

      // Check if an active price already matches the desired unit_amount
      const prices = await stripe.prices.list({ product: productId, active: true, limit: 10 });
      const matchingPrice = prices.data.find((p) => p.unit_amount === plan.unitAmount);

      if (matchingPrice) {
        console.log(`✓ ${plan.name} — prezzo già corretto`);
        console.log(`  Product ID: ${productId}`);
        console.log(`  Price ID:   ${matchingPrice.id}  (€${plan.unitAmount / 100})`);
        console.log('');
        continue;
      }

      // Archive old prices
      for (const oldPrice of prices.data) {
        await stripe.prices.update(oldPrice.id, { active: false });
        console.log(`  ⚠ Prezzo archiviato: ${oldPrice.id}  (€${(oldPrice.unit_amount ?? 0) / 100})`);
      }
      console.log(`↻ ${plan.name} — prezzo aggiornato su prodotto esistente`);
      console.log(`  Product ID: ${productId}`);
    } else {
      // Create product
      const product = await stripe.products.create({
        name: plan.name,
        description: plan.description,
        metadata: { planId: plan.planId },
      });
      productId = product.id;
      console.log(`✓ Prodotto creato: ${product.name} (${product.id})`);
    }

    // Create new price
    const pricePayload: Parameters<typeof stripe.prices.create>[0] = {
      product: productId,
      unit_amount: plan.unitAmount,
      currency: plan.currency,
      metadata: { planId: plan.planId },
    };
    if (plan.recurring) pricePayload.recurring = plan.recurring;

    const price = await stripe.prices.create(pricePayload);
    console.log(`  Price ID: ${price.id}  (€${plan.unitAmount / 100}${plan.recurring ? '/mese' : ' una tantum'})`);
    console.log('');
  }

  console.log('✅ Seeding completato. Copia i Price ID sopra e aggiorna payments.ts se necessario.');
}

seedProducts().catch((err) => {
  console.error('Errore:', err.message);
  process.exit(1);
});
