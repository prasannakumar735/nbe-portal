import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { isManagerOrAdmin } from '@/app/api/job-cards/helpers'
import { loadJobDetailExport, mapJob } from '@/app/api/job-cards/detail'

export const runtime = 'nodejs'

/**
 * GET /api/job-cards?event_id=UUID&ensure=1
 * Lists job cards for current technician (optional) or fetches by event.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const eventId = req.nextUrl.searchParams.get('event_id')?.trim()
    const ensure = req.nextUrl.searchParams.get('ensure') === '1' || req.nextUrl.searchParams.get('ensure') === 'true'

    if (eventId) {
      const { data: existing } = await supabase.from('job_cards').select('id').eq('event_id', eventId).maybeSingle()

      if (existing?.id) {
        const detail = await loadJobDetailExport(supabase, existing.id)
        return NextResponse.json(detail)
      }

      if (!ensure) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }

      const { data: ev, error: evErr } = await supabase
        .from('calendar_events')
        .select(
          'id, title, description, assigned_to, client_id, location_id, clients ( name ), client_locations ( location_name, suburb, Company_address )',
        )
        .eq('id', eventId)
        .single()

      if (evErr || !ev) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 })
      }

      const row = ev as Record<string, unknown>
      const assignee = String(row.assigned_to ?? '')
      const manager = await isManagerOrAdmin(supabase, user.id)
      if (assignee !== user.id && !manager) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const insertPayload = {
        event_id: eventId,
        technician_id: assignee,
        client_id: (row.client_id as string | null) ?? null,
        location_id: (row.location_id as string | null) ?? null,
        job_title: String(row.title ?? 'Job'),
        job_description: (row.description as string | null) ?? null,
        is_manual: false,
        status: 'pending' as const,
      }

      const { data: created, error: cErr } = await supabase.from('job_cards').insert(insertPayload).select('*').single()

      if (cErr) {
        if (String(cErr.code) === '23505') {
          const { data: again } = await supabase.from('job_cards').select('id').eq('event_id', eventId).maybeSingle()
          if (again?.id) {
            const detail = await loadJobDetailExport(supabase, again.id)
            return NextResponse.json(detail)
          }
        }
        console.error('[POST job-cards create]', cErr)
        return NextResponse.json({ error: cErr.message }, { status: 400 })
      }

      const detail = await loadJobDetailExport(supabase, String(created!.id))
      return NextResponse.json(detail)
    }

    const manager = await isManagerOrAdmin(supabase, user.id)
    let q = supabase
      .from('job_cards')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(100)
    if (!manager) {
      q = q.eq('technician_id', user.id)
    }

    const { data: rows, error } = await q
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ jobs: (rows ?? []).map(r => mapJob(r as Record<string, unknown>)) })
  } catch (e) {
    console.error('[GET /api/job-cards]', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

type CreateBody = {
  event_id?: string
  is_manual?: boolean
  job_title?: string
  job_description?: string | null
  client_id?: string | null
  location_id?: string | null
  work_type?: string | null
  technician_id?: string | null
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
    const manager = await isManagerOrAdmin(supabase, user.id)

    if (body.event_id) {
      const eventId = String(body.event_id)
      const { data: ev, error: evErr } = await supabase
        .from('calendar_events')
        .select('assigned_to, title, description, client_id, location_id')
        .eq('id', eventId)
        .single()

      if (evErr || !ev) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 })
      }

      const assignee = String((ev as Record<string, unknown>).assigned_to ?? '')
      if (assignee !== user.id && !manager) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const { data: dup } = await supabase.from('job_cards').select('id').eq('event_id', eventId).maybeSingle()
      if (dup?.id) {
        const detail = await loadJobDetailExport(supabase, dup.id)
        return NextResponse.json(detail, { status: 200 })
      }

      const row = ev as Record<string, unknown>
      const { data: created, error: cErr } = await supabase
        .from('job_cards')
        .insert({
          event_id: eventId,
          technician_id: assignee,
          client_id: (row.client_id as string | null) ?? null,
          location_id: (row.location_id as string | null) ?? null,
          job_title: String(row.title ?? 'Job'),
          job_description: (row.description as string | null) ?? null,
          is_manual: false,
          status: 'pending',
        })
        .select('*')
        .single()

      if (cErr) {
        return NextResponse.json({ error: cErr.message }, { status: 400 })
      }
      const detail = await loadJobDetailExport(supabase, String(created!.id))
      return NextResponse.json(detail, { status: 201 })
    }

    const isManual = Boolean(body.is_manual)
    if (!isManual) {
      return NextResponse.json({ error: 'event_id or is_manual required' }, { status: 400 })
    }

    const techId = body.technician_id?.trim() || user.id
    if (techId !== user.id && !manager) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const title = String(body.job_title ?? '').trim()
    if (!title) {
      return NextResponse.json({ error: 'job_title required' }, { status: 400 })
    }

    const { data: created, error: cErr } = await supabase
      .from('job_cards')
      .insert({
        event_id: null,
        technician_id: techId,
        client_id: body.client_id ?? null,
        location_id: body.location_id ?? null,
        job_title: title,
        job_description: body.job_description ?? null,
        work_type: body.work_type ?? null,
        is_manual: true,
        status: 'pending',
      })
      .select('*')
      .single()

    if (cErr) {
      return NextResponse.json({ error: cErr.message }, { status: 400 })
    }

    const detail = await loadJobDetailExport(supabase, String(created!.id))
    return NextResponse.json(detail, { status: 201 })
  } catch (e) {
    console.error('[POST /api/job-cards]', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
