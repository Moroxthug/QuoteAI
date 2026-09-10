import Stripe from 'stripe';

function getCredentials(): { publishableKey: string; secretKey: string } {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is required');
  }
  return {
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? '',
    secretKey,
  };
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = getCredentials();
  return new Stripe(secretKey);
}

export async function getStripePublishableKey(): Promise<string> {
  const { publishableKey } = getCredentials();
  return publishableKey;
}

export async function getStripeSecretKey(): Promise<string> {
  const { secretKey } = getCredentials();
  return secretKey;
}
