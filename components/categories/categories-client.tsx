'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Tags, Loader2, Pencil, Trash2 } from 'lucide-react'
import type { CategoryPerformance } from '@/types/database'

const schema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  description: z.string().optional(),
  color: z.string().min(4, 'Cor inválida'),
})

type FormData = z.infer<typeof schema>

interface CategoriesClientProps {
  categories: CategoryPerformance[]
}

export function CategoriesClient({ categories }: CategoriesClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CategoryPerformance | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CategoryPerformance | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: { color: '#6366f1' },
  })

  const openNew = () => {
    setEditing(null)
    reset({ name: '', description: '', color: '#6366f1' })
    setOpen(true)
  }

  const openEdit = (cat: CategoryPerformance) => {
    setEditing(cat)
    reset({ name: cat.name, description: '', color: cat.color })
    setOpen(true)
  }

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (editing) {
        const { error } = await (supabase.from('categories') as any)
          .update({ name: data.name, description: data.description || null, color: data.color })
          .eq('id', editing.id)
        if (error) throw error
        toast.success('Categoria atualizada!')
      } else {
        const { error } = await (supabase.from('categories') as any).insert({
          name: data.name,
          description: data.description || null,
          color: data.color,
          created_by: user?.id,
        })
        if (error) throw error
        toast.success('Categoria criada!')
      }
      reset()
      setOpen(false)
      setEditing(null)
      router.refresh()
    } catch {
      toast.error(editing ? 'Erro ao atualizar categoria' : 'Erro ao criar categoria')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      const { error } = await (supabase.from('categories') as any).delete().eq('id', deleteTarget.id)
      if (error) throw error
      toast.success('Categoria removida!')
      setDeleteTarget(null)
      router.refresh()
    } catch {
      toast.error('Erro ao remover. Verifique se não há itens vinculados.')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Categorias</h1>
          <p className="text-muted-foreground text-sm">{categories.length} categorias cadastradas</p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Categoria
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {categories.map(cat => (
          <Card key={cat.id} className="hover:shadow-md transition-shadow overflow-hidden">
            <div className="h-1.5" style={{ background: cat.color }} />
            <CardHeader className="pb-2 pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-4 h-4 rounded-full shrink-0" style={{ background: cat.color }} />
                  <CardTitle className="text-base truncate">{cat.name}</CardTitle>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  {cat.total_items > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {cat.total_items} itens
                    </Badge>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(cat)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(cat)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Em Estoque</p>
                  <p className="font-semibold">{cat.stock_items}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vendidos</p>
                  <p className="font-semibold">{cat.sold_items}</p>
                </div>
                {cat.total_revenue > 0 && (
                  <>
                    <div>
                      <p className="text-xs text-muted-foreground">Receita</p>
                      <p className="font-semibold text-green-600">{formatCurrency(cat.total_revenue)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Lucro</p>
                      <p className={`font-semibold ${cat.total_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(cat.total_profit)}
                      </p>
                    </div>
                  </>
                )}
              </div>
              {cat.total_revenue > 0 && cat.avg_margin !== 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Margem média:</span>
                    <Badge variant="outline" className="text-xs">{formatPercent(cat.avg_margin)}</Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {categories.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-20">
            <Tags className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Nenhuma categoria cadastrada</p>
          </div>
        )}
      </div>

      {/* Sheet Criar/Editar */}
      <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null) }}>
        <SheetContent className="flex flex-col">
          <SheetHeader className="border-b pb-4">
            <SheetTitle>{editing ? 'Editar Categoria' : 'Nova Categoria'}</SheetTitle>
          </SheetHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-y-auto">
            <div className="flex-1 space-y-5 p-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input placeholder="Ex: Móveis Antigos" {...register('name')} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  placeholder="Descrição da categoria..."
                  {...register('description')}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Cor</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    {...register('color')}
                    onChange={(e) => setValue('color', e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded-md border border-border p-1"
                  />
                  <Input {...register('color')} placeholder="#6366f1" className="flex-1" />
                </div>
                {errors.color && <p className="text-xs text-destructive">{errors.color.message}</p>}
              </div>
            </div>

            <div className="border-t p-4 flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              A categoria <strong>{deleteTarget?.name}</strong> será removida permanentemente.
              {(deleteTarget?.total_items ?? 0) > 0 && (
                <span className="block mt-2 text-destructive font-medium">
                  Atenção: esta categoria possui {deleteTarget?.total_items} itens vinculados. Remova os vínculos antes de excluir.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteLoading || (deleteTarget?.total_items ?? 0) > 0}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
