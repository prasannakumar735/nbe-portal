'use client'

import type { InputHTMLAttributes } from 'react'

type InputProps = {
  label: string
  hint?: string
  error?: string
  id: string
} & InputHTMLAttributes<HTMLInputElement>

export function Input({ label, hint, error, id, className = '', ...rest }: InputProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        className={`h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 ${error ? 'border-red-300' : ''} ${className}`}
        {...rest}
      />
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
