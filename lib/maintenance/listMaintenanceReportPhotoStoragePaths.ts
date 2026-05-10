import type { SupabaseClient } from '@supabase/supabase-js'
import { imageUrlToMaintenanceBucketPath } from '@/lib/maintenance/imageUrlToMaintenanceBucketPath'

const BUCKET = 'maintenance-images'

export type MaintenanceReportPhotoStorageRef = { path: string; name: string }

/**
 * Lists storage object paths for photos attached to a maintenance report (DB rows + optional storage fallback).
 */
export async function listMaintenanceReportPhotoStoragePaths(
  supabase: SupabaseClient,
  reportId: string,
  opts?: { maintenanceDoorRowIds?: string[] | null },
): Promise<MaintenanceReportPhotoStorageRef[]> {
  const out: MaintenanceReportPhotoStorageRef[] = []
  const seen = new Set<string>()

  const addPath = (path: string) => {
    const normalized = String(path || '').trim().replace(/^\/+/, '')
    if (!normalized || seen.has(normalized)) return
    const name = normalized.split('/').pop() || `photo-${seen.size + 1}`
    seen.add(normalized)
    out.push({ path: normalized, name })
  }

  let doorQuery = supabase.from('maintenance_doors').select('id').eq('report_id', reportId)
  const rowFilter = opts?.maintenanceDoorRowIds?.filter(Boolean) ?? []
  if (rowFilter.length > 0) {
    doorQuery = doorQuery.in('id', rowFilter)
  }

  const { data: doorRows } = await doorQuery

  const doorIds = (doorRows ?? [])
    .map(row => String((row as { id?: string | null }).id ?? '').trim())
    .filter(Boolean)

  if (doorIds.length > 0) {
    const { data: photoRows } = await supabase
      .from('maintenance_photos')
      .select('image_url')
      .in('door_id', doorIds)

    for (const row of photoRows ?? []) {
      const imageUrl = String((row as { image_url?: string | null }).image_url ?? '').trim()
      if (!imageUrl) continue

      const parsed = imageUrlToMaintenanceBucketPath(imageUrl)
      if (parsed) {
        addPath(parsed)
      }
    }
  }

  if (out.length > 0 || rowFilter.length > 0) {
    return out
  }

  const safeReportId = reportId.replace(/[^a-zA-Z0-9_-]/g, '_')

  const { data: topLevel } = await supabase.storage.from(BUCKET).list(safeReportId, { limit: 500 })
  if (!topLevel?.length) return out

  for (const item of topLevel) {
    if (!item.name) continue
    const { data: files } = await supabase.storage
      .from(BUCKET)
      .list(`${safeReportId}/${item.name}`, { limit: 200 })
    if (files) {
      for (const file of files) {
        if (!file.name) continue
        addPath(`${safeReportId}/${item.name}/${file.name}`)
      }
    }
  }
  return out
}
