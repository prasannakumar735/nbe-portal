import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const BUCKET = 'maintenance-images'

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase service role configuration.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function listReportPhotoPaths(
  supabase: ReturnType<typeof createServiceClient>,
  reportId: string,
): Promise<Array<{ path: string; name: string }>> {
  const out: Array<{ path: string; name: string }> = []
  const seen = new Set<string>()

  const addPath = (path: string) => {
    const normalized = String(path || '').trim().replace(/^\/+/, '')
    if (!normalized || seen.has(normalized)) return
    const name = normalized.split('/').pop() || `photo-${seen.size + 1}`
    seen.add(normalized)
    out.push({ path: normalized, name })
  }

  const storagePublicPrefix = '/storage/v1/object/public'
  const bucketSegment = `/${BUCKET}/`

  const { data: doorRows } = await supabase
    .from('maintenance_doors')
    .select('id')
    .eq('report_id', reportId)

  const doorIds = (doorRows ?? [])
    .map(row => String((row as { id?: string | null }).id ?? '').trim())
    .filter(Boolean)

  if (doorIds.length > 0) {
    const { data: photoRows } = await supabase
      .from('maintenance_photos')
      .select('image_url')
      .in('door_id', doorIds)

    for (const row of (photoRows ?? [])) {
      const imageUrl = String((row as { image_url?: string | null }).image_url ?? '').trim()
      if (!imageUrl) continue

      if (/^https?:\/\//i.test(imageUrl)) {
        const marker = `${storagePublicPrefix}${bucketSegment}`
        const markerIndex = imageUrl.indexOf(marker)
        if (markerIndex >= 0) {
          addPath(imageUrl.slice(markerIndex + marker.length))
        }
      } else {
        addPath(imageUrl)
      }
    }
  }

  if (out.length > 0) {
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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  try {
    const { reportId } = await params
    if (!reportId) {
      return NextResponse.json({ error: 'Report ID required' }, { status: 400 })
    }

    const serverSupabase = await createServerClient()
    const { data: { user } } = await serverSupabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()
    const photos = await listReportPhotoPaths(supabase, reportId)
    if (photos.length === 0) {
      return NextResponse.json({ error: 'No photos found for this report' }, { status: 404 })
    }

    const zip = new JSZip()
    for (let i = 0; i < photos.length; i += 1) {
      const { path, name } = photos[i]!
      const { data, error } = await supabase.storage.from(BUCKET).download(path)
      if (error || !data) continue
      const buffer = Buffer.from(await data.arrayBuffer())
      const zipName = photos.length > 1 ? `photo-${i + 1}-${name}` : name
      zip.file(zipName, buffer)
    }

    const zipBlob = await zip.generateAsync({ type: 'nodebuffer' })
    const filename = `maintenance-photos-${reportId.slice(0, 8)}.zip`

    return new NextResponse(new Uint8Array(zipBlob), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(zipBlob.length),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create photos zip'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
