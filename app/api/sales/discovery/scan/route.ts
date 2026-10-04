import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { runBusinessDiscoveryAgent } from '@/lib/sales/agents/businessDiscoveryAgent'
import { discoveryScanBodySchema } from '@/lib/sales/validators'
import { assertJsonContentLength } from '@/lib/security/httpRequestLimits'


export const maxDuration = 60

const LOG_PREFIX = '[businessDiscovery]'

function routeErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return fallback
}

export async function POST(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    assertJsonContentLength(request, 16_384)
    const body = await request.json()
    const { postcodes, refreshFromGoogle } = discoveryScanBodySchema.parse(body)
    console.info(`${LOG_PREFIX} POST /api/sales/discovery/scan`, {
      handler: 'app/api/sales/discovery/scan/route.ts POST',
      next: 'runBusinessDiscoveryAgent',
      postcodes,
      refreshFromGoogle: Boolean(refreshFromGoogle),
    })
    const result = await runBusinessDiscoveryAgent(auth.supabase, {
      postcodes,
      createdBy: auth.userId,
      refreshFromGoogle: refreshFromGoogle === true,
    })
    return ok(result)
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(routeErrorMessage(error, 'Scan failed'), 500)
  }
}
