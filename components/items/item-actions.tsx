'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trash2, RefreshCw, Loader2 } from 'lucide-react'
import { getStatusLabel } from '@/lib/utils'
import type { ItemStatus } from '@/types/database'

interface ItemActionsProps {
  itemId: string
  itemStatus: ItemStatus
  isAdmin: boolean
}

export function ItemActions({ itemId, itemStatus, isAdmin }: ItemActionsProps) {
  const router = useRouter()
  const supabase = createClient()
  const [updating, setUpdating] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const handleStatusChange = async (newStatus: string | null) => {
    if (!newStatus || newStatus === itemStatus) return
    setUpdating(true)
    try {
      const { error } = await (supabase.from('items') as any)
        .update({ status: newStatus })
        .eq('id', itemId)

      if (error) throw error
      toast.success(`Status atualizado para "${getStatusLabel(newStatus)}"`)
      router.refresh()
    } catch {
      toast.error('Erro ao atualizar status')
    } finally {
      setUpdating(false)
    }
  }

  const handleDelete = async () => {
    try {
      const { error } = await (supabase.from('items') as any).delete().eq('id', itemId)
      if (error) throw error
      toast.success('Item excluído com sucesso')
      router.push('/estoque')
      router.refresh()
    } catch {
      toast.error('Erro ao excluir item')
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      {itemStatus !== 'sold' && (
        <div className="flex items-center gap-2">
          {updating && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          <Select
            value={itemStatus}
            onValueChange={handleStatusChange as any}
            disabled={updating}
          >
            <SelectTrigger className="w-40 h-9">
              <RefreshCw className="w-3.5 h-3.5 mr-2" />
              <SelectValue>
                {(value: string) => value === 'in_stock' ? 'Em Estoque' : 'Reservado'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="in_stock">Em Estoque</SelectItem>
              <SelectItem value="reserved">Reservado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {isAdmin && (
        <>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive border-destructive/30"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Excluir
          </Button>
          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. O item será removido permanentemente do sistema.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  )
}
