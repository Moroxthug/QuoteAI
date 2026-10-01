-- Pocket (docs/POCKET-APP-PLAN.md, Phase 126): the crew's phone pairs with a code the admin makes. A code is hashed, lasts 7 days and works once;
-- it is swapped for the worker's personal link token. `replaced_token_hash` remembers the link a new one replaced, so the phone can say "replaced".
-- Additive, idempotent. Apply with: supabase db query --linked --file lib/db/drizzle/0066_pocket_crew_pairing.sql
ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS pairing_code_hash text;
ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS pairing_code_expires_at timestamptz;
ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS replaced_token_hash text;
CREATE INDEX IF NOT EXISTS collaborators_pairing_code_idx ON collaborators (pairing_code_hash) WHERE pairing_code_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS collaborators_replaced_token_idx ON collaborators (replaced_token_hash) WHERE replaced_token_hash IS NOT NULL;
