'use client'

import type { ChangeEvent } from 'react'
import { SearchableSelect } from '@/components/ui/SearchableSelect'

export type PeriodFilter = 'this_week' | 'last_week' | 'this_month' | 'custom'

export interface ProjectOption {
  id: string
  name: string
}

interface CustomRange {
  start: string
  end: string
}

interface DashboardFiltersProps {
  period: PeriodFilter
  onPeriodChange: (value: PeriodFilter) => void
  projectId: string
  onProjectChange: (value: string) => void
  projects: ProjectOption[]
  customRange: CustomRange
  onCustomRangeChange: (value: CustomRange) => void
}

export function DashboardFilters({
  period,
  onPeriodChange,
  projectId,
  onProjectChange,
  projects,
  customRange,
  onCustomRangeChange
}: DashboardFiltersProps) {
  const handlePeriodChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onPeriodChange(event.target.value as PeriodFilter)
  }

  const projectSelectOptions = [
    { value: 'all', label: 'All Projects' },
    ...projects.map(p => ({ value: p.id, label: p.name })),
  ]

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <select
          value={period}
          onChange={handlePeriodChange}
          className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="this_week">This week</option>
          <option value="last_week">Last week</option>
          <option value="this_month">This month</option>
          <option value="custom">Custom range</option>
        </select>

        <div className="min-w-[200px] flex-1 sm:flex-initial">
          <SearchableSelect
            id="dashboard-analytics-project"
            label="Project / client"
            labelClassName="sr-only"
            value={projectId || 'all'}
            onChange={onProjectChange}
            options={projectSelectOptions}
            placeholder="Search projects…"
            className="[&_button]:rounded-xl [&_button]:border-gray-200 [&_button]:px-4 [&_button]:py-2 [&_button]:text-sm [&_button]:font-medium [&_button]:text-gray-700 [&_button]:shadow-sm"
          />
        </div>
      </div>

      {period === 'custom' && (
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={customRange.start}
            onChange={(event) => onCustomRangeChange({ ...customRange, start: event.target.value })}
            className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <input
            type="date"
            value={customRange.end}
            onChange={(event) => onCustomRangeChange({ ...customRange, end: event.target.value })}
            className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
      )}
    </>
  )
}
