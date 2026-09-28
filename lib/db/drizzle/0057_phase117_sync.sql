-- Phase 117 (docs/APP-PLAN.md "Sync II"): idempotency keys for every mutating
-- route, and the per-company change feed behind GET /api/changes.
-- Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0057_phase117_sync.sql

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key text NOT NULL,
  method text NOT NULL,
  path text NOT NULL,
  fingerprint text,
  response_status integer,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idempotency_keys_key_idx ON idempotency_keys (key, method, path);
CREATE INDEX IF NOT EXISTS idempotency_keys_created_idx ON idempotency_keys (created_at);

CREATE TABLE IF NOT EXISTS change_log (
  id bigserial PRIMARY KEY,
  org_id text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  parent_id text,
  op text NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS change_log_org_idx ON change_log (org_id, id);
CREATE INDEX IF NOT EXISTS change_log_at_idx ON change_log (at);

-- Server-only tables: no API role reads them directly (RLS on, no policies),
-- as for every other table the Express API owns.
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_log ENABLE ROW LEVEL SECURITY;

-- One trigger function for every table in the feed.
--   TG_ARGV[0] = the entity name the app knows it by
--   TG_ARGV[1] = the column holding the parent (job or quote) id, '' for none
-- The company is the row's user_id; rows without one (project_tasks) are
-- looked up through their job. Anything going wrong here is swallowed: the
-- feed is a hint to refetch, and it must never block or fail a write.
CREATE OR REPLACE FUNCTION qai_log_change() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  r jsonb;
  org text;
  parent text;
BEGIN
  BEGIN
    IF TG_OP = 'DELETE' THEN r := to_jsonb(OLD); ELSE r := to_jsonb(NEW); END IF;
    org := r->>'user_id';
    IF TG_NARGS > 1 AND TG_ARGV[1] <> '' THEN parent := r->>TG_ARGV[1]; END IF;
    IF org IS NULL AND parent IS NOT NULL THEN
      SELECT p.user_id INTO org FROM projects p WHERE p.id = parent::uuid;
    END IF;
    IF org IS NOT NULL THEN
      INSERT INTO change_log (org_id, entity, entity_id, parent_id, op)
      VALUES (org, TG_ARGV[0], r->>'id', parent, lower(TG_OP));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NULL;
END
$$;

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT * FROM (VALUES
    ('projects', 'job', ''),
    ('milestones', 'milestone', 'project_id'),
    ('project_tasks', 'task', 'project_id'),
    ('job_notes', 'note', 'project_id'),
    ('job_photos', 'photo', 'project_id'),
    ('cost_entries', 'cost', 'project_id'),
    ('time_entries', 'time', 'project_id'),
    ('field_reports', 'report', 'project_id'),
    ('change_orders', 'change_order', 'project_id'),
    ('schedule_blocks', 'schedule', 'project_id'),
    ('quotes', 'quote', ''),
    ('quote_variants', 'quote', 'quote_id'),
    ('clients', 'client', ''),
    ('invoices', 'invoice', 'project_id'),
    ('contracts', 'contract', 'project_id'),
    ('leads', 'lead', '')
  ) AS v(tbl, entity, parent_col)
  LOOP
    IF to_regclass('public.' || t.tbl) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS qai_change_feed ON %I', t.tbl);
      EXECUTE format('CREATE TRIGGER qai_change_feed AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION qai_log_change(%L, %L)', t.tbl, t.entity, t.parent_col);
    END IF;
  END LOOP;
END
$$;
