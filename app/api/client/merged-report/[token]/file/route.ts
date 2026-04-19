import { NextRequest, NextResponse } from 'next/server'
import { unauthorizedOrForbiddenResponse } from '@/lib/security/httpAuthErrors'
import { requireUser } from '@/lib/security/requireUser'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import {
  checkMergedReportClientGate,
  fetchMergedReportByAccessToken,
} from '@/lib/merged-reports/serverAccess'
import { MERGED_MAINTENANCE_REPORTS_BUCKET } from '@/lib/merged-reports/storage'
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
    const user = await requireUser(serverSupabase)

    const { data: profile } = await serverSupabase
      .from('profiles')
      .select('role, client_id')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.role !== 'client') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const userClientId = profile.client_id ? String(profile.client_id) : null
    const row = await fetchMergedReportByAccessToken(accessToken)
    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const gate = checkMergedReportClientGate(row, userClientId)
    if (gate === 'expired') {
      return NextResponse.json({ error: 'This link has expired' }, { status: 410 })
    }
    if (gate === 'wrong_client' || gate === 'no_client_profile') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!row.pdf_storage_path) {
      return NextResponse.json({ error: 'PDF not available' }, { status: 503 })
    }

    const service = createServiceRoleClient()
    const { data: blob, error: dlErr } = await service.storage
      .from(MERGED_MAINTENANCE_REPORTS_BUCKET)
      .download(row.pdf_storage_path)

    if (dlErr || !blob) {
      return NextResponse.json({ error: 'Failed to load PDF' }, { status: 500 })
    }

    const buf = Buffer.from(await blob.arrayBuffer())
    return createPdfBinaryResponse(buf, {
      contentDisposition: 'inline; filename="merged-report.pdf"',
      cacheControl: 'private, no-store',
      extraHeaders: {
        'X-Robots-Tag': 'noindex, nofollow',
      },
    })
  } catch (err) {
    const auth = unauthorizedOrForbiddenResponse(err)
    if (auth) return auth
    const message = err instanceof Error ? err.message : 'Failed to load report'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
