import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import {
  CLIENT_LOCATIONS_DB_COLUMNS,
  mapLocationDbRowToApi,
  type ClientLocationDbRow,
} from '@/lib/supabase/clientLocationsDb'
import { createLocationSchema } from '@/lib/validation/admin-clients'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const parsed = createLocationSchema.parse(body)

    const insertRow = {
      client_id: parsed.client_id,
      location_name: parsed.location_name.trim(),
      Company_address: parsed.Company_address,
      suburb: parsed.suburb,
    }

    const { data, error } = await auth.supabase
      .from('client_locations')
      .insert(insertRow)
      .select(CLIENT_LOCATIONS_DB_COLUMNS)
      .single()

    if (error) {
      return fail(error.message, 400)
    }

    return ok(mapLocationDbRowToApi(data as ClientLocationDbRow), 201)
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Failed to create location', 500)
  }
}
