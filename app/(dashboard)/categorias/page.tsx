import { createClient } from '@/lib/supabase/server'
import { CategoriesClient } from '@/components/categories/categories-client'

export const metadata = { title: 'Categorias' }
export const revalidate = 0

export default async function CategoriasPage() {
  const supabase = await createClient()
  const { data: categories } = await supabase.from('category_performance').select('*')

  return <CategoriesClient categories={(categories as any[]) ?? []} />
}
