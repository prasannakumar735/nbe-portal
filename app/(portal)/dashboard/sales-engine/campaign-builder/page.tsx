import { redirect } from 'next/navigation'
import { CampaignBuilderPage } from '@/components/sales-engine/CampaignBuilderPage'
import { createServerClient } from '@/lib/supabase/server'

export default async function SalesCampaignBuilderPage() {
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

  return <CampaignBuilderPage />
}
