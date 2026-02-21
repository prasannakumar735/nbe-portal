import type { ReactNode } from 'react'

interface DashboardHeaderProps {
  title: string
  subtitle: string
  actions?: ReactNode
}

export function DashboardHeader({ title, subtitle, actions }: DashboardHeaderProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-500">{subtitle}</p>
      </div>
      {actions && <div className="flex flex-col sm:flex-row gap-3">{actions}</div>}
    </div>
  )
}
