import type { EmployeeTimesheetEntry } from '@/lib/types/employee-timesheet.types'

/** Returns ids that appear more than once (dev diagnostics). */
export function findDuplicateEntryIds(entries: { id: string }[]): Set<string> {
  const seen = new Set<string>()
  const dup = new Set<string>()
  for (const e of entries) {
    const id = String(e.id ?? '').trim()
    if (!id) continue
    if (seen.has(id)) dup.add(id)
    else seen.add(id)
  }
  return dup
}

/**
 * Keeps one row per `id` (last occurrence wins — typically the newest edit).
 * Rows with missing/blank `id` are dropped (invalid for upsert).
 * Sort order is not modified; caller should renumber `sort_order` if needed.
 */
export function dedupeTimesheetEntriesById(entries: EmployeeTimesheetEntry[]): EmployeeTimesheetEntry[] {
  const map = new Map<string, EmployeeTimesheetEntry>()
  for (const e of entries) {
    const id = String(e.id ?? '').trim()
    if (!id) continue
    map.set(id, e)
  }
  return Array.from(map.values())
}
