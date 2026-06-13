'use client'

import { AlertCircle, Clock, LogIn, Users } from 'lucide-react'
import type { AttendanceDashboard } from '@/lib/officeClock/attendanceDashboard'

type Props = {
  dashboard: AttendanceDashboard | null
  isLoading?: boolean
}

export function AttendanceSummaryCards({ dashboard, isLoading }: Props) {
  const cards = [
    {
      icon: LogIn,
      label: 'Logged in today',
      sub: dashboard ? dashboard.todayMelbourne : '',
      value: dashboard?.loggedInTodayCount ?? 0,
    },
    {
      icon: Users,
      label: 'In office now',
      sub: 'Open sessions',
      value: dashboard?.signedInNowCount ?? 0,
    },
    {
      icon: Clock,
      label: 'Avg duration',
      sub: 'Selected range',
      value: dashboard?.averageDurationDisplay ?? '—',
    },
    {
      icon: AlertCircle,
      label: 'Missing sign-out',
      sub: 'In selected range',
      value: dashboard?.missingSignOutsInRange ?? 0,
    },
  ]

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(card => {
        const Icon = card.icon
        return (
          <div
            key={card.label}
            className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Icon className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
              {card.sub ? <p className="truncate text-[10px] text-slate-400">{card.sub}</p> : null}
              <p
                className={`text-xl font-semibold tabular-nums text-slate-900 ${isLoading ? 'animate-pulse' : ''}`}
              >
                {isLoading ? '—' : card.value}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
