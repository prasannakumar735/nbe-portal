'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary:
    'bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-500',
  secondary:
    'bg-white text-slate-800 border border-slate-200 hover:bg-slate-50 disabled:opacity-50',
  ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 disabled:opacity-50',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50',
}

type ButtonProps = {
  children: ReactNode
  variant?: Variant
  className?: string
  loading?: boolean
} & ButtonHTMLAttributes<HTMLButtonElement>

export function Button({
  children,
  variant = 'primary',
  className = '',
  loading = false,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors ${variants[variant]} ${className}`}
      {...rest}
    >
      {loading && (
        <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  )
}
