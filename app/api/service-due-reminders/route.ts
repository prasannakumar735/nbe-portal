import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import type { ClientServiceDueReminderRow } from '@/lib/serviceReminders/types'
import { createServiceDueReminderSchema } from '@/lib/validation/service-due-reminders'



function mapReminderRow(row: Record<string, unknown>): ClientServiceDueReminderRow {
  const clients = row.clients as { name?: string } | null | undefined
  const { clients: _c, ...rest } = row
  return {
    ...(rest as ClientServiceDueReminderRow),
    client_name: clients?.name?.trim() ?? null,
  }
}

export async function GET(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const status = url.searchParams.get('status')?.trim()
  const clientId = url.searchParams.get('client_id')?.trim()

  let q = auth.supabase
    .from('client_service_due_reminders')
    .select('*, clients ( name )')
    .order('due_date', { ascending: true })
    .limit(500)

  if (status && ['active', 'cancelled', 'done'].includes(status)) {
    q = q.eq('status', status)
  }
  if (clientId) {
    q = q.eq('client_id', clientId)
  }

  const { data, error } = await q
  if (error) {
    const fallback = await auth.supabase
      .from('client_service_due_reminders')
      .select('*')
      .order('due_date', { ascending: true })
      .limit(500)
    if (fallback.error) return fail(fallback.error.message, 400)
    return ok({
      reminders: ((fallback.data ?? []) as Record<string, unknown>[]).map(r => mapReminderRow(r)),
    })
  }

  return ok({
    reminders: ((data ?? []) as Record<string, unknown>[]).map(r => mapReminderRow(r)),
  })
}

export async function POST(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const parsed = createServiceDueReminderSchema.parse(body)

    if (parsed.send_client_email && !parsed.client_contact_email) {
      return fail('Client contact email is required when sending client reminder.', 400)
    }

    const row = {
      client_id: parsed.client_id,
      client_location_id: parsed.client_location_id ?? null,
      title: parsed.title,
      notes: parsed.notes,
      last_service_date: parsed.last_service_date ?? null,
      service_interval_months: parsed.service_interval_months ?? null,
      due_date: parsed.due_date,
      lead_time_days: parsed.lead_time_days,
      send_manager_email: parsed.send_manager_email,
      send_client_email: parsed.send_client_email,
      client_contact_email: parsed.client_contact_email
        ? parsed.client_contact_email.trim().toLowerCase()
        : null,
      client_contact_name: parsed.client_contact_name,
      client_contact_email_id: parsed.client_contact_email_id ?? null,
      status: 'active' as const,
      created_by: auth.userId,
    }

    const { data, error } = await auth.supabase
      .from('client_service_due_reminders')
      .insert(row)
      .select('*')
      .single()

    if (error) return fail(error.message, 400)
    return ok({ reminder: mapReminderRow(data as Record<string, unknown>) }, 201)
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Failed to create reminder', 500)
  }
}
