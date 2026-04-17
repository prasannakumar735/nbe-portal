import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import {
  CLIENT_LOCATIONS_DB_COLUMNS,
  mapLocationDbRowToApi,
  type ClientLocationDbRow,
} from '@/lib/supabase/clientLocationsDb'
import { updateLocationSchema } from '@/lib/validation/admin-clients'

export const runtime = 'nodejs'

type Params = { params: Promise<{ locationId: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireManagerOrAdminApi()
  if (!auth.ok) return auth.response

  try {
    const { locationId } = await params
    const body = await request.json()
    const parsed = updateLocationSchema.parse(body)

    const updates = {
      location_name: parsed.location_name.trim(),
      Company_address: parsed.Company_address,
      suburb: parsed.suburb,
    }

    const { data, error } = await auth.supabase
      .from('client_locations')
      .update(updates)
      .eq('id', locationId)
      .select(CLIENT_LOCATIONS_DB_COLUMNS)
      .single()

    if (error) {
      return fail(error.message, 400)
    }

    return ok(mapLocationDbRowToApi(data as ClientLocationDbRow))
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Failed to update location', 500)
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireManagerOrAdminApi()
  if (!auth.ok) return auth.response

  try {
    const { locationId } = await params
    const { count, error: countError } = await auth.supabase
      .from('doors')
      .select('id', { count: 'exact', head: true })
      .eq('client_location_id', locationId)

    if (countError) {
      return fail(countError.message, 400)
    }
    if ((count ?? 0) > 0) {
      return fail('Cannot delete location with existing doors. Remove doors first.', 409)
    }

    const { error } = await auth.supabase
      .from('client_locations')
      .delete()
      .eq('id', locationId)

    if (error) {
      return fail(error.message, 400)
    }

    return ok({ id: locationId })
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to delete location', 500)
  }
}
