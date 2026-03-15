import { NextRequest, NextResponse } from 'next/server'
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

/** List all file paths under reportId/ in storage (reportId/doorId/filename). */
async function listReportPhotoPaths(
  supabase: ReturnType<typeof createServiceClient>,
  reportId: string,
): Promise<Array<{ path: string; name: string }>> {
  const out: Array<{ path: string; name: string }> = []
  const safeReportId = reportId.replace(/[^a-zA-Z0-9_-]/g, '_')

  const { data: topLevel } = await supabase.storage.from(BUCKET).list(safeReportId, { limit: 500 })
  if (!topLevel?.length) return out

  for (const item of topLevel) {
    if (item.name && item.id) {
      const { data: files } = await supabase.storage
        .from(BUCKET)
        .list(`${safeReportId}/${item.name}`, { limit: 200 })
      if (files) {
        for (const file of files) {
          if (!file.name) continue
          const path = `${safeReportId}/${item.name}/${file.name}`
          out.push({ path, name: file.name })
        }
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

    return NextResponse.json({ photos })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list photos'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
