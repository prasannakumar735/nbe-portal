import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { runSalesAssistant } from '@/lib/sales/assistant/salesAssistantService'
import { runSalesAssistantBodySchema } from '@/lib/sales/validators/salesAssistant.validators'
import { assertJsonContentLength } from '@/lib/security/httpRequestLimits'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    assertJsonContentLength(request, 64_000)
    const body = await request.json()
    const parsed = runSalesAssistantBodySchema.parse(body)
    const result = await runSalesAssistant(auth.supabase, {
      capability: parsed.capability,
      businessId: parsed.businessId,
      contactId: parsed.contactId,
      campaignId: parsed.campaignId,
      opportunityId: parsed.opportunityId,
      replyText: parsed.replyText,
      managerNotes: parsed.managerNotes,
      provider: parsed.provider,
    })
    return ok({ run: result })
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Assistant run failed', 500)
  }
}
