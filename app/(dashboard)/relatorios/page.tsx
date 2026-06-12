import { createClient } from '@/lib/supabase/server'
import { ReportsClient } from '@/components/reports/reports-client'

export const metadata = { title: 'Relatórios' }
export const revalidate = 0

export default async function RelatoriosPage() {
  const supabase = await createClient()

  const [
    { data: items },
    { data: sales },
    { data: cashFlow },
    { data: categories },
    { data: monthly },
  ] = await Promise.all([
    supabase.from('items').select('*, category:categories(*), images:item_images(*)').order('created_at', { ascending: false }),
    supabase.from('sales').select('*, item:items(*, category:categories(*))').order('sale_date', { ascending: false }),
    supabase.from('cash_flow').select('*').order('date', { ascending: false }),
    supabase.from('category_performance').select('*'),
    supabase.from('monthly_performance').select('*').order('month'),
  ])

  return (
    <ReportsClient
      items={(items as any[]) ?? []}
      sales={(sales as any[]) ?? []}
      cashFlow={cashFlow ?? []}
      categories={(categories as any[]) ?? []}
      monthly={(monthly as any[]) ?? []}
    />
  )
}
