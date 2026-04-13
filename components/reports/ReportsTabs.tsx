'use client'

import type { ReportsTab } from '@/lib/reports/types'

const tabs: { id: ReportsTab; label: string }[] = [
  { id: 'timecards', label: 'Timecards' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'gps', label: 'GPS activity' },
  { id: 'quotes', label: 'Quotes & revenue' },
]

type Props = {
  tab: ReportsTab
  onTabChange: (t: ReportsTab) => void
}

export function ReportsTabs({ tab, onTabChange }: Props) {
  return (
    <nav className="flex min-w-0 flex-wrap gap-2" aria-label="Report sections">
      {tabs.map(t => {
        const active = tab === t.id
        return (
          <button
            key={t.id}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => onTabChange(t.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
              active
                ? 'bg-slate-900 text-white shadow-sm ring-1 ring-slate-900/10'
                : 'bg-slate-100/90 text-slate-600 hover:bg-slate-200/90'
            }`}
          >
            {t.label}
          </button>
        )
      })}
    </nav>
  )
}
