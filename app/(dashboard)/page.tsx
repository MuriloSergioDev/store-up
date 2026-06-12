import { createClient } from '@/lib/supabase/server'
import {
  DollarSign,
  Package,
  TrendingUp,
  ShoppingCart,
  Target,
  Percent,
  BarChart3,
  Clock,
} from 'lucide-react'
import { StatsCard } from '@/components/dashboard/stats-card'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  MonthlyEvolutionChart,
  CategorySalesChart,
  StockVsSoldChart,
  ProfitCompareChart,
  CashFlowChart,
  TopItemsChart,
} from '@/components/dashboard/charts'
import { formatCurrency, formatPercent, formatDate, projectSalesDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import type { CashFlow, MonthlyPerformance, CategoryPerformance, DashboardSummary } from '@/types/database'

export const metadata = { title: 'Dashboard' }
export const revalidate = 0

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { data: summary },
    { data: monthly },
    { data: categories },
    { data: cashFlowRaw },
    { data: topItems },
    { data: staleItems },
  ] = await Promise.all([
    supabase.from('dashboard_summary').select('*').single(),
    supabase.from('monthly_performance').select('*').order('month', { ascending: true }).limit(12),
    supabase.from('category_performance').select('*'),
    supabase.from('cash_flow').select('*').order('date', { ascending: true }),
    supabase.from('items').select('*, sale:sales(*)').eq('status', 'sold').order('created_at', { ascending: false }).limit(20),
    supabase.from('items').select('id, name, purchase_date, days_in_stock').eq('status', 'in_stock').gt('days_in_stock', 90).order('days_in_stock', { ascending: false }).limit(5),
  ])

  const cashFlows = (cashFlowRaw ?? []) as unknown as CashFlow[]
  const monthlyPerf = (monthly ?? []) as unknown as MonthlyPerformance[]
  const categoriesPerf = (categories ?? []) as unknown as CategoryPerformance[]
  const s: DashboardSummary = (summary as unknown as DashboardSummary) ?? {
    total_invested: 0, total_shipping: 0, total_item_costs: 0,
    items_in_stock: 0, items_reserved: 0, items_sold: 0, total_items: 0,
    sales_count: 0, potential_revenue: 0, potential_profit: 0, stock_value: 0,
    realized_revenue: 0, realized_profit: 0, avg_price_accuracy: 0,
  }

  const roi = s.total_invested > 0 ? s.realized_profit / s.total_invested : 0
  const avgTicket = s.sales_count > 0 ? s.realized_revenue / s.sales_count : 0

  // Monthly cash flow chart data
  const monthlyMap = new Map<string, { income: number; expense: number }>()
  cashFlows.forEach((cf) => {
    const key = cf.date.slice(0, 7)
    const entry = monthlyMap.get(key) ?? { income: 0, expense: 0 }
    if (cf.type === 'income') entry.income += cf.amount
    else entry.expense += cf.amount
    monthlyMap.set(key, entry)
  })
  let runningBalance = 0
  const cashFlowData = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([date, { income, expense }]) => {
      runningBalance += income - expense
      return { date: date.slice(5) + '/' + date.slice(2, 4), income, expense, balance: runningBalance }
    })

  // Profit compare data from monthly
  const profitCompareData = monthlyPerf.map(m => ({
    month: m.month,
    estimated: m.cost * 0.4,
    realized: m.profit,
  }))

  // Sales velocity
  const recentMonths = monthlyPerf.slice(-3)
  const avgMonthlySales = recentMonths.length > 0
    ? recentMonths.reduce((sum, m) => sum + m.sales_count, 0) / recentMonths.length
    : 0
  const projection = projectSalesDate(s.items_in_stock, avgMonthlySales)

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral do seu negócio</p>
      </div>

      {(staleItems?.length ?? 0) > 0 && (
        <Alert className="border-amber-500/50 bg-amber-500/5">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-700 dark:text-amber-400">
            <strong>{staleItems!.length} {staleItems!.length === 1 ? 'item parado' : 'itens parados'}</strong> há mais de 90 dias no estoque.
            Considere revisar os preços para acelerar as vendas.
          </AlertDescription>
        </Alert>
      )}

      {/* Primary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatsCard title="Receita Realizada" value={formatCurrency(s.realized_revenue)} subtitle={`${s.sales_count} ${s.sales_count === 1 ? 'venda' : 'vendas'} realizadas`} icon={TrendingUp} variant="success" />
        <StatsCard title="Lucro Realizado" value={formatCurrency(s.realized_profit)} subtitle={`ROI: ${formatPercent(roi)}`} icon={DollarSign} variant="success" />
        <StatsCard title="Total Investido" value={formatCurrency(s.total_invested)} subtitle={`Fretes: ${formatCurrency(s.total_shipping)}`} icon={ShoppingCart} variant="warning" />
        <StatsCard title="Itens em Estoque" value={s.items_in_stock.toString()} subtitle={`${s.items_reserved} reservados`} icon={Package} variant="info" />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatsCard title="Receita Potencial" value={formatCurrency(s.potential_revenue)} subtitle="Estoque não vendido" icon={Target} variant="purple" />
        <StatsCard title="Lucro Potencial" value={formatCurrency(s.potential_profit)} subtitle="Se vender tudo estimado" icon={Percent} variant="purple" />
        <StatsCard title="Ticket Médio" value={formatCurrency(avgTicket)} subtitle="Por venda realizada" icon={BarChart3} />
        <StatsCard
          title="Precisão Estimativas"
          value={formatPercent(Math.abs(s.avg_price_accuracy - 1))}
          subtitle={s.avg_price_accuracy >= 1 ? 'acima do previsto' : 'abaixo do previsto'}
          icon={Target}
          variant={s.avg_price_accuracy >= 0.95 ? 'success' : 'warning'}
        />
      </div>

      {/* Projection */}
      {projection && (
        <Card className="bg-gradient-to-r from-primary/10 to-purple-500/10 border-primary/20">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/20 shrink-0">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Projeção de Retorno do Estoque</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Com a velocidade atual ({avgMonthlySales.toFixed(1)} vendas/mês), o estoque atual estará esgotado em{' '}
                  <strong>{projection.months.toFixed(1)} meses</strong> — por volta de{' '}
                  <strong>{formatDate(projection.date)}</strong>
                </p>
                <div className="flex flex-wrap gap-4 mt-2">
                  <span className="text-xs">Faturamento previsto: <strong className="text-green-600">{formatCurrency(s.potential_revenue)}</strong></span>
                  <span className="text-xs">Lucro previsto: <strong className="text-primary">{formatCurrency(s.potential_profit)}</strong></span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Evolução Financeira</CardTitle>
            <CardDescription className="text-xs">Receita, lucro e investimento por mês</CardDescription>
          </CardHeader>
          <CardContent><MonthlyEvolutionChart data={monthlyPerf} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Vendas por Categoria</CardTitle>
            <CardDescription className="text-xs">Distribuição das vendas</CardDescription>
          </CardHeader>
          <CardContent><CategorySalesChart data={categoriesPerf} /></CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Estoque vs Vendidos</CardTitle>
            <CardDescription className="text-xs">Por categoria</CardDescription>
          </CardHeader>
          <CardContent><StockVsSoldChart data={categoriesPerf} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Lucro Previsto vs Realizado</CardTitle>
            <CardDescription className="text-xs">Comparativo mensal</CardDescription>
          </CardHeader>
          <CardContent><ProfitCompareChart data={profitCompareData} /></CardContent>
        </Card>
      </div>

      {/* Charts Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Evolução do Caixa</CardTitle>
            <CardDescription className="text-xs">Entradas, saídas e saldo acumulado</CardDescription>
          </CardHeader>
          <CardContent><CashFlowChart data={cashFlowData} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Top Itens Mais Lucrativos</CardTitle>
            <CardDescription className="text-xs">Ranking por lucro absoluto</CardDescription>
          </CardHeader>
          <CardContent><TopItemsChart items={(topItems as any[]) ?? []} /></CardContent>
        </Card>
      </div>

      {/* Top Categories */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Performance por Categoria</CardTitle>
          <CardDescription className="text-xs">Ranking de categorias mais rentáveis</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {categoriesPerf
              .filter(c => c.total_revenue > 0)
              .sort((a, b) => b.total_profit - a.total_profit)
              .slice(0, 6)
              .map((cat, i) => (
                <div key={cat.id} className="flex items-center gap-3">
                  <span className="text-sm font-bold text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: cat.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate">{cat.name}</span>
                      <span className="text-sm font-bold text-green-600 shrink-0 ml-2">{formatCurrency(cat.total_profit)}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          background: cat.color,
                          width: `${Math.min(100, (cat.total_profit / Math.max(...categoriesPerf.map(c => c.total_profit), 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">{cat.sold_items} vendas</Badge>
                </div>
              ))}
            {categoriesPerf.filter(c => c.total_revenue > 0).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma venda registrada ainda</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
