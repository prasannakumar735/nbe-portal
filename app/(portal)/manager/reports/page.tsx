import { Suspense } from 'react'
import { ReportsPageClient } from '@/components/reports/ReportsPageClient'

export const metadata = {
  title: 'Reports & Analytics | NBE Portal',
  description:
    'Centralised insights across operations, time tracking, maintenance, GPS activity, and revenue.',
}

function ReportsFallback() {
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-12 sm:px-6">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
      <div className="mt-4 h-4 w-full max-w-lg animate-pulse rounded bg-slate-100" />
      <div className="mt-8 h-40 animate-pulse rounded-xl bg-slate-100" />
    </div>
  )
}

export default function ManagerReportsPage() {
  return (
    <Suspense fallback={<ReportsFallback />}>
      <ReportsPageClient />
    </Suspense>
  )
}
