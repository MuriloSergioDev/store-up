'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Switch } from '@/components/ui/switch'
import { Globe, EyeOff, Loader2 } from 'lucide-react'

interface PublishToggleProps {
  itemId: string
  published: boolean
}

export function PublishToggle({ itemId, published }: PublishToggleProps) {
  const router = useRouter()
  const supabase = createClient()
  const [value, setValue] = useState(published)
  const [loading, setLoading] = useState(false)

  const handleChange = async (checked: boolean) => {
    setValue(checked)
    setLoading(true)
    try {
      const { error } = await (supabase.from('items') as any)
        .update({ published: checked })
        .eq('id', itemId)
      if (error) throw error
      toast.success(checked ? 'Item publicado no site' : 'Item removido do site')
      router.refresh()
    } catch {
      setValue(!checked)
      toast.error('Erro ao atualizar publicação')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-3">
      <div className="flex items-center gap-2">
        {value ? (
          <Globe className="w-4 h-4 text-primary" />
        ) : (
          <EyeOff className="w-4 h-4 text-muted-foreground" />
        )}
        <div>
          <p className="text-sm font-medium">{value ? 'Publicado no site' : 'Não publicado'}</p>
          <p className="text-xs text-muted-foreground">
            {value ? 'Visível para visitantes' : 'Apenas uso interno'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
        <Switch checked={value} onCheckedChange={handleChange} disabled={loading} />
      </div>
    </div>
  )
}
