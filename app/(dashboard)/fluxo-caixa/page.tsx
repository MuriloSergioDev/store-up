import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StatsCard } from '@/components/dashboard/stats-card'
import { CashFlowChart } from '@/components/dashboard/charts'
import { ArrowUpCircle, ArrowDownCircle, Wallet, TrendingUp } from 'lucide-react'
import { AddManualCashFlow } from '@/components/cash-flow/add-manual'
import type { CashFlow } from '@/types/database'

export const metadata = { title: 'Fluxo de Caixa' }
export const revalidate = 0

const categoryLabels: Record<string, string> = {
  sale: 'Venda',
  purchase: 'Compra',
  shipping: 'Frete',
  other_cost: 'Outros Custos',
  other_income: 'Outros (Receita)',
  other_expense: 'Outros (Despesa)',
}

export default async function FluxoCaixaPage() {
  const supabase = await createClient()
  const { data: allEntries } = await supabase
    .from('cash_flow')
    .select('*')
    .order('date', { ascending: false })

  const entries = (allEntries ?? []) as unknown as CashFlow[]

  // Aggregations
  const totalIncome = entries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0)
  const totalExpense = entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0)
  const balance = totalIncome - totalExpense

  // Monthly chart data
  const monthlyMap = new Map<string, { income: number; expense: number }>()
  entries.forEach((e) => {
    const key = e.date.slice(0, 7)
    const entry = monthlyMap.get(key) ?? { income: 0, expense: 0 }
    if (e.type === 'income') entry.income += e.amount
    else entry.expense += e.amount
    monthlyMap.set(key, entry)
  })
  let running = 0
  const chartData = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, { income, expense }]) => {
      running += income - expense
      return {
        date: month.slice(5) + '/' + month.slice(2, 4),
        income,
        expense,
        balance: running,
      }
    })

  // Group by month for list view
  const byMonth = new Map<string, typeof entries>()
  entries.forEach(e => {
    const key = e.date.slice(0, 7)
    byMonth.set(key, [...(byMonth.get(key) ?? []), e])
  })

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fluxo de Caixa</h1>
          <p className="text-muted-foreground text-sm">Entradas e saídas financeiras</p>
        </div>
        <AddManualCashFlow />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatsCard
          title="Saldo Atual"
          value={formatCurrency(balance)}
          icon={Wallet}
          variant={balance >= 0 ? 'success' : 'warning'}
        />
        <StatsCard
          title="Total Entradas"
          value={formatCurrency(totalIncome)}
          icon={ArrowUpCircle}
          variant="success"
        />
        <StatsCard
          title="Total Saídas"
          value={formatCurrency(totalExpense)}
          icon={ArrowDownCircle}
          variant="warning"
        />
        <StatsCard
          title="Resultado"
          value={formatCurrency(balance)}
          subtitle={balance >= 0 ? 'Caixa positivo' : 'Caixa negativo'}
          icon={TrendingUp}
          variant={balance >= 0 ? 'info' : 'warning'}
        />
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Evolução do Caixa</CardTitle>
        </CardHeader>
        <CardContent>
          <CashFlowChart data={chartData} />
        </CardContent>
      </Card>

      {/* Transactions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Movimentações</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList className="mb-4">
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="income">Entradas</TabsTrigger>
              <TabsTrigger value="expense">Saídas</TabsTrigger>
            </TabsList>

            {(['all', 'income', 'expense'] as const).map(tab => (
              <TabsContent key={tab} value={tab} className="space-y-4">
                {Array.from(byMonth.entries())
                  .sort(([a], [b]) => b.localeCompare(a))
                  .map(([month, monthEntries]) => {
                    const filtered = tab === 'all'
                      ? monthEntries
                      : monthEntries.filter(e => e.type === tab)
                    if (filtered.length === 0) return null
                    const monthIncome = filtered.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0)
                    const monthExpense = filtered.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0)
                    return (
                      <div key={month}>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                            {new Date(month + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                          </h3>
                          <div className="flex gap-3 text-xs">
                            {monthIncome > 0 && <span className="text-green-600">+{formatCurrency(monthIncome)}</span>}
                            {monthExpense > 0 && <span className="text-red-600">-{formatCurrency(monthExpense)}</span>}
                          </div>
                        </div>
                        <div className="space-y-2">
                          {filtered.map(entry => (
                            <div
                              key={entry.id}
                              className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                            >
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                entry.type === 'income'
                                  ? 'bg-green-100 dark:bg-green-900/30'
                                  : 'bg-red-100 dark:bg-red-900/30'
                              }`}>
                                {entry.type === 'income'
                                  ? <ArrowUpCircle className="w-4 h-4 text-green-600" />
                                  : <ArrowDownCircle className="w-4 h-4 text-red-600" />
                                }
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{entry.description}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">
                                    {categoryLabels[entry.category] ?? entry.category}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">{formatDate(entry.date)}</span>
                                </div>
                              </div>
                              <span className={`font-semibold text-sm shrink-0 ${
                                entry.type === 'income' ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {entry.type === 'income' ? '+' : '-'}{formatCurrency(entry.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                {entries.filter(e => tab === 'all' || e.type === tab).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma movimentação encontrada
                  </p>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
