import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import {
  checkMaintenanceReportClientGate,
  fetchMaintenanceReportByShareToken,
} from '@/lib/maintenance-reports/clientAccess'
import { createPdfBinaryResponse } from '@/lib/http/pdfBinaryResponse'

export const runtime = 'nodejs'

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

    const serverSupabase = await createServerClient()
    const {
      data: { user },
    } = await serverSupabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await serverSupabase
      .from('profiles')
      .select('role, client_id')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.role !== 'client') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const userClientId = profile.client_id ? String(profile.client_id) : null
    const row = await fetchMaintenanceReportByShareToken(accessToken)
    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const gate = checkMaintenanceReportClientGate(row, userClientId)
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
