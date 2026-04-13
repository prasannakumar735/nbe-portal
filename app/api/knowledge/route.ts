import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const qRaw = req.nextUrl.searchParams.get('q')?.trim()
    const q = qRaw ? qRaw.replace(/[^a-zA-Z0-9\s'-]/g, '').slice(0, 120) : ''
    const category = req.nextUrl.searchParams.get('category')?.trim()
    const tag = req.nextUrl.searchParams.get('tag')?.trim()

    let query = supabase.from('knowledge_articles').select('*').order('updated_at', { ascending: false }).limit(200)

    if (category) {
      query = query.eq('category', category)
    }
    if (tag) {
      query = query.contains('tags', [tag])
    }
    if (q) {
      query = query.textSearch('search_vector', q, {
        type: 'websearch',
        config: 'english',
      })
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ articles: data ?? [] })
  } catch (e) {
    console.error('[GET /api/knowledge]', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

type CreateBody = {
  title?: string
  content?: string
  category?: string
  tags?: string[]
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json()) as CreateBody
    const title = String(body.title ?? '').trim()
    if (!title) {
      return NextResponse.json({ error: 'title required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('knowledge_articles')
      .insert({
        title,
        content: body.content ?? '',
        category: body.category?.trim() || 'General',
        tags: Array.isArray(body.tags) ? body.tags.map(t => String(t).trim()).filter(Boolean) : [],
        created_by: user.id,
      })
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ article: data }, { status: 201 })
  } catch (e) {
    console.error('[POST /api/knowledge]', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
