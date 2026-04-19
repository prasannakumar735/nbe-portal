import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { upsertDoorSchema } from '@/lib/validation/admin-clients'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const parsed = upsertDoorSchema.parse(body)

    const insertRow = {
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
      .insert(insertRow)
      .select('id, client_location_id, door_label, door_type, door_description, door_type_alt, cw, ch, install_date, created_at')
      .single()

    if (error) {
      return fail(error.message, 400)
    }

    return ok(data, 201)
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Failed to create door', 500)
  }
}
