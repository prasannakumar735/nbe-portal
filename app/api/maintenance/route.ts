import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { maintenanceFormSchema } from '@/lib/validation/maintenance'
import type { MaintenanceChecklistStatus } from '@/lib/types/maintenance.types'

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

    return {
      door_id: String(door.door_id ?? '').trim() || undefined,
      local_id: String(door.local_id ?? crypto.randomUUID()),
      door_number: String(door.door_number ?? `Door ${index + 1}`),
      door_type: String(door.door_type ?? ''),
      door_cycles: toNumberOrZero(door.door_cycles),
      view_window_visibility: toNumberOrZero(door.view_window_visibility),
      notes: String(door.notes ?? ''),
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

  const rawStatus = String(source.status ?? '').trim().toLowerCase()
  const status = (VALID_STATUS.includes(rawStatus as MaintenanceStatus)
    ? rawStatus
    : 'submitted') as MaintenanceStatus

  return {
    report_id,
    status,
    formCandidate: {
      report_id,
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

    const parsed = maintenanceFormSchema.safeParse(normalized.formCandidate)

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
