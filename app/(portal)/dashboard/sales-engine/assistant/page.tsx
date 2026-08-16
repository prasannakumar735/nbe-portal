import { redirect } from 'next/navigation'
import { SalesAssistantPage } from '@/components/sales-engine/SalesAssistantPage'
import { createServerClient } from '@/lib/supabase/server'

export default async function SalesEngineAssistantRoute() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin' && profile?.role !== 'manager') {
    redirect('/dashboard')
  }

  return <SalesAssistantPage />
}
