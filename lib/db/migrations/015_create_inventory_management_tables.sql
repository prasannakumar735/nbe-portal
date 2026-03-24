-- Inventory Management (BOM-based) - safe additive migration
-- Creates new tables only: components, bill_of_materials, inventory_movements
-- Adds atomic order processing function for stock validation + deduction + movement logging

CREATE TABLE IF NOT EXISTS components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'pcs',
  stock_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0,
  min_stock NUMERIC(12, 3) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT components_stock_quantity_non_negative CHECK (stock_quantity >= 0),
  CONSTRAINT components_min_stock_non_negative CHECK (min_stock >= 0)
);

CREATE TABLE IF NOT EXISTS bill_of_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL,
  product_name TEXT,
  component_id UUID NOT NULL REFERENCES components(id) ON DELETE RESTRICT,
  quantity_per_unit NUMERIC(12, 3) NOT NULL,
  wastage_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT bill_of_materials_qty_positive CHECK (quantity_per_unit > 0),
  CONSTRAINT bill_of_materials_wastage_non_negative CHECK (wastage_percentage >= 0),
  CONSTRAINT bill_of_materials_product_component_unique UNIQUE (product_id, component_id)
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id UUID NOT NULL REFERENCES components(id) ON DELETE RESTRICT,
  movement_type TEXT NOT NULL,
  quantity NUMERIC(12, 3) NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  note TEXT,
  metadata JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT inventory_movements_type_check CHECK (movement_type IN ('in', 'out', 'adjustment', 'reserved', 'release')),
  CONSTRAINT inventory_movements_quantity_non_zero CHECK (quantity <> 0)
);

CREATE INDEX IF NOT EXISTS idx_components_stock_min ON components (stock_quantity, min_stock);
CREATE INDEX IF NOT EXISTS idx_components_active ON components (is_active);
CREATE INDEX IF NOT EXISTS idx_bom_product ON bill_of_materials (product_id);
CREATE INDEX IF NOT EXISTS idx_bom_component ON bill_of_materials (component_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_component_created ON inventory_movements (component_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_reference ON inventory_movements (reference_type, reference_id);

CREATE OR REPLACE FUNCTION process_inventory_order(
  p_product_id TEXT,
  p_quantity NUMERIC,
  p_reference_id TEXT,
  p_created_by UUID DEFAULT NULL
)
RETURNS TABLE(
  component_id UUID,
  component_name TEXT,
  required_qty NUMERIC,
  available_qty NUMERIC,
  remaining_qty NUMERIC,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  lock_row RECORD;
BEGIN
  IF p_product_id IS NULL OR btrim(p_product_id) = '' THEN
    RAISE EXCEPTION 'product_id is required';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'quantity must be greater than zero';
  END IF;

  CREATE TEMP TABLE tmp_inventory_requirements (
    component_id UUID,
    component_name TEXT,
    required_qty NUMERIC,
    available_qty NUMERIC,
    min_stock NUMERIC
  ) ON COMMIT DROP;

  FOR lock_row IN
    SELECT DISTINCT c.id
    FROM bill_of_materials bom
    JOIN components c ON c.id = bom.component_id
    WHERE bom.product_id = p_product_id
      AND bom.is_active = TRUE
      AND c.is_active = TRUE
  LOOP
    PERFORM 1 FROM components WHERE id = lock_row.id FOR UPDATE;
  END LOOP;

  INSERT INTO tmp_inventory_requirements (component_id, component_name, required_qty, available_qty, min_stock)
  SELECT
    c.id,
    c.name,
    ROUND(SUM(bom.quantity_per_unit * p_quantity * (1 + (bom.wastage_percentage / 100.0))), 3) AS required_qty,
    c.stock_quantity AS available_qty,
    c.min_stock
  FROM bill_of_materials bom
  JOIN components c ON c.id = bom.component_id
  WHERE bom.product_id = p_product_id
    AND bom.is_active = TRUE
    AND c.is_active = TRUE
  GROUP BY c.id, c.name, c.stock_quantity, c.min_stock;

  IF NOT EXISTS (SELECT 1 FROM tmp_inventory_requirements) THEN
    RAISE EXCEPTION 'No active BOM found for product_id %', p_product_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM tmp_inventory_requirements r
    WHERE r.required_qty > r.available_qty
  ) THEN
    RETURN QUERY
    SELECT
      r.component_id,
      r.component_name,
      r.required_qty,
      r.available_qty,
      r.available_qty AS remaining_qty,
      'insufficient'::TEXT AS status
    FROM tmp_inventory_requirements r
    ORDER BY r.component_name;

    RETURN;
  END IF;

  UPDATE components c
  SET
    stock_quantity = ROUND(c.stock_quantity - r.required_qty, 3),
    updated_at = timezone('utc', now())
  FROM tmp_inventory_requirements r
  WHERE c.id = r.component_id;

  INSERT INTO inventory_movements (
    component_id,
    movement_type,
    quantity,
    reference_type,
    reference_id,
    note,
    metadata,
    created_by
  )
  SELECT
    r.component_id,
    'out',
    ROUND(r.required_qty * -1, 3),
    'order',
    p_reference_id,
    'Auto deduction from order processing',
    jsonb_build_object(
      'product_id', p_product_id,
      'order_quantity', p_quantity,
      'required_qty', r.required_qty
    ),
    p_created_by
  FROM tmp_inventory_requirements r;

  RETURN QUERY
  SELECT
    r.component_id,
    r.component_name,
    r.required_qty,
    r.available_qty,
    ROUND(r.available_qty - r.required_qty, 3) AS remaining_qty,
    CASE
      WHEN ROUND(r.available_qty - r.required_qty, 3) <= r.min_stock THEN 'low'
      ELSE 'ok'
    END AS status
  FROM tmp_inventory_requirements r
  ORDER BY r.component_name;
END;
$$;