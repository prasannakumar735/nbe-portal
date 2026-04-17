import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { mapClientDbRowToApi } from '@/lib/supabase/clientsDb'
import { createClientSchema } from '@/lib/validation/admin-clients'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const auth = await requireManagerOrAdminApi()
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const parsed = createClientSchema.parse(body)
    const trimmed = parsed.client_name.trim()

    const { data: duplicate } = await auth.supabase
      .from('clients')
      .select('id')
      .eq('name', trimmed)
      .maybeSingle()

    if (duplicate?.id) {
      return fail('A client with this name already exists.', 409)
    }

    const { data, error } = await auth.supabase
      .from('clients')
      .insert({ name: trimmed })
      .select('id, name, created_at')
      .single()

    if (error) {
      return fail(error.message, 400)
    }

    return ok(mapClientDbRowToApi(data as { id: string; name?: string | null; created_at?: string | null }), 201)
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Failed to create client', 500)
  }
}
