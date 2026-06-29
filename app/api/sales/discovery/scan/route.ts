import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { runBusinessDiscoveryAgent } from '@/lib/sales/agents/businessDiscoveryAgent'
import { discoveryScanBodySchema } from '@/lib/sales/validators'
import { assertJsonContentLength } from '@/lib/security/httpRequestLimits'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    assertJsonContentLength(request, 16_384)
    const body = await request.json()
    const { postcodes } = discoveryScanBodySchema.parse(body)
    const result = await runBusinessDiscoveryAgent(auth.supabase, {
      postcodes,
      createdBy: auth.userId,
    })
    return ok(result)
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Scan failed', 500)
  }
}
