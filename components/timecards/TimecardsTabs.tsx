'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { MyTimecardTab } from '@/components/timecards/MyTimecardTab'
import { TeamApprovalsTab } from '@/components/timecards/TeamApprovalsTab'

export type TimecardTabId = 'my' | 'team'

function tabFromSearchParam(raw: string | null, canViewTeam: boolean): TimecardTabId {
  if (raw === 'team' && canViewTeam) return 'team'
  return 'my'
}

type TimecardsTabsProps = {
  initialTab: TimecardTabId
  canViewTeam: boolean
}

export function TimecardsTabs({ initialTab, canViewTeam }: TimecardsTabsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<TimecardTabId>(initialTab)

  useEffect(() => {
    setTab(tabFromSearchParam(searchParams.get('tab'), canViewTeam))
  }, [searchParams, canViewTeam])

  const selectTab = useCallback(
    (next: TimecardTabId) => {
      if (next === 'team' && !canViewTeam) return
      setTab(next)
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', next)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [canViewTeam, pathname, router, searchParams]
  )

  if (!canViewTeam) {
    return (
      <div>
        <header className="border-b border-slate-200 pb-2">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">Timecards</h1>
          <p className="mt-0.5 text-xs text-slate-500">Your weekly timesheet and submissions.</p>
        </header>
        <div className="mt-3">
          <MyTimecardTab />
        </div>
      </div>
    )
  }

  return (
    <div>
      <header className="border-b border-slate-200 pb-2">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">Timecards</h1>
        <p className="mt-0.5 text-xs text-slate-500">Your timesheet and team approval queue.</p>
        <div
          className="mt-3 inline-flex w-full max-w-md gap-0.5 rounded-lg bg-slate-100 p-0.5 sm:w-auto"
          role="tablist"
          aria-label="Timecards sections"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'my'}
            id="timecards-tab-my"
            aria-controls="timecards-panel-my"
            onClick={() => selectTab('my')}
            className={`min-w-0 flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none ${
              tab === 'my' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            My Timecard
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'team'}
            id="timecards-tab-team"
            aria-controls="timecards-panel-team"
            onClick={() => selectTab('team')}
            className={`min-w-0 flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none ${
              tab === 'team' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Team Approvals
          </button>
        </div>
      </header>

      <div className="mt-4">
        <section
          id="timecards-panel-my"
          role="tabpanel"
          aria-labelledby="timecards-tab-my"
          hidden={tab !== 'my'}
        >
          <MyTimecardTab />
        </section>
        <section
          id="timecards-panel-team"
          role="tabpanel"
          aria-labelledby="timecards-tab-team"
          hidden={tab !== 'team'}
        >
          <TeamApprovalsTab />
        </section>
      </div>
    </div>
  )
}
