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
    id?: string
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
    site_address?: string | null
    location_address?: string | null
    Company_address?: string | null
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

  if (!technicianEmail || !technicianContact) {
    const { data: previousReports } = await supabase
      .from('maintenance_reports')
      .select('technician_email, submitter_email, technician_contact, submitter_contact')
      .eq('technician_name', String(form.technician_name ?? '').trim())
      .neq('id', reportId)
      .order('created_at', { ascending: false })
      .limit(20)

    for (const row of (previousReports ?? [])) {
      const candidate = row as {
        technician_email?: string | null
        submitter_email?: string | null
        technician_contact?: string | null
        submitter_contact?: string | null
      }

      if (!technicianEmail) {
        technicianEmail = String(candidate.technician_email ?? candidate.submitter_email ?? '').trim()
      }

      if (!technicianContact) {
        technicianContact = String(candidate.technician_contact ?? candidate.submitter_contact ?? '').trim()
      }

      if (technicianEmail && technicianContact) {
        break
      }
    }
  }

  if (!technicianEmail || !technicianContact) {
    const normalize = (value: string) =>
      String(value ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

    const scoreMatch = (source: string, tokens: string[]) => {
      if (!source || tokens.length === 0) return 0
      const words = new Set(source.split(' ').filter(Boolean))
      let hits = 0
      for (const token of tokens) {
        if (words.has(token) || source.includes(token)) hits += 1
      }
      return hits / tokens.length
    }

    const normalizedTechnicianName = normalize(String(form.technician_name ?? ''))
    const nameTokens = normalizedTechnicianName.split(' ').filter(Boolean)

    if (normalizedTechnicianName) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .limit(1000)

      let bestProfileId = ''
      let bestScore = 0

      for (const row of (profiles ?? [])) {
        const r = row as { id?: string | null; first_name?: string | null; last_name?: string | null }
        const fullName = normalize(`${String(r.first_name ?? '').trim()} ${String(r.last_name ?? '').trim()}`)
        const currentScore = scoreMatch(fullName, nameTokens)
        if (currentScore > bestScore) {
          bestScore = currentScore
          bestProfileId = String(r.id ?? '').trim()
        }
      }

      let matchedUserId = bestScore >= 0.66 ? bestProfileId : ''

      if (!matchedUserId) {
        const adminApi = (supabase as unknown as {
          auth?: { admin?: { listUsers?: (params?: { page?: number; perPage?: number }) => Promise<{ data?: { users?: Array<{ id?: string | null; email?: string | null; phone?: string | null; user_metadata?: Record<string, unknown> | null }> } }> } }
        }).auth?.admin

        if (adminApi?.listUsers) {
          const listed = await adminApi.listUsers({ page: 1, perPage: 1000 })
          let bestAuthId = ''
          let bestAuthScore = 0

          for (const user of (listed?.data?.users ?? [])) {
            const metadata = (user.user_metadata ?? {}) as Record<string, unknown>
            const fullName = normalize(String(metadata.full_name ?? metadata.name ?? ''))
            const emailLocal = normalize(String(user.email ?? '').split('@')[0] ?? '')
            const combined = `${fullName} ${emailLocal}`.trim()
            const currentScore = scoreMatch(combined, nameTokens)
            if (currentScore > bestAuthScore) {
              bestAuthScore = currentScore
              bestAuthId = String(user.id ?? '').trim()
              if (!technicianEmail) {
                technicianEmail = String(user.email ?? '').trim()
              }
              if (!technicianContact) {
                technicianContact = String(
                  user.phone ?? metadata.contact ?? metadata.phone ?? metadata.mobile ?? metadata.mobile_number ?? ''
                ).trim()
              }
            }
          }

          if (bestAuthScore >= 0.66) {
            matchedUserId = bestAuthId
          }
        }
      }

      if (matchedUserId) {
        const adminApi = (supabase as unknown as {
          auth?: { admin?: { getUserById?: (id: string) => Promise<{ data?: { user?: { email?: string | null; phone?: string | null; user_metadata?: Record<string, unknown> | null } | null } }> } }
        }).auth?.admin

        if (adminApi?.getUserById) {
          const authRes = await adminApi.getUserById(matchedUserId)
          const user = authRes?.data?.user

          if (!technicianEmail) {
            technicianEmail = String(user?.email ?? '').trim()
          }

          if (!technicianContact) {
            const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>
            technicianContact = String(
              user?.phone ?? metadata.contact ?? metadata.phone ?? metadata.mobile ?? metadata.mobile_number ?? ''
            ).trim()
          }
        }
      }
    }

    if ((technicianEmail || technicianContact) && report?.id) {
      const backfillUpdate: Record<string, string> = {}
      if (technicianEmail) {
        backfillUpdate.technician_email = technicianEmail
        backfillUpdate.submitter_email = technicianEmail
      }
      if (technicianContact) {
        backfillUpdate.technician_contact = technicianContact
        backfillUpdate.submitter_contact = technicianContact
      }

      if (Object.keys(backfillUpdate).length > 0) {
        await supabase
          .from('maintenance_reports')
          .update(backfillUpdate)
          .eq('id', report.id)
      }
    }
  }

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

      const companyAddress = String(location.Company_address ?? '').trim()
      const normalizedCompanyAddress = companyAddress.toLowerCase() === 'null' ? '' : companyAddress
      const resolvedAddress = String(
        normalizedCompanyAddress || location.address || location.site_address || location.location_address || ''
      ).trim()

      if (!form.address && resolvedAddress) {
        ;(form as MaintenanceFormValues).address = resolvedAddress
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
