import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

function tokenize(title: string, workType: string | null): string[] {
  const raw = `${title} ${workType ?? ''}`.toLowerCase()
  const parts = raw.split(/[^a-z0-9]+/i).filter(w => w.length > 2)
  return [...new Set(parts)].slice(0, 12)
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const jobTitle = req.nextUrl.searchParams.get('job_title')?.trim() ?? ''
    const workType = req.nextUrl.searchParams.get('work_type')?.trim() ?? null
    const tokens = tokenize(jobTitle, workType)
    if (tokens.length === 0) {
      return NextResponse.json({ articles: [] })
    }

    const orFilter = tokens.map(t => `title.ilike.%${t}%`).join(',')
    const { data, error } = await supabase
      .from('knowledge_articles')
      .select('id, title, category, tags, updated_at')
      .or(orFilter)
      .order('updated_at', { ascending: false })
      .limit(12)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ articles: data ?? [] })
  } catch (e) {
    console.error('[GET /api/knowledge/suggested]', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
