import { NextRequest, NextResponse } from 'next/server'
import { unauthorizedOrForbiddenResponse } from '@/lib/security/httpAuthErrors'
import { requireUser } from '@/lib/security/requireUser'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { KNOWLEDGE_MEDIA_BUCKET } from '@/lib/storage/knowledgeBucket'
import type { KnowledgeMediaType } from '@/lib/knowledge/types'

export const runtime = 'nodejs'

function guessMediaType(file: File): KnowledgeMediaType {
  const t = (file.type || '').toLowerCase()
  if (t.startsWith('video/')) return 'video'
  if (t === 'application/pdf') return 'pdf'
  if (t.startsWith('image/')) return 'image'
  return 'other'
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const user = await requireUser(supabase)

    const form = await req.formData()
    const articleId = String(form.get('article_id') ?? '').trim()
    const file = form.get('file')
    if (!articleId || !(file instanceof File)) {
      return NextResponse.json({ error: 'article_id and file required' }, { status: 400 })
    }

    const { data: article, error: aErr } = await supabase.from('knowledge_articles').select('id, created_by').eq('id', articleId).single()
    if (aErr || !article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    if (article.created_by !== user.id) {
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      const r = String(prof?.role ?? '')
      if (r !== 'admin' && r !== 'manager') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const buf = Buffer.from(await file.arrayBuffer())
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().slice(0, 8)
    const path = `${articleId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const service = createServiceRoleClient()
    const { error: upErr } = await service.storage.from(KNOWLEDGE_MEDIA_BUCKET).upload(path, buf, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 400 })
    }

    const mediaType = guessMediaType(file)

    const { data: row, error: insErr } = await supabase
      .from('knowledge_media')
      .insert({ article_id: articleId, media_url: path, type: mediaType })
      .select('*')
      .single()

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 400 })
    }

    const { data: signed } = await service.storage.from(KNOWLEDGE_MEDIA_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7)

    return NextResponse.json({
      media: {
        ...row,
        media_url: signed?.signedUrl ?? path,
        storage_path: path,
      },
    })
  } catch (e) {
    const auth = unauthorizedOrForbiddenResponse(e)
    if (auth) return auth
    console.error('[POST /api/knowledge/upload]', e)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
