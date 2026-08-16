import { redirect } from 'next/navigation'
import { CampaignEmailReviewPage } from '@/components/sales-engine/CampaignEmailReviewPage'
import { createServerClient } from '@/lib/supabase/server'

type PageProps = {
  params: Promise<{ campaignId: string }>
}

export default async function SalesCampaignEmailsPage({ params }: PageProps) {
  const { campaignId } = await params
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

  return <CampaignEmailReviewPage campaignId={campaignId} />
}
