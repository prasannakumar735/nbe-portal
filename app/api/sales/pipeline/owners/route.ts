import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { listPipelineOwnerOptions } from '@/lib/sales/pipeline/pipelineService'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const owners = await listPipelineOwnerOptions(auth.supabase)
    return ok({ owners })
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to load owners', 500)
  }
}
