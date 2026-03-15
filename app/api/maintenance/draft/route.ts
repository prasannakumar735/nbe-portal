import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import { canApproveMaintenanceReport } from '@/lib/auth/roles'
import { maintenanceDraftSchema } from '@/lib/validation/maintenance'
import { MAINTENANCE_CHECKLIST_ITEMS } from '@/lib/types/maintenance.types'

export const runtime = 'nodejs'

/** Use service role key so draft writes bypass RLS. */
function createWriteClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!url || !serviceRoleKey) {
    throw new Error('Missing Supabase service role configuration for maintenance writes.')
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function persistDoorData(
  supabase: SupabaseClient,
  reportId: string,
  clientLocationId: string,
  status: 'draft' | 'submitted' | 'reviewing',
  doors: Array<{
    door_id?: string
    local_id: string
    door_number: string
    door_type: string
    door_cycles: number
    view_window_visibility: number
    notes: string
    checklist: Record<string, 'good' | 'caution' | 'fault' | 'na' | null>
    photos: Array<{ url: string; path: string }>
  }>,
) {
  const { data: existingDoors } = await supabase
    .from('maintenance_doors')
    .select('id')
    .eq('report_id', reportId)

  const existingDoorIds = (existingDoors ?? []).map(item => item.id)

  if (existingDoorIds.length > 0) {
    await supabase.from('maintenance_checklist').delete().in('door_id', existingDoorIds)
    await supabase.from('maintenance_photos').delete().in('door_id', existingDoorIds)
    await supabase.from('maintenance_doors').delete().eq('report_id', reportId)
  }

  const resolvedDoorIds = new Map<string, string>()

  for (const door of doors) {
    let doorId = door.door_id?.trim()

    if (!doorId) {
      if (!clientLocationId) {
        throw new Error(`Cannot resolve door_id for door ${door.local_id}: client_location_id is required when door has no door_id.`)
      }
      const doorLabel = String(door.door_number || '').trim() || `Door ${doors.indexOf(door) + 1}`

      const { data: existingDoor } = await supabase
        .from('doors')
        .select('id')
        .eq('client_location_id', clientLocationId)
        .eq('door_label', doorLabel)
        .maybeSingle()

      if (existingDoor?.id) {
        doorId = existingDoor.id
        console.log('Resolved door ID (existing):', doorId)
      } else {
        const { data: newDoor, error } = await supabase
          .from('doors')
          .insert({
            client_location_id: clientLocationId,
            door_label: doorLabel,
            door_type: (door.door_type || 'Unspecified').trim() || 'Unspecified',
          })
          .select('id')
          .single()

        if (error || !newDoor?.id) {
          console.error('Door creation failed:', error)
          throw new Error('Failed to create door record')
        }
        doorId = newDoor.id
        console.log('Resolved door ID (created):', doorId)
      }
    }

    if (!doorId) {
      throw new Error(`door_id could not be resolved for door ${door.local_id}`)
    }
    resolvedDoorIds.set(door.local_id, doorId)
  }

  const maintenanceDoorsInsert: Array<{
    report_id: string
    door_id: string
    door_index: number
    local_id: string
    door_number: string
    door_type: string
    door_cycles: number
    view_window_visibility: number
    notes: string | null
  }> = []

  doors.forEach((door, index) => {
    const doorId = resolvedDoorIds.get(door.local_id)
    if (!doorId) {
      throw new Error(`door_id could not be resolved for door ${door.local_id}`)
    }
    maintenanceDoorsInsert.push({
      report_id: reportId,
      door_id: doorId,
      door_index: index + 1,
      local_id: door.local_id,
      door_number: String(door.door_number ?? '').trim() || `Door ${index + 1}`,
      door_type: String(door.door_type ?? '').trim() || 'Unspecified',
      door_cycles: Number(door.door_cycles) || 0,
      view_window_visibility: Number(door.view_window_visibility) || 0,
      notes: door.notes ?? null,
    })
  })

  console.log('maintenanceDoorsInsert payload:', maintenanceDoorsInsert)

  const { data: insertedDoors, error: doorsError } = await supabase
    .from('maintenance_doors')
    .insert(maintenanceDoorsInsert)
    .select('id, local_id')

  if (doorsError) {
    throw doorsError
  }

  const idByLocal = new Map((insertedDoors ?? []).map(item => [item.local_id as string, item.id as string]))

  const checklistRows: Array<{ door_id: string; item_code: string; status: string }> = []
  const photoRows: Array<{ door_id: string; image_url: string }> = []

  doors.forEach(door => {
    const doorId = idByLocal.get(door.local_id)
    if (!doorId) {
      return
    }

    MAINTENANCE_CHECKLIST_ITEMS.forEach(item => {
      const status = door.checklist[item.code]
      if (status) {
        checklistRows.push({ door_id: doorId, item_code: item.code, status })
      }
    })

    door.photos.forEach(photo => {
      photoRows.push({ door_id: doorId, image_url: photo.url })
    })
  })

  if (checklistRows.length > 0) {
    console.log('Door inspection insert (maintenance_checklist):', checklistRows.length, 'rows')
    const { error } = await supabase.from('maintenance_checklist').insert(checklistRows)
    if (error) {
      throw error
    }
  }

  if (photoRows.length > 0) {
    console.log('Door inspection insert (maintenance_photos):', photoRows.length, 'rows')
    const { error } = await supabase.from('maintenance_photos').insert(photoRows)
    if (error) {
      throw error
    }
  }

  if (status === 'submitted' || status === 'reviewing') {
    await supabase.from('door_inspections').delete().eq('report_id', reportId)

    const doorInspectionRows = doors
      .map(door => {
        const doorId = resolvedDoorIds.get(door.local_id)
        if (!doorId) {
          return null
        }

        const checklistResults = Object.fromEntries(
          Object.entries(door.checklist).filter(([, value]) => Boolean(value)),
        )

        return {
          report_id: reportId,
          door_id: doorId,
          checklist_results: checklistResults,
          technician_notes: door.notes || null,
          ai_summary: null,
          photos: door.photos.map(photo => ({ url: photo.url, path: photo.path })),
        }
      })
      .filter(Boolean) as Array<{
      report_id: string
      door_id: string
      checklist_results: Record<string, 'good' | 'caution' | 'fault' | 'na' | null>
      technician_notes: string | null
      ai_summary: null
      photos: Array<{ url: string; path: string }>
    }>

    if (doorInspectionRows.length > 0) {
      console.log('Door inspection insert (door_inspections):', doorInspectionRows)
      const { error: doorInspectionError } = await supabase
        .from('door_inspections')
        .insert(doorInspectionRows)

      if (doorInspectionError) {
        throw doorInspectionError
      }
    }
  }
}

export async function POST(request: NextRequest) {
  let body: unknown = null
  try {
    body = await request.json()

    console.log('[Maintenance Draft API] Incoming payload:', {
      hasForm: typeof body === 'object' && body !== null ? Boolean((body as Record<string, unknown>).form) : false,
      keys: typeof body === 'object' && body !== null ? Object.keys(body as Record<string, unknown>) : [],
      status: typeof body === 'object' && body !== null ? (body as Record<string, unknown>).status : undefined,
    })

    const payload = maintenanceDraftSchema.parse(body)
    console.log('Draft Payload:', payload)

    const supabase = createWriteClient()

    let adminUserId: string | null = null
    if (payload.report_id && (payload.admin_edit === true)) {
      const serverSupabase = await createServerClient()
      const { data: { user } } = await serverSupabase.auth.getUser()
      if (!user?.id) {
        return NextResponse.json({ error: 'Unauthorized. Sign in to save admin edits.' }, { status: 401 })
      }
      const { data: profile } = await serverSupabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (!canApproveMaintenanceReport(profile as { role?: string } | null)) {
        return NextResponse.json({ error: 'Only managers and admins can edit submitted reports.' }, { status: 403 })
      }
      adminUserId = user.id
    }

    if (payload.report_id) {
      const { data: existing, error: existingError } = await supabase
        .from('maintenance_reports')
        .select('id, status')
        .eq('id', payload.report_id)
        .single()

      if (existingError && existingError.code !== 'PGRST116') {
        throw existingError
      }

      // canEdit: manager/admin can edit submitted/reviewing/approved; employee only when status === 'draft'
      if (existing?.status === 'submitted' || existing?.status === 'reviewing' || existing?.status === 'approved') {
        if (!payload.admin_edit) {
          return NextResponse.json({ error: 'This report has already been submitted and is locked.' }, { status: 409 })
        }
      }
    }

    const reportInsert: Record<string, unknown> = {
      technician_name: String(payload.form.technician_name ?? '').trim() || 'Technician',
      submission_date: payload.form.submission_date ?? new Date().toISOString().slice(0, 10),
      source_app: String(payload.form.source_app ?? 'Portal').trim() || 'Portal',
      client_location_id: payload.form.client_location_id || null,
      address: String(payload.form.address ?? '').trim(),
      inspection_date: payload.form.inspection_date ?? new Date().toISOString().slice(0, 10),
      inspection_start: payload.form.inspection_start ?? '00:00:00',
      inspection_end: payload.form.inspection_end ?? '23:59:00',
      total_doors: Number(payload.form.total_doors) ?? 1,
      notes: payload.form.notes ?? null,
      signature_url: payload.form.signature_storage_url || null,
      status: payload.status ?? 'draft',
    }
    if (!payload.report_id) {
      reportInsert.submitted_at =
        payload.status === 'submitted' || payload.status === 'reviewing'
          ? new Date().toISOString()
          : null
    }
    if (adminUserId) {
      reportInsert.edited_by = adminUserId
      reportInsert.edited_at = new Date().toISOString()
    }

    let reportId = payload.report_id

    const hasDoorsWithoutId = (payload.form.doors ?? []).some((d: { door_id?: string }) => !d.door_id)
    if (hasDoorsWithoutId && !payload.form.client_location_id) {
      throw new Error('Missing required identifiers for draft save: client_location_id is required when a door has not been linked to a location.')
    }

    console.log('Draft payload:', {
      report_id: reportId,
      status: payload.status,
      hasForm: Boolean(payload.form),
      doorCount: payload.form.doors?.length ?? 0,
      reportInsertKeys: Object.keys(reportInsert),
    })
    console.log('Maintenance reports insert/update:', reportInsert)

    if (reportId) {
      const { error } = await supabase
        .from('maintenance_reports')
        .update(reportInsert)
        .eq('id', reportId)

      if (error) {
        throw error
      }
    } else {
      const { data, error } = await supabase
        .from('maintenance_reports')
        .insert(reportInsert)
        .select('id')
        .single()

      if (error) {
        throw error
      }
      reportId = data.id
    }

    await persistDoorData(
      supabase,
      reportId!,
      payload.form.client_location_id,
      payload.status,
      payload.form.doors,
    )

    return NextResponse.json({ report_id: reportId, status: payload.status })
  } catch (error) {
    console.error('Supabase error:', error)
    const serializable =
      error && typeof error === 'object'
        ? {
            ...(error instanceof Error && { message: error.message, name: error.name }),
            ...('code' in error && { code: (error as { code: string }).code }),
            ...('details' in error && { details: (error as { details: string }).details }),
            ...('hint' in error && { hint: (error as { hint: string }).hint }),
            ...('issues' in error && { issues: (error as { issues: unknown }).issues }),
          }
        : String(error)
    return NextResponse.json(
      {
        error: 'Draft save failed',
        details: serializable,
      },
      { status: 400 },
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const reportId = request.nextUrl.searchParams.get('reportId')
    if (!reportId) {
      return NextResponse.json({ report: null })
    }

    const supabase = createWriteClient()

    const { data: report, error: reportError } = await supabase
      .from('maintenance_reports')
      .select('*')
      .eq('id', reportId)
      .single()

    if (reportError) {
      throw reportError
    }

    let resolvedClientLocationId = String(report.client_location_id ?? '').trim()
    if (!resolvedClientLocationId) {
      const { data: linkedDoor } = await supabase
        .from('maintenance_doors')
        .select('door_id')
        .eq('report_id', reportId)
        .not('door_id', 'is', null)
        .limit(1)
        .maybeSingle()

      const linkedDoorId = String((linkedDoor as { door_id?: string | null } | null)?.door_id ?? '').trim()
      if (linkedDoorId) {
        const { data: doorRow } = await supabase
          .from('doors')
          .select('client_location_id')
          .eq('id', linkedDoorId)
          .maybeSingle()

        const inferredLocationId = String(
          (doorRow as { client_location_id?: string | null } | null)?.client_location_id ?? ''
        ).trim()
        if (inferredLocationId) {
          resolvedClientLocationId = inferredLocationId
          void supabase
            .from('maintenance_reports')
            .update({ client_location_id: inferredLocationId })
            .eq('id', reportId)
        }
      }
    }

    let clientId = ''
    if (resolvedClientLocationId) {
      const { data: locationData } = await supabase
        .from('client_locations')
        .select('client_id')
        .eq('id', resolvedClientLocationId)
        .single()

      clientId = String(locationData?.client_id ?? '')
    }

    const { data: doors, error: doorsError } = await supabase
      .from('maintenance_doors')
      .select('*')
      .eq('report_id', reportId)
      .order('created_at', { ascending: true })

    if (doorsError) {
      throw doorsError
    }

    const resolvedDoorIdByLabel = new Map<string, string>()
    if (resolvedClientLocationId) {
      const { data: reusableDoors } = await supabase
        .from('doors')
        .select('id, door_label')
        .eq('client_location_id', resolvedClientLocationId)

      ;(reusableDoors ?? []).forEach(row => {
        const label = String(row.door_label ?? '').trim().toLowerCase()
        const id = String(row.id ?? '')
        if (label && id) {
          resolvedDoorIdByLabel.set(label, id)
        }
      })
    }

    const doorIds = (doors ?? []).map(item => item.id)

    const [{ data: checklistRows }, { data: photoRows }] = await Promise.all([
      doorIds.length > 0
        ? supabase.from('maintenance_checklist').select('*').in('door_id', doorIds)
        : Promise.resolve({ data: [] as Array<{ door_id: string; item_code: string; status: string }>, error: null }),
      doorIds.length > 0
        ? supabase.from('maintenance_photos').select('*').in('door_id', doorIds)
        : Promise.resolve({ data: [] as Array<{ door_id: string; image_url: string }>, error: null }),
    ])

    const checklistByDoor = new Map<string, Record<string, 'good' | 'caution' | 'fault' | 'na' | null>>()
    ;(doors ?? []).forEach(door => {
      const emptyChecklist: Record<string, 'good' | 'caution' | 'fault' | 'na' | null> = {}
      MAINTENANCE_CHECKLIST_ITEMS.forEach(item => {
        emptyChecklist[item.code] = null
      })
      checklistByDoor.set(door.id, emptyChecklist)
    })

    ;(checklistRows ?? []).forEach(row => {
      const current = checklistByDoor.get(row.door_id)
      if (current) {
        current[row.item_code] = row.status as 'good' | 'caution' | 'fault' | 'na'
      }
    })

    const photosByDoor = new Map<string, Array<{ url: string; path: string }>>()
    ;(photoRows ?? []).forEach(row => {
      const list = photosByDoor.get(row.door_id) ?? []
      list.push({ url: row.image_url, path: row.image_url })
      photosByDoor.set(row.door_id, list)
    })

    const hydratedDoors = (doors ?? []).map(door => {
      const fallbackDoorId = resolvedDoorIdByLabel.get(String(door.door_number ?? '').trim().toLowerCase())
      const resolvedDoorId = String(door.door_id ?? fallbackDoorId ?? '').trim() || undefined

      if (!door.door_id && resolvedDoorId) {
        void supabase
          .from('maintenance_doors')
          .update({ door_id: resolvedDoorId })
          .eq('id', door.id)
      }

      return {
      door_id: resolvedDoorId,
      local_id: door.local_id,
      door_number: door.door_number,
      door_type: door.door_type,
      door_cycles: Number(door.door_cycles ?? 0),
      view_window_visibility: Number(door.view_window_visibility ?? 0),
      notes: door.notes ?? '',
      checklist: checklistByDoor.get(door.id) ?? {},
      photos: photosByDoor.get(door.id) ?? [],
      isCollapsed: false,
    }})

    return NextResponse.json({
      report: {
        report_id: report.id,
        status: report.status,
        technician_name: report.technician_name,
        submission_date: report.submission_date,
        source_app: report.source_app,
        client_id: clientId,
        client_location_id: resolvedClientLocationId,
        address: report.address,
        inspection_date: report.inspection_date,
        inspection_start: report.inspection_start,
        inspection_end: report.inspection_end,
        total_doors: report.total_doors,
        notes: report.notes ?? '',
        ai_summary: (report as { ai_summary?: string | null }).ai_summary ?? null,
        signature_data_url: '',
        signature_storage_url: report.signature_url ?? '',
        doors: hydratedDoors,
      },
    })
  } catch {
    return NextResponse.json({ report: null })
  }
}
