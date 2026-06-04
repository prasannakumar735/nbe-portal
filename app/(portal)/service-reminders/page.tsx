import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth/server'
import { createServerClient } from '@/lib/supabase/server'
import { isManagerOrAdminRole } from '@/lib/auth/roles'
import { ServiceRemindersPageClient } from '@/components/serviceReminders/ServiceRemindersPageClient'

export default async function ServiceRemindersPage() {
  const user = await getServerUser()
  if (!user) redirect('/login')

  const supabase = await createServerClient()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!isManagerOrAdminRole(profile?.role)) {
    redirect('/calendar')
  }

  return <ServiceRemindersPageClient />
}
