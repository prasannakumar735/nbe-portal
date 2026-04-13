import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { computeEntryTotalHours } from '@/lib/timecard/computeHours'
import {
  getAddressFromLatLng,
  NOMINATIM_MIN_INTERVAL_MS,
  sleep,
} from '@/lib/timecard/reverseGeocode'
import { weekEndFromStart } from '@/lib/timecard/weekDates'
import {
  latLngColumnsFromPoints,
  mergeGpsPointFromRow,
  warnIfIdenticalStartEnd,
} from '@/lib/timecard/gpsDbColumns'
import type { EmployeeTimesheetEntry, GpsAddressMeta } from '@/lib/types/employee-timesheet.types'
import { fetchIsManagerOrAdmin } from '@/lib/auth/supabase-role'
import {
  dedupeTimesheetEntriesById,
  findDuplicateEntryIds,
} from '@/lib/timecard/dedupeTimesheetEntries'

export const runtime = 'nodejs'

function normalizeTime(value: unknown): string {
  if (typeof value !== 'string') return '09:00'
  return value.trim().slice(0, 5)
}

function mapRowToEntry(row: Record<string, unknown>): EmployeeTimesheetEntry {
  const gps_start = mergeGpsPointFromRow(row.gps_start, row.gps_start_lat, row.gps_start_lng)
  const gps_end = mergeGpsPointFromRow(row.gps_end, row.gps_end_lat, row.gps_end_lng)
  return {
    id: String(row.id),
    timesheet_id: row.timesheet_id ? String(row.timesheet_id) : null,
    entry_date: String(row.entry_date ?? '').slice(0, 10),
    client_id: row.client_id ? String(row.client_id) : null,
    location_id: row.location_id ? String(row.location_id) : null,
    work_type_level1_id: row.work_type_level1_id ? String(row.work_type_level1_id) : null,
    work_type_level2_id: row.work_type_level2_id ? String(row.work_type_level2_id) : null,
    task: String(row.task ?? ''),
    start_time: normalizeTime(row.start_time),
    end_time: normalizeTime(row.end_time),
    break_minutes: Number(row.break_minutes ?? 0) || 0,
    total_hours: Number(row.total_hours ?? 0) || 0,
    billable: Boolean(row.billable),
    notes: String(row.notes ?? ''),
    gps_start,
    gps_end,
    gps_start_address: row.gps_start_address != null ? String(row.gps_start_address) : null,
    gps_start_meta: (row.gps_start_meta as GpsAddressMeta | null) ?? null,
    gps_end_address: row.gps_end_address != null ? String(row.gps_end_address) : null,
    gps_end_meta: (row.gps_end_meta as GpsAddressMeta | null) ?? null,
    sort_order: Number(row.sort_order ?? 0) || 0,
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  }
}

export async function GET(request: NextRequest) {
  try {
    const weekStart = request.nextUrl.searchParams.get('weekStart')
    if (!weekStart) {
      return NextResponse.json({ error: 'weekStart is required' }, { status: 400 })
    }

    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const forUserId = request.nextUrl.searchParams.get('forUserId')?.trim() || null
    const targetUserId = forUserId && forUserId !== user.id ? forUserId : user.id

    if (targetUserId !== user.id) {
      const ok = await fetchIsManagerOrAdmin(supabase, user.id)
      if (!ok) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const { data: sheet, error: sheetError } = await supabase
      .from('employee_weekly_timesheets')
      .select('*')
      .eq('user_id', targetUserId)
      .eq('week_start_date', weekStart)
      .maybeSingle()

    if (sheetError) {
      throw sheetError
    }

    if (!sheet) {
      return NextResponse.json({ timesheet: null, entries: [] as EmployeeTimesheetEntry[] })
    }

    const { data: rows, error: entError } = await supabase
      .from('employee_timesheet_entries')
      .select('*')
      .eq('timesheet_id', sheet.id)
      .order('entry_date', { ascending: true })
      .order('sort_order', { ascending: true })

    if (entError) {
      throw entError
    }

    const merged = dedupeTimesheetEntriesById(
      (rows ?? []).map(r => mapRowToEntry(r as Record<string, unknown>)),
    )
    merged.sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.sort_order - b.sort_order)
    return NextResponse.json({ timesheet: sheet, entries: merged })
  } catch (e) {
    console.error('[GET /api/timecard/week]', e)
    return NextResponse.json({ error: 'Failed to load timesheet' }, { status: 500 })
  }
}

