import type { SupabaseClient } from '@supabase/supabase-js'
import { MAINTENANCE_CHECKLIST_ITEMS } from '@/lib/types/maintenance.types'

/**
 * Load the same payload as GET /api/maintenance/draft?reportId=… but in-process (service role).
 * Used by merge PDF routes — avoids HTTP self-fetch that often fails or returns HTML behind proxies.
 */
export async function loadMaintenanceReportDraftPayload(
  supabase: SupabaseClient,
  reportId: string,
): Promise<Record<string, unknown> | null> {
  try {
    const { data: report, error: reportError } = await supabase
      .from('maintenance_reports')
      .select('*')
      .eq('id', reportId)
      .single()

    if (reportError || !report) {
      return null
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
          (doorRow as { client_location_id?: string | null } | null)?.client_location_id ?? '',
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
    let clientName = ''
    let locationName = ''
    let resolvedAddress = String(report.address ?? '').trim()
    if (resolvedClientLocationId) {
      const { data: locationData } = await supabase
        .from('client_locations')
        .select('*')
        .eq('id', resolvedClientLocationId)
        .maybeSingle()

      clientId = String(locationData?.client_id ?? '')
      locationName = String(
        (locationData as { location_name?: string | null; name?: string | null; suburb?: string | null; site_name?: string | null } | null)?.location_name ??
          (locationData as { location_name?: string | null; name?: string | null; suburb?: string | null; site_name?: string | null } | null)?.name ??
          (locationData as { location_name?: string | null; name?: string | null; suburb?: string | null; site_name?: string | null } | null)?.suburb ??
          (locationData as { location_name?: string | null; name?: string | null; suburb?: string | null; site_name?: string | null } | null)?.site_name ??
          '',
      ).trim()
      const companyAddress = String(
        (locationData as { Company_address?: string | null; company_address?: string | null } | null)?.Company_address ??
          (locationData as { Company_address?: string | null; company_address?: string | null } | null)?.company_address ??
          '',
      ).trim()
      const normalizedCompanyAddress = companyAddress.toLowerCase() === 'null' ? '' : companyAddress
      if (!resolvedAddress) {
        resolvedAddress = String(
          normalizedCompanyAddress ||
            (locationData as { address?: string | null; site_address?: string | null; location_address?: string | null } | null)?.address ||
            (locationData as { address?: string | null; site_address?: string | null; location_address?: string | null } | null)?.site_address ||
            (locationData as { address?: string | null; site_address?: string | null; location_address?: string | null } | null)?.location_address ||
            '',
        ).trim()
      }

      if (clientId) {
        const { data: clientData } = await supabase
          .from('clients')
          .select('*')
          .eq('id', clientId)
          .maybeSingle()

        clientName = String(
          (clientData as { client_name?: string | null; name?: string | null; company_name?: string | null } | null)?.client_name ??
            (clientData as { client_name?: string | null; name?: string | null; company_name?: string | null } | null)?.name ??
            (clientData as { client_name?: string | null; name?: string | null; company_name?: string | null } | null)?.company_name ??
            '',
        ).trim()
      }
    }

    const { data: doors, error: doorsError } = await supabase
      .from('maintenance_doors')
      .select('*')
      .eq('report_id', reportId)
      .order('created_at', { ascending: true })

    if (doorsError) {
      return null
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
      }
    })

    return {
      report_id: report.id,
      updated_at: (report as { updated_at?: string }).updated_at ?? null,
      status: report.status,
      technician_name: report.technician_name,
      submission_date: report.submission_date,
      source_app: report.source_app,
      client_id: clientId,
      client_name: clientName,
      client_location_id: resolvedClientLocationId,
      client_location_name: locationName,
      address: resolvedAddress,
      inspection_date: report.inspection_date,
      inspection_start: report.inspection_start,
      inspection_end: report.inspection_end,
      total_doors: report.total_doors,
      notes: report.notes ?? '',
      ai_summary: (report as { ai_summary?: string | null }).ai_summary ?? null,
      signature_data_url: '',
      signature_storage_url: report.signature_url ?? '',
      doors: hydratedDoors,
    }
  } catch {
    return null
  }
}
