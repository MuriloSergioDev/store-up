import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus, TrendingUp, Target } from 'lucide-react'
import { formatCurrency, formatDate, formatPercent, getPaymentMethodLabel } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { StatsCard } from '@/components/dashboard/stats-card'
import type { Sale, Item, Category, ItemImage } from '@/types/database'

type SaleWithItem = Sale & { item: Item & { category: Category | null; images: ItemImage[] } | null }

export const metadata = { title: 'Vendas' }
export const revalidate = 0

export default async function VendasPage() {
  const supabase = await createClient()
  const { data: rawSales } = await supabase
    .from('sales')
    .select('*, item:items(*, category:categories(*), images:item_images(*))')
    .order('sale_date', { ascending: false })

  const sales = (rawSales ?? []) as unknown as SaleWithItem[]

  const totalRevenue = sales.reduce((sum, s) => sum + s.sale_price, 0)
  const totalProfit = sales.reduce((sum, s) => sum + s.profit, 0)
  const avgTicket = sales.length ? totalRevenue / sales.length : 0
  const avgAccuracy = sales.length
    ? sales.reduce((sum, s) => sum + s.price_accuracy, 0) / sales.length
    : 0

  const aboveEstimate = sales.filter(s => s.sale_price > s.estimated_price).length
  const belowEstimate = sales.filter(s => s.sale_price < s.estimated_price).length

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vendas</h1>
          <p className="text-muted-foreground text-sm">
            {sales?.length ?? 0} {(sales?.length ?? 0) === 1 ? 'venda registrada' : 'vendas registradas'}
          </p>
        </div>
        <Button asChild>
          <Link href="/vendas/nova">
            <Plus className="mr-2 h-4 w-4" />
            Registrar Venda
          </Link>
        </Button>
      </div>

      {/* Summary Stats */}
      {sales.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatsCard
            title="Receita Total"
            value={formatCurrency(totalRevenue)}
            icon={TrendingUp}
            variant="success"
          />
          <StatsCard
            title="Lucro Total"
            value={formatCurrency(totalProfit)}
            icon={TrendingUp}
            variant="success"
          />
          <StatsCard
            title="Ticket Médio"
            value={formatCurrency(avgTicket)}
            icon={TrendingUp}
          />
          <StatsCard
            title="Precisão Média"
            value={formatPercent(avgAccuracy - 1)}
            subtitle={`${aboveEstimate} acima / ${belowEstimate} abaixo do estimado`}
            icon={Target}
            variant={avgAccuracy >= 0.95 ? 'success' : 'warning'}
          />
        </div>
      )}

      {/* Sales List */}
      {(sales?.length ?? 0) === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <TrendingUp className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold">Nenhuma venda registrada</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-4">
            Registre sua primeira venda
          </p>
          <Button asChild>
            <Link href="/vendas/nova">
              <Plus className="mr-2 h-4 w-4" />
              Registrar Venda
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {sales.map((sale) => {
            const item = sale.item
            const isAbove = sale.sale_price > sale.estimated_price
            const isBelow = sale.sale_price < sale.estimated_price
            return (
              <Card key={sale.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex gap-3 items-start">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden bg-muted shrink-0 relative">
                      {item?.images?.[0] ? (
                        <img src={item.images[0].url} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground/30 text-xl">📦</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{item?.name}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(sale.sale_date)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-green-600 text-sm">{formatCurrency(sale.sale_price)}</p>
                          <p className={`text-xs font-medium ${sale.profit >= 0 ? 'text-green-600/70' : 'text-red-500'}`}>
                            +{formatCurrency(sale.profit)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium">
                          {formatPercent(sale.profit_margin)} margem
                        </span>
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium">
                          {getPaymentMethodLabel(sale.payment_method)}
                        </span>
                        {sale.quantity_sold > 1 && (
                          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium">
                            ×{sale.quantity_sold}
                          </span>
                        )}
                        {isAbove && (
                          <span className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 rounded font-medium">
                            +{formatCurrency(sale.sale_price - sale.estimated_price)} acima
                          </span>
                        )}
                        {isBelow && (
                          <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium">
                            -{formatCurrency(sale.estimated_price - sale.sale_price)} abaixo
                          </span>
                        )}
                      </div>
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
