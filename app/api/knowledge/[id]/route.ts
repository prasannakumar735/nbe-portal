import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { KNOWLEDGE_MEDIA_BUCKET } from '@/lib/storage/knowledgeBucket'

export const runtime = 'nodejs'

async function loadArticle(supabase: Awaited<ReturnType<typeof createServerClient>>, id: string) {
  const { data: article, error } = await supabase.from('knowledge_articles').select('*').eq('id', id).maybeSingle()
  if (error || !article) return null

  const { data: media } = await supabase.from('knowledge_media').select('*').eq('article_id', id)

  const service = createServiceRoleClient()
  const mediaSigned = await Promise.all(
    (media ?? []).map(async m => {
      const row = m as Record<string, unknown>
      const raw = String(row.media_url ?? '')
      let url = raw
      if (raw && !raw.startsWith('http')) {
        const { data: signed } = await service.storage.from(KNOWLEDGE_MEDIA_BUCKET).createSignedUrl(raw, 60 * 60 * 24 * 7)
        url = signed?.signedUrl ?? raw
      }
      return { ...row, media_url: url }
    }),
  )

  return { article, media: mediaSigned }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const detail = await loadArticle(supabase, id)
    if (!detail) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(detail)
  } catch (e) {
    console.error('[GET /api/knowledge/[id]]', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

type PatchBody = {
  title?: string
  content?: string
  category?: string
  tags?: string[]
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json()) as PatchBody
    const patch: Record<string, unknown> = {}
    if (body.title !== undefined) patch.title = body.title
    if (body.content !== undefined) patch.content = body.content
    if (body.category !== undefined) patch.category = body.category
    if (body.tags !== undefined) patch.tags = body.tags

    const { data, error } = await supabase.from('knowledge_articles').update(patch).eq('id', id).select('*').maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (!data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const detail = await loadArticle(supabase, id)
    return NextResponse.json(detail)
  } catch (e) {
    console.error('[PATCH /api/knowledge/[id]]', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase.from('knowledge_articles').delete().eq('id', id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[DELETE /api/knowledge/[id]]', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
