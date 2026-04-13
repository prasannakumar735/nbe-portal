import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { TimecardsTabs, type TimecardTabId } from '@/components/timecards/TimecardsTabs'
import { pickSearchParam, type AppSearchParams } from '@/lib/app/searchParams'

export const metadata = {
  title: 'Timecards | NBE Portal',
  description: 'Weekly time entry and team approvals',
}

function tabFromSearch(raw: string | undefined, canViewTeam: boolean): TimecardTabId {
  if (raw === 'team' && canViewTeam) return 'team'
  return 'my'
}

function TimecardsFallback() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-40 rounded-lg bg-slate-200" />
      <div className="h-4 w-72 rounded bg-slate-100" />
      <div className="h-11 max-w-md rounded-lg bg-slate-200" />
      <div className="mt-6 h-48 rounded-xl bg-slate-100" />
    </div>
  )
}

export default async function DashboardTimecardsPage({
  searchParams,
}: {
  searchParams: Promise<AppSearchParams>
}) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const role = profile?.role ?? 'employee'
  const canViewTeam = role === 'admin' || role === 'manager'

  const raw = await searchParams
  const tab = pickSearchParam(raw.tab)
  const initialTab = tabFromSearch(tab, canViewTeam)

  if (tab === 'team' && !canViewTeam) {
    redirect('/dashboard/timecards?tab=my')
  }

  return (
    <div>
      <Suspense fallback={<TimecardsFallback />}>
        <TimecardsTabs initialTab={initialTab} canViewTeam={canViewTeam} />
      </Suspense>
    </div>
  )
}
