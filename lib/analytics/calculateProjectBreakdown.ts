import type { TimeEntryAnalyticsRow } from './calculateWeeklyStats'

export interface ProjectBreakdownItem {
  id: string
  name: string
  totalHours: number
  billableHours: number
  entryCount: number
}

export function calculateProjectBreakdown(
  entries: TimeEntryAnalyticsRow[],
  projectLookup: Record<string, string>
): ProjectBreakdownItem[] {
  const breakdown = entries.reduce<Record<string, ProjectBreakdownItem>>((acc, entry) => {
    const projectId = entry.client_id
    const name = projectLookup[projectId] || 'Unnamed project'

    if (!acc[projectId]) {
      acc[projectId] = {
        id: projectId,
        name,
        totalHours: 0,
        billableHours: 0,
        entryCount: 0
      }
    }

    const hours = typeof entry.hours === 'number' && Number.isFinite(entry.hours)
      ? entry.hours
      : entry.end_time
        ? Math.max(0, new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / 3600000
        : 0

    acc[projectId].totalHours += hours
    acc[projectId].entryCount += 1

    if (entry.billable) {
      acc[projectId].billableHours += hours
    }

    return acc
  }, {})

  return Object.values(breakdown)
    .map(item => ({
      ...item,
      totalHours: Number(item.totalHours.toFixed(2)),
      billableHours: Number(item.billableHours.toFixed(2))
    }))
    .sort((a, b) => b.totalHours - a.totalHours)
}
