-- Trigger functions that write to tables with RLS must be SECURITY DEFINER
-- so they execute as the function owner (postgres) and bypass RLS.
-- Without this, PostgREST's role-switching context can cause the
-- "new row violates row-level security policy" error on items INSERT.

CREATE OR REPLACE FUNCTION add_purchase_to_cashflow()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.item_cost > 0 THEN
    INSERT INTO cash_flow (type, category, amount, description, reference_id, reference_type, date, created_by)
    VALUES ('expense', 'purchase', NEW.item_cost, 'Compra: ' || NEW.name, NEW.id, 'item', NEW.purchase_date, NEW.created_by);
  END IF;
  IF NEW.shipping_cost > 0 THEN
    INSERT INTO cash_flow (type, category, amount, description, reference_id, reference_type, date, created_by)
    VALUES ('expense', 'shipping', NEW.shipping_cost, 'Frete: ' || NEW.name, NEW.id, 'item', NEW.purchase_date, NEW.created_by);
  END IF;
  IF NEW.other_costs > 0 THEN
    INSERT INTO cash_flow (type, category, amount, description, reference_id, reference_type, date, created_by)
    VALUES ('expense', 'other_cost', NEW.other_costs, 'Outros custos: ' || NEW.name, NEW.id, 'item', NEW.purchase_date, NEW.created_by);
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION update_item_on_sale()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE items SET status = 'sold', updated_at = NOW() WHERE id = NEW.item_id;

  INSERT INTO cash_flow (type, category, amount, description, reference_id, reference_type, date, created_by)
  VALUES ('income', 'sale', NEW.sale_price, 'Venda: ' || (SELECT name FROM items WHERE id = NEW.item_id), NEW.id, 'sale', NEW.sale_date, NEW.created_by);

  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER SET search_path = public;
