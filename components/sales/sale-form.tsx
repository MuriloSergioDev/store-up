'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatPercent, getPaymentMethodLabel } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle, TrendingUp, TrendingDown, Package } from 'lucide-react'
import type { Item } from '@/types/database'
import Image from 'next/image'

const schema = z.object({
  item_id: z.string().uuid('Selecione um item'),
  quantity_sold: z.coerce.number().int().min(1, 'Quantidade mínima é 1'),
  sale_date: z.string().min(1, 'Data de venda é obrigatória'),
  price_option: z.enum(['estimated', 'custom']),
  sale_price: z.coerce.number().min(0.01, 'Preço de venda inválido'),
  payment_method: z.enum(['dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'transferencia', 'outro']),
  buyer_name: z.string().optional(),
  buyer_contact: z.string().optional(),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const paymentMethods = [
  'dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'transferencia', 'outro'
] as const

interface SaleFormProps {
  items: Item[]
  preSelectedItem?: Item | null
}

export function SaleForm({ items, preSelectedItem }: SaleFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState<Item | null>(preSelectedItem ?? null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      item_id: preSelectedItem?.id ?? '',
      quantity_sold: 1,
      sale_date: new Date().toISOString().split('T')[0],
      price_option: 'estimated',
      sale_price: preSelectedItem?.estimated_price ?? 0,
      payment_method: 'pix',
    },
  })

  const priceOption = watch('price_option')
  const salePrice = watch('sale_price')
  const quantitySold = watch('quantity_sold') || 1

  // total_cost = item_cost * quantity + shipping + other (all units); divide by quantity for per-unit
  const unitCost = selectedItem
    ? selectedItem.total_cost / (selectedItem.quantity || 1)
    : 0
  const saleCost = unitCost * quantitySold
  // estimated_price is per unit
  const estimatedUnitPrice = selectedItem?.estimated_price ?? 0

  useEffect(() => {
    if (priceOption === 'estimated' && selectedItem) {
      setValue('sale_price', estimatedUnitPrice * quantitySold)
    }
  // estimatedUnitPrice já captura selectedItem.estimated_price; selectedItem.id detecta troca de item
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceOption, selectedItem?.id, estimatedUnitPrice, quantitySold])

  const profit = selectedItem ? salePrice - saleCost : 0
  const profitMargin = saleCost > 0 ? profit / saleCost : 0
  const priceAccuracy = selectedItem && estimatedUnitPrice * quantitySold > 0
    ? salePrice / (estimatedUnitPrice * quantitySold)
    : 0

  const onSubmit = async (data: FormData) => {
    if (!selectedItem) return
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const unitCostAtSubmit = selectedItem.total_cost / (selectedItem.quantity || 1)

      const { error } = await (supabase.from('sales') as any).insert({
        item_id: data.item_id,
        quantity_sold: data.quantity_sold,
        sale_date: data.sale_date,
        estimated_price: selectedItem.estimated_price * data.quantity_sold,
        sale_price: data.sale_price,
        item_cost: unitCostAtSubmit * data.quantity_sold,
        payment_method: data.payment_method,
        buyer_name: data.buyer_name || null,
        buyer_contact: data.buyer_contact || null,
        notes: data.notes || null,
        created_by: user?.id,
      })

      if (error) throw error

      toast.success(`"${selectedItem.name}" vendido por ${formatCurrency(data.sale_price)}!`)
      router.push('/vendas')
      router.refresh()
    } catch (error: any) {
      console.error(error)
      toast.error('Erro ao registrar venda. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleItemChange = (itemId: string | null) => {
    if (!itemId) return
    const item = items.find(i => i.id === itemId) ?? null
    setSelectedItem(item)
    if (item) {
      setValue('item_id', itemId)
      setValue('quantity_sold', 1)
      if (priceOption === 'estimated') {
        setValue('sale_price', item.estimated_price) // qty reset to 1, so unit price = total price here
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Item Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Item para Vender</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Item *</Label>
            <Select
              defaultValue={preSelectedItem?.id ?? ''}
              onValueChange={handleItemChange}
            >
              <SelectTrigger className={`w-full${errors.item_id ? ' border-destructive' : ''}`}>
                <SelectValue placeholder="Selecione o item...">
                  {(value: string) => items.find(i => i.id === value)?.name ?? 'Selecione o item...'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {items.map(item => (
                  <SelectItem key={item.id} value={item.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-xs text-muted-foreground">
                        Est.: {formatCurrency(item.estimated_price)} | Custo: {formatCurrency(item.total_cost)}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.item_id && <p className="text-xs text-destructive">{errors.item_id.message}</p>}
          </div>

          {/* Selected item preview */}
          {selectedItem && (
            <div className="flex gap-3 p-3 rounded-lg bg-muted/50 border border-border">
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted shrink-0 relative">
                {(selectedItem as any).images?.[0] ? (
                  <Image src={(selectedItem as any).images[0].url} alt={selectedItem.name} fill className="object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Package className="w-6 h-6 text-muted-foreground/40" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{selectedItem.name}</p>
                {(selectedItem as any).category && (
                  <p className="text-xs text-muted-foreground">{(selectedItem as any).category.name}</p>
                )}
                <div className="flex gap-3 mt-1.5 text-xs">
                  <span>Custo unit.: <strong>{formatCurrency(unitCost)}</strong></span>
                  <span>Est. unit.: <strong className="text-primary">{formatCurrency(estimatedUnitPrice)}</strong></span>
                  <span className="text-muted-foreground">Estoque: <strong>{selectedItem.quantity}</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* Quantity sold */}
          {selectedItem && (
            <div className="space-y-2">
              <Label htmlFor="quantity_sold">
                Quantidade Vendida
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  (disponível: {selectedItem.quantity})
                </span>
              </Label>
              <Input
                id="quantity_sold"
                type="number"
                min={1}
                max={selectedItem.quantity}
                className="w-32"
                {...register('quantity_sold', {
                  setValueAs: (v) => v === '' ? 1 : Math.min(parseInt(v) || 1, selectedItem.quantity),
                })}
              />
              {errors.quantity_sold && (
                <p className="text-xs text-destructive">{errors.quantity_sold.message}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Price */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Preço de Venda</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            defaultValue="estimated"
            onValueChange={(v) => setValue('price_option', v as 'estimated' | 'custom')}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="estimated" id="r-estimated" />
              <Label htmlFor="r-estimated" className="cursor-pointer">
                Usar preço estimado
                {selectedItem && (
                  <span className="ml-2 text-sm font-semibold text-primary">
                    {formatCurrency(estimatedUnitPrice * quantitySold)}
                    {quantitySold > 1 && (
                      <span className="ml-1 font-normal text-muted-foreground text-xs">
                        ({formatCurrency(estimatedUnitPrice)} × {quantitySold})
                      </span>
                    )}
                  </span>
                )}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="custom" id="r-custom" />
              <Label htmlFor="r-custom" className="cursor-pointer">Informar preço real</Label>
            </div>
          </RadioGroup>

          {priceOption === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="sale_price">Preço Real de Venda *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                <Input
                  id="sale_price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0,00"
                  {...register('sale_price')}
                  className={`pl-8 ${errors.sale_price ? 'border-destructive' : ''}`}
                />
              </div>
              {errors.sale_price && <p className="text-xs text-destructive">{errors.sale_price.message}</p>}
              {selectedItem && salePrice !== estimatedUnitPrice * quantitySold && (
                <Alert className={salePrice > estimatedUnitPrice * quantitySold ? 'border-green-500/50 bg-green-500/5' : 'border-amber-500/50 bg-amber-500/5'}>
                  <AlertDescription className="text-xs">
                    {salePrice > estimatedUnitPrice * quantitySold
                      ? `✓ ${formatCurrency(salePrice - estimatedUnitPrice * quantitySold)} acima do estimado`
                      : `⚠ ${formatCurrency(estimatedUnitPrice * quantitySold - salePrice)} abaixo do estimado`
                    }
                    {' — O valor estimado original será preservado para análises.'}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Profit preview */}
          {selectedItem && salePrice > 0 && (
            <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-muted/50">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Custo{quantitySold > 1 ? ` (x${quantitySold})` : ''}</p>
                <p className="font-bold text-sm">{formatCurrency(saleCost)}</p>
              </div>
              <div className="text-center border-x border-border">
                <p className="text-xs text-muted-foreground">Lucro</p>
                <div className="flex items-center justify-center gap-1">
                  {profit >= 0 ? (
                    <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5 text-red-600" />
                  )}
                  <p className={`font-bold text-sm ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(profit)}
                  </p>
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Margem</p>
                <Badge variant={profitMargin >= 0.3 ? 'default' : profitMargin >= 0 ? 'secondary' : 'destructive'} className="text-xs">
                  {formatPercent(profitMargin)}
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Detalhes da Venda</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sale_date">Data da Venda *</Label>
              <Input
                id="sale_date"
                type="date"
                {...register('sale_date')}
              />
            </div>
            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select
                defaultValue="pix"
                onValueChange={(v) => setValue('payment_method', v as any)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: string) => getPaymentMethodLabel(value)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map(method => (
                    <SelectItem key={method} value={method}>
                      {getPaymentMethodLabel(method)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="buyer_name">Nome do Comprador</Label>
              <Input
                id="buyer_name"
                placeholder="Opcional"
                {...register('buyer_name')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buyer_contact">Contato</Label>
              <Input
                id="buyer_contact"
                placeholder="Telefone ou e-mail"
                {...register('buyer_contact')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              placeholder="Notas sobre a venda..."
              rows={2}
              {...register('notes')}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading || !selectedItem} className="gap-2">
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Registrando...</>
          ) : (
            <><CheckCircle className="h-4 w-4" /> Confirmar Venda</>
          )}
        </Button>
      </div>
    </form>
  )
}
