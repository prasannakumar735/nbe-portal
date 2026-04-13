/**
 * Greedy lane assignment for overlapping intervals (Teams-style columns).
 * Returns lane index (0-based) and total lane count for the day.
 */
export function assignOverlapLanes(
  items: Array<{ id: string; startMin: number; endMin: number }>
): Map<string, { lane: number; laneCount: number }> {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)
  const laneEnds: number[] = []
  const laneById = new Map<string, number>()

  for (const ev of sorted) {
    let lane = laneEnds.findIndex(end => ev.startMin >= end)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(ev.endMin)
    } else {
      laneEnds[lane] = ev.endMin
    }
    laneById.set(ev.id, lane)
  }

  const laneCount = Math.max(1, laneEnds.length)
  const out = new Map<string, { lane: number; laneCount: number }>()
  for (const ev of sorted) {
    const lane = laneById.get(ev.id) ?? 0
    out.set(ev.id, { lane, laneCount })
  }
  return out
}
