import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { listMaintenanceReportPhotoStoragePaths } from '@/lib/maintenance/listMaintenanceReportPhotoStoragePaths'
import { clientCanViewApprovedReportPhotos } from '@/lib/client-portal/clientMaintenancePortal'
import { loadClientPortalPdfScope } from '@/lib/client-portal/loadClientPortalPdfScope'

export const runtime = 'nodejs'

const BUCKET = 'maintenance-images'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  try {
    const { reportId } = await params
    const rid = String(reportId ?? '').trim()
    if (!rid) {
      return NextResponse.json({ error: 'Report ID required' }, { status: 400 })
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

    const allowed = await clientCanViewApprovedReportPhotos(scope.clientId, rid, scope.portalLocationId)
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const doorRowsParam = request.nextUrl.searchParams.get('doorRows')?.trim() ?? ''
    const maintenanceDoorRowIds = doorRowsParam
      ? doorRowsParam
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
      : null

    if (maintenanceDoorRowIds?.length) {
      const svc = createServiceRoleClient()
      const { data: rows } = await svc
        .from('maintenance_doors')
        .select('id')
        .eq('report_id', rid)
        .in('id', maintenanceDoorRowIds)

      const okIds = new Set((rows ?? []).map(r => String((r as { id?: string }).id ?? '').trim()).filter(Boolean))
      for (const id of maintenanceDoorRowIds) {
        if (!okIds.has(id)) {
          return NextResponse.json({ error: 'Invalid door scope' }, { status: 400 })
        }
      }
    }

    const supabase = createServiceRoleClient()
    const photos = await listMaintenanceReportPhotoStoragePaths(supabase, rid, {
      maintenanceDoorRowIds: maintenanceDoorRowIds ?? undefined,
    })

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
    const filename = `maintenance-photos-${rid.slice(0, 8)}.zip`

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
