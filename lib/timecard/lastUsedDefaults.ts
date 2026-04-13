import type { EmployeeTimesheetEntry } from '@/lib/types/employee-timesheet.types'

const STORAGE_KEY = 'nbe-timecard:last-entry-prefs'

export type LastUsedEntryPrefs = {
  client_id: string | null
  location_id: string | null
  work_type_level1_id: string | null
  work_type_level2_id: string | null
  billable: boolean
}

export function readLastUsedEntryPrefs(): LastUsedEntryPrefs | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as LastUsedEntryPrefs
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export function writeLastUsedEntryPrefs(entry: EmployeeTimesheetEntry): void {
  if (typeof window === 'undefined') return
  try {
    const prefs: LastUsedEntryPrefs = {
      client_id: entry.client_id,
      location_id: entry.location_id,
      work_type_level1_id: entry.work_type_level1_id,
      work_type_level2_id: entry.work_type_level2_id,
      billable: entry.billable,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // ignore quota / private mode
  }
}

export function mergeLastUsedIntoEntry(base: EmployeeTimesheetEntry): EmployeeTimesheetEntry {
  const last = readLastUsedEntryPrefs()
  if (!last) return base
  return {
    ...base,
    client_id: last.client_id ?? base.client_id,
    location_id: last.location_id ?? base.location_id,
    work_type_level1_id: last.work_type_level1_id ?? base.work_type_level1_id,
    work_type_level2_id: last.work_type_level2_id ?? base.work_type_level2_id,
    billable: last.billable,
  }
}
