import { ZodError } from 'zod'
import { fail, ok, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { processSalesJobs } from '@/lib/sales/jobs/jobProcessor'
import { processSalesJobsBodySchema } from '@/lib/sales/validators'
import { assertJsonContentLength } from '@/lib/security/httpRequestLimits'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    assertJsonContentLength(request, 16_384)
    const body = await request.json().catch(() => ({}))
    const parsed = processSalesJobsBodySchema.parse(body)
    const results = await processSalesJobs(auth.supabase, {
      jobIds: parsed.jobIds,
      limit: parsed.limit,
      retryFailed: parsed.retryFailed,
      maxAttempts: parsed.maxAttempts,
    })
    return ok({ results })
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    return fail(error instanceof Error ? error.message : 'Job processing failed', 500)
  }
}
