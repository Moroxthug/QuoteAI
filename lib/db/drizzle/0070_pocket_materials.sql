-- Pocket (docs/POCKET-APP-PLAN.md, Phase 127.6): the price book's kind, cost and parts (PriceBook), the supplier's rep and terms (Suppliers, Supplier),
-- the stock and the orders to suppliers (Inventory). Additive, idempotent.
-- Apply with: supabase db query --linked --file lib/db/drizzle/0070_pocket_materials.sql
ALTER TABLE price_catalog_items ADD COLUMN IF NOT EXISTS kind text;
ALTER TABLE price_catalog_items ADD COLUMN IF NOT EXISTS unit_cost numeric(10,2);
ALTER TABLE price_catalog_items ADD COLUMN IF NOT EXISTS previous_price numeric(10,2);
ALTER TABLE price_catalog_items ADD COLUMN IF NOT EXISTS price_changed_at timestamptz;
ALTER TABLE price_catalog_items ADD COLUMN IF NOT EXISTS parts jsonb;

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS rep_name text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS rep_role text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'account';
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS account_no text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS terms text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS pro_discount_pct numeric(5,2);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS delivers text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS hours text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'each',
  par numeric(10,2) NOT NULL DEFAULT 0,
  shop_qty numeric(10,2) NOT NULL DEFAULT 0,
  truck_qty numeric(10,2) NOT NULL DEFAULT 0,
  sites jsonb NOT NULL DEFAULT '[]'::jsonb,
  reserved jsonb NOT NULL DEFAULT '[]'::jsonb,
  unit_cost_cents integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inventory_items_user_idx ON inventory_items (user_id);

CREATE TABLE IF NOT EXISTS supplier_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  inventory_item_id uuid REFERENCES inventory_items(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  unit text NOT NULL DEFAULT 'each',
  qty numeric(10,2) NOT NULL DEFAULT 1,
  unit_price_cents integer,
  destination text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'listed',
  ordered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS supplier_orders_user_supplier_idx ON supplier_orders (user_id, supplier_id, created_at);
