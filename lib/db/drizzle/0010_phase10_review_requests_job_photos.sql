-- Phase 10 — review requests + job photo galleries. Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0010_phase10_review_requests_job_photos.sql

-- Review requests: one-shot, gated on job completion + a company-set Google review link.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS review_request_sent_at TIMESTAMPTZ;

ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS google_review_url TEXT;
ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS send_review_requests BOOLEAN NOT NULL DEFAULT TRUE;

-- CASL opt-out for marketing-type sends (review requests, shared photos) — separate
-- from any transactional communication, which is never gated by this.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS marketing_unsubscribe_token TEXT;
UPDATE clients SET marketing_unsubscribe_token = gen_random_uuid()::text WHERE marketing_unsubscribe_token IS NULL;
ALTER TABLE clients ALTER COLUMN marketing_unsubscribe_token SET NOT NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS marketing_unsubscribed_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS clients_marketing_unsubscribe_token_idx ON clients (marketing_unsubscribe_token);

-- Job photo galleries.
CREATE TABLE IF NOT EXISTS job_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id UUID,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  shared_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS job_photos_project_idx ON job_photos (project_id, sort_order);
