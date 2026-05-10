'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { SearchableSelect } from '@/components/ui/SearchableSelect'

export interface FilterOption {
  id: string
  name: string
}

/** Query state comes from the server page — avoids `useSearchParams()` / OuterLayoutRouter races on Next 15+. */
interface FilterBarProps {
  projects: FilterOption[]
  period: string
  project: string
  startDate: string
  endDate: string
}

const PERIOD_OPTIONS = [
  { id: 'this_week', label: 'This week' },
  { id: 'last_week', label: 'Last week' },
  { id: 'this_month', label: 'This month' },
  { id: 'custom', label: 'Custom range' }
]

export function FilterBar({ projects, period, project, startDate, endDate }: FilterBarProps) {
  const router = useRouter()

  const projectOptions = useMemo(() => {
    return [{ id: 'all', name: 'All Projects' }, ...projects]
  }, [projects])

  const projectSelectOptions = useMemo(
    () => projectOptions.map(o => ({ value: o.id, label: o.name })),
    [projectOptions],
  )

  const updateParams = (updates: Record<string, string>) => {
    const params = new URLSearchParams()
    if (period) params.set('period', period)
    if (project) params.set('project', project)
    if (startDate) params.set('start', startDate)
    if (endDate) params.set('end', endDate)
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    })
    const qs = params.toString()
    router.push(qs ? `/dashboard?${qs}` : '/dashboard')
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <select
        value={period}
        onChange={(event) => updateParams({ period: event.target.value })}
        className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
      >
        {PERIOD_OPTIONS.map(option => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>

      <div className="min-w-[180px] flex-1 sm:max-w-xs">
        <SearchableSelect
          id="dashboard-filter-project"
          label="Project / client"
          labelClassName="sr-only"
          value={project || 'all'}
          onChange={(value) => updateParams({ project: value })}
          options={projectSelectOptions}
          placeholder="Search projects…"
          className="[&_button]:h-9 [&_button]:rounded-lg [&_button]:border-gray-200 [&_button]:px-3 [&_button]:text-sm [&_button]:font-medium [&_button]:text-gray-700 [&_button]:shadow-sm"
        />
      </div>

      {period === 'custom' && (
        <div className="flex flex-wrap gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(event) => updateParams({ start: event.target.value })}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <input
            type="date"
            value={endDate}
            onChange={(event) => updateParams({ end: event.target.value })}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
      )}
    </div>
  )
}
