'use client'

import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Loader2, Plus, Trash2, Calculator, Package } from 'lucide-react'
import type { Category, Supplier } from '@/types/database'

const itemLineSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  category_id: z.string().optional().or(z.literal('')),
  description: z.string().optional(),
  item_cost: z.coerce.number().min(0, 'Valor inválido'),
  other_costs: z.coerce.number().min(0, 'Valor inválido').default(0),
  estimated_price: z.coerce.number().min(0, 'Valor estimado inválido'),
  quantity: z.coerce.number().int().min(1, 'Quantidade mínima é 1').default(1),
  notes: z.string().optional(),
})

const schema = z.object({
  supplier_id: z.string().optional().or(z.literal('')),
  purchase_date: z.string().min(1, 'Data de compra é obrigatória'),
  shipping_cost: z.coerce.number().min(0, 'Valor inválido').default(0),
  items: z.array(itemLineSchema).min(1),
})

type FormData = z.infer<typeof schema>

const emptyItem = {
  name: '',
  category_id: '',
  description: '',
  item_cost: 0,
  other_costs: 0,
  estimated_price: 0,
  quantity: 1,
  notes: '',
}

interface PurchaseFormProps {
  categories: Category[]
  suppliers: Supplier[]
}

export function PurchaseForm({ categories, suppliers }: PurchaseFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      supplier_id: '',
      purchase_date: new Date().toISOString().split('T')[0],
      shipping_cost: 0,
      items: [{ ...emptyItem }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  const toNumber = (value: unknown) => {
    if (typeof value === 'number') return value
    if (typeof value !== 'string') return 0

    const trimmed = value.trim()
    const normalized = trimmed.includes(',')
      ? trimmed.replace(/\./g, '').replace(',', '.')
      : trimmed

    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : 0
  }

  const watchedItems = watch('items')
  const watchedShipping = toNumber(watch('shipping_cost'))

  const itemCalcs = (watchedItems ?? []).map(item => {
    const qty = toNumber(item.quantity) || 1
    const itemCost = toNumber(item.item_cost)
    const otherCosts = toNumber(item.other_costs)
    const estimatedPrice = toNumber(item.estimated_price)
    const cost = itemCost * qty + otherCosts
    const revenue = estimatedPrice * qty
    const profit = revenue - cost
    const margin = cost > 0 ? profit / cost : 0
    return { cost, profit, margin }
  })

  const totalItemCosts = (watchedItems ?? []).reduce((s, i) => s + toNumber(i.item_cost) * (toNumber(i.quantity) || 1), 0)
  const totalOtherCosts = (watchedItems ?? []).reduce((s, i) => s + toNumber(i.other_costs), 0)
  const totalCost = totalItemCosts + watchedShipping + totalOtherCosts
  const totalEstimated = (watchedItems ?? []).reduce((s, i) => s + toNumber(i.estimated_price) * (toNumber(i.quantity) || 1), 0)
  const totalProfit = totalEstimated - totalCost
  const totalMargin = totalCost > 0 ? totalProfit / totalCost : 0

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const totalItemCostsForShipping = data.items.reduce((s, i) => s + toNumber(i.item_cost), 0)

      await Promise.all(
        data.items.map(async (item) => {
          const itemShipping = totalItemCostsForShipping > 0
            ? toNumber(data.shipping_cost) * (toNumber(item.item_cost) / totalItemCostsForShipping)
            : toNumber(data.shipping_cost) / data.items.length

          const { error } = await (supabase.from('items') as any).insert({
            name: item.name,
            category_id: item.category_id || null,
            description: item.description || null,
            supplier_id: data.supplier_id || null,
            purchase_date: data.purchase_date,
            item_cost: toNumber(item.item_cost),
            shipping_cost: Math.round(itemShipping * 100) / 100,
            other_costs: toNumber(item.other_costs),
            estimated_price: toNumber(item.estimated_price),
            quantity: toNumber(item.quantity),
            notes: item.notes || null,
            created_by: user?.id,
            updated_by: user?.id,
          })
          if (error) throw error
        })
      )

      const count = data.items.length
      toast.success(count === 1 ? 'Item cadastrado com sucesso!' : `${count} itens cadastrados com sucesso!`)
      router.push('/estoque')
      router.refresh()
    } catch (error: any) {
      console.error(error)
      toast.error('Erro ao salvar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Informações da Compra */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Informações da Compra</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Fornecedor <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Select
                onValueChange={(v) => setValue('supplier_id', (v as string) ?? '')}
                items={suppliers.map(s => ({ value: s.id, label: s.name }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o fornecedor" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.length === 0 ? (
                    <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                      Nenhum fornecedor cadastrado
                    </div>
                  ) : (
                    suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchase_date">Data da Compra *</Label>
              <Input
                id="purchase_date"
                type="date"
                {...register('purchase_date')}
                className={errors.purchase_date ? 'border-destructive' : ''}
              />
              {errors.purchase_date && (
                <p className="text-xs text-destructive">{errors.purchase_date.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="shipping_cost">Frete da Compra</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                <Input
                  id="shipping_cost"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  {...register('shipping_cost', { valueAsNumber: true })}
                  className="pl-8"
                />
              </div>
              <p className="text-xs text-muted-foreground">Distribuído proporcionalmente entre os itens</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Itens */}
      {fields.map((field, index) => {
        const calc = itemCalcs[index] ?? { cost: 0, profit: 0, margin: 0 }
        return (
          <Card key={field.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Item {index + 1}
                </CardTitle>
                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Item *</Label>
                  <Input
                    placeholder="Ex: Aparelho de jantar alemão, séc. XIX"
                    {...register(`items.${index}.name`)}
                    className={errors.items?.[index]?.name ? 'border-destructive' : ''}
                  />
                  {errors.items?.[index]?.name && (
                    <p className="text-xs text-destructive">{errors.items[index].name?.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select
                    onValueChange={(v) => setValue(`items.${index}.category_id`, (v as string) ?? '')}
                    items={categories.map(cat => ({ value: cat.id, label: cat.name }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.length === 0 ? (
                        <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                          Nenhuma categoria cadastrada
                        </div>
                      ) : (
                        categories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  placeholder="Estado de conservação, detalhes relevantes..."
                  rows={2}
                  {...register(`items.${index}.description`)}
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Valor do Item *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      {...register(`items.${index}.item_cost`, { valueAsNumber: true })}
                      className={`pl-8 ${errors.items?.[index]?.item_cost ? 'border-destructive' : ''}`}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Outros Custos</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      {...register(`items.${index}.other_costs`, { valueAsNumber: true })}
                      className="pl-8"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Preço Estimado de Venda *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      {...register(`items.${index}.estimated_price`, { valueAsNumber: true })}
                      className={`pl-8 ${errors.items?.[index]?.estimated_price ? 'border-destructive' : ''}`}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Quantidade</Label>
                  <Input
                    type="number"
                    min="1"
                    {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                  />
                </div>
              </div>

              {/* Cálculo por item */}
              <div className="bg-muted/50 rounded-lg p-3 grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Custo (sem frete)</p>
                  <p className="font-semibold text-sm">{formatCurrency(calc.cost)}</p>
                </div>
                <div className="text-center border-x border-border">
                  <p className="text-xs text-muted-foreground mb-1">Lucro Estimado</p>
                  <p className={`font-semibold text-sm ${calc.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(calc.profit)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Margem</p>
                  <Badge
                    variant={calc.margin >= 0.3 ? 'default' : calc.margin >= 0 ? 'secondary' : 'destructive'}
                    className="text-xs"
                  >
                    {formatPercent(calc.margin)}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  placeholder="Histórico, proveniência, restauros realizados..."
                  rows={2}
                  {...register(`items.${index}.notes`)}
                />
              </div>
            </CardContent>
          </Card>
        )
      })}

      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        onClick={() => append({ ...emptyItem })}
      >
        <Plus className="w-4 h-4" />
        Adicionar Item
      </Button>

      {/* Resumo da Compra */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            Resumo da Compra
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Custo dos Itens</p>
              <p className="font-semibold">{formatCurrency(totalItemCosts)}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Frete</p>
              <p className="font-semibold">{formatCurrency(watchedShipping)}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Outros Custos</p>
              <p className="font-semibold">{formatCurrency(totalOtherCosts)}</p>
            </div>
            <div className="bg-primary/10 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Custo Total</p>
              <p className="font-bold">{formatCurrency(totalCost)}</p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Total Estimado de Venda</p>
              <p className="font-semibold text-sm">{formatCurrency(totalEstimated)}</p>
            </div>
            <div className="text-center border-x border-border">
              <p className="text-xs text-muted-foreground mb-1">Lucro Total Estimado</p>
              <p className={`font-bold text-sm ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(totalProfit)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Margem Geral</p>
              <Badge variant={totalMargin >= 0.3 ? 'default' : totalMargin >= 0 ? 'secondary' : 'destructive'}>
                {formatPercent(totalMargin)}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cadastrando...</>
          ) : (
            `Cadastrar ${fields.length === 1 ? 'Item' : `${fields.length} Itens`}`
          )}
        </Button>
      </div>
    </form>
  )
}
