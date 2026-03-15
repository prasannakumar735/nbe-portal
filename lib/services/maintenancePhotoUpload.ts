import type { SupabaseClient } from '@supabase/supabase-js'
import type { MaintenanceDoorPhoto } from '@/lib/types/maintenance.types'

/**
 * The Supabase storage bucket used for maintenance images and PDFs.
 * Must match the bucket created in your Supabase project:
 *   Dashboard → Storage → New Bucket → Name: "maintenance-images"
 *   Set to Public so getPublicUrl() works without signed URLs.
 */
const MAINTENANCE_IMAGES_BUCKET = 'maintenance-images'

function extensionFromFile(file: File): string {
  const byName = file.name.split('.').pop()?.toLowerCase()
  if (byName && byName.length <= 5) {
    return byName
  }
  if (file.type.includes('png')) return 'png'
  if (file.type.includes('webp')) return 'webp'
  return 'jpg'
}

/**
 * Translate raw Supabase storage errors into user-friendly messages.
 */
function humaniseStorageError(message: string, bucket: string): string {
  const lower = message.toLowerCase()

  if (lower.includes('bucket not found') || lower.includes('bucketnotfound')) {
    return (
      `Storage bucket "${bucket}" was not found. ` +
      `Please create it in Supabase → Storage → New Bucket → "${bucket}" (Public).`
    )
  }

  if (lower.includes('exceeded') || lower.includes('quota')) {
    return 'Storage quota exceeded. Please contact your administrator.'
  }

  if (lower.includes('unauthorized') || lower.includes('not authorized') || lower.includes('row-level security')) {
    return 'You are not authorised to upload files. Please sign in and try again.'
  }

  if (lower.includes('duplicate') || lower.includes('already exists')) {
    return 'A file with this name already exists. Please try again.'
  }

  return `Upload error: ${message}`
}

export async function uploadMaintenancePhotos(params: {
  supabase: SupabaseClient
  reportId: string
  doorId: string
  files: File[]
  onProgress?: (percent: number) => void
}): Promise<MaintenanceDoorPhoto[]> {
  const { supabase, reportId, doorId, files, onProgress } = params

  if (files.length === 0) return []

  // Sanitise path segments so they don't break storage URLs
  const safeReportId = reportId.replace(/[^a-zA-Z0-9_-]/g, '_')
  const safeDoorId = doorId.replace(/[^a-zA-Z0-9_-]/g, '_')

  const uploaded: MaintenanceDoorPhoto[] = []

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]!
    const timestamp = Date.now()
    const extension = extensionFromFile(file)

    // Path structure: maintenance-images/{report_id}/{door_id}/{timestamp}.jpg
    const path = `${safeReportId}/${safeDoorId}/${timestamp}-${index}.${extension}`

    const { error } = await supabase.storage
      .from(MAINTENANCE_IMAGES_BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'image/jpeg',
      })

    if (error) {
      throw new Error(humaniseStorageError(error.message, MAINTENANCE_IMAGES_BUCKET))
    }

    const { data: publicUrlData } = supabase.storage
      .from(MAINTENANCE_IMAGES_BUCKET)
      .getPublicUrl(path)

    uploaded.push({
      path,
      url: publicUrlData.publicUrl,
    })

    const percent = Math.round(((index + 1) / files.length) * 100)
    onProgress?.(percent)
  }

  return uploaded
}
