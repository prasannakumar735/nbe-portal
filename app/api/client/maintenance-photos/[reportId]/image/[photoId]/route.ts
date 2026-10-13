import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { clientCanViewApprovedReportPhotos } from '@/lib/client-portal/clientMaintenancePortal'
import { loadClientPortalPdfScope } from '@/lib/client-portal/loadClientPortalPdfScope'
import { imageUrlToMaintenanceBucketPath } from '@/lib/maintenance/imageUrlToMaintenanceBucketPath'

export const runtime = 'nodejs'

const BUCKET = 'maintenance-images'

function contentTypeForPath(pathOrName: string): string {
  const lower = pathOrName.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  return 'application/octet-stream'
}

function safeFilename(path: string): string {
  const base = path.split('/').pop() || 'photo.jpg'
  return base.replace(/[^\w.\-]+/g, '_').slice(0, 180) || 'photo.jpg'
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string; photoId: string }> },
) {
  try {
    const { reportId, photoId } = await params
    const rid = String(reportId ?? '').trim()
    const pid = String(photoId ?? '').trim()
    if (!rid || !pid) {
      return NextResponse.json({ error: 'Bad request' }, { status: 400 })
    }

    const serverSupabase = await createServerClient()
    const {
      data: { user },
    } = await serverSupabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const scope = await loadClientPortalPdfScope(user.id)
    if (!scope.ok) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const svc = createServiceRoleClient()

    // Single join: fetch photo + door + report access check in parallel
    const [photoResult, accessOk] = await Promise.all([
      svc
        .from('maintenance_photos')
        .select('id, door_id, image_url, maintenance_doors!inner(report_id, maintenance_reports!inner(client_location_id, status, approved, share_token, pdf_url))')
        .eq('id', pid)
        .eq('maintenance_doors.report_id', rid)
        .maybeSingle(),
      clientCanViewApprovedReportPhotos(scope.clientId, rid, scope.portalLocationId),
    ])

    if (!accessOk) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const photoRow = photoResult.data
    if (photoResult.error || !photoRow) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const imageUrl = String((photoRow as { image_url?: string | null }).image_url ?? '').trim()
    if (!imageUrl) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const download = request.nextUrl.searchParams.get('download') === '1'
    const bucketPath = imageUrlToMaintenanceBucketPath(imageUrl)

    let body: Buffer
    let contentType: string

    if (bucketPath) {
      const { data: blob, error: dlErr } = await svc.storage.from(BUCKET).download(bucketPath)
      if (dlErr || !blob) {
        console.error('[client-maintenance-photo] storage download', dlErr)
        return NextResponse.json({ error: 'Failed to load image' }, { status: 502 })
      }
      body = Buffer.from(await blob.arrayBuffer())
      contentType = contentTypeForPath(bucketPath)
    } else {
      const upstream = await fetch(imageUrl, { cache: 'no-store' })
      if (!upstream.ok) {
        return NextResponse.json({ error: 'Failed to load image' }, { status: 502 })
      }
      body = Buffer.from(await upstream.arrayBuffer())
      contentType = upstream.headers.get('content-type')?.split(';')[0]?.trim() || contentTypeForPath(imageUrl)
    }

    const filename = safeFilename(bucketPath || imageUrl)

    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
        'X-Robots-Tag': 'noindex, nofollow',
        ...(download
          ? { 'Content-Disposition': `attachment; filename="${filename}"` }
          : { 'Content-Disposition': `inline; filename="${filename}"` }),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to serve image'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
