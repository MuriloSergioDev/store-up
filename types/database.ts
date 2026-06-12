export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'admin' | 'operator'
export type ItemStatus = 'in_stock' | 'reserved' | 'sold'
export type ABCClass = 'A' | 'B' | 'C'
export type CashFlowType = 'income' | 'expense'
export type CashFlowCategory = 'sale' | 'purchase' | 'shipping' | 'other_cost' | 'other_income' | 'other_expense'
export type PaymentMethod = 'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito' | 'transferencia' | 'outro'
export type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'logout' | 'sell'

export interface Profile {
  id: string
  name: string
  email: string
  avatar_url: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  name: string
  description: string | null
  color: string
  icon: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Supplier {
  id: string
  name: string
  contact: string | null
  phone: string | null
  email: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Item {
  id: string
  name: string
  category_id: string | null
  description: string | null
  supplier_id: string | null
  purchase_date: string
  item_cost: number
  shipping_cost: number
  other_costs: number
  total_cost: number
  estimated_price: number
  estimated_profit: number
  estimated_margin: number
  quantity: number
  status: ItemStatus
  qr_code: string | null
  notes: string | null
  days_in_stock: number
  abc_class: ABCClass
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  // Relations
  category?: Category
  supplier?: Supplier
  images?: ItemImage[]
  sale?: Sale
}

export interface ItemImage {
  id: string
  item_id: string
  url: string
  storage_path: string
  is_primary: boolean
  created_at: string
}

export interface Sale {
  id: string
  item_id: string
  sale_date: string
  quantity_sold: number
  estimated_price: number
  sale_price: number
  item_cost: number
  profit: number
  profit_margin: number
  price_accuracy: number
  buyer_name: string | null
  buyer_contact: string | null
  payment_method: PaymentMethod
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Relations
  item?: Item
  created_by_profile?: Profile
}

export interface CashFlow {
  id: string
  type: CashFlowType
  category: CashFlowCategory
  amount: number
  description: string
  reference_id: string | null
  reference_type: 'sale' | 'item' | 'manual' | null
  date: string
  created_by: string | null
  created_at: string
}

export interface AuditLog {
  id: string
  user_id: string | null
  action: AuditAction
  table_name: string
  record_id: string | null
  old_data: Json | null
  new_data: Json | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
  // Relations
  user?: Profile
}

export interface DashboardSummary {
  total_invested: number
  total_shipping: number
  total_item_costs: number
  items_in_stock: number
  items_reserved: number
  items_sold: number
  total_items: number
  sales_count: number
  potential_revenue: number
  potential_profit: number
  stock_value: number
  realized_revenue: number
  realized_profit: number
  avg_price_accuracy: number
}

export interface MonthlyPerformance {
  month: string
  sales_count: number
  revenue: number
  profit: number
  cost: number
  avg_ticket: number
  avg_margin: number
}

export interface CategoryPerformance {
  id: string
  name: string
  color: string
  total_items: number
  sold_items: number
  stock_items: number
  total_cost: number
  total_revenue: number
  total_profit: number
  avg_margin: number
  potential_revenue: number
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
      }
      categories: {
        Row: Category
        Insert: Omit<Category, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Category, 'id' | 'created_at'>>
      }
      items: {
        Row: Item
        Insert: Omit<Item, 'id' | 'total_cost' | 'estimated_profit' | 'estimated_margin' | 'days_in_stock' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Item, 'id' | 'total_cost' | 'estimated_profit' | 'estimated_margin' | 'days_in_stock' | 'created_at'>>
      }
      item_images: {
        Row: ItemImage
        Insert: Omit<ItemImage, 'id' | 'created_at'>
        Update: Partial<Omit<ItemImage, 'id' | 'created_at'>>
      }
      sales: {
        Row: Sale
        Insert: Omit<Sale, 'id' | 'profit' | 'profit_margin' | 'price_accuracy' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Sale, 'id' | 'profit' | 'profit_margin' | 'price_accuracy' | 'created_at'>>
      }
      cash_flow: {
        Row: CashFlow
        Insert: Omit<CashFlow, 'id' | 'created_at'>
        Update: Partial<Omit<CashFlow, 'id' | 'created_at'>>
      }
      audit_log: {
        Row: AuditLog
        Insert: Omit<AuditLog, 'id' | 'created_at'>
        Update: never
      }
      suppliers: {
        Row: Supplier
        Insert: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Supplier, 'id' | 'created_at'>>
      }
    }
    Views: {
      dashboard_summary: { Row: DashboardSummary }
      monthly_performance: { Row: MonthlyPerformance }
      category_performance: { Row: CategoryPerformance }
    }
  }
}
