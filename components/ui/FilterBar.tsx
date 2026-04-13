'use client'

import { useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export interface FilterOption {
  id: string
  name: string
}

interface FilterBarProps {
  projects: FilterOption[]
  defaultPeriod: string
  defaultProject: string
}

const PERIOD_OPTIONS = [
  { id: 'this_week', label: 'This week' },
  { id: 'last_week', label: 'Last week' },
  { id: 'this_month', label: 'This month' },
  { id: 'custom', label: 'Custom range' }
]

export function FilterBar({ projects, defaultPeriod, defaultProject }: FilterBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const period = searchParams.get('period') || defaultPeriod
  const project = searchParams.get('project') || defaultProject
  const startDate = searchParams.get('start') || ''
  const endDate = searchParams.get('end') || ''

  const projectOptions = useMemo(() => {
    return [{ id: 'all', name: 'All Projects' }, ...projects]
  }, [projects])

  const updateParams = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())

    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    })

    router.push(`/dashboard?${params.toString()}`)
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

      <select
        value={project}
        onChange={(event) => updateParams({ project: event.target.value })}
        className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
      >
        {projectOptions.map(option => (
          <option key={option.id} value={option.id}>{option.name}</option>
        ))}
      </select>

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
