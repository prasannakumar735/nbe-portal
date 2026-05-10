import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const clientId = request.nextUrl.searchParams.get('clientId')?.trim()
    if (!clientId) {
      return NextResponse.json({ subProjects: [] as { id: string; name: string }[] })
    }

    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('client_sub_projects')
      .select('id, name, sort_order')
      .eq('client_id', clientId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      console.error('[GET /api/clients/sub-projects]', error.message)
      return NextResponse.json({ subProjects: [] })
    }

    const subProjects = (data ?? []).map(row => ({
      id: String(row.id ?? ''),
      name: String(row.name ?? '').trim() || '—',
    })).filter(r => r.id)

    return NextResponse.json({ subProjects })
  } catch (e) {
    console.error('[GET /api/clients/sub-projects]', e)
    return NextResponse.json({ subProjects: [] })
  }
}
