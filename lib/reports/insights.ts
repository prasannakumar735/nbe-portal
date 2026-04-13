import type { ReportsSummary } from '@/lib/reports/types'

function formatDayLabel(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })
}

/**
 * Dynamic analytics bullets from aggregated summary metrics.
 * De-duplicated; order is stable and user-facing.
 */
export function generateInsights(summary: ReportsSummary | null): string[] {
  if (!summary) return []

  const insights: string[] = []
  const { totalHours, billableHours, revenueTotal, hoursByDay, hoursByTechnician } = summary

  const billablePercent = totalHours > 0 ? (billableHours / totalHours) * 100 : 0

  if (totalHours <= 0) {
    insights.push('No timesheet hours recorded in this period')
  } else {
    insights.push(`${billablePercent.toFixed(0)}% of total hours are billable`)
    if (billablePercent > 80) {
      insights.push('High billable utilisation')
    }
    if (billablePercent < 40) {
      insights.push('Billable share is low — review non-billable time')
    }
  }

  if (revenueTotal === 0) {
    insights.push('No revenue recorded in this period')
  }

  if (hoursByDay.length > 0) {
    let peak = hoursByDay[0]
    for (const row of hoursByDay) {
      if (row.hours > peak.hours) peak = row
    }
    if (peak.hours > 0) {
      insights.push(`Peak activity on ${formatDayLabel(peak.date)} (${peak.hours} h)`)
    }
  }

  if (hoursByTechnician.length > 0 && hoursByTechnician[0].hours > 0) {
    const top = hoursByTechnician[0]
    insights.push(`Top technician: ${top.name} (${top.hours} h)`)
  }

  return [...new Set(insights)]
}
