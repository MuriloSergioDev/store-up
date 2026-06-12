'use client'

import { useState } from 'react'
import { formatCurrency, formatDate, formatPercent, getPaymentMethodLabel, getStatusLabel } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Download, FileText, BarChart3, Package } from 'lucide-react'
import { toast } from 'sonner'
import type { Item, Sale, CashFlow, CategoryPerformance, MonthlyPerformance } from '@/types/database'

interface ReportsClientProps {
  items: (Item & { category?: any })[]
  sales: (Sale & { item?: Item & { category?: any } })[]
  cashFlow: CashFlow[]
  categories: CategoryPerformance[]
  monthly: MonthlyPerformance[]
}

export function ReportsClient({ items, sales, cashFlow, categories, monthly }: ReportsClientProps) {
  const [exporting, setExporting] = useState<string | null>(null)

  const totalRevenue = sales.reduce((s, sale) => s + sale.sale_price, 0)
  const totalProfit = sales.reduce((s, sale) => s + sale.profit, 0)
  const totalCost = items.reduce((s, item) => s + item.total_cost, 0)
  const roi = totalCost > 0 ? totalProfit / totalCost : 0
  const avgTicket = sales.length > 0 ? totalRevenue / sales.length : 0
  const avgMargin = sales.length > 0 ? sales.reduce((s, sale) => s + sale.profit_margin, 0) / sales.length : 0

  const exportExcel = async (type: 'financial' | 'inventory' | 'performance') => {
    setExporting(type)
    try {
      const XLSX = await import('xlsx')
      let wb = XLSX.utils.book_new()

      if (type === 'financial') {
        // Sales sheet
        const salesData = sales.map(s => ({
          'Data': formatDate(s.sale_date),
          'Item': s.item?.name ?? '',
          'Categoria': s.item?.category?.name ?? '',
          'Custo': s.item_cost,
          'Preço Estimado': s.estimated_price,
          'Preço Real': s.sale_price,
          'Lucro': s.profit,
          'Margem %': (s.profit_margin * 100).toFixed(1) + '%',
          'Forma Pag.': getPaymentMethodLabel(s.payment_method),
          'Comprador': s.buyer_name ?? '',
        }))
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(salesData), 'Vendas')

        // Cash flow sheet
        const cfData = cashFlow.map(cf => ({
          'Data': formatDate(cf.date),
          'Tipo': cf.type === 'income' ? 'Entrada' : 'Saída',
          'Categoria': cf.category,
          'Descrição': cf.description,
          'Valor': cf.amount,
        }))
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cfData), 'Fluxo de Caixa')
      }

      if (type === 'inventory') {
        const inventoryData = items.map(i => ({
          'Nome': i.name,
          'Categoria': i.category?.name ?? '',
          'Status': getStatusLabel(i.status),
          'Data Compra': formatDate(i.purchase_date),
          'Dias Estoque': i.days_in_stock,
          'Custo Item': i.item_cost,
          'Frete': i.shipping_cost,
          'Outros': i.other_costs,
          'Custo Total': i.total_cost,
          'Preço Estimado': i.estimated_price,
          'Lucro Estimado': i.estimated_profit,
          'Margem Est. %': (i.estimated_margin * 100).toFixed(1) + '%',
          'Local Compra': i.purchase_location ?? '',
        }))
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(inventoryData), 'Estoque')
      }

      if (type === 'performance') {
        const catData = categories.map(c => ({
          'Categoria': c.name,
          'Total Itens': c.total_items,
          'Vendidos': c.sold_items,
          'Em Estoque': c.stock_items,
          'Receita': c.total_revenue,
          'Lucro': c.total_profit,
          'Margem Média %': (c.avg_margin * 100).toFixed(1) + '%',
        }))
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catData), 'Por Categoria')

        const monthlyData = monthly.map(m => ({
          'Mês': formatDate(m.month),
          'Vendas': m.sales_count,
          'Receita': m.revenue,
          'Lucro': m.profit,
          'Custo': m.cost,
          'Ticket Médio': m.avg_ticket,
          'Margem Média %': (m.avg_margin * 100).toFixed(1) + '%',
        }))
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(monthlyData), 'Por Mês')
      }

      XLSX.writeFile(wb, `relatorio-${type}-${new Date().toISOString().split('T')[0]}.xlsx`)
      toast.success('Relatório exportado com sucesso!')
    } catch (error) {
      console.error(error)
      toast.error('Erro ao exportar relatório')
    } finally {
      setExporting(null)
    }
  }

  const exportPDF = async (type: string) => {
    setExporting(type + '-pdf')
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF()
      doc.setFontSize(18)
      doc.text('Store Up - Relatório', 20, 20)
      doc.setFontSize(12)
      doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 20, 30)

      let y = 45
      doc.setFontSize(14)

      if (type === 'financial') {
        doc.text('Resumo Financeiro', 20, y); y += 10
        doc.setFontSize(11)
        doc.text(`Receita Total: ${formatCurrency(totalRevenue)}`, 20, y); y += 7
        doc.text(`Lucro Total: ${formatCurrency(totalProfit)}`, 20, y); y += 7
        doc.text(`Total Investido: ${formatCurrency(totalCost)}`, 20, y); y += 7
        doc.text(`ROI: ${formatPercent(roi)}`, 20, y); y += 7
        doc.text(`Ticket Médio: ${formatCurrency(avgTicket)}`, 20, y); y += 7
        doc.text(`Margem Média: ${formatPercent(avgMargin)}`, 20, y); y += 15

        doc.setFontSize(13)
        doc.text('Últimas Vendas', 20, y); y += 8
        doc.setFontSize(9)
        sales.slice(0, 25).forEach(s => {
          if (y > 270) { doc.addPage(); y = 20 }
          doc.text(
            `${formatDate(s.sale_date)} | ${s.item?.name?.slice(0, 30)} | ${formatCurrency(s.sale_price)} | Lucro: ${formatCurrency(s.profit)}`,
            20, y
          )
          y += 6
        })
      }

      doc.save(`relatorio-${type}-${new Date().toISOString().split('T')[0]}.pdf`)
      toast.success('PDF exportado com sucesso!')
    } catch (error) {
      console.error(error)
      toast.error('Erro ao gerar PDF')
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-muted-foreground text-sm">Análises detalhadas do seu negócio</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Receita Total</p>
            <p className="text-xl font-bold text-green-600 mt-1">{formatCurrency(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Lucro Total</p>
            <p className="text-xl font-bold text-green-600 mt-1">{formatCurrency(totalProfit)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">ROI</p>
            <p className="text-xl font-bold mt-1">{formatPercent(roi)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Ticket Médio</p>
            <p className="text-xl font-bold mt-1">{formatCurrency(avgTicket)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Margem Média</p>
            <p className="text-xl font-bold mt-1">{formatPercent(avgMargin)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total de Vendas</p>
            <p className="text-xl font-bold mt-1">{sales.length}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="financial">
        <TabsList>
          <TabsTrigger value="financial">
            <FileText className="w-4 h-4 mr-2" />
            Financeiro
          </TabsTrigger>
          <TabsTrigger value="inventory">
            <Package className="w-4 h-4 mr-2" />
            Estoque
          </TabsTrigger>
          <TabsTrigger value="performance">
            <BarChart3 className="w-4 h-4 mr-2" />
            Performance
          </TabsTrigger>
        </TabsList>

        {/* Financial Tab */}
        <TabsContent value="financial" className="space-y-4 mt-4">
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => exportPDF('financial')} disabled={!!exporting}>
              <Download className="h-4 w-4 mr-2" />
              {exporting === 'financial-pdf' ? 'Gerando...' : 'PDF'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportExcel('financial')} disabled={!!exporting}>
              <Download className="h-4 w-4 mr-2" />
              {exporting === 'financial' ? 'Exportando...' : 'Excel'}
            </Button>
          </div>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Histórico de Vendas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Custo</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Lucro</TableHead>
                      <TableHead>Margem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="text-sm">{formatDate(s.sale_date)}</TableCell>
                        <TableCell className="text-sm font-medium max-w-[150px] truncate">
                          {s.item?.name}
                        </TableCell>
                        <TableCell className="text-sm">{formatCurrency(s.item_cost)}</TableCell>
                        <TableCell className="text-sm font-medium">{formatCurrency(s.sale_price)}</TableCell>
                        <TableCell className={`text-sm font-medium ${s.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(s.profit)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={s.profit_margin >= 0.3 ? 'default' : 'secondary'} className="text-xs">
                            {formatPercent(s.profit_margin)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {sales.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          Nenhuma venda registrada
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inventory Tab */}
        <TabsContent value="inventory" className="space-y-4 mt-4">
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => exportExcel('inventory')} disabled={!!exporting}>
              <Download className="h-4 w-4 mr-2" />
              {exporting === 'inventory' ? 'Exportando...' : 'Excel'}
            </Button>
          </div>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Inventário Completo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Custo</TableHead>
                      <TableHead>Est. Venda</TableHead>
                      <TableHead>Lucro Est.</TableHead>
                      <TableHead>Dias</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map(item => (
                      <TableRow key={item.id} className={(item.days_in_stock ?? 0) > 90 ? 'bg-amber-500/5' : ''}>
                        <TableCell className="font-medium text-sm max-w-[150px] truncate">{item.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{item.category?.name ?? '-'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {getStatusLabel(item.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{formatCurrency(item.total_cost)}</TableCell>
                        <TableCell className="text-sm">{formatCurrency(item.estimated_price)}</TableCell>
                        <TableCell className={`text-sm font-medium ${item.estimated_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(item.estimated_profit)}
                        </TableCell>
                        <TableCell className={`text-sm ${(item.days_in_stock ?? 0) > 90 ? 'text-amber-600 font-medium' : ''}`}>
                          {item.days_in_stock}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4 mt-4">
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => exportExcel('performance')} disabled={!!exporting}>
              <Download className="h-4 w-4 mr-2" />
              {exporting === 'performance' ? 'Exportando...' : 'Excel'}
            </Button>
          </div>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Performance por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Vendidos</TableHead>
                      <TableHead>Receita</TableHead>
                      <TableHead>Lucro</TableHead>
                      <TableHead>Margem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map(cat => (
                      <TableRow key={cat.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ background: cat.color }} />
                            <span className="font-medium text-sm">{cat.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{cat.total_items}</TableCell>
                        <TableCell className="text-sm">{cat.sold_items}</TableCell>
                        <TableCell className="text-sm">{formatCurrency(cat.total_revenue)}</TableCell>
                        <TableCell className={`text-sm font-medium ${cat.total_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(cat.total_profit)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {formatPercent(cat.avg_margin)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Performance Mensal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mês</TableHead>
                      <TableHead>Vendas</TableHead>
                      <TableHead>Receita</TableHead>
                      <TableHead>Lucro</TableHead>
                      <TableHead>Ticket Médio</TableHead>
                      <TableHead>Margem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthly.map(m => (
                      <TableRow key={m.month}>
                        <TableCell className="text-sm font-medium">
                          {new Date(m.month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                        </TableCell>
                        <TableCell className="text-sm">{m.sales_count}</TableCell>
                        <TableCell className="text-sm">{formatCurrency(m.revenue)}</TableCell>
                        <TableCell className={`text-sm font-medium ${m.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(m.profit)}
                        </TableCell>
                        <TableCell className="text-sm">{formatCurrency(m.avg_ticket)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {formatPercent(m.avg_margin)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {monthly.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          Sem dados de performance mensal
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
