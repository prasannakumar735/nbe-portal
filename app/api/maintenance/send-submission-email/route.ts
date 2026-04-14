import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { notifyManagersOfReportSubmission } from '@/lib/maintenance/reportWorkflowEmail'

export const runtime = 'nodejs'

function createSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Missing Supabase service role configuration.')
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { report_id?: string; reportId?: string }
    const reportId = body.report_id ?? body.reportId

    if (!reportId || typeof reportId !== 'string') {
      return NextResponse.json({ error: 'report_id or reportId is required.' }, { status: 400 })
    }

    const supabase = createSupabaseClient()
    const result = await notifyManagersOfReportSubmission(supabase, reportId)

    if (result.status === 'failed') {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    if (result.status === 'skipped') {
      return NextResponse.json({
        success: true,
        report_id: reportId,
        skipped: true,
        reason: result.reason,
      })
    }

    return NextResponse.json({
      success: true,
      report_id: reportId,
      recipients: result.recipients,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send submission email.'
    console.error('[send-submission-email]', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
