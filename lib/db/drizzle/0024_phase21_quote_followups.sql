-- Phase 21: quote-sent follow-up reminders.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0024_phase21_quote_followups.sql

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS follow_up_stage integer NOT NULL DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS next_follow_up_at timestamptz;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS unsubscribe_token text NOT NULL DEFAULT gen_random_uuid()::text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz;

CREATE INDEX IF NOT EXISTS quotes_followup_due_idx ON quotes (status, next_follow_up_at);
CREATE UNIQUE INDEX IF NOT EXISTS quotes_unsubscribe_token_idx ON quotes (unsubscribe_token);
