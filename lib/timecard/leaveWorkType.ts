export function isLeaveLevel1Code(code: string | null | undefined): boolean {
  return (code ?? '').trim().toUpperCase() === 'LVH'
}

/** Legacy `time_entries` may store level-1 as UUID (`level1_id`) or code string. */
export function isLeaveLegacyTimeEntry(entry: {
  work_type_level1_id?: string | null | undefined
  level1_id?: string | null | undefined
}): boolean {
  if (isLeaveLevel1Code(entry.work_type_level1_id)) return true
  return isLeaveLevel1Code(entry.level1_id)
}

export function isLeaveTimesheetEntry(
  entry: { work_type_level1_id?: string | null | undefined },
  l1CodeById: Map<string, string>,
): boolean {
  const id = entry.work_type_level1_id ? String(entry.work_type_level1_id) : ''
  if (!id) return false
  return isLeaveLevel1Code(l1CodeById.get(id))
}

export type HoursSplit = {
  totalHours: number
  workHours: number
  leaveHours: number
}

export function splitWorkAndLeaveHours<T>(
  items: T[],
  isLeave: (item: T) => boolean,
  getHours: (item: T) => number,
): HoursSplit {
  let workHours = 0
  let leaveHours = 0
  for (const item of items) {
    const h = Number(getHours(item)) || 0
    if (h <= 0) continue
    if (isLeave(item)) leaveHours += h
    else workHours += h
  }
  const round = (n: number) => Math.round(n * 10000) / 10000
  workHours = round(workHours)
  leaveHours = round(leaveHours)
  return {
    totalHours: round(workHours + leaveHours),
    workHours,
    leaveHours,
  }
}
