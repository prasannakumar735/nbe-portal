import type { SupabaseClient } from '@supabase/supabase-js'
import type { JobCardRow } from '@/lib/job-cards/types'
import { clientLocationLabel } from '@/app/api/job-cards/helpers'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { JOB_CARD_IMAGE_BUCKET } from '@/lib/storage/jobCardBucket'

async function signImageUrlIfNeeded(pathOrUrl: string): Promise<string> {
  const p = String(pathOrUrl ?? '').trim()
  if (!p) return p
  if (p.startsWith('http://') || p.startsWith('https://')) return p
  try {
    const service = createServiceRoleClient()
    const { data, error } = await service.storage.from(JOB_CARD_IMAGE_BUCKET).createSignedUrl(p, 60 * 60 * 24 * 7)
    if (error || !data?.signedUrl) return p
    return data.signedUrl
  } catch {
    return p
  }
}

export function mapJob(row: Record<string, unknown>): JobCardRow {
  return {
    id: String(row.id),
    event_id: (row.event_id as string | null) ?? null,
    technician_id: String(row.technician_id),
    client_id: (row.client_id as string | null) ?? null,
    location_id: (row.location_id as string | null) ?? null,
    job_title: String(row.job_title ?? ''),
    job_description: (row.job_description as string | null) ?? null,
    work_type: (row.work_type as string | null) ?? null,
    status: row.status as JobCardRow['status'],
    start_time: (row.start_time as string | null) ?? null,
    end_time: (row.end_time as string | null) ?? null,
    gps_start: (row.gps_start as JobCardRow['gps_start']) ?? null,
    gps_end: (row.gps_end as JobCardRow['gps_end']) ?? null,
    gps_start_address: (row.gps_start_address as string | null) ?? null,
    gps_end_address: (row.gps_end_address as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    signature_url: (row.signature_url as string | null) ?? null,
    is_manual: Boolean(row.is_manual),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

export async function loadJobDetailExport(supabase: SupabaseClient, jobId: string) {
  const { data: job, error: jErr } = await supabase.from('job_cards').select('*').eq('id', jobId).single()
  if (jErr || !job) return null

  const { data: images } = await supabase.from('job_card_images').select('*').eq('job_card_id', jobId)

  let calendar: {
    date: string
    start_time: string | null
    travel_minutes: number
    duration_minutes: number | null
    work_minutes: number | null
  } | null = null

  let labels: { client_name: string | null; location_label: string | null } | undefined

  if (job.event_id) {
    const { data: ev } = await supabase
      .from('calendar_events')
      .select(
        'date, start_time, travel_minutes, duration_minutes, client_id, location_id, clients ( name ), client_locations ( location_name, name, site_name, suburb, address, Company_address )',
      )
      .eq('id', job.event_id)
      .maybeSingle()

    if (ev) {
      const d = ev as Record<string, unknown>
      const dur = d.duration_minutes
      const workMin = typeof dur === 'number' ? dur : dur != null ? Number(dur) : null
      calendar = {
        date: String(d.date),
        start_time: (d.start_time as string | null) ?? null,
        travel_minutes: Math.max(0, Number(d.travel_minutes) || 0),
        duration_minutes: workMin,
        work_minutes: workMin,
      }
      const clients = d.clients as { name?: string } | null
      const loc = d.client_locations as Record<string, unknown> | null
      labels = {
        client_name: clients?.name?.trim() ?? null,
        location_label: clientLocationLabel(loc) || null,
      }
    }
  } else {
    const { data: clients } = job.client_id
      ? await supabase.from('clients').select('name').eq('id', job.client_id).maybeSingle()
      : { data: null }
    let locLabel: string | null = null
    if (job.location_id) {
      const { data: loc } = await supabase
        .from('client_locations')
        .select('location_name, name, site_name, suburb, address, Company_address')
        .eq('id', job.location_id)
        .maybeSingle()
      locLabel = clientLocationLabel(loc as Record<string, unknown>) || null
    }
    labels = {
      client_name: clients?.name?.trim() ?? null,
      location_label: locLabel,
    }
  }

  const imageRows = images ?? []
  const signedImages = await Promise.all(
    imageRows.map(async img => {
      const raw = String((img as Record<string, unknown>).image_url)
      const signed = await signImageUrlIfNeeded(raw)
      return {
        id: String((img as Record<string, unknown>).id),
        job_card_id: String((img as Record<string, unknown>).job_card_id),
        image_url: signed,
        created_at: String((img as Record<string, unknown>).created_at),
      }
    }),
  )

  const jobRow = mapJob(job as Record<string, unknown>)
  const signatureUrl = jobRow.signature_url ? await signImageUrlIfNeeded(jobRow.signature_url) : null
  return {
    job: { ...jobRow, signature_url: signatureUrl },
    images: signedImages,
    calendar,
    labels,
  }
}
