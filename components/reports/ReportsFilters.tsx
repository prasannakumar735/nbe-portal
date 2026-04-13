'use client'

import type { BillableFilter, FilterOptions, ReportsFilters } from '@/lib/reports/types'
import { presetLastMonth, presetThisWeek } from '@/lib/reports/parseFilters'

type Props = {
  filters: ReportsFilters
  options: FilterOptions | null
  /** Sites for the current client (or full list when “All clients”). */
  locationOptions: FilterOptions['locations']
  /** Job types observed for client + location in the date range (cascading). */
  workTypeOptions: FilterOptions['workTypesLevel1']
  workTypesLoading?: boolean
  cascade: {
    locationDisabled: boolean
    jobTypeDisabled: boolean
  }
  onChange: (next: ReportsFilters) => void
}

const selectClass =
  'h-9 w-full min-w-0 rounded-xl border border-slate-200/90 bg-white px-2.5 text-sm text-slate-800 shadow-sm outline-none ring-slate-900/[0.04] transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/30'

const selectDisabledClass =
  'h-9 w-full min-w-0 cursor-not-allowed rounded-xl border border-slate-200/80 bg-slate-50 px-2.5 text-sm text-slate-500 shadow-sm'

export function ReportsFilters({
  filters,
  options,
  locationOptions,
  workTypeOptions,
  workTypesLoading = false,
  cascade,
  onChange,
}: Props) {
  const set = <K extends keyof ReportsFilters>(key: K, value: ReportsFilters[K]) => {
    onChange({ ...filters, [key]: value })
  }

  const applyPreset = (which: 'week' | 'month') => {
    const r = which === 'week' ? presetThisWeek() : presetLastMonth()
    onChange({ ...filters, dateFrom: r.from, dateTo: r.to })
  }

  return (
    <div className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 py-4 backdrop-blur-md">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.04]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Filters</h2>
            <p className="text-xs text-slate-500">
              Client → Location → Job type cascade. Applied to charts, tables, and exports.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => applyPreset('week')}
              className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
            >
              This week
            </button>
            <button
              type="button"
              onClick={() => applyPreset('month')}
              className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
            >
              Last month
            </button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <label className="block min-w-0">
            <span className="mb-1 block text-xs font-medium text-slate-600">From</span>
            <input
              type="date"
              className={selectClass}
              value={filters.dateFrom}
              onChange={e => set('dateFrom', e.target.value)}
              required
            />
          </label>
          <label className="block min-w-0">
            <span className="mb-1 block text-xs font-medium text-slate-600">To</span>
            <input
              type="date"
              className={selectClass}
              value={filters.dateTo}
              onChange={e => set('dateTo', e.target.value)}
              required
            />
          </label>
          <label className="block min-w-0">
            <span className="mb-1 block text-xs font-medium text-slate-600">Client</span>
            <select
              className={selectClass}
              value={filters.clientId ?? ''}
              onChange={e => set('clientId', e.target.value || null)}
            >
              <option value="">All clients</option>
              {(options?.clients ?? []).map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0">
            <span className="mb-1 block text-xs font-medium text-slate-600">Location</span>
            <select
              className={cascade.locationDisabled ? selectDisabledClass : selectClass}
              disabled={cascade.locationDisabled}
              title={
                cascade.locationDisabled
                  ? 'Select a client first to choose a site'
                  : 'Site for the selected client'
              }
              value={filters.locationId ?? ''}
              onChange={e => set('locationId', e.target.value || null)}
            >
              <option value="">{cascade.locationDisabled ? 'Select client first' : 'All locations'}</option>
              {locationOptions.map(l => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0">
            <span className="mb-1 block text-xs font-medium text-slate-600">Job type</span>
            <select
              className={cascade.jobTypeDisabled ? selectDisabledClass : selectClass}
              disabled={cascade.jobTypeDisabled || workTypesLoading}
              title={
                cascade.jobTypeDisabled
                  ? 'Select client and location first'
                  : 'Types that appear on timesheets for this site in the date range'
              }
              value={filters.workTypeLevel1Id ?? ''}
              onChange={e => set('workTypeLevel1Id', e.target.value || null)}
            >
              <option value="">
                {cascade.jobTypeDisabled
                  ? 'Select location first'
                  : workTypesLoading
                    ? 'Loading types…'
                    : 'All types'}
              </option>
              {workTypeOptions.map(w => (
                <option key={w.id} value={w.id}>
                  {[w.code, w.name].filter(Boolean).join(' — ')}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0">
            <span className="mb-1 block text-xs font-medium text-slate-600">Technician</span>
            <select
              className={selectClass}
              value={filters.technicianId ?? ''}
              onChange={e => set('technicianId', e.target.value || null)}
            >
              <option value="">All technicians</option>
              {(options?.technicians ?? []).map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0">
            <span className="mb-1 block text-xs font-medium text-slate-600">Billable</span>
            <select
              className={selectClass}
              value={filters.billable}
              onChange={e => set('billable', e.target.value as BillableFilter)}
            >
              <option value="all">All</option>
              <option value="yes">Billable</option>
              <option value="no">Non-billable</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  )
}
