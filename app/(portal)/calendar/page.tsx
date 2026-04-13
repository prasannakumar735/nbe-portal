import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth/server'
import { createServerClient } from '@/lib/supabase/server'
import { isManagerOrAdminRole } from '@/lib/auth/roles'
import { CalendarPageClient } from '@/components/calendar/CalendarPageClient'

export default async function CalendarPage() {
  const user = await getServerUser()
  if (!user) {
    redirect('/login')
  }

  const supabase = await createServerClient()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const canManage = isManagerOrAdminRole(profile?.role)

  return <CalendarPageClient userId={user.id} canManage={canManage} />
}
