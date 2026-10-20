-- Phase 135 (docs/GROWTH-PLAN.md): Google Play Billing. Additive, idempotent. NOT applied yet.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0078_play_billing.sql
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS subscription_provider text;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS play_purchase_token text;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS play_product_id text;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS play_auto_renewing boolean;

-- One purchase token belongs to one company.
CREATE UNIQUE INDEX IF NOT EXISTS business_profiles_play_token_uq ON business_profiles (play_purchase_token) WHERE play_purchase_token IS NOT NULL;

-- Everyone who pays through Stripe today is a Stripe subscriber.
UPDATE business_profiles
   SET subscription_provider = 'stripe'
 WHERE subscription_provider IS NULL
   AND stripe_customer_id IS NOT NULL
   AND subscription_status = 'active'
   AND coalesce(subscription_plan, '') NOT IN ('', 'free');
