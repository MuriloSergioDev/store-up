'use client'

import { useState, useCallback } from 'react'
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
import { Slider } from '@/components/ui/slider'
import { Loader2, Plus, Trash2, Calculator, Package, Upload, X, ImageIcon } from 'lucide-react'
import Image from 'next/image'
import type { Category, Item, ItemImage, Supplier } from '@/types/database'

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
  item?: Item & { images: ItemImage[] }
  defaultImages?: string[]
}

export function PurchaseForm({ categories, suppliers, item, defaultImages = [] }: PurchaseFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const isEditing = !!item
  const [loading, setLoading] = useState(false)

  // Per-item photo state
  const [itemPhotos, setItemPhotos] = useState<File[][]>([[]])
  const [itemPreviews, setItemPreviews] = useState<string[][]>([isEditing ? defaultImages : []])

  // Margin state
  const computeInitialMargin = (): number => {
    if (!item) return 100
    const cost = item.item_cost * item.quantity + item.shipping_cost + item.other_costs
    return cost > 0
      ? Math.max(0, Math.min(500, Math.round(((item.estimated_price * item.quantity - cost) / cost) * 100)))
      : 100
  }
  const [margins, setMargins] = useState<number[]>([computeInitialMargin()])
  const [marginInputs, setMarginInputs] = useState<string[]>([(computeInitialMargin() / 100).toFixed(2)])

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: isEditing ? {
      supplier_id: item.supplier_id ?? '',
      purchase_date: item.purchase_date,
      shipping_cost: item.shipping_cost,
      items: [{
        name: item.name,
        category_id: item.category_id ?? '',
        description: item.description ?? '',
        item_cost: item.item_cost,
        other_costs: item.other_costs,
        estimated_price: item.estimated_price,
        quantity: item.quantity,
        notes: item.notes ?? '',
      }],
    } : {
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

  const handleMarginChange = (index: number, pct: number) => {
    setMargins(prev => prev.map((m, i) => (i === index ? pct : m)))
    setMarginInputs(prev => prev.map((v, i) => (i === index ? (pct / 100).toFixed(2) : v)))
    const it = watchedItems?.[index]
    const qty = toNumber(it?.quantity) || 1
    const cost = toNumber(it?.item_cost) * qty + toNumber(it?.other_costs)
    if (cost > 0) {
      setValue(`items.${index}.estimated_price`, Math.round((cost * (1 + pct / 100)) / qty * 100) / 100)
    }
  }

  const handlePriceChange = (index: number, price: number) => {
    const it = watchedItems?.[index]
    const qty = toNumber(it?.quantity) || 1
    const cost = toNumber(it?.item_cost) * qty + toNumber(it?.other_costs)
    if (cost > 0) {
      const pct = Math.max(0, Math.min(500, Math.round(((price * qty - cost) / cost) * 100)))
      setMargins(prev => prev.map((m, i) => (i === index ? pct : m)))
      setMarginInputs(prev => prev.map((v, i) => (i === index ? (pct / 100).toFixed(2) : v)))
    }
  }

  const recalcPriceFromMargin = (index: number, overrides: { itemCost?: number; otherCosts?: number; qty?: number }) => {
    const it = watchedItems?.[index]
    const itemCost = overrides.itemCost ?? toNumber(it?.item_cost)
    const otherCosts = overrides.otherCosts ?? toNumber(it?.other_costs)
    const qty = (overrides.qty ?? toNumber(it?.quantity)) || 1
    const cost = itemCost * qty + otherCosts
    const pct = margins[index] ?? 100
    if (cost > 0) {
      setValue(`items.${index}.estimated_price`, Math.round((cost * (1 + pct / 100)) / qty * 100) / 100)
    }
  }

  // Photo handlers
  const handlePhotoChange = useCallback((itemIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const valid = files.filter(f => f.type.startsWith('image/') && f.size < 10 * 1024 * 1024)
    if (valid.length < files.length) toast.warning('Algumas imagens ignoradas (máx. 10MB)')
    setItemPhotos(prev => prev.map((arr, i) => i === itemIndex ? [...arr, ...valid] : arr))
    valid.forEach(file => {
      const reader = new FileReader()
      reader.onloadend = () =>
        setItemPreviews(prev => prev.map((arr, i) => i === itemIndex ? [...arr, reader.result as string] : arr))
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }, [])

  const removePhoto = useCallback((itemIndex: number, photoIndex: number) => {
    setItemPreviews(prev => prev.map((arr, i) => {
      if (i !== itemIndex) return arr
      const isNew = arr[photoIndex]?.startsWith('data:')
      if (isNew) {
        const newFileIdx = arr.slice(0, photoIndex).filter(p => p.startsWith('data:')).length
        setItemPhotos(p2 => p2.map((fa, fi) => fi === itemIndex ? fa.filter((_, idx) => idx !== newFileIdx) : fa))
      }
      return arr.filter((_, idx) => idx !== photoIndex)
    }))
  }, [])

  const uploadPhotos = async (itemId: string, itemIndex: number) => {
    const photos = itemPhotos[itemIndex] ?? []
    const existingCount = (itemPreviews[itemIndex] ?? []).filter(p => !p.startsWith('data:')).length
    for (let i = 0; i < photos.length; i++) {
      const file = photos[i]
      const ext = file.name.split('.').pop()
      const path = `items/${itemId}/${Date.now()}-${i}.${ext}`
      const { error } = await supabase.storage.from('item-images').upload(path, file, { cacheControl: '3600', upsert: false })
      if (error) { toast.error(`Erro ao enviar foto: ${error.message}`); continue }
      const { data: { publicUrl } } = supabase.storage.from('item-images').getPublicUrl(path)
      await (supabase.from('item_images') as any).insert({
        url: publicUrl, storage_path: path,
        is_primary: existingCount === 0 && i === 0,
        item_id: itemId,
      })
    }
  }

  const itemCalcs = (watchedItems ?? []).map(it => {
    const qty = toNumber(it.quantity) || 1
    const cost = toNumber(it.item_cost) * qty + toNumber(it.other_costs)
    const revenue = toNumber(it.estimated_price) * qty
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

      if (isEditing && item) {
        const it = data.items[0]
        const { error } = await (supabase.from('items') as any).update({
          name: it.name,
          category_id: it.category_id || null,
          description: it.description || null,
          supplier_id: data.supplier_id || null,
          purchase_date: data.purchase_date,
          item_cost: toNumber(it.item_cost),
          shipping_cost: toNumber(data.shipping_cost),
          other_costs: toNumber(it.other_costs),
          estimated_price: toNumber(it.estimated_price),
          quantity: toNumber(it.quantity),
          notes: it.notes || null,
          updated_by: user?.id,
        }).eq('id', item.id)
        if (error) throw error
        if ((itemPhotos[0] ?? []).length > 0) await uploadPhotos(item.id, 0)
        toast.success('Item atualizado com sucesso!')
        router.push(`/estoque/${item.id}`)
      } else {
        const totalCostsForShipping = data.items.reduce((s, i) => s + toNumber(i.item_cost), 0)
        await Promise.all(
          data.items.map(async (it, idx) => {
            const itemShipping = totalCostsForShipping > 0
              ? toNumber(data.shipping_cost) * (toNumber(it.item_cost) / totalCostsForShipping)
              : data.items.length > 0 ? toNumber(data.shipping_cost) / data.items.length : 0
            const { data: newItem, error } = await (supabase.from('items') as any).insert({
              name: it.name,
              category_id: it.category_id || null,
              description: it.description || null,
              supplier_id: data.supplier_id || null,
              purchase_date: data.purchase_date,
              item_cost: toNumber(it.item_cost),
              shipping_cost: Math.round(itemShipping * 100) / 100,
              other_costs: toNumber(it.other_costs),
              estimated_price: toNumber(it.estimated_price),
              quantity: toNumber(it.quantity),
              notes: it.notes || null,
              created_by: user?.id,
              updated_by: user?.id,
            }).select().single()
            if (error) throw error
            if ((itemPhotos[idx] ?? []).length > 0) await uploadPhotos(newItem.id, idx)
          })
        )
        const count = data.items.length
        toast.success(count === 1 ? 'Item cadastrado com sucesso!' : `${count} itens cadastrados com sucesso!`)
        router.push('/estoque')
      }
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
                defaultValue={isEditing ? item.supplier_id ?? undefined : undefined}
                onValueChange={(v) => setValue('supplier_id', (v as string) ?? '')}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o fornecedor">
                    {(value: string) => suppliers.find(s => s.id === value)?.name ?? 'Selecione o fornecedor'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {suppliers.length === 0 ? (
                    <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                      Nenhum fornecedor cadastrado
                    </div>
                  ) : (
                    suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)
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
              {errors.purchase_date && <p className="text-xs text-destructive">{errors.purchase_date.message}</p>}
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
                  onWheel={(e) => e.currentTarget.blur()}
                  className="pl-8"
                />
              </div>
              {!isEditing && <p className="text-xs text-muted-foreground">Distribuído proporcionalmente entre os itens</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Item cards */}
      {fields.map((field, index) => {
        const calc = itemCalcs[index] ?? { cost: 0, profit: 0, margin: 0 }
        const previews = itemPreviews[index] ?? []
        return (
          <Card key={field.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  {isEditing ? 'Dados do Item' : `Item ${index + 1}`}
                </CardTitle>
                {!isEditing && fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => {
                      remove(index)
                      setMargins(prev => prev.filter((_, i) => i !== index))
                      setMarginInputs(prev => prev.filter((_, i) => i !== index))
                      setItemPhotos(prev => prev.filter((_, i) => i !== index))
                      setItemPreviews(prev => prev.filter((_, i) => i !== index))
                    }}
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
                    defaultValue={isEditing ? item.category_id ?? undefined : undefined}
                    onValueChange={(v) => setValue(`items.${index}.category_id`, (v as string) ?? '')}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione a categoria">
                        {(value: string) => categories.find(c => c.id === value)?.name ?? 'Selecione a categoria'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {categories.length === 0 ? (
                        <div className="px-2 py-4 text-center text-sm text-muted-foreground">Nenhuma categoria cadastrada</div>
                      ) : (
                        categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)
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

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Valor do Item *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                    <Input
                      type="number" step="0.01" min="0" placeholder="0,00"
                      {...(() => {
                        const { onChange, ...rest } = register(`items.${index}.item_cost`, { valueAsNumber: true })
                        return { ...rest, onChange: (e: React.ChangeEvent<HTMLInputElement>) => { onChange(e); recalcPriceFromMargin(index, { itemCost: parseFloat(e.target.value) || 0 }) } }
                      })()}
                      onWheel={(e) => e.currentTarget.blur()}
                      className={`pl-8 ${errors.items?.[index]?.item_cost ? 'border-destructive' : ''}`}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Outros Custos</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                    <Input
                      type="number" step="0.01" min="0" placeholder="0,00"
                      {...(() => {
                        const { onChange, ...rest } = register(`items.${index}.other_costs`, { valueAsNumber: true })
                        return { ...rest, onChange: (e: React.ChangeEvent<HTMLInputElement>) => { onChange(e); recalcPriceFromMargin(index, { otherCosts: parseFloat(e.target.value) || 0 }) } }
                      })()}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="pl-8"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Quantidade</Label>
                  <Input
                    type="number" min="1"
                    {...(() => {
                      const { onChange, ...rest } = register(`items.${index}.quantity`, { valueAsNumber: true })
                      return { ...rest, onChange: (e: React.ChangeEvent<HTMLInputElement>) => { onChange(e); recalcPriceFromMargin(index, { qty: parseInt(e.target.value) || 1 }) } }
                    })()}
                    onWheel={(e) => e.currentTarget.blur()}
                  />
                </div>
              </div>

              {/* Preço + Slider */}
              <div className="space-y-3">
                <Label>Preço Estimado de Venda *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                  <Input
                    type="number" step="0.01" min="0" placeholder="0,00"
                    {...(() => {
                      const { onChange, ...rest } = register(`items.${index}.estimated_price`, { valueAsNumber: true })
                      return { ...rest, onChange: (e: React.ChangeEvent<HTMLInputElement>) => { onChange(e); handlePriceChange(index, parseFloat(e.target.value) || 0) } }
                    })()}
                    onWheel={(e) => e.currentTarget.blur()}
                    className={`pl-8 ${errors.items?.[index]?.estimated_price ? 'border-destructive' : ''}`}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Slider
                    value={[margins[index] ?? 100]}
                    min={0} max={500} step={1}
                    className="flex-1"
                    onValueChange={(vals: number | readonly number[]) => handleMarginChange(index, Array.isArray(vals) ? (vals as number[])[0] : (vals as number))}
                  />
                  <div className="relative w-24 shrink-0">
                    <Input
                      type="text" inputMode="decimal" placeholder="1.00"
                      value={marginInputs[index] ?? '1.00'}
                      onChange={(e) => {
                        const raw = e.target.value
                        setMarginInputs(prev => prev.map((v, i) => (i === index ? raw : v)))
                        const multiplier = parseFloat(raw.replace(',', '.'))
                        if (!isNaN(multiplier) && multiplier >= 0) {
                          const pct = Math.round(multiplier * 100)
                          setMargins(prev => prev.map((m, i) => (i === index ? pct : m)))
                          const it = watchedItems?.[index]
                          const qty = toNumber(it?.quantity) || 1
                          const cost = toNumber(it?.item_cost) * qty + toNumber(it?.other_costs)
                          if (cost > 0) setValue(`items.${index}.estimated_price`, Math.round((cost * (1 + pct / 100)) / qty * 100) / 100)
                        }
                      }}
                      className="pr-8 text-right"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">×</span>
                  </div>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0%</span>
                  <span className="font-semibold tabular-nums">{margins[index] ?? 100}% de margem</span>
                  <span>500%</span>
                </div>
                {errors.items?.[index]?.estimated_price && (
                  <p className="text-xs text-destructive">{errors.items[index].estimated_price?.message}</p>
                )}
              </div>

              {/* Cálculo por item */}
              <div className="bg-muted/50 rounded-lg p-3 grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Custo</p>
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
                  <Badge variant={calc.margin >= 0.3 ? 'default' : calc.margin >= 0 ? 'secondary' : 'destructive'} className="text-xs">
                    {formatPercent(calc.margin)}
                  </Badge>
                </div>
              </div>

              {/* Fotos do item */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <ImageIcon className="w-3.5 h-3.5" />
                  Fotos
                </Label>
                <div className="border-2 border-dashed border-border rounded-xl p-4 text-center hover:border-primary/50 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    id={`photos-${index}`}
                    className="hidden"
                    onChange={(e) => handlePhotoChange(index, e)}
                  />
                  <label htmlFor={`photos-${index}`} className="cursor-pointer flex flex-col items-center gap-1.5">
                    <Upload className="w-6 h-6 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Clique para adicionar fotos</p>
                  </label>
                </div>
                {previews.length > 0 && (
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                    {previews.map((preview, pi) => (
                      <div key={pi} className="relative group aspect-square rounded-lg overflow-hidden border border-border">
                        <Image src={preview} alt={`Foto ${pi + 1}`} fill className="object-cover" />
                        {pi === 0 && (
                          <Badge className="absolute top-1 left-1 text-[10px] py-0 px-1.5 h-4">Principal</Badge>
                        )}
                        <button
                          type="button"
                          onClick={() => removePhoto(index, pi)}
                          className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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

      {!isEditing && (
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2"
          onClick={() => {
            append({ ...emptyItem })
            setMargins(prev => [...prev, 100])
            setMarginInputs(prev => [...prev, '1.00'])
            setItemPhotos(prev => [...prev, []])
            setItemPreviews(prev => [...prev, []])
          }}
        >
          <Plus className="w-4 h-4" />
          Adicionar Item
        </Button>
      )}

      {/* Resumo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            {isEditing ? 'Resumo do Item' : 'Resumo da Compra'}
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

          {!isEditing && fields.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Custo por item</p>
              <div className="divide-y divide-border rounded-lg border">
                {fields.map((field, index) => {
                  const it = watchedItems?.[index]
                  const qty = toNumber(it?.quantity) || 1
                  const itemCost = toNumber(it?.item_cost)
                  const shippingPerItem = fields.length > 0 ? watchedShipping / fields.length : 0
                  const totalItemCost = itemCost + shippingPerItem / qty
                  const name = it?.name?.trim() || `Item ${index + 1}`
                  return (
                    <div key={field.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="text-muted-foreground truncate max-w-[60%]">{name}</span>
                      <span className="font-medium tabular-nums">{formatCurrency(totalItemCost)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

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
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isEditing ? 'Salvando...' : 'Cadastrando...'}</>
          ) : isEditing ? 'Salvar Alterações' : `Cadastrar ${fields.length === 1 ? 'Item' : `${fields.length} Itens`}`}
        </Button>
      </div>
    </form>
  )
}
