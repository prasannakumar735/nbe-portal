'use client'

import type { ChangeEvent } from 'react'

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

  const handleProjectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onProjectChange(event.target.value)
  }

  return (
    <>
      <div className="flex items-center gap-3">
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

        <select
          value={projectId}
          onChange={handleProjectChange}
          className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="all">All Projects</option>
          {projects.map(project => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
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
