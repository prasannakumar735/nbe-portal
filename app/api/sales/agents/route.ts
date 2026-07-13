import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import {
  dispatchSalesAgent,
  getSalesAgentStatusBoard,
} from '@/lib/sales/agents/runtime/agentDispatchService'
import { listSalesAgentDefinitions } from '@/lib/sales/agents/runtime/salesAgentRegistry'
import { listRecentSalesAgentRuns } from '@/lib/sales/repositories/salesAgentRunRepository'
import { dispatchSalesAgentBodySchema } from '@/lib/sales/validators/salesAgent.validators'
import { assertJsonContentLength } from '@/lib/security/httpRequestLimits'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const runsLimit = Number(searchParams.get('runsLimit') ?? '20')
    const [agents, status, recentRuns] = await Promise.all([
      Promise.resolve(listSalesAgentDefinitions()),
      getSalesAgentStatusBoard(auth.supabase),
      listRecentSalesAgentRuns(auth.supabase, {
        limit: Number.isFinite(runsLimit) ? runsLimit : 20,
      }),
    ])
    return ok({ agents, status, recentRuns })
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to load agents', 500)
  }
}

export async function POST(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    assertJsonContentLength(request, 8_192)
    const body = await request.json()
    const parsed = dispatchSalesAgentBodySchema.parse(body)
    const result = await dispatchSalesAgent(auth.supabase, parsed.agentId, {
      limit: parsed.limit,
      jobIds: parsed.jobIds,
      queueIds: parsed.queueIds,
      retryFailed: parsed.retryFailed,
      maxAttempts: parsed.maxAttempts,
    })
    return ok({ dispatch: result })
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Agent dispatch failed', 500)
  }
}
