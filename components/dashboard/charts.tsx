'use client'

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { formatCurrency, formatMonth } from '@/lib/utils'
import type { MonthlyPerformance, CategoryPerformance, Item, Sale } from '@/types/database'

const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

const CustomTooltip = ({ active, payload, label, isCurrency = true }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-xl shadow-lg p-3 text-sm">
        <p className="font-semibold mb-2 text-foreground">{label}</p>
        {payload.map((p: any) => (
          <div key={p.name} className="flex items-center gap-2 text-muted-foreground">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span>{p.name}:</span>
            <span className="font-medium text-foreground">
              {isCurrency ? formatCurrency(p.value) : p.value}
            </span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

interface MonthlyChartProps {
  data: MonthlyPerformance[]
}

export function MonthlyEvolutionChart({ data }: MonthlyChartProps) {
  const chartData = data.map(d => ({
    ...d,
    month: formatMonth(d.month),
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
        <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: '12px' }} />
        <Area type="monotone" dataKey="revenue" name="Receita" stroke="#3b82f6" fill="url(#colorRevenue)" strokeWidth={2} />
        <Area type="monotone" dataKey="profit" name="Lucro" stroke="#10b981" fill="url(#colorProfit)" strokeWidth={2} />
        <Area type="monotone" dataKey="cost" name="Investimento" stroke="#f59e0b" fill="url(#colorCost)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

interface CategoryChartProps {
  data: CategoryPerformance[]
}

export function CategorySalesChart({ data }: CategoryChartProps) {
  const chartData = data
    .filter(d => d.sold_items > 0)
    .map(d => ({ name: d.name, value: d.sold_items, revenue: d.total_revenue }))

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">
        Sem dados de vendas por categoria
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={3}
          dataKey="value"
        >
          {chartData.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={((value: number) => [value, 'Vendas']) as any}
          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
        />
        <Legend wrapperStyle={{ fontSize: '12px' }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

interface StockBarChartProps {
  data: CategoryPerformance[]
}

export function StockVsSoldChart({ data }: StockBarChartProps) {
  const chartData = data
    .filter(d => d.total_items > 0)
    .slice(0, 6)
    .map(d => ({
      name: d.name.length > 10 ? d.name.slice(0, 10) + '…' : d.name,
      'Em Estoque': d.stock_items,
      'Vendidos': d.sold_items,
    }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
        <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
        <Tooltip
          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
          content={<CustomTooltip isCurrency={false} />}
        />
        <Legend wrapperStyle={{ fontSize: '12px' }} />
        <Bar dataKey="Em Estoque" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Vendidos" fill="#10b981" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

interface ProfitCompareProps {
  data: { estimated: number; realized: number; month: string }[]
}

export function ProfitCompareChart({ data }: ProfitCompareProps) {
  const chartData = data.map(d => ({
    ...d,
    month: formatMonth(d.month),
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
        <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: '12px' }} />
        <Bar dataKey="estimated" name="Lucro Previsto" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
        <Bar dataKey="realized" name="Lucro Realizado" fill="#10b981" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

interface CashFlowChartData {
  date: string
  income: number
  expense: number
  balance: number
}

export function CashFlowChart({ data }: { data: CashFlowChartData[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
        <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: '12px' }} />
        <Area type="monotone" dataKey="income" name="Entradas" stroke="#10b981" fill="url(#colorIncome)" strokeWidth={2} />
        <Area type="monotone" dataKey="expense" name="Saídas" stroke="#ef4444" fill="url(#colorExpense)" strokeWidth={2} />
        <Line type="monotone" dataKey="balance" name="Saldo" stroke="#3b82f6" strokeWidth={2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

interface TopItemsChartProps {
  items: (Item & { sale: Sale | null })[]
}

export function TopItemsChart({ items }: TopItemsChartProps) {
  const topItems = items
    .filter(i => i.sale)
    .sort((a, b) => (b.sale?.profit ?? 0) - (a.sale?.profit ?? 0))
    .slice(0, 5)
    .map(i => ({
      name: i.name.length > 16 ? i.name.slice(0, 16) + '…' : i.name,
      lucro: i.sale?.profit ?? 0,
    }))

  if (topItems.length === 0) {
    return (
      <div className="flex items-center justify-center h-[180px] text-muted-foreground text-sm">
        Nenhum item vendido ainda
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={topItems} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `R$${(v/1000).toFixed(1)}k`} />
        <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={100} />
        <Tooltip
          formatter={((v: number) => [formatCurrency(v), 'Lucro']) as any}
          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
        />
        <Bar dataKey="lucro" fill="#10b981" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
