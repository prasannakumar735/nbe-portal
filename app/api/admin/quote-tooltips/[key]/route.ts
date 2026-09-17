import { NextRequest } from 'next/server'
import { requireManagerOrAdminApi, ok, fail } from '@/app/api/admin/_utils'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  const { key } = await params
  const body = await request.json().catch(() => null)
  if (!body?.tooltip_text) return fail('tooltip_text required', 400)

  const { error } = await auth.supabase
    .from('quote_field_tooltips')
    .update({ tooltip_text: body.tooltip_text, updated_at: new Date().toISOString() })
    .eq('field_key', key)

  if (error) return fail(error.message, 500)
  return ok({ updated: key })
}
