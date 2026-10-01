-- Pocket (docs/POCKET-APP-PLAN.md, Phase 127.3): the accountant's comments on a month of books (AccountantView). Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0069_pocket_accountant_comments.sql
CREATE TABLE IF NOT EXISTS accountant_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  month text NOT NULL,
  author_user_id text NOT NULL,
  author_name text NOT NULL DEFAULT '',
  author_role text NOT NULL DEFAULT 'accountant',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS accountant_comments_user_month_idx ON accountant_comments (user_id, month, created_at);
