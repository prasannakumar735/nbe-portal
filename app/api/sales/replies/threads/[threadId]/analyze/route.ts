import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { runReplyAnalysis } from '@/lib/sales/replies/replyAnalysisService'
import {
  analyzeReplyThreadBodySchema,
  salesEmailThreadIdParamSchema,
} from '@/lib/sales/validators/replyManagement.validators'
import { assertJsonContentLength } from '@/lib/security/httpRequestLimits'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ threadId: string }> }

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const { threadId } = salesEmailThreadIdParamSchema.parse(await context.params)
    assertJsonContentLength(request, 8_192)
    const body = await request.json().catch(() => ({}))
    const parsed = analyzeReplyThreadBodySchema.parse(body)

    const result = await runReplyAnalysis(auth.supabase, {
      threadId,
      messageId: parsed.messageId,
      provider: parsed.provider,
      forceNewVersion: true,
    })

    return ok({
      analysis: result.analysis,
      created: result.created,
      skippedDuplicate: result.skippedDuplicate,
      provider: result.provider,
      latencyMs: result.latencyMs,
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Reply analysis failed', 500)
  }
}
