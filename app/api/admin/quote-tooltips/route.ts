import { NextRequest } from 'next/server'
import { requireManagerOrAdminApi, ok, fail } from '@/app/api/admin/_utils'

export async function GET(request: NextRequest) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  const { data, error } = await auth.supabase
    .from('quote_field_tooltips')
    .select('field_key, label, tooltip_text')
    .order('label')

  if (error) return fail(error.message, 500)
  return ok(data ?? [])
}
