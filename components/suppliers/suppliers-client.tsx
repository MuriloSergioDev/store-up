'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Truck, Loader2, Pencil, Trash2, Phone, Mail, User, Package, ShoppingCart, DollarSign } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { Supplier } from '@/types/database'

export interface SupplierStats {
  items_count: number
  total_quantity: number
  purchases_count: number
  total_spent: number
  _dates?: Set<string>
}

const schema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  contact: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface SuppliersClientProps {
  suppliers: Supplier[]
  statsMap: Record<string, SupplierStats>
}

export function SuppliersClient({ suppliers, statsMap }: SuppliersClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
  })

  const openNew = () => {
    setEditing(null)
    reset({ name: '', contact: '', phone: '', email: '', notes: '' })
    setOpen(true)
  }

  const openEdit = (s: Supplier) => {
    setEditing(s)
    reset({
      name: s.name,
      contact: s.contact ?? '',
      phone: s.phone ?? '',
      email: s.email ?? '',
      notes: s.notes ?? '',
    })
    setOpen(true)
  }

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const payload = {
        name: data.name,
        contact: data.contact || null,
        phone: data.phone || null,
        email: data.email || null,
        notes: data.notes || null,
      }
      if (editing) {
        const { error } = await (supabase.from('suppliers') as any).update(payload).eq('id', editing.id)
        if (error) throw error
        toast.success('Fornecedor atualizado!')
      } else {
        const { error } = await (supabase.from('suppliers') as any).insert({ ...payload, created_by: user?.id })
        if (error) throw error
        toast.success('Fornecedor cadastrado!')
      }
      reset()
      setOpen(false)
      setEditing(null)
      router.refresh()
    } catch {
      toast.error(editing ? 'Erro ao atualizar fornecedor' : 'Erro ao cadastrar fornecedor')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      const { error } = await (supabase.from('suppliers') as any).delete().eq('id', deleteTarget.id)
      if (error) throw error
      toast.success('Fornecedor removido!')
      setDeleteTarget(null)
      router.refresh()
    } catch {
      toast.error('Erro ao remover fornecedor.')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fornecedores</h1>
          <p className="text-muted-foreground text-sm">{suppliers.length} fornecedores cadastrados</p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Fornecedor
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {suppliers.map(s => {
          const stats = statsMap[s.id]
          return (
            <Card key={s.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 shrink-0">
                      <Truck className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{s.name}</p>
                      {s.contact && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 truncate">
                          <User className="w-3 h-3 shrink-0" />
                          {s.contact}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(s)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Estatísticas */}
                <div className="mt-3 pt-3 border-t border-border grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                      <ShoppingCart className="w-3 h-3" />
                      <span className="text-[10px]">Compras</span>
                    </div>
                    <p className="text-sm font-semibold">{stats?.purchases_count ?? 0}</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                      <Package className="w-3 h-3" />
                      <span className="text-[10px]">Itens</span>
                    </div>
                    <p className="text-sm font-semibold">{stats?.total_quantity ?? 0}</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                      <DollarSign className="w-3 h-3" />
                      <span className="text-[10px]">Total gasto</span>
                    </div>
                    <p className="text-sm font-semibold">{formatCurrency(stats?.total_spent ?? 0)}</p>
                  </div>
                </div>

                {(s.phone || s.email) && (
                  <div className="mt-3 pt-3 border-t border-border space-y-1">
                    {s.phone && (
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        <Phone className="w-3 h-3" />
                        {s.phone}
                      </p>
                    )}
                    {s.email && (
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        <Mail className="w-3 h-3" />
                        {s.email}
                      </p>
                    )}
                  </div>
                )}

                {s.notes && (
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{s.notes}</p>
                )}
              </CardContent>
            </Card>
          )
        })}

        {suppliers.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-20">
            <Truck className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Nenhum fornecedor cadastrado</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" />
              Cadastrar primeiro fornecedor
            </Button>
          </div>
        )}
      </div>

      {/* Sheet Criar/Editar */}
      <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null) }}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editing ? 'Editar Fornecedor' : 'Novo Fornecedor'}</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-6">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input placeholder="Ex: Leilão Silva" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Contato / Responsável</Label>
              <Input placeholder="Nome do responsável" {...register('contact')} />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input placeholder="(11) 99999-9999" {...register('phone')} />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" placeholder="contato@fornecedor.com" {...register('email')} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea placeholder="Informações adicionais..." {...register('notes')} rows={3} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? 'Salvar' : 'Cadastrar'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover fornecedor?</AlertDialogTitle>
            <AlertDialogDescription>
              O fornecedor <strong>{deleteTarget?.name}</strong> será removido permanentemente.
              Itens vinculados a ele perderão o vínculo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteLoading}
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
