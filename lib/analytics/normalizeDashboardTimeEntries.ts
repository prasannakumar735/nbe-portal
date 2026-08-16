import type { SupabaseClient } from '@supabase/supabase-js'
import { loadLevel1CodeMap } from '@/lib/timecard/loadLevel1CodeMap'

/** Columns on clock-style `time_entries` (live work / completed shifts). */
export const DASHBOARD_TIME_ENTRY_SELECT =
  'id, employee_id, client_id, start_time, end_time, hours, billable, status, level1_id'

export type DashboardTimeEntryRaw = {
  id: string
  employee_id: string
  client_id: string
  start_time: string
  end_time: string | null
  hours: number | null
  billable: boolean | null
  status: string | null
  level1_id: string | null
}

export type DashboardTimeEntryRow = DashboardTimeEntryRaw & {
  /** Level-1 code (e.g. LVH) for analytics; resolved from `level1_id` when UUID. */
  work_type_level1_id: string | null
}

export function mapDashboardTimeEntryRows(
  rows: DashboardTimeEntryRaw[],
  codeById: Map<string, string>,
): DashboardTimeEntryRow[] {
  return rows.map(row => {
    const id = row.level1_id != null ? String(row.level1_id) : null
    const work_type_level1_id = id ? (codeById.get(id) ?? id) : null
    return { ...row, work_type_level1_id }
  })
}

export async function normalizeDashboardTimeEntries(
  supabase: SupabaseClient,
  rows: DashboardTimeEntryRaw[],
): Promise<DashboardTimeEntryRow[]> {
  const level1Ids = rows
    .map(r => (r.level1_id != null ? String(r.level1_id) : ''))
    .filter(Boolean)
  const codeById = await loadLevel1CodeMap(supabase, level1Ids)
  return mapDashboardTimeEntryRows(rows, codeById)
}
