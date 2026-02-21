export interface TimeEntryAnalyticsRow {
  employee_id: string
  client_id: string
  start_time: string
  end_time: string | null
  hours: number | null
  billable: boolean | null
  status: string | null
}

export interface WeeklyStats {
  totalHours: number
  billableHours: number
  nonBillableHours: number
  overworkDays: number
  idleDays: number
  dailyHours: { day: string; hours: number }[]
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

function toHours(entry: TimeEntryAnalyticsRow): number {
  if (typeof entry.hours === 'number' && Number.isFinite(entry.hours)) {
    return entry.hours
  }

  if (entry.end_time) {
    const start = new Date(entry.start_time).getTime()
    const end = new Date(entry.end_time).getTime()
    return Math.max(0, end - start) / 3600000
  }

  return 0
}

export function calculateWeeklyStats(entries: TimeEntryAnalyticsRow[]): WeeklyStats {
  const dailyTotals = DAY_LABELS.reduce<Record<string, number>>((acc, label) => {
    acc[label] = 0
    return acc
  }, {})

  let totalHours = 0
  let billableHours = 0

  entries.forEach(entry => {
    const hours = toHours(entry)
    totalHours += hours

    if (entry.billable) {
      billableHours += hours
    }

    const date = new Date(entry.start_time)
    const dayIndex = (date.getDay() + 6) % 7
    const label = DAY_LABELS[dayIndex]
    dailyTotals[label] = (dailyTotals[label] || 0) + hours
  })

  const dailyHours = DAY_LABELS.map(label => ({
    day: label,
    hours: Number((dailyTotals[label] || 0).toFixed(2))
  }))

  const overworkDays = dailyHours.filter(day => day.hours > 9).length
  const idleDays = dailyHours.filter(day => day.hours === 0).length
  const nonBillableHours = totalHours - billableHours

  return {
    totalHours: Number(totalHours.toFixed(2)),
    billableHours: Number(billableHours.toFixed(2)),
    nonBillableHours: Number(nonBillableHours.toFixed(2)),
    overworkDays,
    idleDays,
    dailyHours
  }
}
