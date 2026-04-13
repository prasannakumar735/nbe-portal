'use client'

import type { SelectHTMLAttributes } from 'react'

export type SelectOption = { value: string; label: string }

type SelectProps = {
  label: string
  id: string
  options: SelectOption[]
  error?: string
} & SelectHTMLAttributes<HTMLSelectElement>

export function Select({ label, id, options, error, className = '', ...rest }: SelectProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-medium text-slate-700">
        {label}
      </label>
      <select
        id={id}
        className={`h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 ${error ? 'border-red-300' : ''} ${className}`}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
