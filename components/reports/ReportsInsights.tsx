'use client'

import { Lightbulb } from 'lucide-react'
import type { ReportsSummary } from '@/lib/reports/types'
import { generateInsights } from '@/lib/reports/insights'

export function ReportsInsights({ summary }: { summary: ReportsSummary | null }) {
  const insights = generateInsights(summary)

  if (!summary) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-5 shadow-sm ring-1 ring-slate-900/[0.04]">
        <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 space-y-2">
          <div className="h-3 w-full max-w-md animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-full max-w-sm animate-pulse rounded bg-slate-100" />
        </div>
      </div>
    )
  }

  if (insights.length === 0) {
    return null
  }

  return (
    <div className="rounded-2xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50/90 to-white p-5 shadow-sm ring-1 ring-indigo-900/[0.06]">
      <div className="flex items-center gap-2 text-sm font-semibold text-indigo-950">
        <Lightbulb className="size-4 text-amber-500" aria-hidden />
        Insights
      </div>
      <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm leading-relaxed text-slate-700">
        {insights.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </div>
  )
}