type SaveBody = {
  weekStart: string
  entries: EmployeeTimesheetEntry[]
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SaveBody
    const weekStart = String(body.weekStart ?? '').trim()
    const entriesRaw = Array.isArray(body.entries) ? body.entries : []
    const dupPayload = findDuplicateEntryIds(entriesRaw as { id: string }[])
    if (dupPayload.size > 0) {
      console.warn('[POST /api/timecard/week] duplicate entry ids in payload (deduped):', [...dupPayload])
    }
    const entries = dedupeTimesheetEntriesById(entriesRaw as EmployeeTimesheetEntry[])

    if (!weekStart) {
      return NextResponse.json({ error: 'weekStart is required' }, { status: 400 })
    }

    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const weekEnd = weekEndFromStart(weekStart)

    let { data: sheet } = await supabase
      .from('employee_weekly_timesheets')
      .select('*')
      .eq('user_id', user.id)
      .eq('week_start_date', weekStart)
      .maybeSingle()

    if (sheet && sheet.status !== 'draft' && sheet.status !== 'rejected') {
      return NextResponse.json({ error: 'Timesheet is locked' }, { status: 409 })
    }

    if (!sheet) {
      const { data: created, error: insErr } = await supabase
        .from('employee_weekly_timesheets')
        .insert({
          user_id: user.id,
          week_start_date: weekStart,
          week_end_date: weekEnd,
          total_hours: 0,
          billable_hours: 0,
          status: 'draft',
        })
        .select()
        .single()

      if (insErr) {
        throw insErr
      }
      sheet = created
    }

    if (!sheet?.id) {
      return NextResponse.json({ error: 'Timesheet not available' }, { status: 500 })
    }

    for (let i = 0; i < entries.length; i += 1) {
      const e = entries[i]
      const { hours, error: calcErr } = computeEntryTotalHours(e.start_time, e.end_time, e.break_minutes)
      if (calcErr) {
        return NextResponse.json({ error: calcErr }, { status: 400 })
      }
      if (Math.abs(hours - Number(e.total_hours ?? 0)) > 0.02) {
        return NextResponse.json({ error: 'Total hours do not match start/end/break' }, { status: 400 })
      }
    }

    const { data: existingRows } = await supabase
      .from('employee_timesheet_entries')
      .select('id')
      .eq('timesheet_id', sheet.id)

    const incomingIds = new Set(entries.map(e => e.id).filter(Boolean))
    for (const row of existingRows ?? []) {
      const id = String((row as { id?: string }).id ?? '')
      if (id && !incomingIds.has(id)) {
        const { error: delErr } = await supabase.from('employee_timesheet_entries').delete().eq('id', id)
        if (delErr) {
          throw delErr
        }
      }
    }

    const rateLimitNom = !process.env.GOOGLE_MAPS_GEOCODING_API_KEY
    let geocodeDelay = false
    const runGeocode = async (lat: number, lng: number) => {
      if (geocodeDelay && rateLimitNom) {
        await sleep(NOMINATIM_MIN_INTERVAL_MS)
      }
      geocodeDelay = true
      return getAddressFromLatLng(lat, lng)
    }

    /** Site → client when the line has location but client was left null (fixes Reports client column). */
    const locIdsForClient = [
      ...new Set(
        entries.filter(e => !e.client_id && e.location_id).map(e => String(e.location_id))
      ),
    ]
    const locationIdToClientId = new Map<string, string>()
    if (locIdsForClient.length > 0) {
      const { data: locRows, error: locLookupErr } = await supabase
        .from('client_locations')
        .select('id, client_id')
        .in('id', locIdsForClient)
      if (locLookupErr) {
        console.warn('[POST /api/timecard/week] client_locations for client_id:', locLookupErr.message)
      } else {
        for (const lr of locRows ?? []) {
          const row = lr as { id: string; client_id: string | null }
          if (row.client_id) locationIdToClientId.set(String(row.id), String(row.client_id))
        }
      }
    }

    for (let i = 0; i < entries.length; i += 1) {
      let e = entries[i]

      if (!e.client_id && e.location_id) {
        const cid = locationIdToClientId.get(String(e.location_id))
        if (cid) {
          e = { ...e, client_id: cid }
        }
      }

      if (e.gps_start && !(e.gps_start_address ?? '').trim()) {
        const r = await runGeocode(e.gps_start.lat, e.gps_start.lng)
        if (r.ok) {
          e = {
            ...e,
            gps_start_address: r.meta.formattedAddress,
            gps_start_meta: r.meta,
          }
        }
      }
      if (e.gps_end && !(e.gps_end_address ?? '').trim()) {
        const r = await runGeocode(e.gps_end.lat, e.gps_end.lng)
        if (r.ok) {
          e = {
            ...e,
            gps_end_address: r.meta.formattedAddress,
            gps_end_meta: r.meta,
          }
        }
      }

      const latLng = latLngColumnsFromPoints(e.gps_start, e.gps_end)
      warnIfIdenticalStartEnd(latLng)

      const row = {
        id: e.id,
        timesheet_id: sheet.id,
        user_id: user.id,
        entry_date: e.entry_date,
        client_id: e.client_id || null,
        location_id: e.location_id || null,
        work_type_level1_id: e.work_type_level1_id || null,
        work_type_level2_id: e.work_type_level2_id || null,
        task: e.task || null,
        start_time: e.start_time.length === 5 ? `${e.start_time}:00` : e.start_time,
        end_time: e.end_time.length === 5 ? `${e.end_time}:00` : e.end_time,
        break_minutes: e.break_minutes,
        total_hours: e.total_hours,
        billable: e.billable,
        notes: e.notes || null,
        gps_start: e.gps_start,
        gps_end: e.gps_end,
        ...latLng,
        gps_start_address: e.gps_start_address ?? null,
        gps_start_meta: e.gps_start_meta ?? null,
        gps_end_address: e.gps_end_address ?? null,
        gps_end_meta: e.gps_end_meta ?? null,
        sort_order: e.sort_order ?? i,
      }

      const { error: upErr } = await supabase.from('employee_timesheet_entries').upsert(row, { onConflict: 'id' })
      if (upErr) {
        throw upErr
      }
    }

    const { data: allEntries } = await supabase
      .from('employee_timesheet_entries')
      .select('total_hours, billable')
      .eq('timesheet_id', sheet.id)

    let total = 0
    let billable = 0
    for (const r of allEntries ?? []) {
      const row = r as { total_hours?: number; billable?: boolean }
      const h = Number(row.total_hours ?? 0) || 0
      total += h
      if (row.billable) {
        billable += h
      }
    }

    const { data: updatedSheet, error: upSheetErr } = await supabase
      .from('employee_weekly_timesheets')
      .update({
        total_hours: Math.round(total * 10000) / 10000,
        billable_hours: Math.round(billable * 10000) / 10000,
      })
      .eq('id', sheet.id)
      .select()
      .single()

    if (upSheetErr) {
      throw upSheetErr
    }

    const { data: outRows } = await supabase
      .from('employee_timesheet_entries')
      .select('*')
      .eq('timesheet_id', sheet.id)
      .order('entry_date', { ascending: true })
      .order('sort_order', { ascending: true })

    return NextResponse.json({
      timesheet: updatedSheet,
      entries: (outRows ?? []).map(r => mapRowToEntry(r as Record<string, unknown>)),
    })
  } catch (e) {
    console.error('[POST /api/timecard/week]', e)
    return NextResponse.json({ error: 'Failed to save timesheet' }, { status: 500 })
  }
}
