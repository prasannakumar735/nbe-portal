/** Monday 00:00 local for the calendar week containing `d`. */
export function startOfIsoWeekMonday(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  return x
}

export function toIsoDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function weekEndFromStart(weekStartIso: string): string {
  const start = new Date(`${weekStartIso}T12:00:00`)
  return toIsoDateString(addDays(start, 6))
}

/** Mon..Sun as ISO date strings */
export function weekDayLabels(weekStartIso: string): { date: string; label: string }[] {
  const start = new Date(`${weekStartIso}T12:00:00`)
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  return labels.map((label, i) => ({
    label,
    date: toIsoDateString(addDays(start, i)),
  }))
}
