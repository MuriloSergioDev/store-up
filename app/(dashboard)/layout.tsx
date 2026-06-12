export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Count stale items (in stock > 90 days)
  const { count: staleCount } = await supabase
    .from('items')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'in_stock')
    .lt('purchase_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar profile={profile} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header staleItemsCount={staleCount ?? 0} />
        <main className="flex-1 p-4 lg:p-6 pt-16 lg:pt-4">
          {children}
        </main>
      </div>
    </div>
  )
}
