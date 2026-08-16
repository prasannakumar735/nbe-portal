import { redirect } from 'next/navigation'
import { SalesEnginePage } from '@/components/sales-engine/SalesEnginePage'
import { createServerClient } from '@/lib/supabase/server'

export default async function DashboardSalesEnginePage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = profile?.role
  if (role !== 'admin' && role !== 'manager') {
    redirect('/dashboard')
  }

  return <SalesEnginePage />
}
