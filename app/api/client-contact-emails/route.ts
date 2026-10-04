import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { createClientContactEmailSchema } from '@/lib/validation/service-due-reminders'



export async function GET(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const clientId = url.searchParams.get('client_id')?.trim() ?? ''
  if (!clientId) {
    return fail('client_id is required', 400)
  }

  const { data, error } = await auth.supabase
    .from('client_contact_emails')
    .select('id, client_id, name, email, is_active, created_at, updated_at')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .order('email', { ascending: true })

  if (error) return fail(error.message, 400)
  return ok({ contacts: data ?? [] })
}

export async function POST(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const parsed = createClientContactEmailSchema.parse(body)
    const email = parsed.email.trim().toLowerCase()

    const { data, error } = await auth.supabase
      .from('client_contact_emails')
      .insert({
        client_id: parsed.client_id,
        name: parsed.name,
        email,
      })
      .select('id, client_id, name, email, is_active, created_at, updated_at')
      .single()

    if (error) {
      if (error.code === '23505') {
        return fail('This email is already saved for this client.', 409)
      }
      return fail(error.message, 400)
    }

    return ok({ contact: data }, 201)
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Failed to save contact', 500)
  }
}
