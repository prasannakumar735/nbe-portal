import { readFile } from 'fs/promises'
import { join } from 'path'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { MaintenanceFormValues } from '@/lib/types/maintenance.types'
import type { MaintenancePdfOptions } from './generateMaintenanceReportPdf'

async function fetchImageBytes(url: string): Promise<Uint8Array | null> {
  try {
    if (url.startsWith('data:')) {
      const base64 = url.split(',')[1]
      if (!base64) return null
      const buf = Buffer.from(base64, 'base64')
      return new Uint8Array(buf)
    }
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const ab = await res.arrayBuffer()
    return new Uint8Array(ab)
  } catch {
    return null
  }
}

export async function buildMaintenancePdfOptions(params: {
  form: MaintenanceFormValues
  reportId: string
  supabase: SupabaseClient
}): Promise<MaintenancePdfOptions> {
  const { form, reportId, supabase } = params
  let clientName = ''
  let locationName = ''
  let clientLocationId = form.client_location_id
  let technicianEmail = ''
  let technicianContact = ''

  type ReportRow = {
    client_location_id?: string | null
    address?: string | null
    technician_email?: string | null
    technician_contact?: string | null
    submitter_email?: string | null
    submitter_contact?: string | null
  }

  type LocationRow = {
    id: string
    client_id?: string | null
    location_name?: string | null
    name?: string | null
    suburb?: string | null
    site_name?: string | null
    address?: string | null
  }

  type ClientRow = {
    id: string
    client_name?: string | null
    name?: string | null
    company_name?: string | null
  }

  const { data: reportData } = await supabase
    .from('maintenance_reports')
    .select('*')
    .eq('id', reportId)
    .single()

  const report = reportData as ReportRow | null
  technicianEmail = String(report?.technician_email ?? report?.submitter_email ?? '').trim()
  technicianContact = String(report?.technician_contact ?? report?.submitter_contact ?? '').trim()

  if (!clientLocationId) {
    clientLocationId = report?.client_location_id ?? ''
  }

  if (!clientLocationId) {
    const { data: reportDoor } = await supabase
      .from('maintenance_doors')
      .select('door_id')
      .eq('report_id', reportId)
      .not('door_id', 'is', null)
      .limit(1)
      .maybeSingle()

    const linkedDoorId = String((reportDoor as { door_id?: string | null } | null)?.door_id ?? '').trim()
    if (linkedDoorId) {
      const { data: linkedDoor } = await supabase
        .from('doors')
        .select('client_location_id')
        .eq('id', linkedDoorId)
        .maybeSingle()

      const inferredClientLocationId = String(
        (linkedDoor as { client_location_id?: string | null } | null)?.client_location_id ?? ''
      ).trim()
      if (inferredClientLocationId) {
        clientLocationId = inferredClientLocationId
      }
    }
  }

  if (!form.address && report?.address) {
    ;(form as MaintenanceFormValues).address = String(report.address ?? '').trim()
  }

  if (clientLocationId) {
    const { data: locationData } = await supabase
      .from('client_locations')
      .select('*')
      .eq('id', clientLocationId)
      .maybeSingle()

    const location = (locationData as LocationRow | null)
    if (location) {
      locationName = String(
        location.location_name ?? location.name ?? location.suburb ?? location.site_name ?? ''
      ).trim()

      if (!form.address && location.address) {
        ;(form as MaintenanceFormValues).address = String(location.address ?? '').trim()
      }

      const locationClientId = String(location.client_id ?? '').trim()
      if (locationClientId) {
        const { data: clientData } = await supabase
          .from('clients')
          .select('*')
          .eq('id', locationClientId)
          .maybeSingle()

        const client = clientData as ClientRow | null
        if (client) {
          clientName = String(client.client_name ?? client.name ?? client.company_name ?? '').trim()
        }
      }
    }
  }

  if (!clientName && form.client_id) {
    const { data: clientData } = await supabase
      .from('clients')
      .select('*')
      .eq('id', form.client_id)
      .maybeSingle()

    const client = clientData as ClientRow | null
    if (client) {
      clientName = String(client.client_name ?? client.name ?? client.company_name ?? '').trim()
    }
  }

  clientName = clientName || '—'
  locationName = locationName || '—'

  let reportNumber = `REP-${reportId.slice(0, 8).toUpperCase()}`
  const { data: seqRow } = await supabase
    .from('maintenance_reports')
    .select('created_at')
    .eq('id', reportId)
    .single()
  if (seqRow) {
    const { count } = await supabase
      .from('maintenance_reports')
      .select('*', { count: 'exact', head: true })
      .lte('created_at', (seqRow as { created_at: string }).created_at)
    reportNumber = `REP-${String(count ?? 0).padStart(4, '0')}`
  }

  const reportDate = form.inspection_date || form.submission_date || new Date().toISOString().slice(0, 10)

  let logoBytes: Uint8Array | null = null
  for (const logoPath of ['nbe-logo.png', 'logo/nbe-logo.png', 'logo.png']) {
    try {
      logoBytes = new Uint8Array(await readFile(join(process.cwd(), 'public', logoPath)))
      break
    } catch {
      // try next
    }
  }

  let signatureBytes: Uint8Array | null = null
  if (form.signature_storage_url) {
    signatureBytes = await fetchImageBytes(form.signature_storage_url)
  }

  const doorPhotoBytes: Uint8Array[][] = []
  for (const door of form.doors) {
    const bytes: Uint8Array[] = []
    for (const photo of door.photos ?? []) {
      const url = photo.url || photo.path
      if (url) {
        const b = await fetchImageBytes(url)
        if (b) bytes.push(b)
      }
    }
    doorPhotoBytes.push(bytes)
  }

  let unicodeFontBytes: Uint8Array | null = null
  for (const fontPath of ['fonts/NotoSans-Regular.ttf', 'fonts/NotoSans.ttf']) {
    try {
      unicodeFontBytes = new Uint8Array(await readFile(join(process.cwd(), 'public', fontPath)))
      break
    } catch {
      // try next path
    }
  }

  let doorDiagramBytes: Uint8Array | null = null
  try {
    doorDiagramBytes = new Uint8Array(
      await readFile(join(process.cwd(), 'app', 'door', 'door_image_reports.png'))
    )
  } catch {
    // optional; generator will use placeholder boxes
  }

  return {
    form,
    clientName,
    locationName,
    reportNumber,
    reportDate,
    technicianEmail,
    technicianContact,
    logoBytes,
    signatureBytes,
    doorPhotoBytes,
    unicodeFontBytes,
    doorDiagramBytes,
  }
}
