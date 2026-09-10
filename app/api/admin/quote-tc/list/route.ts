import { NextRequest } from 'next/server'
import { requireManagerOrAdminApi, ok, fail } from '@/app/api/admin/_utils'

export async function GET(request: NextRequest) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  const { data, error } = await auth.supabase
    .from('quote_tc_documents')
    .select('quote_type, end_user_type, file_name, uploaded_at, storage_path')
    .order('uploaded_at', { ascending: false })

  if (error) return fail(error.message, 500)

  return ok(data ?? [])
}
