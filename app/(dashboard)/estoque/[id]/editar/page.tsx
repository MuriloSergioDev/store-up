import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { ItemForm } from '@/components/items/item-form'
import type { Item, ItemImage } from '@/types/database'

export const metadata = { title: 'Editar Item' }

export default async function EditarItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: rawItem }, { data: categories }, { data: suppliers }] = await Promise.all([
    supabase.from('items').select('*, images:item_images(*)').eq('id', id).single(),
    supabase.from('categories').select('*').order('name'),
    (supabase.from('suppliers') as any).select('*').order('name'),
  ])

  if (!rawItem) notFound()
  const item = rawItem as unknown as Item & { images: ItemImage[] }

  const imageUrls = (item.images ?? []).map((img) => img.url)

  return (
    <div className="space-y-6 max-w-4xl pb-10">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/estoque/${id}`}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Editar Item</h1>
          <p className="text-muted-foreground text-sm truncate max-w-sm">{item.name}</p>
        </div>
      </div>
      <ItemForm categories={categories ?? []} suppliers={suppliers ?? []} item={item} defaultImages={imageUrls} />
    </div>
  )
}
