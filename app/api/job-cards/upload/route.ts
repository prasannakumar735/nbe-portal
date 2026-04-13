import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { JOB_CARD_IMAGE_BUCKET } from '@/lib/storage/jobCardBucket'

export const runtime = 'nodejs'

const BUCKET = JOB_CARD_IMAGE_BUCKET

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const form = await req.formData()
    const jobCardId = String(form.get('job_card_id') ?? '').trim()
    const asSignature = String(form.get('as_signature') ?? '') === '1' || String(form.get('as_signature') ?? '') === 'true'
    const file = form.get('file')
    if (!jobCardId || !(file instanceof File)) {
      return NextResponse.json({ error: 'job_card_id and file required' }, { status: 400 })
    }

    const { data: job, error: jErr } = await supabase.from('job_cards').select('id, technician_id').eq('id', jobCardId).single()
    if (jErr || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    if (job.technician_id !== user.id) {
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      const r = String(prof?.role ?? '')
      if (r !== 'admin' && r !== 'manager') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const buf = Buffer.from(await file.arrayBuffer())
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg'
    const path = `${jobCardId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`

    const service = createServiceRoleClient()
    const { error: upErr } = await service.storage.from(BUCKET).upload(path, buf, {
      contentType: file.type || `image/${safeExt === 'jpg' ? 'jpeg' : safeExt}`,
      upsert: false,
    })
    if (upErr) {
      console.error('[job-cards upload]', upErr)
      return NextResponse.json({ error: upErr.message }, { status: 400 })
    }

    const { data: signed, error: signErr } = await service.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365)
    const displayUrl = signed?.signedUrl ?? path

    if (asSignature) {
      const { error: sigErr } = await supabase.from('job_cards').update({ signature_url: path }).eq('id', jobCardId)
      if (sigErr) {
        return NextResponse.json({ error: sigErr.message }, { status: 400 })
      }
      return NextResponse.json({
        signature_url: displayUrl,
        storage_path: path,
      })
    }

    const { data: row, error: insErr } = await supabase
      .from('job_card_images')
      .insert({ job_card_id: jobCardId, image_url: path })
      .select('*')
      .single()

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 400 })
    }

    return NextResponse.json({
      image: {
        ...row,
        image_url: displayUrl,
        storage_path: path,
      },
    })
  } catch (e) {
    console.error('[POST /api/job-cards/upload]', e)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
