import { NextResponse } from 'next/server'
import { ZodError, z } from 'zod'
import { fail, requireManagerOrAdminApi } from '@/app/api/admin/_utils'
import { syncCampaignEngagementFromDeliveryArtifacts } from '@/lib/sales/engagement/syncDeliveryEngagement'
import { dispatchFollowupQueue } from '@/lib/sales/followup/followupQueueDispatcher'
import { processSalesJobs } from '@/lib/sales/jobs/jobProcessor'
import { runMailboxDeltaSyncPage } from '@/lib/sales/replies/mailboxDeltaSyncService'
import { listSalesEmailSendQueue } from '@/lib/sales/repositories/salesEmailSendQueueRepository'
import { dispatchEmailSendQueue } from '@/lib/sales/sending/emailSendQueueDispatcher'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'




function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  return 'Job failed'
}

const runJobBodySchema = z.object({
  job: z.enum([
    'email-send',
    'followup-dispatch',
    'jobs',
    'engagement-sync',
    'inbound-mail-sync',
    'all',
  ]),
})

async function runEngagementSync(supabase: ReturnType<typeof createServiceRoleClient>) {
  const queues = await listSalesEmailSendQueue(supabase, { limit: 500 })
  const campaignIds = [...new Set(queues.map((q) => q.campaign_id))]
  const results: Record<string, Awaited<ReturnType<typeof syncCampaignEngagementFromDeliveryArtifacts>>> =
    {}
  for (const id of campaignIds) {
    results[id] = await syncCampaignEngagementFromDeliveryArtifacts(supabase, id)
  }
  return { campaigns: campaignIds.length, results }
}

async function runJob(
  supabase: ReturnType<typeof createServiceRoleClient>,
  job: z.infer<typeof runJobBodySchema>['job'],
): Promise<unknown> {
  switch (job) {
    case 'email-send':
      return dispatchEmailSendQueue(supabase)
    case 'followup-dispatch':
      return dispatchFollowupQueue(supabase)
    case 'jobs':
      return processSalesJobs(supabase)
    case 'engagement-sync':
      return runEngagementSync(supabase)
    case 'inbound-mail-sync':
      return runMailboxDeltaSyncPage(supabase)
    case 'all': {
      const emailSend = await dispatchEmailSendQueue(supabase)
      const followup = await dispatchFollowupQueue(supabase)
      const jobs = await processSalesJobs(supabase)
      const engagement = await runEngagementSync(supabase)
      const inbound = await runMailboxDeltaSyncPage(supabase)
      return { emailSend, followup, jobs, engagement, inbound }
    }
    default: {
      const _exhaustive: never = job
      throw new Error(`Unknown job: ${_exhaustive}`)
    }
  }
}

export async function POST(request: Request) {
  const auth = await requireManagerOrAdminApi(request)
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const { job } = runJobBodySchema.parse(body)
    const supabase = createServiceRoleClient()
    const result = await runJob(supabase, job)
    return NextResponse.json({ ok: true, result })
  } catch (error) {
    if (error instanceof ZodError) {
      return fail('Validation failed', 422, error.issues)
    }
    const message = toErrorMessage(error)
    console.error('[run-jobs] error:', message, error)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
