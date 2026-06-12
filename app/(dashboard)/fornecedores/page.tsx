import { createClient } from '@/lib/supabase/server'
import { SuppliersClient } from '@/components/suppliers/suppliers-client'
import type { SupplierStats } from '@/components/suppliers/suppliers-client'

export const metadata = { title: 'Fornecedores' }
export const revalidate = 0

export default async function FornecedoresPage() {
  const supabase = await createClient()

  const [{ data: suppliers }, { data: items }] = await Promise.all([
    (supabase.from('suppliers') as any).select('*').order('name'),
    (supabase.from('items') as any)
      .select('supplier_id, quantity, total_cost, purchase_date')
      .not('supplier_id', 'is', null),
  ])

  const statsMap: Record<string, SupplierStats> = {}
  for (const item of (items ?? [])) {
    if (!item.supplier_id) continue
    if (!statsMap[item.supplier_id]) {
      statsMap[item.supplier_id] = { items_count: 0, total_quantity: 0, total_spent: 0, purchases_count: 0, _dates: new Set() }
    }
    const s = statsMap[item.supplier_id]
    s.items_count++
    s.total_quantity += item.quantity ?? 0
    s.total_spent += item.total_cost ?? 0
    ;(s._dates as Set<string>).add(item.purchase_date)
  }
  for (const s of Object.values(statsMap)) {
    s.purchases_count = (s._dates as Set<string>).size
    delete s._dates
  }

  return <SuppliersClient suppliers={suppliers ?? []} statsMap={statsMap} />
}
