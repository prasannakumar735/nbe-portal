import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { runContactDiscoveryAgent } from '@/lib/sales/agents/contactDiscoveryAgent'
import { contactDiscoveryRequestSchema } from '@/lib/sales/validators'
import { assertJsonContentLength } from '@/lib/security/httpRequestLimits'


export const maxDuration = 60

export async function POST(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    assertJsonContentLength(request, 16_384)
    const body = await request.json()
    const { businessIds, processImmediately } = contactDiscoveryRequestSchema.parse(body)
    const result = await runContactDiscoveryAgent(auth.supabase, {
      businessIds,
      createdBy: auth.userId,
      processImmediately,
    })
    return ok(result)
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Contact discovery failed', 500)
  }
}
