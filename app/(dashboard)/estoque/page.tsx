import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus, Package, AlertTriangle } from 'lucide-react'
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { InventoryFilters } from '@/components/items/inventory-filters'
import Image from 'next/image'
import { Suspense } from 'react'
import type { Item, Category, ItemImage } from '@/types/database'

export const metadata = { title: 'Estoque' }
export const revalidate = 0

interface SearchParams {
  q?: string
  status?: string
  category?: string
  price?: string
}

type ItemWithRelations = Item & {
  category: Category | null
  images: ItemImage[]
}

export default async function EstoquePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const supabase = await createClient()
  const params = await searchParams

  const { data: categories } = await supabase.from('categories').select('*').order('name')

  let query = supabase
    .from('items')
    .select('*, category:categories(*), images:item_images(*)')
    .order('created_at', { ascending: false })

  if (params.q) query = query.ilike('name', `%${params.q}%`)
  if (params.status) query = query.eq('status', params.status)
  if (params.category) query = query.eq('category_id', params.category)
  if (params.price) {
    const parts = params.price.split('-')
    if (parts.length === 2 && parts[1]) {
      query = query.gte('estimated_price', Number(parts[0])).lte('estimated_price', Number(parts[1]))
    } else if (params.price === '5000+') {
      query = query.gte('estimated_price', 5000)
    }
  }

  const { data: rawItems } = await query
  const items = (rawItems ?? []) as unknown as ItemWithRelations[]

  const inStockCount = items.filter(i => i.status === 'in_stock').length
  const reservedCount = items.filter(i => i.status === 'reserved').length
  const soldCount = items.filter(i => i.status === 'sold').length
  const staleCount = items.filter(i => i.status === 'in_stock' && (i.days_in_stock ?? 0) > 90).length

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Estoque</h1>
          <div className="flex gap-3 mt-1">
            <span className="text-xs text-green-600 dark:text-green-400 font-medium">{inStockCount} em estoque</span>
            <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">{reservedCount} reservados</span>
            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">{soldCount} vendidos</span>
          </div>
        </div>
        <Button asChild>
          <Link href="/compras/nova">
            <Plus className="mr-2 h-4 w-4" />
            Novo Item
          </Link>
        </Button>
      </div>

      {staleCount > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{staleCount} {staleCount === 1 ? 'item parado' : 'itens parados'} há mais de 90 dias — considere revisar os preços</span>
        </div>
      )}

      <Suspense>
        <InventoryFilters categories={categories ?? []} />
      </Suspense>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Package className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold">Nenhum item encontrado</h3>
          <p className="text-muted-foreground text-sm mt-1">
            {Object.keys(params).length > 0 ? 'Tente ajustar os filtros' : 'Cadastre seu primeiro item'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {items.map((item) => {
            const primaryImage = item.images?.find(img => img.is_primary) ?? item.images?.[0]
            const isStale = item.status === 'in_stock' && (item.days_in_stock ?? 0) > 90
            return (
              <Card
                key={item.id}
                className={`overflow-hidden hover:shadow-md transition-shadow ${isStale ? 'border-amber-500/30' : ''}`}
              >
                <Link href={`/estoque/${item.id}`}>
                  <div className="aspect-[4/3] relative bg-muted">
                    {primaryImage ? (
                      <Image src={primaryImage.url} alt={item.name} fill className="object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Package className="w-10 h-10 text-muted-foreground/30" />
                      </div>
                    )}
                    <Badge className={`absolute top-2 right-2 text-xs ${getStatusColor(item.status)}`} variant="secondary">
                      {getStatusLabel(item.status)}
                    </Badge>
                    {isStale && (
                      <div className="absolute bottom-2 left-2">
                        <Badge variant="outline" className="bg-amber-500/90 text-white border-0 text-xs">
                          {item.days_in_stock}d parado
                        </Badge>
                      </div>
                    )}
                    {item.abc_class === 'A' && (
                      <div className="absolute top-2 left-2">
                        <Badge className="bg-green-600 text-white text-xs">Classe A</Badge>
                      </div>
                    )}
                  </div>
                </Link>
                <CardContent className="p-4">
                  <Link href={`/estoque/${item.id}`}>
                    <h3 className="font-semibold text-sm truncate hover:text-primary transition-colors">
                      {item.name}
                    </h3>
                  </Link>
                  {item.category && (
                    <p className="text-xs text-muted-foreground mt-0.5">{item.category.name}</p>
                  )}
                  <div className="mt-3 grid grid-cols-2 gap-y-1.5 text-xs">
                    <span className="text-muted-foreground">Compra:</span>
                    <span className="text-right">{formatDate(item.purchase_date)}</span>
                    <span className="text-muted-foreground">Quantidade:</span>
                    <span className="text-right font-medium">{item.quantity}</span>
                    <span className="text-muted-foreground">Custo:</span>
                    <span className="text-right font-medium">{formatCurrency(item.total_cost)}</span>
                    <span className="text-muted-foreground">Est. Venda:</span>
                    <span className="text-right font-semibold text-primary">{formatCurrency(item.estimated_price)}</span>
                    <span className="text-muted-foreground">Lucro Est.:</span>
                    <span className={`text-right font-medium ${item.estimated_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(item.estimated_profit)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
