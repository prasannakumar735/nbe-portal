import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import {
  checkMaintenanceReportClientGate,
  fetchMaintenanceReportByShareToken,
} from '@/lib/maintenance-reports/clientAccess'
import { createPdfBinaryResponse } from '@/lib/http/pdfBinaryResponse'
import { loadClientPortalPdfScope } from '@/lib/client-portal/loadClientPortalPdfScope'
import { getSingleFeatureFlag } from '@/lib/featureFlags'



export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params
    const accessToken = String(token ?? '').trim()
    if (!accessToken) {
      return NextResponse.json({ error: 'Invalid link' }, { status: 400 })
    }

    const publicAccess = await getSingleFeatureFlag('public_maintenance_reports')

    if (publicAccess) {
      // Public path — token is the only credential; enforce report is approved
      const row = await fetchMaintenanceReportByShareToken(accessToken)
      if (!row) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      if (row.status !== 'approved' || !row.approved) {
        return NextResponse.json({ error: 'Report is not approved for sharing' }, { status: 403 })
      }
      if (!row.pdf_url?.trim()) {
        return NextResponse.json({ error: 'PDF not available' }, { status: 503 })
      }
      const pdfRes = await fetch(row.pdf_url.trim(), { cache: 'no-store' })
      if (!pdfRes.ok) {
        return NextResponse.json({ error: 'Failed to load PDF' }, { status: 502 })
      }
      const buf = Buffer.from(await pdfRes.arrayBuffer())
      return createPdfBinaryResponse(buf, {
        contentDisposition: 'inline; filename="maintenance-inspection-report.pdf"',
        cacheControl: 'private, no-store',
        extraHeaders: { 'X-Robots-Tag': 'noindex, nofollow' },
      })
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

    const row = await fetchMaintenanceReportByShareToken(accessToken)
    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const gate = checkMaintenanceReportClientGate(row, scope.clientId, scope.portalLocationId)
    if (gate === 'not_approved') {
      return NextResponse.json({ error: 'Report is not approved for sharing' }, { status: 403 })
    }
    if (gate === 'no_pdf') {
      return NextResponse.json({ error: 'PDF not available' }, { status: 503 })
    }
    if (gate === 'wrong_client' || gate === 'no_client_profile') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const pdfUrl = row.pdf_url!.trim()
    const pdfRes = await fetch(pdfUrl, { cache: 'no-store' })
    if (!pdfRes.ok) {
      return NextResponse.json({ error: 'Failed to load PDF' }, { status: 502 })
    }

    const buf = Buffer.from(await pdfRes.arrayBuffer())
    return createPdfBinaryResponse(buf, {
      contentDisposition: 'inline; filename="maintenance-inspection-report.pdf"',
      cacheControl: 'private, no-store',
      extraHeaders: {
        'X-Robots-Tag': 'noindex, nofollow',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load report'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
