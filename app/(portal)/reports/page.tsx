import { redirect } from 'next/navigation'
import { getServerUser } from '@/lib/auth/server'
import { createServerClient } from '@/lib/supabase/server'
import { isManagerOrAdminRole } from '@/lib/auth/roles'
import { filtersToQueryString, parseFiltersFromSearchParams } from '@/lib/reports/parseFilters'

/**
 * Entry point from the main nav "Reports" link: managers go to the full module; others return to the dashboard.
 */
export default async function ReportsEntryPage() {
  const user = await getServerUser()
  if (!user) {
    redirect('/login')
  }

  const supabase = await createServerClient()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!isManagerOrAdminRole(profile?.role)) {
    redirect('/dashboard')
  }

  const f = parseFiltersFromSearchParams({})
  const q = new URLSearchParams(filtersToQueryString(f))
  q.set('tab', 'timecards')
  redirect(`/manager/reports?${q.toString()}`)
}
