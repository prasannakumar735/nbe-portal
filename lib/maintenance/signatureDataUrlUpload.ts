import type { SupabaseClient } from '@supabase/supabase-js'

export function isDataUrlForUpload(value: string): boolean {
  return typeof value === 'string' && value.startsWith('data:') && value.includes('base64,')
}

/** Upload a PNG/data-URL signature to `maintenance-images` and return public URL, or null on failure. */
export async function uploadSignatureDataUrlToStorage(
  supabase: SupabaseClient,
  dataUrl: string,
  pathPrefix: string,
): Promise<string | null> {
  if (!isDataUrlForUpload(dataUrl)) return null
  const match = dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/)
  if (!match) return null
  const contentType = match[1] || 'image/png'
  const base64 = match[2]?.replace(/\s/g, '') ?? ''
  if (!base64) return null
  const buffer = Buffer.from(base64, 'base64')
  const sigPath = `signatures/${pathPrefix}/${crypto.randomUUID()}.png`
  const { error } = await supabase.storage.from('maintenance-images').upload(sigPath, buffer, {
    contentType: contentType || 'image/png',
    upsert: true,
  })
  if (error) return null
  return supabase.storage.from('maintenance-images').getPublicUrl(sigPath).data.publicUrl
}
