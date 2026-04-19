import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { upsertDoorSchema } from '@/lib/validation/admin-clients'

export const runtime = 'nodejs'

type Params = { params: Promise<{ doorId: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const { doorId } = await params
    const body = await request.json()
    const parsed = upsertDoorSchema.parse(body)

    const updates = {
      client_location_id: parsed.client_location_id,
      door_label: parsed.door_label,
      door_type: parsed.door_type,
      door_description: parsed.door_description,
      door_type_alt: parsed.door_type_alt,
      cw: parsed.cw,
      ch: parsed.ch,
      install_date: parsed.install_date,
    }

    const { data, error } = await auth.supabase
      .from('doors')
      .update(updates)
      .eq('id', doorId)
      .select('id, client_location_id, door_label, door_type, door_description, door_type_alt, cw, ch, install_date, created_at')
      .single()

    if (error) {
      return fail(error.message, 400)
    }

    return ok(data)
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Failed to update door', 500)
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireManagerOrAdminApi(_request)
  if (!auth.ok) return auth.response

  try {
    const { doorId } = await params
    const { error } = await auth.supabase
      .from('doors')
      .delete()
      .eq('id', doorId)

    if (error) {
      return fail(error.message, 400)
    }

    return ok({ id: doorId })
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to delete door', 500)
  }
}
