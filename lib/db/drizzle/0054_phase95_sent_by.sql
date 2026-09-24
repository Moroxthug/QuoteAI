-- Phase 95 (docs/LAUNCH-FINISH-PLAN.md): who sent it, so a won quote is
-- credited to the person who sent it and each person's page and the team
-- leaderboard can count "sent" as well as "made".
--  * quotes.sent_by_user_id: the person who first emailed the quote.
--  * invoices.sent_by_user_id: the person who first sent the invoice (null
--    when it went out on a schedule).
-- Nothing is backfilled: rows sent before this phase stay unattributed.
-- Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0054_phase95_sent_by.sql

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS sent_by_user_id text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_by_user_id text;
CREATE INDEX IF NOT EXISTS quotes_sent_by_idx ON quotes (user_id, sent_by_user_id) WHERE sent_by_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS invoices_sent_by_idx ON invoices (user_id, sent_by_user_id) WHERE sent_by_user_id IS NOT NULL;
