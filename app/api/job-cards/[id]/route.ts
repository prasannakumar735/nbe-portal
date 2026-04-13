import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import type { JobCardGpsPayload, JobCardStatus } from '@/lib/job-cards/types'
import { loadJobDetailExport } from '@/app/api/job-cards/detail'

export const runtime = 'nodejs'

type PatchBody = {
  status?: JobCardStatus
  start_time?: string | null
  end_time?: string | null
  gps_start?: JobCardGpsPayload | null
  gps_end?: JobCardGpsPayload | null
  gps_start_address?: string | null
  gps_end_address?: string | null
  notes?: string | null
  job_title?: string | null
  job_description?: string | null
  work_type?: string | null
  client_id?: string | null
  location_id?: string | null
  signature_url?: string | null
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

    const detail = await loadJobDetailExport(supabase, id)
    if (!detail) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(detail)
  } catch (e) {
    console.error('[GET /api/job-cards/[id]]', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
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

    const { data: existing, error: exErr } = await supabase.from('job_cards').select('*').eq('id', id).single()
    if (exErr || !existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = (await req.json()) as PatchBody

    const patch: Record<string, unknown> = {}

    if (body.job_title !== undefined) patch.job_title = body.job_title
    if (body.job_description !== undefined) patch.job_description = body.job_description
    if (body.work_type !== undefined) patch.work_type = body.work_type
    if (body.notes !== undefined) patch.notes = body.notes
    if (body.signature_url !== undefined) patch.signature_url = body.signature_url

    if (body.status !== undefined) patch.status = body.status
    if (body.start_time !== undefined) patch.start_time = body.start_time
    if (body.end_time !== undefined) patch.end_time = body.end_time
    if (body.gps_start !== undefined) patch.gps_start = body.gps_start
    if (body.gps_end !== undefined) patch.gps_end = body.gps_end
    if (body.gps_start_address !== undefined) patch.gps_start_address = body.gps_start_address
    if (body.gps_end_address !== undefined) patch.gps_end_address = body.gps_end_address

    const isManual = Boolean((existing as Record<string, unknown>).is_manual)
    if (isManual) {
      if (body.client_id !== undefined) patch.client_id = body.client_id
      if (body.location_id !== undefined) patch.location_id = body.location_id
    }

    const { data: updated, error: upErr } = await supabase.from('job_cards').update(patch).eq('id', id).select('*').single()

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 400 })
    }

    const detail = await loadJobDetailExport(supabase, String(updated!.id))
    return NextResponse.json(detail)
  } catch (e) {
    console.error('[PATCH /api/job-cards/[id]]', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
