'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Search, X, Globe } from 'lucide-react'
import type { Category } from '@/types/database'

interface InventoryFiltersProps {
  categories: Category[]
}

const STATUS_LABELS: Record<string, string> = {
  all: 'Todos os status',
  in_stock: 'Em Estoque',
  reserved: 'Reservado',
  sold: 'Vendido',
}

const PRICE_LABELS: Record<string, string> = {
  all: 'Todos os preços',
  '0-100': 'Até R$ 100',
  '100-500': 'R$ 100 – R$ 500',
  '500-1000': 'R$ 500 – R$ 1.000',
  '1000-5000': 'R$ 1.000 – R$ 5.000',
  '5000+': 'Acima de R$ 5.000',
}

const PUBLISHED_LABELS: Record<string, string> = {
  all: 'Todos',
  true: 'Publicados',
  false: 'Não publicados',
}

export function InventoryFilters({ categories }: InventoryFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const updateFilter = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all') {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    startTransition(() => {
      router.push(`/estoque?${params.toString()}`)
    })
  }, [router, searchParams])

  const clearFilters = useCallback(() => {
    startTransition(() => {
      router.push('/estoque')
    })
  }, [router])

  const hasFilters = searchParams.size > 0

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <div className="relative flex-1 min-w-48">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome..."
          defaultValue={searchParams.get('q') ?? ''}
          onChange={(e) => updateFilter('q', e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      <Select
        defaultValue={searchParams.get('status') ?? 'all'}
        onValueChange={(v) => updateFilter('status', v ?? 'all')}
      >
        <SelectTrigger className="w-36 h-9">
          <SelectValue placeholder="Status">
            {(value: string) => STATUS_LABELS[value] ?? value}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os status</SelectItem>
          <SelectItem value="in_stock">Em Estoque</SelectItem>
          <SelectItem value="reserved">Reservado</SelectItem>
          <SelectItem value="sold">Vendido</SelectItem>
        </SelectContent>
      </Select>

      <Select
        defaultValue={searchParams.get('category') ?? 'all'}
        onValueChange={(v) => updateFilter('category', v ?? 'all')}
      >
        <SelectTrigger className="w-40 h-9">
          <SelectValue placeholder="Categoria">
            {(value: string) => {
              if (!value || value === 'all') return 'Todas as categorias'
              return categories.find(c => c.id === value)?.name ?? value
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as categorias</SelectItem>
          {categories.map(cat => (
            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        defaultValue={searchParams.get('price') ?? 'all'}
        onValueChange={(v) => updateFilter('price', v ?? 'all')}
      >
        <SelectTrigger className="w-36 h-9">
          <SelectValue placeholder="Preço">
            {(value: string) => PRICE_LABELS[value] ?? value}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os preços</SelectItem>
          <SelectItem value="0-100">Até R$ 100</SelectItem>
          <SelectItem value="100-500">R$ 100 – R$ 500</SelectItem>
          <SelectItem value="500-1000">R$ 500 – R$ 1.000</SelectItem>
          <SelectItem value="1000-5000">R$ 1.000 – R$ 5.000</SelectItem>
          <SelectItem value="5000+">Acima de R$ 5.000</SelectItem>
        </SelectContent>
      </Select>

      <Select
        defaultValue={searchParams.get('published') ?? 'all'}
        onValueChange={(v) => updateFilter('published', v ?? 'all')}
      >
        <SelectTrigger className="w-36 h-9">
          <Globe className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
          <SelectValue placeholder="Publicação">
            {(value: string) => PUBLISHED_LABELS[value] ?? value}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="true">Publicados</SelectItem>
          <SelectItem value="false">Não publicados</SelectItem>
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1.5">
          <X className="h-3.5 w-3.5" />
          Limpar
        </Button>
      )}
    </div>
  )
}
