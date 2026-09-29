-- Pocket (docs/POCKET-DESIGN-PLAN.md, Phases 147 and 149): the phone Settings the owner's design
-- draws, and what the Quote draft needs from them. Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0060_pocket_settings.sql

-- Quote defaults (Settings → Quote defaults): how long a quote stays valid, the markup on
-- materials the quote writer adds, whether the owner gets a copy of each quote sent, the units.
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS quote_valid_days integer;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS materials_markup_percent numeric(5,2);
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS quote_copy_to_me boolean NOT NULL DEFAULT false;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS units text;

-- Each quote keeps the validity it was written with, and when the client first opened it.
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS valid_days integer;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS first_viewed_at timestamptz;

-- Push kinds that start off (Crew check-ins): turned on per person here; everything else is on
-- unless listed in muted.
ALTER TABLE push_preferences ADD COLUMN IF NOT EXISTS enabled text[] NOT NULL DEFAULT '{}'::text[];

-- A person's own app choices (the assistant's voice, speaking replies, asking before sending,
-- the language), per company and person like push_preferences.
CREATE TABLE IF NOT EXISTS member_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  member_user_id text NOT NULL,
  prefs jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS member_preferences_member_idx ON member_preferences (user_id, member_user_id);
ALTER TABLE member_preferences ENABLE ROW LEVEL SECURITY;
