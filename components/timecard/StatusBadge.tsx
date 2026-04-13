'use client'

import type { EmployeeTimesheetStatus } from '@/lib/types/employee-timesheet.types'

const STYLES: Record<
  EmployeeTimesheetStatus,
  { label: string; className: string }
> = {
  draft: {
    label: 'Draft',
    className: 'border-amber-200 bg-amber-50 text-amber-950',
  },
  submitted: {
    label: 'Submitted',
    className: 'border-sky-200 bg-sky-50 text-sky-900',
  },
  approved: {
    label: 'Approved',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  },
  rejected: {
    label: 'Rejected',
    className: 'border-red-200 bg-red-50 text-red-900',
  },
}

type Props = {
  status: EmployeeTimesheetStatus | null | undefined
  className?: string
}

export function StatusBadge({ status, className = '' }: Props) {
  const s = (status ?? 'draft') as EmployeeTimesheetStatus
  const cfg = STYLES[s] ?? STYLES.draft
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${cfg.className} ${className}`.trim()}
    >
      {cfg.label}
    </span>
  )
}
