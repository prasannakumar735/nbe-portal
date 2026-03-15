import type { SupabaseClient } from '@supabase/supabase-js'
import type { MaintenanceDoorPhoto } from '@/lib/types/maintenance.types'

const MAINTENANCE_IMAGES_BUCKET = 'maintenance-images'

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_')
}

/**
 * Full logical path:
 * maintenance-images/{report_id}/{door_id}/{timestamp}.jpg
 *
 * For Supabase Storage API, bucket is provided separately via .from(bucket),
 * so object path is: {report_id}/{door_id}/{timestamp}.jpg
 */
export function buildMaintenanceImagePath(reportId: string, doorId: string, extension = 'jpg'): string {
  const safeReportId = safeSegment(reportId)
  const safeDoorId = safeSegment(doorId)
  const timestamp = Date.now()
  return `${safeReportId}/${safeDoorId}/${timestamp}.${extension}`
}

function extensionFromFile(file: File): string {
  const byName = file.name.split('.').pop()?.toLowerCase()
  if (byName && byName.length <= 5) return byName
  if (file.type.includes('png')) return 'png'
  if (file.type.includes('webp')) return 'webp'
  return 'jpg'
}

function mapStorageError(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('bucket not found') || lower.includes('bucketnotfound')) {
    return 'Storage bucket "maintenance-images" was not found. Please create it in Supabase Storage.'
  }
  if (lower.includes('unauthorized') || lower.includes('not authorized')) {
    return 'You are not authorised to upload photos.'
  }
  if (lower.includes('quota') || lower.includes('exceeded')) {
    return 'Storage quota exceeded. Please contact an administrator.'
  }
  return `Upload failed: ${message}`
}

export async function uploadInspectionImage(params: {
  supabase: SupabaseClient
  reportId: string
  doorId: string
  file: File
  onProgress?: (percent: number) => void
}): Promise<MaintenanceDoorPhoto> {
  const { supabase, reportId, doorId, file, onProgress } = params

  onProgress?.(20)
  const extension = extensionFromFile(file)
  const path = buildMaintenanceImagePath(reportId, doorId, extension)

  onProgress?.(50)
  const { error } = await supabase.storage.from(MAINTENANCE_IMAGES_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'image/jpeg',
  })

  if (error) {
    throw new Error(mapStorageError(error.message))
  }

  onProgress?.(90)
  const { data } = supabase.storage.from(MAINTENANCE_IMAGES_BUCKET).getPublicUrl(path)
  onProgress?.(100)

  return {
    path,
    url: data.publicUrl,
  }
}
