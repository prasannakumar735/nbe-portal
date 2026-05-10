const BUCKET = 'maintenance-images'
const storagePublicPrefix = '/storage/v1/object/public'
const bucketSegment = `/${BUCKET}/`

/**
 * Maps a stored `maintenance_photos.image_url` value to a bucket object path, when it points at our public bucket.
 * Returns null for unrelated HTTPS URLs (caller may fetch upstream separately).
 */
export function imageUrlToMaintenanceBucketPath(imageUrl: string): string | null {
  const s = String(imageUrl ?? '').trim()
  if (!s) return null
  if (!/^https?:\/\//i.test(s)) {
    return s.replace(/^\/+/, '')
  }
  const marker = `${storagePublicPrefix}${bucketSegment}`
  const idx = s.indexOf(marker)
  if (idx >= 0) {
    return s.slice(idx + marker.length).trim().replace(/^\/+/, '')
  }
  return null
}
