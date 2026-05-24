import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isManagerOrAdmin } from '@/app/api/job-cards/helpers'
import { loadJobDetailExport, mapJob } from '@/app/api/job-cards/detail'

export const runtime = 'nodejs'

async function technicianIdsForEvent(
  sb: SupabaseClient,
  eventId: string,
  fallbackAssigned?: string | null,
): Promise<string[]> {
  const { data } = await sb.from('calendar_event_assignees').select('user_id').eq('event_id', eventId)
  const rows = data ?? []
  const fromJoin =
    rows.length > 0
      ? [...new Set((rows as { user_id?: string }[]).map(r => String(r.user_id ?? '').trim()).filter(Boolean))]
      : []
  if (fromJoin.length > 0) return fromJoin
  const fb = fallbackAssigned?.trim()
  return fb ? [fb] : []
}

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
      const manager = await isManagerOrAdmin(supabase, user.id)
      const techIds = await technicianIdsForEvent(supabase, eventId, String(row.assigned_to ?? ''))
      const primary = String(row.assigned_to ?? '').trim()
      const roster = [...new Set(techIds.length > 0 ? techIds : primary ? [primary] : [])].filter(Boolean)

      if (roster.length === 0) {
        return NextResponse.json({ error: 'Event has no crew assigned' }, { status: 400 })
      }

      if (!manager && !roster.includes(user.id)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const { data: existingRowsRaw } = await supabase.from('job_cards').select('id, technician_id').eq('event_id', eventId)
      let existingRows = (existingRowsRaw ?? []) as { id: string; technician_id?: string | null }[]

      const pickDetailJobId = (rowsList: { id: string; technician_id?: string | null }[]): string | undefined => {
        const sorted = [...rowsList].sort((a, b) => a.id.localeCompare(b.id))
        const mine = sorted.find(r => r.technician_id === user.id)
        if (mine?.id) return mine.id
        if (manager && sorted[0]?.id) return sorted[0].id
        return undefined
      }

      let pickId = pickDetailJobId(existingRows)
      if (pickId) {
        const detail = await loadJobDetailExport(supabase, pickId)
        return NextResponse.json(detail)
      }

      if (!ensure) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }

      const rosterDedup = roster.filter(Boolean)

      const insertPayloadBase = {
        client_id: (row.client_id as string | null) ?? null,
        location_id: (row.location_id as string | null) ?? null,
        job_title: String(row.title ?? 'Job'),
        job_description: (row.description as string | null) ?? null,
        is_manual: false as const,
        status: 'pending' as const,
      }

      for (const technician_id of rosterDedup) {
        if (!technician_id) continue
        if (existingRows.some(r => r.technician_id === technician_id)) continue
        const { error: insErr } = await supabase
          .from('job_cards')
          .insert({ ...insertPayloadBase, event_id: eventId, technician_id })

        if (insErr?.code !== '23505') {
          if (insErr) {
            console.error('[job-cards ensure]', insErr)
            return NextResponse.json({ error: insErr.message }, { status: 400 })
          }
        }
      }

      const { data: refreshed } = await supabase.from('job_cards').select('id, technician_id').eq('event_id', eventId)
      existingRows = (refreshed ?? []) as typeof existingRows

      pickId = pickDetailJobId(existingRows)
      if (!pickId) {
        return NextResponse.json({ error: 'Could not create job card' }, { status: 400 })
      }

      const detail = await loadJobDetailExport(supabase, pickId)
      return NextResponse.json(detail)
    }

    const manager = await isManagerOrAdmin(supabase, user.id)
    let q = supabase.from('job_cards').select('*').order('updated_at', { ascending: false }).limit(100)
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

      const erow = ev as Record<string, unknown>
      const primary = String(erow.assigned_to ?? '').trim()
      const techIds = await technicianIdsForEvent(supabase, eventId, primary)
      const roster = [...new Set(techIds.length > 0 ? techIds : primary ? [primary] : [])].filter(Boolean)

      if (roster.length === 0) {
        return NextResponse.json({ error: 'Event has no crew assigned' }, { status: 400 })
      }

      if (!manager && !roster.includes(user.id)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const { data: existingRowsRaw } = await supabase.from('job_cards').select('id').eq('event_id', eventId).eq('technician_id', user.id)

      const existingMineId = existingRowsRaw?.[0]?.id as string | undefined
      if (existingMineId) {
        const detail = await loadJobDetailExport(supabase, existingMineId)
        return NextResponse.json(detail, { status: 200 })
      }

      const row = erow

      const { data: created, error: cErr } = await supabase
        .from('job_cards')
        .insert({
          event_id: eventId,
          technician_id: user.id,
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
        if (String(cErr.code) === '23505') {
          const { data: again } = await supabase
            .from('job_cards')
            .select('id')
            .eq('event_id', eventId)
            .eq('technician_id', user.id)
            .maybeSingle()
          if (again?.id) {
            const detail = await loadJobDetailExport(supabase, again.id)
            return NextResponse.json(detail, { status: 200 })
          }
        }
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
