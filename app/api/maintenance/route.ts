import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { maintenanceFormDraftSchema, maintenanceFormSubmitSchema } from '@/lib/validation/maintenance'
import type { MaintenanceChecklistStatus } from '@/lib/types/maintenance.types'
import { createClient } from '@supabase/supabase-js'
import { runMaintenanceSubmit } from '@/lib/maintenance/runMaintenanceSubmit'

export const runtime = 'nodejs'

type MaintenanceStatus = 'draft' | 'submitted'

type NormalizedEnvelope = {
  report_id?: string
  status: MaintenanceStatus
  formCandidate: Record<string, unknown>
}

const VALID_STATUS: Array<'draft' | 'submitted'> = ['draft', 'submitted']
const VALID_CHECKLIST = new Set<MaintenanceChecklistStatus>(['good', 'caution', 'fault', 'na'])

function toNumberOrZero(value: unknown): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

function normaliseChecklist(value: unknown): Record<string, MaintenanceChecklistStatus | null> {
  if (Array.isArray(value)) {
    const byArray: Record<string, MaintenanceChecklistStatus | null> = {}
    value.forEach((item, index) => {
      if (!item || typeof item !== 'object') return
      const row = item as Record<string, unknown>
      const code = String(row.item_code ?? row.code ?? index).trim()
      const status = String(row.status ?? '').trim().toLowerCase()
      byArray[code] = VALID_CHECKLIST.has(status as MaintenanceChecklistStatus)
        ? (status as MaintenanceChecklistStatus)
        : null
    })
    return byArray
  }

  if (!value || typeof value !== 'object') {
    return {}
  }

  const result: Record<string, MaintenanceChecklistStatus | null> = {}
  for (const [key, rawStatus] of Object.entries(value as Record<string, unknown>)) {
    if (typeof rawStatus !== 'string') {
      result[key] = null
      continue
    }

    result[key] = VALID_CHECKLIST.has(rawStatus as MaintenanceChecklistStatus)
      ? (rawStatus as MaintenanceChecklistStatus)
      : null
  }

  return result
}

function normalisePhotos(value: unknown): Array<{ url: string; path: string }> {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map(item => {
      if (typeof item === 'string') {
        return { url: item, path: item }
      }

      if (!item || typeof item !== 'object') {
        return null
      }

      const url = String((item as Record<string, unknown>).url ?? '').trim()
      const path = String((item as Record<string, unknown>).path ?? url).trim()

      if (!url) {
        return null
      }

      return { url, path: path || url }
    })
    .filter((photo): photo is { url: string; path: string } => Boolean(photo))
}

function normaliseDoors(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map((rawDoor, index) => {
    const door = (rawDoor && typeof rawDoor === 'object' ? rawDoor : {}) as Record<string, unknown>

    const rawMaster = (door as Record<string, unknown>).door_master
    let masterSnap: Record<string, string | null> | undefined
    if (rawMaster && typeof rawMaster === 'object' && !Array.isArray(rawMaster)) {
      const m = rawMaster as Record<string, unknown>
      masterSnap = {
        door_description: m.door_description != null ? String(m.door_description) : null,
        door_type_alt: m.door_type_alt != null ? String(m.door_type_alt) : null,
        cw: m.cw != null ? String(m.cw) : null,
        ch: m.ch != null ? String(m.ch) : null,
      }
    }

    return {
      door_id: String(door.door_id ?? '').trim() || undefined,
      local_id: String(door.local_id ?? crypto.randomUUID()),
      door_number: String(door.door_number ?? `Door ${index + 1}`),
      door_type: String(door.door_type ?? ''),
      door_cycles: toNumberOrZero(door.door_cycles),
      view_window_visibility: toNumberOrZero(door.view_window_visibility),
      notes: String(door.notes ?? ''),
      technician_door_details: String((door as Record<string, unknown>).technician_door_details ?? ''),
      door_master: masterSnap ?? undefined,
      checklist: normaliseChecklist(door.checklist),
      photos: normalisePhotos(door.photos),
      isCollapsed: Boolean(door.isCollapsed),
    }
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalisePayload(body: unknown): NormalizedEnvelope {
  const source = isRecord(body) ? body : {}
  const rawForm = isRecord(source.form) ? source.form : source

  const report_id = String(source.report_id ?? rawForm.report_id ?? '').trim() || undefined
  const offline_id = String(rawForm.offline_id ?? source.offline_id ?? '').trim() || undefined

  const rawStatus = String(source.status ?? '').trim().toLowerCase()
  const status = (VALID_STATUS.includes(rawStatus as MaintenanceStatus)
    ? rawStatus
    : 'submitted') as MaintenanceStatus

  const rawSchema = rawForm.report_schema_version
  let report_schema_version: number | undefined
  if (rawSchema !== undefined && rawSchema !== null && rawSchema !== '') {
    const n = Number(rawSchema)
    if (Number.isFinite(n)) {
      report_schema_version = Math.trunc(n)
    }
  }

  return {
    report_id,
    status,
    formCandidate: {
      report_id,
      offline_id,
      report_schema_version,
      technician_name: String(rawForm.technician_name ?? '').trim(),
      submission_date: String(rawForm.submission_date ?? new Date().toISOString().slice(0, 10)),
      source_app: String(rawForm.source_app ?? 'Portal').trim() || 'Portal',
      client_id: String(rawForm.client_id ?? '').trim(),
      client_location_id: String(rawForm.client_location_id ?? '').trim(),
      address: String(rawForm.address ?? '').trim(),
      inspection_date: String(rawForm.inspection_date ?? '').trim(),
      inspection_start: String(rawForm.inspection_start ?? '').trim(),
      inspection_end: String(rawForm.inspection_end ?? '').trim(),
      total_doors: toNumberOrZero(rawForm.total_doors),
      notes: String(rawForm.notes ?? ''),
      signature_data_url: String(rawForm.signature_data_url ?? ''),
      signature_storage_url: String(rawForm.signature_storage_url ?? ''),
      doors: normaliseDoors(rawForm.doors),
    },
  }
}

function createWriteClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error('Missing Supabase service role configuration for maintenance writes.')
  }
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

function isDataUrl(value: string): boolean {
  return value.startsWith('data:')
}

function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; contentType: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) {
    throw new Error('Invalid data URL')
  }
  const contentType = match[1] || 'application/octet-stream'
  const base64 = match[2] || ''
  return { buffer: Buffer.from(base64, 'base64'), contentType }
}

