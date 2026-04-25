import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import { canApproveMaintenanceReport } from '@/lib/auth/roles'
import {
  formatMaintenanceZodIssues,
  maintenanceFormSubmitSchema,
  parseMaintenanceDraftPayload,
  uuidOrEmpty,
} from '@/lib/validation/maintenance'
import { ZodError } from 'zod'
import { MAINTENANCE_CHECKLIST_ITEMS } from '@/lib/types/maintenance.types'
import { loadMaintenanceReportDraftPayload } from '@/lib/maintenance/loadMaintenanceReportDraftPayload'
import { maintenanceReportClientViewUrl } from '@/lib/app/publicAppBaseUrl'
import { uploadSignatureDataUrlToStorage } from '@/lib/maintenance/signatureDataUrlUpload'

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
    technician_door_details?: string
    door_master?: {
      door_description?: string | null
      door_type_alt?: string | null
      cw?: string | null
      ch?: string | null
    } | null
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

  // Keep `doors` (site registry) in sync with the inspection form. Previously we only set door_type on INSERT,
  // so the first save with an empty type stored "Unspecified" and later edits never updated the registry —
  // the dropdown and GET /api/maintenance/doors kept showing "Unspecified" even after the technician fixed it.
  for (const door of doors) {
    const doorId = resolvedDoorIds.get(door.local_id)
    if (!doorId) continue
    const t = String(door.door_type ?? '').trim() || 'Unspecified'
    const { error: syncErr } = await supabase.from('doors').update({ door_type: t }).eq('id', doorId)
    if (syncErr) {
      console.error('Failed to sync doors.door_type from inspection:', doorId, syncErr)
    }
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
    door_master_description: string | null
    door_master_type_alt: string | null
    door_master_cw: string | null
    door_master_ch: string | null
    technician_door_details: string | null
  }> = []

  doors.forEach((door, index) => {
    const doorId = resolvedDoorIds.get(door.local_id)
    if (!doorId) {
      throw new Error(`door_id could not be resolved for door ${door.local_id}`)
    }
    const m = door.door_master
    const masterDesc = m?.door_description != null ? String(m.door_description).trim() : ''
    const masterAlt = m?.door_type_alt != null ? String(m.door_type_alt).trim() : ''
    const masterCw = m?.cw != null ? String(m.cw).trim() : ''
    const masterCh = m?.ch != null ? String(m.ch).trim() : ''
    const techDetails = String(door.technician_door_details ?? '').trim()
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
      door_master_description: masterDesc || null,
      door_master_type_alt: masterAlt || null,
      door_master_cw: masterCw || null,
      door_master_ch: masterCh || null,
      technician_door_details: techDetails || null,
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
      const url = String(photo.url ?? '').trim()
      if (url) {
        photoRows.push({ door_id: doorId, image_url: url })
      }
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

    const payload = parseMaintenanceDraftPayload(body)
    console.log('Draft Payload:', payload)

    // Final submitted rows must still satisfy full checklist rules; WIP draft/reviewing saves skip this.
    if (payload.status === 'submitted') {
      maintenanceFormSubmitSchema.parse(payload.form)
    }

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

    let existingStatus: string | undefined
    let existingReportSchemaVersion: number | null = null

    if (payload.report_id) {
      const { data: existing, error: existingError } = await supabase
        .from('maintenance_reports')
        .select('id, status, report_schema_version')
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

      existingStatus = String(existing?.status ?? '').trim() || undefined
      const rawExistingSchema = (existing as { report_schema_version?: unknown } | null)?.report_schema_version
      const n = Number(rawExistingSchema)
      existingReportSchemaVersion = Number.isFinite(n) && n > 0 ? Math.trunc(n) : null
    }

    const persistedStatus =
      payload.admin_edit === true
        ? (existingStatus ?? payload.status ?? 'submitted')
        : (payload.status ?? 'draft')

    let resolvedSignatureUrl: string | null =
      String(payload.form.signature_storage_url ?? '').trim() || null
    const inlineSig = String(
      (payload.form as { signature_data_url?: string }).signature_data_url ?? '',
    ).trim()
    if (!resolvedSignatureUrl && inlineSig) {
      const pathPrefix = String(payload.report_id ?? '').trim() || crypto.randomUUID()
      const uploaded = await uploadSignatureDataUrlToStorage(supabase, inlineSig, pathPrefix)
      if (uploaded) {
        resolvedSignatureUrl = uploaded
      }
    }

    const reportInsert: Record<string, unknown> = {
      technician_name: String(payload.form.technician_name ?? '').trim() || 'Technician',
      submission_date: payload.form.submission_date ?? new Date().toISOString().slice(0, 10),
      source_app: String(payload.form.source_app ?? 'Portal').trim() || 'Portal',
      client_location_id: uuidOrEmpty(payload.form.client_location_id) || null,
      address: String(payload.form.address ?? '').trim(),
      inspection_date: payload.form.inspection_date ?? new Date().toISOString().slice(0, 10),
      inspection_start: payload.form.inspection_start ?? '00:00:00',
      inspection_end: payload.form.inspection_end ?? '23:59:00',
      total_doors: Number(payload.form.total_doors) ?? 1,
      notes: payload.form.notes ?? null,
      signature_url: resolvedSignatureUrl,
      offline_id: (payload.form as { offline_id?: string | null }).offline_id ?? null,
      status: persistedStatus,
    }
    const rawIncomingSchema = (payload.form as { report_schema_version?: unknown }).report_schema_version
    const incomingSchemaNum = Number(rawIncomingSchema)
    const incomingSchema = Number.isFinite(incomingSchemaNum) && incomingSchemaNum > 0 ? Math.trunc(incomingSchemaNum) : null
    const resolvedSchema = incomingSchema ?? existingReportSchemaVersion ?? 2
    reportInsert.report_schema_version = Math.max(2, resolvedSchema)

    if (!payload.report_id) {
      reportInsert.submitted_at =
        persistedStatus === 'submitted' || persistedStatus === 'reviewing'
          ? new Date().toISOString()
          : null
    }
    if (adminUserId) {
      reportInsert.edited_by = adminUserId
      reportInsert.edited_at = new Date().toISOString()
    }

    let reportId = payload.report_id

    const resolvedLocationId = uuidOrEmpty(payload.form.client_location_id)
    const hasDoorsWithoutId = (payload.form.doors ?? []).some((d: { door_id?: string }) => !d.door_id)
    if (hasDoorsWithoutId && !resolvedLocationId) {
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
      resolvedLocationId,
      persistedStatus as 'draft' | 'submitted' | 'reviewing',
      payload.form.doors,
    )

    const { data: reportMeta } = await supabase
      .from('maintenance_reports')
      .select('updated_at')
      .eq('id', reportId!)
      .single()

    const updatedAt =
      reportMeta && typeof (reportMeta as { updated_at?: unknown }).updated_at === 'string'
        ? String((reportMeta as { updated_at: string }).updated_at)
        : null

    return NextResponse.json({ report_id: reportId, status: persistedStatus, updated_at: updatedAt })
  } catch (error) {
    if (error instanceof ZodError) {
      const summary = formatMaintenanceZodIssues(error)
      return NextResponse.json(
        {
          error: summary,
          details: {
            name: 'ZodError',
            message: error.message,
            issues: error.issues,
          },
        },
        { status: 400 },
      )
    }
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
      return NextResponse.json({ report: null, client_view_url: null })
    }

    const supabase = createWriteClient()
    const report = await loadMaintenanceReportDraftPayload(supabase, reportId)

    let client_view_url: string | null = null
    const { data: meta } = await supabase
      .from('maintenance_reports')
      .select('status, approved, share_token')
      .eq('id', reportId)
      .maybeSingle()

    if (meta) {
      const st = String((meta as { status?: string | null }).status ?? '').trim()
      const appr = Boolean((meta as { approved?: boolean | null }).approved)
      const tok = String((meta as { share_token?: string | null }).share_token ?? '').trim()
      if (st === 'approved' && appr && tok) {
        client_view_url = maintenanceReportClientViewUrl(tok)
      }
    }

    return NextResponse.json({ report, client_view_url })
  } catch {
    return NextResponse.json({ report: null, client_view_url: null })
  }
}
