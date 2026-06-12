import { createClient } from '@/lib/supabase/server'
import { PurchaseForm } from '@/components/items/purchase-form'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const metadata = { title: 'Nova Compra' }

export default async function NovaCompraPage() {
  const supabase = await createClient()
  const [{ data: categories }, { data: suppliers }] = await Promise.all([
    supabase.from('categories').select('*').order('name'),
    (supabase.from('suppliers') as any).select('*').order('name'),
  ])

  return (
    <div className="space-y-6 max-w-4xl pb-10">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/compras">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Nova Compra</h1>
          <p className="text-muted-foreground text-sm">Cadastre os itens adquiridos</p>
        </div>
      </div>
      <PurchaseForm categories={categories ?? []} suppliers={suppliers ?? []} />
    </div>
  )
}
