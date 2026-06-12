-- Add quantity_sold to sales table (default 1 keeps existing rows valid).
ALTER TABLE sales ADD COLUMN IF NOT EXISTS quantity_sold INTEGER NOT NULL DEFAULT 1;

-- Update trigger: decrement item quantity; mark as sold only when it hits 0.
CREATE OR REPLACE FUNCTION update_item_on_sale()
RETURNS TRIGGER AS $$
DECLARE
  v_item_name TEXT;
  v_remaining INTEGER;
BEGIN
  SELECT name, quantity - NEW.quantity_sold
    INTO v_item_name, v_remaining
    FROM items
    WHERE id = NEW.item_id;

  UPDATE items
     SET quantity   = GREATEST(quantity - NEW.quantity_sold, 0),
         status     = CASE WHEN v_remaining <= 0 THEN 'sold' ELSE status END,
         updated_at = NOW()
   WHERE id = NEW.item_id;

  INSERT INTO cash_flow (type, category, amount, description, reference_id, reference_type, date, created_by)
  VALUES ('income', 'sale', NEW.sale_price,
          'Venda: ' || v_item_name || CASE WHEN NEW.quantity_sold > 1 THEN ' (x' || NEW.quantity_sold || ')' ELSE '' END,
          NEW.id, 'sale', NEW.sale_date, NEW.created_by);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
