import Stripe from 'stripe';

export async function getUncachableStripeClient(): Promise<Stripe> {
  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) throw new Error('STRIPE_SECRET_KEY environment variable is required');
  return new Stripe(sk);
}
