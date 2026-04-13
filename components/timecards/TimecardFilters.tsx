'use client'

import { Filter } from 'lucide-react'

export type BillableFilterValue = 'all' | 'yes' | 'no'

type ClientOpt = { id: string; name: string }

type Props = {
  clients: ClientOpt[]
  clientId: string
  onClientIdChange: (id: string) => void
  billable: BillableFilterValue
  onBillableChange: (v: BillableFilterValue) => void
  dateFrom: string
  dateTo: string
  onDateFromChange: (v: string) => void
  onDateToChange: (v: string) => void
  weekMin: string
  weekMax: string
}

const field =
  'h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20'

const label = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500'

export function TimecardFilters({
  clients,
  clientId,
  onClientIdChange,
  billable,
  onBillableChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  weekMin,
  weekMax,
}: Props) {
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-3 shadow-sm ring-1 ring-slate-900/[0.04]">
      <div className="mb-2 flex items-center gap-2 text-slate-800">
        <Filter className="size-4 shrink-0 text-slate-400" aria-hidden />
        <span className="text-sm font-semibold tracking-tight">Filters</span>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <label className="min-w-0">
          <span className={label}>Client</span>
          <select value={clientId} onChange={e => onClientIdChange(e.target.value)} className={field}>
            <option value="">All clients</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0">
          <span className={label}>Billable</span>
          <select
            value={billable}
            onChange={e => onBillableChange(e.target.value as BillableFilterValue)}
            className={field}
          >
            <option value="all">All</option>
            <option value="yes">Billable</option>
            <option value="no">Non-billable</option>
          </select>
        </label>
        <label className="min-w-0">
          <span className={label}>From</span>
          <input
            type="date"
            min={weekMin}
            max={weekMax}
            value={dateFrom}
            onChange={e => onDateFromChange(e.target.value)}
            className={field}
          />
        </label>
        <label className="min-w-0">
          <span className={label}>To</span>
          <input
            type="date"
            min={weekMin}
            max={weekMax}
            value={dateTo}
            onChange={e => onDateToChange(e.target.value)}
            className={field}
          />
        </label>
      </div>
    </div>
  )
}
