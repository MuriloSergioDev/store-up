import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft, Edit, ShoppingBag, Calendar, MapPin,
  DollarSign, Package, Clock,
} from 'lucide-react'
import { formatCurrency, formatDate, formatPercent, getStatusColor, getStatusLabel, formatRelativeDate } from '@/lib/utils'
import Image from 'next/image'
import { ItemActions } from '@/components/items/item-actions'
import type { Item, Sale, ItemImage, Category, Profile } from '@/types/database'

type ItemWithRelations = Item & {
  category: Category | null
  images: ItemImage[]
  sale: Sale | Sale[] | null
}

export const revalidate = 0

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: rawItem } = await supabase
    .from('items')
    .select('*, category:categories(*), images:item_images(*), sale:sales(*)')
    .eq('id', id)
    .single()

  if (!rawItem) notFound()
  const item = rawItem as unknown as ItemWithRelations

  const { data: user } = await supabase.auth.getUser()
  const { data: rawProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.user?.id ?? '')
    .single()
  const profile = rawProfile as Profile | null

  const sale = Array.isArray(item.sale) ? item.sale[0] : item.sale as Sale | null
  const images = item.images ?? []
  const primaryImage = images.find(i => i.is_primary) ?? images[0]

  return (
    <div className="space-y-6 max-w-4xl pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/estoque"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold truncate">{item.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={getStatusColor(item.status)} variant="secondary">
              {getStatusLabel(item.status)}
            </Badge>
            {item.category && (
              <Badge variant="outline" className="text-xs">{item.category.name}</Badge>
            )}
            {item.abc_class === 'A' && (
              <Badge className="bg-green-600 text-white text-xs">Classe A</Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/estoque/${id}/editar`}>
              <Edit className="h-3.5 w-3.5 mr-1.5" />
              Editar
            </Link>
          </Button>
          {item.status !== 'sold' && (
            <Button size="sm" asChild>
              <Link href={`/vendas/nova?item=${id}`}>
                <ShoppingBag className="h-3.5 w-3.5 mr-1.5" />
                Vender
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Images */}
        <div className="space-y-3">
          <div className="aspect-square relative rounded-xl overflow-hidden bg-muted">
            {primaryImage ? (
              <Image src={primaryImage.url} alt={item.name} fill className="object-cover" />
            ) : (
              <div className="flex items-center justify-center h-full">
                <Package className="w-16 h-16 text-muted-foreground/30" />
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {images.slice(0, 5).map((img) => (
                <div key={img.id} className="aspect-square relative rounded-lg overflow-hidden border border-border">
                  <Image src={img.url} alt="" fill className="object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-4">
          {/* Financial Summary */}
          <Card className="bg-gradient-to-br from-primary/5 to-purple-500/5 border-primary/20">
            <CardContent className="p-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Custo Total</p>
                <p className="text-xl font-bold mt-1">{formatCurrency(item.total_cost)}</p>
                <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                  <div>Item: {formatCurrency(item.item_cost)}</div>
                  {item.shipping_cost > 0 && <div>Frete: {formatCurrency(item.shipping_cost)}</div>}
                  {item.other_costs > 0 && <div>Outros: {formatCurrency(item.other_costs)}</div>}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {sale ? 'Vendido por' : 'Preço Estimado'}
                </p>
                <p className="text-xl font-bold mt-1 text-primary">
                  {formatCurrency(sale ? sale.sale_price : item.estimated_price)}
                </p>
                <div className={`text-xs font-medium mt-1 ${(sale ? sale.profit : item.estimated_profit) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  Lucro: {formatCurrency(sale ? sale.profit : item.estimated_profit)}
                  <span className="text-muted-foreground ml-1">
                    ({formatPercent(sale ? sale.profit_margin : item.estimated_margin)})
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Informações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Comprado em:</span>
                <span className="font-medium">{formatDate(item.purchase_date)}</span>
              </div>
              {item.purchase_location && (
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Local:</span>
                  <span className="font-medium">{item.purchase_location}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Cadastrado:</span>
                <span className="font-medium">{formatRelativeDate(item.created_at)}</span>
              </div>
              {item.status === 'in_stock' && (
                <div className="flex items-center gap-3 text-sm">
                  <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Dias em estoque:</span>
                  <span className={`font-medium ${(item.days_in_stock ?? 0) > 90 ? 'text-amber-600' : ''}`}>
                    {item.days_in_stock} dias
                    {(item.days_in_stock ?? 0) > 90 && ' ⚠️'}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Description */}
          {item.description && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Descrição</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {item.notes && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Observações</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Sale info */}
          {sale && (
            <Card className="border-green-500/30 bg-green-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-green-700 dark:text-green-400">Informações da Venda</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data:</span>
                  <span>{formatDate(sale.sale_date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Preço estimado:</span>
                  <span>{formatCurrency(sale.estimated_price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Preço real:</span>
                  <span className="font-semibold text-green-600">{formatCurrency(sale.sale_price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Precisão:</span>
                  <span>{formatPercent(Math.abs(sale.price_accuracy - 1))} {sale.price_accuracy >= 1 ? 'acima' : 'abaixo'} do estimado</span>
                </div>
                {sale.buyer_name && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Comprador:</span>
                    <span>{sale.buyer_name}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <ItemActions
            itemId={id}
            itemStatus={item.status}
            isAdmin={profile?.role === 'admin'}
          />
        </div>
      </div>
    </div>
  )
}
