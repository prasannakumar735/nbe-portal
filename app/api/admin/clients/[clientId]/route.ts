import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { mapClientDbRowToApi } from '@/lib/supabase/clientsDb'
import { updateClientSchema } from '@/lib/validation/admin-clients'

export const runtime = 'nodejs'

type Params = { params: Promise<{ clientId: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireManagerOrAdminApi()
  if (!auth.ok) return auth.response

  try {
    const { clientId } = await params
    const body = await request.json()
    const parsed = updateClientSchema.parse(body)
    const trimmed = parsed.client_name.trim()

    const { data: duplicate } = await auth.supabase
      .from('clients')
      .select('id')
      .eq('name', trimmed)
      .neq('id', clientId)
      .maybeSingle()

    if (duplicate?.id) {
      return fail('Another client already uses this name.', 409)
    }

    const { data, error } = await auth.supabase
      .from('clients')
      .update({ name: trimmed })
      .eq('id', clientId)
      .select('id, name, created_at')
      .single()

    if (error) {
      return fail(error.message, 400)
    }

    return ok(mapClientDbRowToApi(data as { id: string; name?: string | null; created_at?: string | null }))
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Failed to update client', 500)
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireManagerOrAdminApi()
  if (!auth.ok) return auth.response

  try {
    const { clientId } = await params
    const { count, error: countError } = await auth.supabase
      .from('client_locations')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)

    if (countError) {
      return fail(countError.message, 400)
    }
    if ((count ?? 0) > 0) {
      return fail('Cannot delete client with existing locations. Remove locations first.', 409)
    }

    const { error } = await auth.supabase
      .from('clients')
      .delete()
      .eq('id', clientId)

    if (error) {
      return fail(error.message, 400)
    }

    return ok({ id: clientId })
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to delete client', 500)
  }
}
