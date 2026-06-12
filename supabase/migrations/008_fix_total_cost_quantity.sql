-- Fix generated columns to account for quantity.
-- item_cost and estimated_price are per-unit values; the original formula
-- omitted the quantity multiplier, making totals wrong for multi-unit items.

-- Drop views that depend on the columns being replaced
DROP VIEW IF EXISTS dashboard_summary;
DROP VIEW IF EXISTS category_performance;

-- Replace generated columns
ALTER TABLE items DROP COLUMN IF EXISTS estimated_margin;
ALTER TABLE items DROP COLUMN IF EXISTS estimated_profit;
ALTER TABLE items DROP COLUMN IF EXISTS total_cost;

ALTER TABLE items ADD COLUMN total_cost DECIMAL(10,2)
  GENERATED ALWAYS AS (item_cost * quantity + shipping_cost + other_costs) STORED;

ALTER TABLE items ADD COLUMN estimated_profit DECIMAL(10,2)
  GENERATED ALWAYS AS (estimated_price * quantity - (item_cost * quantity + shipping_cost + other_costs)) STORED;

ALTER TABLE items ADD COLUMN estimated_margin DECIMAL(10,4)
  GENERATED ALWAYS AS (
    CASE WHEN (item_cost * quantity + shipping_cost + other_costs) > 0
    THEN (estimated_price * quantity - (item_cost * quantity + shipping_cost + other_costs))
         / (item_cost * quantity + shipping_cost + other_costs)
    ELSE 0 END
  ) STORED;

-- Recreate dashboard_summary with corrected item cost formula
CREATE OR REPLACE VIEW dashboard_summary AS
SELECT
  COALESCE(SUM(i.total_cost), 0) as total_invested,
  COALESCE(SUM(i.shipping_cost), 0) as total_shipping,
  COALESCE(SUM(i.item_cost * i.quantity + i.other_costs), 0) as total_item_costs,
  COUNT(CASE WHEN i.status = 'in_stock' THEN 1 END) as items_in_stock,
  COUNT(CASE WHEN i.status = 'reserved' THEN 1 END) as items_reserved,
  COUNT(CASE WHEN i.status = 'sold' THEN 1 END) as items_sold,
  COUNT(*) as total_items,
  COALESCE(SUM(CASE WHEN i.status != 'sold' THEN i.estimated_price * i.quantity ELSE 0 END), 0) as potential_revenue,
  COALESCE(SUM(CASE WHEN i.status != 'sold' THEN i.estimated_profit ELSE 0 END), 0) as potential_profit,
  COALESCE(SUM(CASE WHEN i.status != 'sold' THEN i.total_cost ELSE 0 END), 0) as stock_value,
  COALESCE(SUM(CASE WHEN i.status = 'sold' THEN s.sale_price ELSE 0 END), 0) as realized_revenue,
  COALESCE(SUM(CASE WHEN i.status = 'sold' THEN s.profit ELSE 0 END), 0) as realized_profit,
  COALESCE(AVG(CASE WHEN s.id IS NOT NULL THEN s.price_accuracy END), 0) as avg_price_accuracy
FROM items i
LEFT JOIN sales s ON i.id = s.item_id;

-- Recreate category_performance
CREATE OR REPLACE VIEW category_performance AS
SELECT
  c.id,
  c.name,
  c.color,
  COUNT(i.id) as total_items,
  COUNT(CASE WHEN i.status = 'sold' THEN 1 END) as sold_items,
  COUNT(CASE WHEN i.status = 'in_stock' THEN 1 END) as stock_items,
  COALESCE(SUM(i.total_cost), 0) as total_cost,
  COALESCE(SUM(CASE WHEN i.status = 'sold' THEN s.sale_price ELSE 0 END), 0) as total_revenue,
  COALESCE(SUM(CASE WHEN i.status = 'sold' THEN s.profit ELSE 0 END), 0) as total_profit,
  COALESCE(AVG(CASE WHEN i.status = 'sold' THEN s.profit_margin ELSE NULL END), 0) as avg_margin,
  COALESCE(SUM(CASE WHEN i.status != 'sold' THEN i.estimated_price * i.quantity ELSE 0 END), 0) as potential_revenue
FROM categories c
LEFT JOIN items i ON i.category_id = c.id
LEFT JOIN sales s ON s.item_id = i.id
GROUP BY c.id, c.name, c.color;
