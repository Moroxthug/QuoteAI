-- Phase 85 — the inbound half of the calendar.
--
-- Everything before this pushed QuoteAI into someone's calendar and never read
-- anything back. These three tables are the other direction: a read-only
-- mirror of what a connected account or a subscribed .ics feed says is
-- happening, the subscriptions themselves, and one private URL per company
-- that serves QuoteAI's own schedule as .ics.

ALTER TABLE "calendar_connections"
  ADD COLUMN IF NOT EXISTS "last_inbound_sync_at" timestamp with time zone;

CREATE TABLE IF NOT EXISTS "calendar_feeds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL REFERENCES "auth_user"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "url" text NOT NULL,
  "is_enabled" boolean DEFAULT true NOT NULL,
  "last_fetched_at" timestamp with time zone,
  "last_status" text,
  "last_error" text,
  "event_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "calendar_feeds_user_idx" ON "calendar_feeds" ("user_id");

CREATE TABLE IF NOT EXISTS "calendar_external_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "source" text NOT NULL,
  "feed_id" uuid REFERENCES "calendar_feeds"("id") ON DELETE CASCADE,
  "external_id" text NOT NULL,
  "title" text DEFAULT '' NOT NULL,
  "location" text DEFAULT '' NOT NULL,
  "starts_at" timestamp with time zone NOT NULL,
  "ends_at" timestamp with time zone NOT NULL,
  "all_day" boolean DEFAULT false NOT NULL,
  "busy" boolean DEFAULT true NOT NULL,
  "html_link" text,
  "is_ours" boolean DEFAULT false NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "calendar_external_events_identity_idx"
  ON "calendar_external_events" ("user_id", "source", "external_id");
CREATE INDEX IF NOT EXISTS "calendar_external_events_window_idx"
  ON "calendar_external_events" ("user_id", "starts_at");

CREATE TABLE IF NOT EXISTS "calendar_publish_tokens" (
  "user_id" text PRIMARY KEY REFERENCES "auth_user"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL,
  "hint" text DEFAULT '' NOT NULL,
  "last_accessed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "calendar_publish_tokens_hash_idx"
  ON "calendar_publish_tokens" ("token_hash");
