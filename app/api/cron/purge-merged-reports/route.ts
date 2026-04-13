import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { purgeSoftDeletedMergedReportsOlderThan } from '@/lib/merged-reports/deleteMergedReport'

export const runtime = 'nodejs'

const DEFAULT_DAYS = 30

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase service role configuration.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/**
 * Hard-delete soft-deleted merged reports older than N days (storage + DB).
 * Secure with CRON_SECRET: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET?.trim()
    const auth = request.headers.get('authorization')?.trim() ?? ''
    if (!secret || auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const daysParam = request.nextUrl.searchParams.get('days')
    let days = DEFAULT_DAYS
    if (daysParam !== null && daysParam !== '') {
      const n = Number(daysParam)
      if (!Number.isFinite(n)) {
        return NextResponse.json({ error: 'Invalid days' }, { status: 400 })
      }
      days = Math.max(1, Math.min(365, Math.floor(n)))
    }

    const supabase = createServiceClient()
    const result = await purgeSoftDeletedMergedReportsOlderThan(supabase, days)

    return NextResponse.json({
      ok: true,
      older_than_days: days,
      purged: result.purged,
      errors: result.errors,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Purge failed'
    console.error('[cron/purge-merged-reports]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