function formatZodIssues(error: z.ZodError) {
  return error.issues.map(issue => ({
    field: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }))
}

export async function POST(request: NextRequest) {
  let rawBody: unknown = null

  try {
    rawBody = await request.json()
    const normalized = normalisePayload(rawBody)

    console.log('Maintenance API payload:', normalized.formCandidate)

    const formSchema =
      normalized.status === 'draft' ? maintenanceFormDraftSchema : maintenanceFormSubmitSchema
    const parsed = formSchema.safeParse(normalized.formCandidate)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: formatZodIssues(parsed.error),
        },
        { status: 400 },
      )
    }

    const payload = {
      report_id: normalized.report_id ?? parsed.data.report_id,
      status: normalized.status,
      form: parsed.data,
    }

    const hasOfflineId = Boolean(payload.form.offline_id)
    const hasInlineSignature = Boolean(payload.form.signature_data_url && isDataUrl(payload.form.signature_data_url))
    const hasInlinePhotos = (payload.form.doors ?? []).some(door =>
      (door.photos ?? []).some(photo => Boolean((photo as { offline_data_url?: string }).offline_data_url) || isDataUrl(photo.url))
    )

    if (payload.status === 'submitted' && hasOfflineId && (hasInlineSignature || hasInlinePhotos)) {
      const supabase = createWriteClient()
      const offlineId = String(payload.form.offline_id ?? '').trim()

      const { data: existing } = await supabase
        .from('maintenance_reports')
        .select('id')
        .eq('offline_id', offlineId)
        .maybeSingle()

      if (existing?.id) {
        return NextResponse.json({
          success: true,
          report_id: existing.id,
          status: 'submitted',
          endpoint: '/api/maintenance/submit',
          data: { report_id: existing.id, status: 'submitted', offline_id: offlineId },
        })
      }

      const uploadedPaths: string[] = []
      const reportIdSlug = offlineId

      let signature_storage_url = payload.form.signature_storage_url || ''
      if (payload.form.signature_data_url && isDataUrl(payload.form.signature_data_url) && !signature_storage_url) {
        const { buffer, contentType } = dataUrlToBuffer(payload.form.signature_data_url)
        const sigPath = `signatures/${reportIdSlug}/${crypto.randomUUID()}.png`
        const up = await supabase.storage.from('maintenance-images').upload(sigPath, buffer, {
          contentType: contentType || 'image/png',
          upsert: true,
        })
        if (up.error) throw new Error(up.error.message)
        uploadedPaths.push(sigPath)
        signature_storage_url = supabase.storage.from('maintenance-images').getPublicUrl(sigPath).data.publicUrl
      }

      const nextDoors = payload.form.doors.map((door) => ({ ...door, photos: [] as Array<{ url: string; path: string }> }))

      for (let i = 0; i < payload.form.doors.length; i += 1) {
        const door = payload.form.doors[i]!
        const out = nextDoors[i]!

        const existingOnline = (door.photos ?? []).filter(p =>
          !isDataUrl(p.url) && !(p as { offline_data_url?: string }).offline_data_url
        ) as Array<{ url: string; path: string }>
        existingOnline.forEach(p => out.photos.push(p))

        for (const photo of (door.photos ?? [])) {
          const offlineDataUrl = String((photo as { offline_data_url?: string }).offline_data_url ?? '').trim()
          const candidate = offlineDataUrl || (isDataUrl(photo.url) ? photo.url : '')
          if (!candidate) continue

          const { buffer, contentType } = dataUrlToBuffer(candidate)
          const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
          const path = `${reportIdSlug}/${door.local_id}/${Date.now()}-${crypto.randomUUID()}.${ext}`
          const up = await supabase.storage.from('maintenance-images').upload(path, buffer, {
            contentType,
            upsert: false,
          })
          if (up.error) throw new Error(up.error.message)
          uploadedPaths.push(path)
          const publicUrl = supabase.storage.from('maintenance-images').getPublicUrl(path).data.publicUrl
          out.photos.push({ url: publicUrl, path })
        }
      }

      const submitBody = {
        form: {
          ...payload.form,
          signature_storage_url,
          doors: nextDoors,
        },
      }

      try {
        const submitReq = new NextRequest(new URL('/api/maintenance/submit', request.url), {
          method: 'POST',
          headers: request.headers,
          body: JSON.stringify(submitBody),
        })
        const upstreamResponse = await runMaintenanceSubmit(submitReq)
        const upstreamJson = (await upstreamResponse.json()) as Record<string, unknown>

        if (!upstreamResponse.ok) {
          if (uploadedPaths.length > 0) {
            await supabase.storage.from('maintenance-images').remove(uploadedPaths).catch(() => {})
          }
          return NextResponse.json(
            {
              error: String(upstreamJson.error ?? `Maintenance request failed (${upstreamResponse.status})`),
              details: upstreamJson,
              endpoint: '/api/maintenance/submit',
            },
            { status: upstreamResponse.status },
          )
        }

        const reportId = String(upstreamJson.report_id ?? payload.form.report_id ?? '')
        return NextResponse.json({
          success: true,
          report_id: reportId || null,
          status: upstreamJson.status ?? payload.status,
          endpoint: '/api/maintenance/submit',
          data: upstreamJson,
        })
      } catch (e) {
        if (uploadedPaths.length > 0) {
          await supabase.storage.from('maintenance-images').remove(uploadedPaths).catch(() => {})
        }
        throw e
      }
    }

    const endpoint = payload.status === 'draft' ? '/api/maintenance/draft' : '/api/maintenance/submit'
    const forwardBody =
      payload.status === 'draft'
        ? {
            report_id: payload.report_id,
            status: 'draft' as const,
            form: payload.form,
          }
        : {
            form: payload.form,
          }

    if (endpoint === '/api/maintenance/submit') {
      const submitReq = new NextRequest(new URL(endpoint, request.url), {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify(forwardBody),
      })
      const upstreamResponse = await runMaintenanceSubmit(submitReq)
      const upstreamJson = (await upstreamResponse.json()) as Record<string, unknown>

      if (!upstreamResponse.ok) {
        console.error('[Maintenance API] Upstream request failed', {
          endpoint,
          status: upstreamResponse.status,
          error: upstreamJson.error,
        })

        return NextResponse.json(
          {
            error: String(upstreamJson.error ?? `Maintenance request failed (${upstreamResponse.status})`),
            details: upstreamJson,
            endpoint,
          },
          { status: upstreamResponse.status },
        )
      }

      const reportId = String(upstreamJson.report_id ?? payload.form.report_id ?? '')

      return NextResponse.json({
        success: true,
        report_id: reportId || null,
        status: upstreamJson.status ?? payload.status,
        endpoint,
        data: upstreamJson,
      })
    }

    const upstreamResponse = await fetch(new URL(endpoint, request.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(forwardBody),
    })

    const upstreamJson = (await upstreamResponse.json()) as Record<string, unknown>

    if (!upstreamResponse.ok) {
      console.error('[Maintenance API] Upstream request failed', {
        endpoint,
        status: upstreamResponse.status,
        error: upstreamJson.error,
      })

      return NextResponse.json(
        {
          error: String(upstreamJson.error ?? `Maintenance request failed (${upstreamResponse.status})`),
          details: upstreamJson,
          endpoint,
        },
        { status: upstreamResponse.status },
      )
    }

    const reportId = String(upstreamJson.report_id ?? payload.form.report_id ?? '')

    return NextResponse.json({
      success: true,
      report_id: reportId || null,
      status: upstreamJson.status ?? payload.status,
      endpoint,
      data: upstreamJson,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[Maintenance API] Payload validation failed', {
        issues: formatZodIssues(error),
        payloadPreview: {
          hasForm: isRecord(rawBody) ? Boolean((rawBody as Record<string, unknown>).form) : false,
          keys: isRecord(rawBody) ? Object.keys(rawBody) : [],
        },
      })

      return NextResponse.json(
        {
          error: 'Validation failed',
          issues: formatZodIssues(error),
        },
        { status: 400 },
      )
    }

    const message = error instanceof Error ? error.message : 'Unexpected maintenance API error.'
    console.error('[Maintenance API] Unexpected error', {
      message,
      error,
    })

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
