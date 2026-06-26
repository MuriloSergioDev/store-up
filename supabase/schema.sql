-- ============================================================
-- SCHEMA COMPLETO - SISTEMA DE GESTÃO DE RELÍQUIAS E ANTIGUIDADES
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'operator')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT 'package',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default categories
INSERT INTO categories (name, description, color, icon) VALUES
  ('Porcelanas', 'Peças de porcelana, louças e cerâmicas finas', '#3b82f6', 'coffee'),
  ('Relíquias', 'Itens raros e históricos', '#f59e0b', 'star'),
  ('Colecionáveis', 'Itens de coleção diversos', '#10b981', 'layers'),
  ('Decoração', 'Objetos decorativos e arte', '#8b5cf6', 'home'),
  ('Joias e Bijuterias', 'Joias antigas e bijuterias vintage', '#ec4899', 'gem'),
  ('Móveis Antigos', 'Móveis e peças de madeira antigas', '#92400e', 'table'),
  ('Outros', 'Outros itens não categorizados', '#6b7280', 'package')
ON CONFLICT DO NOTHING;

-- ============================================================
-- ITEMS (Estoque)
-- ============================================================
CREATE TABLE IF NOT EXISTS items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  category_id UUID REFERENCES categories(id),
  description TEXT,
  purchase_location TEXT,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  item_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  shipping_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  other_costs DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_cost DECIMAL(10,2) GENERATED ALWAYS AS (item_cost + shipping_cost + other_costs) STORED,
  estimated_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  estimated_profit DECIMAL(10,2) GENERATED ALWAYS AS (estimated_price - (item_cost + shipping_cost + other_costs)) STORED,
  estimated_margin DECIMAL(10,4) GENERATED ALWAYS AS (
    CASE WHEN (item_cost + shipping_cost + other_costs) > 0
    THEN (estimated_price - (item_cost + shipping_cost + other_costs)) / (item_cost + shipping_cost + other_costs)
    ELSE 0 END
  ) STORED,
  quantity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'reserved', 'sold')),
  qr_code TEXT,
  notes TEXT,
  days_in_stock INTEGER DEFAULT 0,
  abc_class TEXT DEFAULT 'C' CHECK (abc_class IN ('A', 'B', 'C')),
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ITEM IMAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS item_images (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  item_id UUID REFERENCES items(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SALES
-- ============================================================
CREATE TABLE IF NOT EXISTS sales (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  item_id UUID REFERENCES items(id) NOT NULL,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  estimated_price DECIMAL(10,2) NOT NULL,
  sale_price DECIMAL(10,2) NOT NULL,
  item_cost DECIMAL(10,2) NOT NULL,
  profit DECIMAL(10,2) GENERATED ALWAYS AS (sale_price - item_cost) STORED,
  profit_margin DECIMAL(10,4) GENERATED ALWAYS AS (
    CASE WHEN item_cost > 0 THEN (sale_price - item_cost) / item_cost ELSE 0 END
  ) STORED,
  price_accuracy DECIMAL(10,4) GENERATED ALWAYS AS (
    CASE WHEN estimated_price > 0 THEN sale_price / estimated_price ELSE 0 END
  ) STORED,
  buyer_name TEXT,
  buyer_contact TEXT,
  payment_method TEXT DEFAULT 'dinheiro' CHECK (payment_method IN ('dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'transferencia', 'outro')),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CASH FLOW
-- ============================================================
CREATE TABLE IF NOT EXISTS cash_flow (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL CHECK (category IN ('sale', 'purchase', 'shipping', 'other_cost', 'other_income', 'other_expense')),
  amount DECIMAL(10,2) NOT NULL,
  description TEXT NOT NULL,
  reference_id UUID,
  reference_type TEXT CHECK (reference_type IN ('sale', 'item', 'manual')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'login', 'logout', 'sell')),
  table_name TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- VIEWS
-- ============================================================

-- Dashboard summary view
CREATE OR REPLACE VIEW dashboard_summary AS
SELECT
  -- Investment metrics
  COALESCE(SUM(i.total_cost), 0) as total_invested,
  COALESCE(SUM(i.shipping_cost), 0) as total_shipping,
  COALESCE(SUM(i.item_cost + i.other_costs), 0) as total_item_costs,

  -- Inventory metrics
  COUNT(CASE WHEN i.status = 'in_stock' THEN 1 END) as items_in_stock,
  COUNT(CASE WHEN i.status = 'reserved' THEN 1 END) as items_reserved,
  COUNT(CASE WHEN i.status = 'sold' THEN 1 END) as items_sold,
  COUNT(*) as total_items,

  -- Estimated/Projected metrics
  COALESCE(SUM(CASE WHEN i.status != 'sold' THEN i.estimated_price ELSE 0 END), 0) as potential_revenue,
  COALESCE(SUM(CASE WHEN i.status != 'sold' THEN i.estimated_profit ELSE 0 END), 0) as potential_profit,
  COALESCE(SUM(CASE WHEN i.status != 'sold' THEN i.total_cost ELSE 0 END), 0) as stock_value,

  -- Realized metrics
  COALESCE(SUM(CASE WHEN i.status = 'sold' THEN s.sale_price ELSE 0 END), 0) as realized_revenue,
  COALESCE(SUM(CASE WHEN i.status = 'sold' THEN s.profit ELSE 0 END), 0) as realized_profit,

  -- Accuracy metrics
  COALESCE(AVG(CASE WHEN s.id IS NOT NULL THEN s.price_accuracy END), 0) as avg_price_accuracy

FROM items i
LEFT JOIN sales s ON i.id = s.item_id;

-- Monthly performance view
CREATE OR REPLACE VIEW monthly_performance AS
SELECT
  DATE_TRUNC('month', s.sale_date) as month,
  COUNT(*) as sales_count,
  SUM(s.sale_price) as revenue,
  SUM(s.profit) as profit,
  SUM(s.item_cost) as cost,
  AVG(s.sale_price) as avg_ticket,
  AVG(s.profit_margin) as avg_margin
FROM sales s
GROUP BY DATE_TRUNC('month', s.sale_date)
ORDER BY month;

-- Category performance view
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
  COALESCE(SUM(CASE WHEN i.status != 'sold' THEN i.estimated_price ELSE 0 END), 0) as potential_revenue
FROM categories c
LEFT JOIN items i ON i.category_id = c.id
LEFT JOIN sales s ON s.item_id = i.id
GROUP BY c.id, c.name, c.color;

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Auto create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'admin')
  );
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Update item status when sold
CREATE OR REPLACE FUNCTION update_item_on_sale()
RETURNS TRIGGER AS $$
BEGIN
  -- Mark item as sold
  UPDATE items SET status = 'sold', updated_at = NOW() WHERE id = NEW.item_id;

  -- Add income to cash flow
  INSERT INTO cash_flow (type, category, amount, description, reference_id, reference_type, date, created_by)
  VALUES ('income', 'sale', NEW.sale_price, 'Venda: ' || (SELECT name FROM items WHERE id = NEW.item_id), NEW.id, 'sale', NEW.sale_date, NEW.created_by);

  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add purchase to cash flow
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
$$ language 'plpgsql';

-- ============================================================
-- TRIGGERS
-- ============================================================
CREATE OR REPLACE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_items_updated_at BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_sales_updated_at BEFORE UPDATE ON sales
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE OR REPLACE TRIGGER on_sale_created AFTER INSERT ON sales
  FOR EACH ROW EXECUTE FUNCTION update_item_on_sale();

CREATE OR REPLACE TRIGGER on_item_created AFTER INSERT ON items
  FOR EACH ROW EXECUTE FUNCTION add_purchase_to_cashflow();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_flow ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Profiles RLS
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins can manage all profiles" ON profiles FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Categories RLS (all authenticated users can read, only admins can write)
CREATE POLICY "Authenticated users can view categories" ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage categories" ON categories FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Items RLS
CREATE POLICY "Authenticated users can view items" ON items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create items" ON items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update items" ON items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete items" ON items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Item Images RLS
CREATE POLICY "Authenticated users can view images" ON item_images FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage images" ON item_images FOR ALL TO authenticated USING (true);

-- Sales RLS
CREATE POLICY "Authenticated users can view sales" ON sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create sales" ON sales FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can update/delete sales" ON sales FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Cash Flow RLS
CREATE POLICY "Authenticated users can view cash flow" ON cash_flow FOR SELECT TO authenticated USING (true);
CREATE POLICY "System can manage cash flow" ON cash_flow FOR ALL TO authenticated USING (true);

-- Audit Log RLS
CREATE POLICY "Authenticated users can view audit log" ON audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "System can insert audit log" ON audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_category_id ON items(category_id);
CREATE INDEX IF NOT EXISTS idx_items_purchase_date ON items(purchase_date);
CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_item_id ON sales(item_id);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_cash_flow_date ON cash_flow(date);
CREATE INDEX IF NOT EXISTS idx_cash_flow_type ON cash_flow(type);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
