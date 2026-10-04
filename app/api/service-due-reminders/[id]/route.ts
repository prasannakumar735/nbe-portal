import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import type { ClientServiceDueReminderRow } from '@/lib/serviceReminders/types'
import { updateServiceDueReminderSchema } from '@/lib/validation/service-due-reminders'



type Params = { params: Promise<{ id: string }> }

function mapReminderRow(row: Record<string, unknown>): ClientServiceDueReminderRow {
  const clients = row.clients as { name?: string } | null | undefined
  const { clients: _c, ...rest } = row
  return {
    ...(rest as ClientServiceDueReminderRow),
    client_name: clients?.name?.trim() ?? null,
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const { id } = await params
    const body = await request.json()
    const parsed = updateServiceDueReminderSchema.parse(body)

    const patch: Record<string, unknown> = {}
    if (parsed.title !== undefined) patch.title = parsed.title
    if (parsed.notes !== undefined) patch.notes = parsed.notes
    if (parsed.due_date !== undefined) patch.due_date = parsed.due_date
    if (parsed.lead_time_days !== undefined) patch.lead_time_days = parsed.lead_time_days
    if (parsed.send_manager_email !== undefined) patch.send_manager_email = parsed.send_manager_email
    if (parsed.send_client_email !== undefined) patch.send_client_email = parsed.send_client_email
    if (parsed.client_contact_email !== undefined) {
      patch.client_contact_email = parsed.client_contact_email
        ? parsed.client_contact_email.trim().toLowerCase()
        : null
    }
    if (parsed.client_contact_name !== undefined) patch.client_contact_name = parsed.client_contact_name
    if (parsed.status !== undefined) patch.status = parsed.status

    if (Object.keys(patch).length === 0) {
      return fail('No changes provided', 400)
    }

    const { data, error } = await auth.supabase
      .from('client_service_due_reminders')
      .update(patch)
      .eq('id', id)
      .select('*, clients ( name )')
      .single()

    if (error) return fail(error.message, 400)
    return ok({ reminder: mapReminderRow(data as Record<string, unknown>) })
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Failed to update reminder', 500)
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireManagerOrAdminApi(_request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const { error } = await auth.supabase
    .from('client_service_due_reminders')
    .update({ status: 'cancelled' })
    .eq('id', id)

  if (error) return fail(error.message, 400)
  return ok({ id, status: 'cancelled' })
}
