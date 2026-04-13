import type { FilterOptions, ReportsFilters } from '@/lib/reports/types'

/** Sites for the selected client (or every site when no client). */
export function locationsForClient(
  locations: FilterOptions['locations'],
  clientId: string | null
): FilterOptions['locations'] {
  if (!clientId) return locations
  return locations.filter(l => l.client_id === clientId)
}

/**
 * When client changes → clear dependent filters.
 * When location changes → clear job type.
 */
export function mergeCascade(prev: ReportsFilters, next: ReportsFilters): ReportsFilters {
  let out = { ...next }
  if (next.clientId !== prev.clientId) {
    out = { ...out, locationId: null, workTypeLevel1Id: null }
  } else if (next.locationId !== prev.locationId) {
    out = { ...out, workTypeLevel1Id: null }
  }
  return out
}

/**
 * Fix deep-linked or stale URLs: infer client from location; drop invalid location/job for client.
 */
export function reconcileReportsFilters(
  f: ReportsFilters,
  options: FilterOptions
): { next: ReportsFilters; changed: boolean } {
  let next = { ...f }
  let changed = false

  if (next.locationId) {
    const loc = options.locations.find(l => l.id === next.locationId)
    if (!loc) {
      next.locationId = null
      next.workTypeLevel1Id = null
      changed = true
    } else {
      if (!next.clientId && loc.client_id) {
        next.clientId = loc.client_id
        changed = true
      } else if (next.clientId && loc.client_id && loc.client_id !== next.clientId) {
        next.locationId = null
        next.workTypeLevel1Id = null
        changed = true
      }
    }
  }

  if (next.clientId && next.locationId) {
    const loc = options.locations.find(l => l.id === next.locationId)
    if (!loc || loc.client_id !== next.clientId) {
      next.locationId = null
      next.workTypeLevel1Id = null
      changed = true
    }
  }

  return { next, changed }
}
