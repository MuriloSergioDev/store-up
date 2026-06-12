import { createClient } from '@/lib/supabase/server'
import { SaleForm } from '@/components/sales/sale-form'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export const metadata = { title: 'Registrar Venda' }

export default async function NovaVendaPage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  // Get available items (not sold)
  const { data: items } = await supabase
    .from('items')
    .select('*, category:categories(*), images:item_images(*)')
    .neq('status', 'sold')
    .order('name')

  const typedItems = (items ?? []) as unknown as any[]
  // Pre-select item if provided via query param
  const preSelectedItem = params.item
    ? typedItems.find(i => i.id === params.item) ?? null
    : null

  return (
    <div className="space-y-6 max-w-2xl pb-10">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/vendas"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Registrar Venda</h1>
          <p className="text-muted-foreground text-sm">Registre a baixa de um item vendido</p>
        </div>
      </div>
      <SaleForm items={typedItems} preSelectedItem={preSelectedItem} />
    </div>
  )
}
