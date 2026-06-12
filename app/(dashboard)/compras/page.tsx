import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus, Package } from 'lucide-react'
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import Image from 'next/image'

export const metadata = { title: 'Compras' }
export const revalidate = 0

export default async function ComprasPage() {
  const supabase = await createClient()
  const { data: items } = await supabase
    .from('items')
    .select('*, category:categories(*), images:item_images(*)')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Compras</h1>
          <p className="text-muted-foreground text-sm">
            {items?.length ?? 0} {(items?.length ?? 0) === 1 ? 'item cadastrado' : 'itens cadastrados'}
          </p>
        </div>
        <Button asChild>
          <Link href="/compras/nova">
            <Plus className="mr-2 h-4 w-4" />
            Nova Compra
          </Link>
        </Button>
      </div>

      {(items?.length ?? 0) === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Package className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg">Nenhuma compra cadastrada</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-4">
            Comece cadastrando sua primeira compra
          </p>
          <Button asChild>
            <Link href="/compras/nova">
              <Plus className="mr-2 h-4 w-4" />
              Cadastrar Primeira Compra
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items!.map((item: any) => {
            const primaryImage = item.images?.find((img: any) => img.is_primary) ?? item.images?.[0]
            return (
              <Card key={item.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <Link href={`/estoque/${item.id}`}>
                  <div className="aspect-[4/3] relative bg-muted">
                    {primaryImage ? (
                      <Image
                        src={primaryImage.url}
                        alt={item.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Package className="w-12 h-12 text-muted-foreground/40" />
                      </div>
                    )}
                    <Badge
                      className={`absolute top-2 right-2 ${getStatusColor(item.status)}`}
                      variant="secondary"
                    >
                      {getStatusLabel(item.status)}
                    </Badge>
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
                  <div className="mt-3 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Compra</span>
                      <span>{formatDate(item.purchase_date)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Custo Total</span>
                      <span className="font-medium">{formatCurrency(item.total_cost)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Preço Estimado</span>
                      <span className="font-semibold text-primary">{formatCurrency(item.estimated_price)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Lucro Est.</span>
                      <span className={`font-medium ${item.estimated_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(item.estimated_profit)}
                      </span>
                    </div>
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
