import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import { canApproveMaintenanceReport } from '@/lib/auth/roles'

export const runtime = 'nodejs'

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase service role configuration.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function GET(request: NextRequest) {
  try {
    const serverSupabase = await createServerClient()
    const { data: { user } } = await serverSupabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await serverSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!canApproveMaintenanceReport(profile as { role?: string } | null)) {
      return NextResponse.json({ error: 'Forbidden. Manager or admin only.' }, { status: 403 })
    }

    const scope = (request.nextUrl.searchParams.get('scope') ?? 'active').toLowerCase()
    const isDeletedScope = scope === 'deleted'

    const supabase = createServiceClient()

    let query = supabase
      .from('merged_reports')
      .select(
        'id, client_id, client_name, report_ids, created_by, created_at, file_url, pdf_url, access_expires_at, deleted_at, deleted_by',
      )
      .order('created_at', { ascending: false })
      .limit(isDeletedScope ? 100 : 200)

    query = isDeletedScope ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null)

    const { data: merged, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const clientIds = [...new Set((merged ?? []).map(r => r.client_id).filter(Boolean))] as string[]
    const { data: clients } = clientIds.length
      ? await supabase.from('clients').select('id, name').in('id', clientIds)
      : { data: [] as Array<{ id: string; name?: string }> }

    const clientMap = new Map((clients ?? []).map(c => [c.id, c]))

    const list = (merged ?? []).map((r) => {
      const c = r.client_id ? clientMap.get(r.client_id) : null
      const clientName = c ? String((c as { name?: string }).name ?? '').trim() : ''
      return {
        id: r.id,
        client_id: r.client_id,
        client_name: String(r.client_name ?? '').trim() || clientName || '—',
        report_ids: r.report_ids ?? [],
        created_by: r.created_by,
        created_at: r.created_at,
        file_url: r.file_url ?? null,
        pdf_url: (r as { pdf_url?: string | null }).pdf_url ?? null,
        access_expires_at: (r as { access_expires_at?: string | null }).access_expires_at ?? null,
        deleted_at: (r as { deleted_at?: string | null }).deleted_at ?? null,
        deleted_by: (r as { deleted_by?: string | null }).deleted_by ?? null,
      }
    })

    return NextResponse.json({ merged_reports: list, scope: isDeletedScope ? 'deleted' : 'active' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch merged reports'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

