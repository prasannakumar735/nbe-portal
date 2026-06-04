/** Add calendar months to a YYYY-MM-DD date (local calendar components). */
export function addMonthsToIsoDate(iso: string, months: number): string | null {
  const parts = iso.split('-').map(Number)
  const y = parts[0]
  const mo = parts[1]
  const day = parts[2]
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(day)) return null
  const d = new Date(y, mo - 1 + months, day)
  if (Number.isNaN(d.getTime())) return null
  const yy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export const SERVICE_REMINDER_LEAD_TIME_DAYS = [3, 5, 7, 14] as const
export type ServiceReminderLeadTimeDays = (typeof SERVICE_REMINDER_LEAD_TIME_DAYS)[number]

/** Calendar day when the manager/client prep email should fire: due_date minus lead_time_days. */
export function serviceReminderNotifyIsoDate(dueDate: string, leadTimeDays: number): string | null {
  const parts = dueDate.split('-').map(Number)
  const y = parts[0]
  const mo = parts[1]
  const day = parts[2]
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(day)) return null
  const d = new Date(y, mo - 1, day)
  d.setDate(d.getDate() - leadTimeDays)
  const yy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}
