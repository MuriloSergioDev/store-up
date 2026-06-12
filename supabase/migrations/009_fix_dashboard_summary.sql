-- Fix dashboard_summary so realized_revenue/profit come from the sales table
-- directly, not filtered by item.status = 'sold'.
-- Reason: partial-quantity sales leave items in 'in_stock' status, so the
-- original view missed their revenue entirely.
-- Also adds sales_count for correct avg-ticket calculation.

DROP VIEW IF EXISTS dashboard_summary;

CREATE OR REPLACE VIEW dashboard_summary AS
SELECT
  COALESCE((SELECT SUM(total_cost)                              FROM items), 0)                              AS total_invested,
  COALESCE((SELECT SUM(shipping_cost)                           FROM items), 0)                              AS total_shipping,
  COALESCE((SELECT SUM(item_cost * quantity + other_costs)      FROM items), 0)                              AS total_item_costs,
  (SELECT COUNT(*) FROM items WHERE status = 'in_stock')                                                     AS items_in_stock,
  (SELECT COUNT(*) FROM items WHERE status = 'reserved')                                                     AS items_reserved,
  (SELECT COUNT(*) FROM items WHERE status = 'sold')                                                         AS items_sold,
  (SELECT COUNT(*) FROM items)                                                                               AS total_items,
  (SELECT COUNT(*) FROM sales)                                                                               AS sales_count,
  COALESCE((SELECT SUM(estimated_price * quantity) FROM items WHERE status != 'sold'), 0)                   AS potential_revenue,
  COALESCE((SELECT SUM(estimated_profit)           FROM items WHERE status != 'sold'), 0)                   AS potential_profit,
  COALESCE((SELECT SUM(total_cost)                 FROM items WHERE status != 'sold'), 0)                   AS stock_value,
  COALESCE((SELECT SUM(sale_price) FROM sales), 0)                                                          AS realized_revenue,
  COALESCE((SELECT SUM(profit)     FROM sales), 0)                                                          AS realized_profit,
  COALESCE((SELECT AVG(price_accuracy) FROM sales), 0)                                                      AS avg_price_accuracy;
