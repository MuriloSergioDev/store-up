'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Plus, Loader2 } from 'lucide-react'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

const schema = z.object({
  type: z.enum(['income', 'expense']),
  category: z.enum(['other_income', 'other_expense']),
  amount: z.coerce.number().min(0.01, 'Valor inválido'),
  description: z.string().min(2, 'Descrição obrigatória'),
  date: z.string().min(1, 'Data obrigatória'),
})

type FormData = z.infer<typeof schema>

export function AddManualCashFlow() {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      type: 'income',
      category: 'other_income',
      date: new Date().toISOString().split('T')[0],
    },
  })

  const type = watch('type')

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await (supabase.from('cash_flow') as any).insert({
        type: data.type,
        category: data.category,
        amount: data.amount,
        description: data.description,
        date: data.date,
        reference_type: 'manual',
        created_by: user?.id,
      })
      if (error) throw error
      toast.success('Lançamento adicionado!')
      reset()
      setOpen(false)
      router.refresh()
    } catch {
      toast.error('Erro ao adicionar lançamento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Lançamento Manual
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Novo Lançamento Manual</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-6">
          <div className="space-y-3">
            <Label>Tipo</Label>
            <RadioGroup
              defaultValue="income"
              onValueChange={(v) => {
                setValue('type', v as 'income' | 'expense')
                setValue('category', v === 'income' ? 'other_income' : 'other_expense')
              }}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="income" id="income" />
                <Label htmlFor="income" className="text-green-600 font-medium cursor-pointer">Entrada</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="expense" id="expense" />
                <Label htmlFor="expense" className="text-red-600 font-medium cursor-pointer">Saída</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>Descrição *</Label>
            <Input placeholder="Descreva o lançamento..." {...register('description')} />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Valor *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
              <Input type="number" step="0.01" min="0.01" placeholder="0,00" {...register('amount')} className="pl-8" />
            </div>
            {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Data *</Label>
            <Input type="date" {...register('date')} />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
    </>
  )
}
