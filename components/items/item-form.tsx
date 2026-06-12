'use client'

import { useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
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
import { Loader2, Upload, X, ImageIcon, Calculator, TrendingUp } from 'lucide-react'
import type { Category, Item, Supplier } from '@/types/database'
import Image from 'next/image'

const schema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  category_id: z.string().uuid({ error: 'Selecione uma categoria' }).optional().or(z.literal('')),
  supplier_id: z.string().uuid().optional().or(z.literal('')),
  description: z.string().optional(),
  purchase_date: z.string().min(1, 'Data de compra é obrigatória'),
  item_cost: z.coerce.number().min(0, 'Valor inválido'),
  shipping_cost: z.coerce.number().min(0, 'Valor inválido').default(0),
  other_costs: z.coerce.number().min(0, 'Valor inválido').default(0),
  estimated_price: z.coerce.number().min(0, 'Valor estimado inválido'),
  quantity: z.coerce.number().int().min(1, 'Quantidade mínima é 1').default(1),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface ItemFormProps {
  categories: Category[]
  suppliers: Supplier[]
  item?: Item
  defaultImages?: string[]
}

export function ItemForm({ categories, suppliers, item, defaultImages = [] }: ItemFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [images, setImages] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>(defaultImages)
  const [uploadProgress, setUploadProgress] = useState(0)
  const isEditing = !!item

  const parseMoney = (value: unknown) => {
    if (typeof value === 'number') return value
    if (typeof value !== 'string') return 0

    const trimmed = value.trim()
    const normalized = trimmed.includes(',')
      ? trimmed.replace(/\./g, '').replace(',', '.')
      : trimmed

    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : 0
  }

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      name: item?.name ?? '',
      category_id: item?.category_id ?? '',
      supplier_id: item?.supplier_id ?? '',
      description: item?.description ?? '',
      purchase_date: item?.purchase_date ?? new Date().toISOString().split('T')[0],
      item_cost: item?.item_cost ?? 0,
      shipping_cost: item?.shipping_cost ?? 0,
      other_costs: item?.other_costs ?? 0,
      estimated_price: item?.estimated_price ?? 0,
      quantity: item?.quantity ?? 1,
      notes: item?.notes ?? '',
    },
  })

  const watchedValues = watch(['item_cost', 'shipping_cost', 'other_costs', 'estimated_price', 'quantity'])
  const qty = parseMoney(watchedValues[4]) || 1
  const itemCost = parseMoney(watchedValues[0])
  const shippingCost = parseMoney(watchedValues[1])
  const otherCosts = parseMoney(watchedValues[2])
  const estimatedPrice = parseMoney(watchedValues[3])
  
  const totalCost = itemCost * qty + shippingCost + otherCosts
  const costPerUnit = qty > 1 ? totalCost / qty : 0
  const estimatedProfit = estimatedPrice * qty - totalCost
  const estimatedMargin = totalCost > 0 ? estimatedProfit / totalCost : 0

  const handleImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const validFiles = files.filter(f => f.type.startsWith('image/') && f.size < 10 * 1024 * 1024)

    if (validFiles.length < files.length) {
      toast.warning('Algumas imagens foram ignoradas (máx. 10MB por arquivo)')
    }

    setImages(prev => [...prev, ...validFiles])
    validFiles.forEach(file => {
      const reader = new FileReader()
      reader.onloadend = () => setPreviews(prev => [...prev, reader.result as string])
      reader.readAsDataURL(file)
    })
  }, [])

  const removeImage = useCallback((index: number) => {
    const isNewImage = previews[index]?.startsWith('data:')
    if (isNewImage) {
      const newFileIndex = previews.slice(0, index).filter(p => p.startsWith('data:')).length
      setImages(prev => prev.filter((_, i) => i !== newFileIndex))
    }
    setPreviews(prev => prev.filter((_, i) => i !== index))
  }, [previews])

  const uploadImages = async (itemId: string) => {
    const uploaded: { url: string; storage_path: string; is_primary: boolean }[] = []
    const existingCount = previews.filter(p => !p.startsWith('data:')).length

    for (let i = 0; i < images.length; i++) {
      const file = images[i]
      const ext = file.name.split('.').pop()
      const path = `items/${itemId}/${Date.now()}-${i}.${ext}`

      const { error } = await supabase.storage.from('item-images').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      })

      if (error) {
        toast.error(`Erro ao enviar foto ${i + 1}: ${error.message}`)
        continue
      }

      const { data: { publicUrl } } = supabase.storage.from('item-images').getPublicUrl(path)
      uploaded.push({ url: publicUrl, storage_path: path, is_primary: existingCount === 0 && i === 0 })
      setUploadProgress(Math.round(((i + 1) / images.length) * 100))
    }

    if (uploaded.length > 0) {
      const { error } = await (supabase.from('item_images') as any).insert(
        uploaded.map(img => ({ ...img, item_id: itemId }))
      )
      if (error) throw new Error(`Erro ao salvar fotos: ${error.message}`)
    }
  }

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const payload = {
        name: data.name,
        category_id: data.category_id || null,
        description: data.description || null,
        supplier_id: data.supplier_id || null,
        purchase_date: data.purchase_date,
        item_cost: data.item_cost,
        shipping_cost: data.shipping_cost,
        other_costs: data.other_costs,
        estimated_price: data.estimated_price,
        quantity: data.quantity,
        notes: data.notes || null,
        updated_by: user?.id,
      }

      let itemId = item?.id

      if (isEditing && itemId) {
        const { error } = await (supabase.from('items') as any).update(payload).eq('id', itemId)
        if (error) throw error
        toast.success('Item atualizado com sucesso!')
      } else {
        const { data: newItem, error } = await (supabase.from('items') as any)
          .insert({ ...payload, created_by: user?.id })
          .select()
          .single()
        if (error) throw error
        itemId = newItem.id
        toast.success('Item cadastrado com sucesso!')
      }

      if (images.length > 0 && itemId) {
        await uploadImages(itemId)
      }

      router.push('/estoque')
      router.refresh()
    } catch (error: any) {
      console.error(error)
      toast.error('Erro ao salvar item. Tente novamente.')
    } finally {
      setLoading(false)
      setUploadProgress(0)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Informações Básicas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Informações Básicas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Item *</Label>
              <Input
                id="name"
                placeholder="Ex: Aparelho de jantar alemão, séc. XIX"
                {...register('name')}
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select
                defaultValue={item?.category_id ?? undefined}
                onValueChange={(v) => setValue('category_id', v ?? '')}
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
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              placeholder="Descreva o item, estado de conservação, detalhes relevantes..."
              rows={3}
              {...register('description')}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fornecedor <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Select
                defaultValue={item?.supplier_id ?? undefined}
                onValueChange={(v) => setValue('supplier_id', v ?? '')}
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
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
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
              {errors.purchase_date && <p className="text-xs text-destructive">{errors.purchase_date.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantidade</Label>
            <Input
              id="quantity"
              type="number"
              min={1}
              {...register('quantity', { 
                setValueAs: (v) => v === '' ? 1 : parseInt(v) || 1 
              })}
              className="w-32"
            />
          </div>
        </CardContent>
      </Card>

      {/* Valores e Custos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            Valores e Custos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="item_cost">Valor do Item *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                <Input
                  id="item_cost"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  {...register('item_cost', { 
                    setValueAs: (v) => v === '' ? 0 : parseFloat(v) || 0 
                  })}
                  className={`pl-8 ${errors.item_cost ? 'border-destructive' : ''}`}
                />
              </div>
              {errors.item_cost && <p className="text-xs text-destructive">{errors.item_cost.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="shipping_cost">Frete</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                <Input
                  id="shipping_cost"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  {...register('shipping_cost', { 
                    setValueAs: (v) => v === '' ? 0 : parseFloat(v) || 0 
                  })}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="other_costs">Outros Custos</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                <Input
                  id="other_costs"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  {...register('other_costs', { 
                    setValueAs: (v) => v === '' ? 0 : parseFloat(v) || 0 
                  })}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimated_price">Preço Estimado de Venda *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                <Input
                  id="estimated_price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  {...register('estimated_price', { 
                    setValueAs: (v) => v === '' ? 0 : parseFloat(v) || 0 
                  })}
                  className={`pl-8 ${errors.estimated_price ? 'border-destructive' : ''}`}
                />
              </div>
              {errors.estimated_price && <p className="text-xs text-destructive">{errors.estimated_price.message}</p>}
            </div>
          </div>

          {/* Cálculo automático */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Custo Total</p>
                <p className="font-bold text-sm">{formatCurrency(totalCost)}</p>
                {costPerUnit > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">{formatCurrency(costPerUnit)}/un.</p>
                )}
              </div>
              <div className="text-center border-x border-border">
                <p className="text-xs text-muted-foreground mb-1">Lucro Estimado</p>
                <p className={`font-bold text-sm ${estimatedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(estimatedProfit)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Margem Estimada</p>
                <Badge variant={estimatedMargin >= 0.3 ? 'default' : estimatedMargin >= 0 ? 'secondary' : 'destructive'}>
                  {formatPercent(estimatedMargin)}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fotos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            Fotos do Item
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors">
            <input
              type="file"
              accept="image/*"
              multiple
              id="images"
              className="hidden"
              onChange={handleImageChange}
            />
            <label htmlFor="images" className="cursor-pointer flex flex-col items-center gap-2">
              <Upload className="w-8 h-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Clique para adicionar fotos</p>
                <p className="text-xs text-muted-foreground">PNG, JPG, WEBP — máximo 10MB por arquivo</p>
              </div>
            </label>
          </div>

          {previews.length > 0 && (
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
              {previews.map((preview, i) => (
                <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-border">
                  <Image
                    src={preview}
                    alt={`Foto ${i + 1}`}
                    fill
                    className="object-cover"
                  />
                  {i === 0 && (
                    <Badge className="absolute top-1 left-1 text-[10px] py-0 px-1.5 h-4">Principal</Badge>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {loading && uploadProgress > 0 && (
            <div className="space-y-1">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Enviando fotos... {uploadProgress}%
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Observações */}
      <Card>
        <CardContent className="pt-5">
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              placeholder="Histórico do item, proveniência, restauros realizados, notas internas..."
              rows={3}
              {...register('notes')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
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
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {isEditing ? 'Salvando...' : 'Cadastrando...'}</>
          ) : (
            isEditing ? 'Salvar Alterações' : 'Cadastrar Item'
          )}
        </Button>
      </div>
    </form>
  )
}
